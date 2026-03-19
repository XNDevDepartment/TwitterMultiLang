import { NextRequest, NextResponse } from 'next/server'
import { getAccounts, upsertAccount, deleteAccount, maskSecret } from '@/lib/config'
import type { AccountMapping } from '@/types'
import { randomUUID } from 'crypto'

function maskAccount(account: AccountMapping) {
  return {
    ...account,
    accessToken: maskSecret(account.accessToken),
    accessTokenSecret: maskSecret(account.accessTokenSecret),
  }
}

export async function GET() {
  const accounts = getAccounts()
  return NextResponse.json(accounts.map(maskAccount))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const existing = getAccounts()
    const existingAccount = existing.find((a) => a.id === body.id)

    const account: AccountMapping = {
      id: body.id || randomUUID(),
      languageCode: body.languageCode,
      handle: body.handle,
      // If masked, preserve existing value
      accessToken:
        body.accessToken?.includes('****')
          ? existingAccount?.accessToken ?? ''
          : body.accessToken ?? '',
      accessTokenSecret:
        body.accessTokenSecret?.includes('****')
          ? existingAccount?.accessTokenSecret ?? ''
          : body.accessTokenSecret ?? '',
    }

    const accounts = upsertAccount(account)
    return NextResponse.json(accounts.map(maskAccount))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const accounts = deleteAccount(id)
    return NextResponse.json(accounts.map(maskAccount))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
