import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { generateWeeklyCommissionReport } from '@/lib/hv-weekly-commission-generator';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24)
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 });
  const bearer = request.headers.get('authorization') || '';
  const expected = 'Bearer ' + secret;
  const a = Buffer.from(bearer), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await generateWeeklyCommissionReport(undefined, null);
    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Weekly COD report cron failed', error);
    return NextResponse.json({ error: 'Weekly report generation failed' }, { status: 500 });
  }
}
