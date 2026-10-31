import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ugcAdmin, fail, textField, linkField, dateField, budget, enumField, payloadObject,
  UGC_STATUSES, UGC_KINDS, UGC_QUALIFICATION, UGC_ACCEPTANCE, UGC_CONTENT } from '@/lib/ugc-crm';

const toInput = (b: Record<string, unknown>) => ({
  externalId: textField(b.externalId, 40),
  name: textField(b.name, 160) || '',
  socialUrl: linkField(b.socialUrl),
  phone: textField(b.phone, 32),
  contactStatus: enumField(b.contactStatus, UGC_STATUSES, 'NEW'),
  acceptance: enumField(b.acceptance, UGC_ACCEPTANCE, 'PENDING'),
  qualification: enumField(b.qualification, UGC_QUALIFICATION, 'UNREVIEWED'),
  kind: enumField(b.kind, UGC_KINDS, 'UGC'),
  priority: (() => {
    const n = Number(b.priority == null ? 3 : b.priority);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error('Priority must be between 1 and 5');
    return n;
  })(),
  budgetEGP: budget(b.budgetEGP),
  contentUrl: linkField(b.contentUrl),
  product: textField(b.product, 300),
  videoConcept: textField(b.videoConcept, 300),
  contentStatus: enumField(b.contentStatus, UGC_CONTENT, 'IDEA'),
  notes: textField(b.notes, 3000),
  affiliateId: textField(b.affiliateId, 120),
  nextFollowUpAt: dateField(b.nextFollowUpAt),
});
async function checkAffiliate(id: string | null) {
  if (!id) return true;
  const found = await prisma.affiliate.findUnique({
    where: { id }, select: { user: { select: { status: true, emailVerifiedAt: true } } },
  });
  return !!found && found.user.status === 'ACTIVE' && !!found.user.emailVerifiedAt;
}
export async function GET(req: NextRequest) {
  if (!(await ugcAdmin(req))) return fail('Admin access required', 403);
  try {
    const [contacts, shipments] = await Promise.all([
      prisma.ugcContact.findMany({
        orderBy: { updatedAt: 'desc' }, take: 1000,
        include: { _count: { select: { shipments: true } } },
      }),
      prisma.ugcShipment.count(),
    ]);
    return NextResponse.json({
      success: true, contacts, totals: {
        contacts: contacts.length, shipments,
        accepted: contacts.filter(p => p.acceptance === 'YES').length,
        active: contacts.filter(p => ['IN_PROGRESS','PREPARING'].includes(p.contactStatus)).length,
        qualified: contacts.filter(p => p.qualification === 'QUALIFIED').length,
        budgetEGP: contacts.reduce((n,p) => n + (p.budgetEGP || 0), 0),
      }, limited: contacts.length === 1000,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return fail('CRM database unavailable or migration not applied', 503); }
}
export async function POST(req: NextRequest) {
  const admin = await ugcAdmin(req);
  if (!admin) return fail('Admin access required', 403);
  try {
    const b = payloadObject(await req.json());
    const data = toInput(b);
    if (!data.name) return fail('Partner name is required',422);
    if (!(await checkAffiliate(data.affiliateId))) return fail('Only approved affiliate accounts can be linked',422);
    const row = await prisma.ugcContact.create({ data });
    await prisma.ugcContactActivity.create({
      data: { contactId: row.id, actorId: admin.id, action: 'CREATED', details: 'Creator prospect created' },
    });
    return NextResponse.json({ success:true, contact:row }, { status:201 });
  } catch(e) {
    return fail(e instanceof Error && /unique constraint/i.test(e.message) ? 'Duplicate CRM reference' :
      e instanceof Error && /Invalid|Only public|Priority/i.test(e.message) ? e.message : 'Unable to create CRM contact',422);
  }
}
export async function PATCH(req: NextRequest) {
  const admin = await ugcAdmin(req);
  if (!admin) return fail('Admin access required', 403);
  try {
    const b=payloadObject(await req.json());
    const id=textField(b.id,120);
    if(!id) return fail('CRM contact ID required',422);
    const existing=await prisma.ugcContact.findUnique({where:{id}});
    if(!existing) return fail('CRM contact not found',404);
    const data=toInput({ ...existing, ...b });
    if(!data.name) return fail('Partner name required',422);
    if (!(await checkAffiliate(data.affiliateId))) return fail('Only approved affiliate accounts can be linked',422);
    const changed = Object.entries(data).filter(([k,v]) => {
      const prev = existing[k as keyof typeof existing];
      return (v instanceof Date ? v.toISOString() : v) !==
        (prev instanceof Date ? prev.toISOString() : prev);
    }).map(([k])=>k);
    const row=await prisma.ugcContact.update({where:{id},data});
    await prisma.ugcContactActivity.create({ data: {
      contactId:id,actorId:admin.id,action:'UPDATED',
      details:'Updated fields: '+changed.join(', ').slice(0,500),
    } });
    return NextResponse.json({success:true,contact:row});
  } catch(e) {return fail(e instanceof Error && /Invalid|Only public|Priority/i.test(e.message)?e.message:'Unable to update CRM contact',422)}
}
