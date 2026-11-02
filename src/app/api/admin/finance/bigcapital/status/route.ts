import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Configuration inspection only. NEVER call an unknown external endpoint or
 * expose credentials from this route. An API token being present does not prove
 * the Bigcapital installation is reachable, authenticated or usable.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId || request.headers.get('x-authenticated-role') !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawUrl = process.env.BIGCAPITAL_BASE_URL?.trim() ?? '';
    const apiKeyConfigured = Boolean(process.env.BIGCAPITAL_API_KEY?.trim());
    let validUrl = false;
    if (rawUrl) {
      try {
        const url = new URL(rawUrl);
        validUrl = url.protocol === 'https:' && Boolean(url.hostname) &&
          !url.username && !url.password && !url.search && !url.hash;
      } catch { validUrl = false; }
    }
    return NextResponse.json({
      success: true,
      provider: 'BIGCAPITAL',
      status: validUrl && apiKeyConfigured ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED',
      baseUrlConfigured: validUrl,
      apiKeyConfigured,
      connectivityTested: false,
      authenticated: false,
      generalLedgerConnected: false,
      postingEnabled: false,
      note: 'Configuration check only. Deploy Bigcapital and validate API authentication before syncing or posting financial records.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Bigcapital configuration inspection error:',
      error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Configuration status unavailable' }, { status: 500 });
  }
}
