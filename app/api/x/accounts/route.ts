import { NextResponse } from 'next/server'
import { getOAuthAccounts } from '@/lib/config'
import type { OAuthAccount } from '@/types'

// Strip tokens before sending to browser
function safeAccount(a: OAuthAccount) {
  return {
    id: a.id,
    x_user_id: a.x_user_id,
    username: a.username,
    languageCode: a.languageCode,
    expires_at: a.expires_at,
    created_at: a.created_at,
  }
}

export async function GET() {
  const accounts = await getOAuthAccounts()
  return NextResponse.json(accounts.map(safeAccount))
}
