import { NextResponse } from 'next/server';
import { googleReady } from '@/lib/google-oauth';

export async function GET() {
  return NextResponse.json({ enabled: googleReady() }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
