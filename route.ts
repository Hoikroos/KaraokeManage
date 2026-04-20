import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    // Region hiện tại mà Function đang thực thi (ví dụ: sin1, hnd1, iad1...)
    vercel_region: process.env.VERCEL_REGION || 'localhost',
    node_env: process.env.NODE_ENV,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString(),
  });
}