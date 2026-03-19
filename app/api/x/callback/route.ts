import { NextRequest, NextResponse } from 'next/server'
import { consumeOAuthState, upsertOAuthAccount } from '@/lib/config'
import { randomUUID } from 'crypto'
import type { OAuthAccount } from '@/types'

const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const X_USER_ME_URL = 'https://api.twitter.com/2/users/me'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const configUrl = `${appUrl}/config`

  if (error) {
    return NextResponse.redirect(`${configUrl}?oauth_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${configUrl}?oauth_error=missing_params`)
  }

  // Validate state and retrieve verifier (single-use)
  const verifier = await consumeOAuthState(state)
  if (!verifier) {
    return NextResponse.redirect(`${configUrl}?oauth_error=invalid_state`)
  }

  const clientId = process.env.TWITTER_CLIENT_ID!
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!
  const callbackUrl = `${appUrl}/api/x/callback`
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  // Exchange authorization code for tokens
  let tokenData: {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  try {
    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        code_verifier: verifier,
        client_id: clientId,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Token exchange failed:', body)
      return NextResponse.redirect(`${configUrl}?oauth_error=token_exchange_failed`)
    }

    tokenData = await tokenRes.json()
  } catch (err) {
    console.error('Token exchange error:', err)
    return NextResponse.redirect(`${configUrl}?oauth_error=token_exchange_failed`)
  }

  // Fetch the connected user's profile
  let x_user_id: string
  let username: string
  try {
    const meRes = await fetch(X_USER_ME_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!meRes.ok) {
      return NextResponse.redirect(`${configUrl}?oauth_error=user_fetch_failed`)
    }

    const meData = await meRes.json()
    x_user_id = meData.data.id
    username = meData.data.username
  } catch (err) {
    console.error('User fetch error:', err)
    return NextResponse.redirect(`${configUrl}?oauth_error=user_fetch_failed`)
  }

  // Persist the account (upsert by x_user_id to avoid duplicates)
  const account: OAuthAccount = {
    id: randomUUID(),
    x_user_id,
    username,
    languageCode: null,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + tokenData.expires_in * 1000,
    created_at: Date.now(),
  }

  await upsertOAuthAccount(account)

  return NextResponse.redirect(
    `${configUrl}?tab=oauth&connected=${encodeURIComponent(username)}`
  )
}
