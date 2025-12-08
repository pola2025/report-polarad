export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'

  return NextResponse.json({
    supabaseUrl,
    urlContains: supabaseUrl.includes('mpljqcuqrrfwzamfyxnz') ? 'CORRECT' : 'WRONG',
    timestamp: new Date().toISOString()
  })
}
