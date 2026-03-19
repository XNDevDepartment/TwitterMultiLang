import { NextRequest, NextResponse } from 'next/server'
import { updateOAuthAccount, deleteOAuthAccount } from '@/lib/config'
import type { OAuthAccount } from '@/types'

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { languageCode } = await req.json()
    const accounts = await updateOAuthAccount(params.id, {
      languageCode: languageCode ?? null,
    })
    return NextResponse.json(accounts.map(safeAccount))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accounts = await deleteOAuthAccount(params.id)
    return NextResponse.json(accounts.map(safeAccount))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
