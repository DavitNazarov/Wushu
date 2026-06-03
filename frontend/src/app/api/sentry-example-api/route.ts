import { NextResponse } from 'next/server';

export function GET() {
  throw new Error('Sentry example API route error');
  return NextResponse.json({ ok: true });
}
