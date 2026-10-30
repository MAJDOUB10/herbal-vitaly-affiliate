import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getShopifyProducts } from '@/lib/hv-shopify-discounts';

export async function GET(request: NextRequest) {
  const id = request.headers.get('x-user-id');
  if (!id || request.headers.get('x-authenticated-role') !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await prisma.user.findUnique({ where: { id },
    select: { role: true, status: true } });
  if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const products = await getShopifyProducts();
    return NextResponse.json({ success: true, products }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({
      error: 'Shopify products unavailable. Configure SHOPIFY_ADMIN_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN in Vercel Preview.',
    }, { status: 503 });
  }
}
