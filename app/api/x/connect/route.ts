import { NextResponse } from 'next/server'
import { generateState, generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce'

const X_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const SCOPES = 'tweet.read users.read tweet.write offline.access'

export async function GET() {
  const clientId = process.env.TWITTER_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'TWITTER_CLIENT_ID is not configured' },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const callbackUrl = `${appUrl}/api/x/callback`

  const state = generateState()
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)

  // Embed verifier in state so it survives across serverless instances.
  // Twitter reflects the state value back unchanged; we extract it in the callback.
  const stateParam = `${state}.${verifier}`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: SCOPES,
    state: stateParam,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  return NextResponse.redirect(`${X_AUTH_URL}?${params.toString()}`)
}
