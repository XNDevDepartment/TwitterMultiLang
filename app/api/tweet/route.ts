import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiConfig, getAccounts, getOAuthAccountForLanguage, updateOAuthAccount } from '@/lib/config'
import { getTwitterClient, postTweet, uploadImages, getOAuth2Client } from '@/lib/twitter'

export async function POST(req: NextRequest) {
  try {
    const { languageCode, text, images, tweetType, referencedTweetId } = await req.json()

    if (!languageCode || !text) {
      return NextResponse.json({ error: 'languageCode and text are required' }, { status: 400 })
    }

    const hasImages = images && images.length > 0

    // Build tweet payload params
    const params = {
      text,
      ...(tweetType === 'quote' && referencedTweetId ? { quoteId: referencedTweetId } : {}),
      ...(tweetType === 'reply' && referencedTweetId ? { replyToId: referencedTweetId } : {}),
    }

    const apiConfig = getTwitterApiConfig()
    const legacyAccounts = apiConfig.apiKey ? await getAccounts() : []
    const legacyAccount = legacyAccounts.find((a) => a.languageCode === languageCode)

    // ── When images are attached, prefer Legacy (OAuth 1.0a) which supports media upload
    if (hasImages && legacyAccount) {
      const client = getTwitterClient(legacyAccount, apiConfig)
      const mediaIds = await uploadImages(client, images)
      const tweetId = await postTweet(client, { ...params, mediaIds })
      const tweetUrl = `https://x.com/${legacyAccount.handle.replace('@', '')}/status/${tweetId}`
      return NextResponse.json({ tweetId, tweetUrl })
    }

    // ── Try OAuth 2.0 account ─────────────────────────────────────────────────
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

      const warning = hasImages
        ? 'Images were skipped — add a Legacy account for this language to include images'
        : undefined

      const tweetId = await postTweet(client, params)
      const tweetUrl = `https://x.com/${refreshedAccount.username}/status/${tweetId}`
      return NextResponse.json({ tweetId, tweetUrl, warning })
    }

    // ── Fall back to Legacy account (text-only) ───────────────────────────────
    if (!legacyAccount) {
      return NextResponse.json(
        { error: `No account configured for language: ${languageCode}` },
        { status: 400 }
      )
    }

    const client = getTwitterClient(legacyAccount, apiConfig)
    let mediaIds: string[] | undefined
    if (hasImages) {
      mediaIds = await uploadImages(client, images)
    }
    const tweetId = await postTweet(client, { ...params, mediaIds })
    const tweetUrl = `https://x.com/${legacyAccount.handle.replace('@', '')}/status/${tweetId}`
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
