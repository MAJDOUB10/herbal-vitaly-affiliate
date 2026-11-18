import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyHvAttribution } from '@/lib/hv-shopify-attribution';
import { allowedStorefrontOrigin, validateVisitorEvent } from '@/lib/hv-visitor-policy';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_BYTES = 2500;
function cors(req: NextRequest): Record<string,string> {
  const origin = req.headers.get('origin');
  return allowedStorefrontOrigin(origin)
    ? { 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':origin!, Vary:'Origin' }
    : { 'Cache-Control':'no-store' };
}
export async function OPTIONS(req: NextRequest) {
  if (!allowedStorefrontOrigin(req.headers.get('origin')))
    return new NextResponse(null, {status:403});
  return new NextResponse(null, {status:204,headers:{
    ...cors(req), 'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Max-Age':'3600'
  }});
}
/** Anonymous analytical events only, never financial commission evidence. */
export async function POST(req: NextRequest) {
  const headers = cors(req);
  if (!allowedStorefrontOrigin(req.headers.get('origin')))
    return NextResponse.json({error:'Invalid storefront origin'},{status:403,headers});
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return NextResponse.json({error:'JSON required'},{status:415,headers});
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES)
    return NextResponse.json({error:'Payload too large'},{status:413,headers});
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    return NextResponse.json({error:'Payload too large'},{status:413,headers});
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return NextResponse.json({error:'Invalid JSON'},{status:400,headers}); }
  const event = validateVisitorEvent(parsed);
  if (!event)
    return NextResponse.json({error:'Invalid event or analytics consent'},{status:422,headers});
  const secret = process.env.HV_ATTRIBUTION_SECRET || process.env.JWT_SECRET;
  if (!secret)
    return NextResponse.json({error:'Tracking unavailable'},{status:503,headers});
  const signed = verifyHvAttribution(event.token,secret);
  if (!signed)
    return NextResponse.json({error:'Invalid attribution'},{status:403,headers});
  try {
    // Rate-limit a hashed, signed click key; no client IP is retained.
    const key = createHash('sha256').update(signed.attributionKey).digest('hex');
    const rate = await checkRateLimit(key,'hv-visitor-events',120,60_000);
    if (!rate.allowed)
      return NextResponse.json({error:'Too many events'},{status:429,headers});
    const affiliate = await prisma.affiliate.findUnique({
      where:{referralCode:signed.referralCode},
      select:{id:true,user:{select:{role:true,status:true,emailVerifiedAt:true}}}
    });
    if (!affiliate || affiliate.user.role !== 'AFFILIATE' ||
        affiliate.user.status !== 'ACTIVE' || !affiliate.user.emailVerifiedAt)
      return NextResponse.json({error:'Inactive affiliate'},{status:403,headers});
    // Signed token is only valid here if the /r redirect actually recorded the click.
    const referral = await prisma.referral.findFirst({
      where:{affiliateId:affiliate.id,metadata:{path:['attribution_key'],equals:signed.attributionKey}},
      select:{id:true}
    });
    if (!referral)
      return NextResponse.json({error:'Unknown referral click'},{status:403,headers});
    await prisma.hvVisitorEvent.create({data:{
      eventId:event.eventId, affiliateId:affiliate.id,
      attributionKey:signed.attributionKey, sessionId:event.sessionId,
      eventType:event.eventType, pagePath:event.pagePath,
      productHandle:event.productHandle, channel:event.channel
    }});
    return NextResponse.json({success:true},{status:201,headers});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return NextResponse.json({success:true,duplicate:true},{headers});
    return NextResponse.json({error:'Tracking unavailable'},{status:503,headers});
  }
}
