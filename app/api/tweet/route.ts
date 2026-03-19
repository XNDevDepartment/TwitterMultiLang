import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiConfig, getAccounts, getOAuthAccountForLanguage, updateOAuthAccount } from '@/lib/config'
import { getTwitterClient, postTweet, uploadImages, getOAuth2Client } from '@/lib/twitter'

export async function POST(req: NextRequest) {
  try {
    const { languageCode, text, images, tweetType, referencedTweetId } = await req.json()

    if (!languageCode || !text) {
      return NextResponse.json({ error: 'languageCode and text are required' }, { status: 400 })
    }

    // Build tweet payload params
    const params = {
      text,
      ...(tweetType === 'quote' && referencedTweetId ? { quoteId: referencedTweetId } : {}),
      ...(tweetType === 'reply' && referencedTweetId ? { replyToId: referencedTweetId } : {}),
    }

    // ── Try OAuth 2.0 account first ──────────────────────────────────────────
    const oauthAccount = await getOAuthAccountForLanguage(languageCode)
    if (oauthAccount) {
      const { client, account: refreshedAccount } = await getOAuth2Client(oauthAccount)

      // Persist refreshed tokens if they changed
      if (refreshedAccount.access_token !== oauthAccount.access_token) {
        await updateOAuthAccount(oauthAccount.id, {
          access_token: refreshedAccount.access_token,
          refresh_token: refreshedAccount.refresh_token,
          expires_at: refreshedAccount.expires_at,
        })
      }

      let mediaIds: string[] | undefined
      if (images && images.length > 0) {
        // Media upload requires OAuth 1.0a; skip silently for OAuth 2.0 accounts
        // (Twitter v1 upload endpoint does not accept OAuth 2.0 user tokens)
        console.warn('Image upload skipped: OAuth 2.0 accounts do not support media upload via v1 API')
      }

      const tweetPayload = { ...params, mediaIds }
      const tweetId = await postTweet(client, tweetPayload)
      const tweetUrl = `https://x.com/${refreshedAccount.username}/status/${tweetId}`
      return NextResponse.json({ tweetId, tweetUrl })
    }

    // ── Fall back to OAuth 1.0a account ──────────────────────────────────────
    const apiConfig = getTwitterApiConfig()
    if (!apiConfig.apiKey) {
      return NextResponse.json({ error: 'Twitter API credentials not configured' }, { status: 400 })
    }

    const accounts = await getAccounts()
    const account = accounts.find((a) => a.languageCode === languageCode)
    if (!account) {
      return NextResponse.json(
        { error: `No account configured for language: ${languageCode}` },
        { status: 400 }
      )
    }

    const client = getTwitterClient(account, apiConfig)

    let mediaIds: string[] | undefined
    if (images && images.length > 0) {
      mediaIds = await uploadImages(client, images)
    }

    const tweetId = await postTweet(client, { ...params, mediaIds })
    const tweetUrl = `https://x.com/${account.handle.replace('@', '')}/status/${tweetId}`
    return NextResponse.json({ tweetId, tweetUrl })

  } catch (err: unknown) {
    const twitterErr = err as { code?: number; data?: { detail?: string; title?: string } }
    const message =
      twitterErr?.data?.detail ??
      twitterErr?.data?.title ??
      (err instanceof Error ? err.message : 'Failed to post tweet')
    const code = twitterErr?.code ?? 500
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}
