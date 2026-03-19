import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiConfig, getAccounts, getOAuthAccountForLanguage, updateOAuthAccount } from '@/lib/config'
import { getTwitterClient, postTweet, uploadImages, getOAuth2Client } from '@/lib/twitter'

export async function POST(req: NextRequest) {
  try {
    const { languageCode, texts, images, tweetType, referencedTweetId } = await req.json()

    if (!languageCode || !texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'languageCode and texts are required' }, { status: 400 })
    }

    const hasImages = images && images.length > 0

    const apiConfig = getTwitterApiConfig()
    const legacyAccounts = apiConfig.apiKey ? await getAccounts() : []
    const legacyAccount = legacyAccounts.find((a) => a.languageCode === languageCode)

    // ── When images are attached, prefer Legacy (OAuth 1.0a) which supports media upload
    if (hasImages && legacyAccount) {
      const client = getTwitterClient(legacyAccount, apiConfig)
      const mediaIds = await uploadImages(client, images)
      const tweetIds = await postThread(
        (params) => postTweet(client, params),
        texts,
        mediaIds,
        tweetType,
        referencedTweetId
      )
      const tweetUrl = `https://x.com/${legacyAccount.handle.replace('@', '')}/status/${tweetIds[0]}`
      return NextResponse.json({ tweetId: tweetIds[0], tweetUrl })
    }

    // ── Try OAuth 2.0 account ─────────────────────────────────────────────────
    const oauthAccount = await getOAuthAccountForLanguage(languageCode)
    if (oauthAccount) {
      const { client, account: refreshedAccount } = await getOAuth2Client(oauthAccount)

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

      const tweetIds = await postThread(
        (params) => postTweet(client, params),
        texts,
        undefined,
        tweetType,
        referencedTweetId
      )
      const tweetUrl = `https://x.com/${refreshedAccount.username}/status/${tweetIds[0]}`
      return NextResponse.json({ tweetId: tweetIds[0], tweetUrl, warning })
    }

    // ── Fall back to Legacy account ───────────────────────────────────────────
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
    const tweetIds = await postThread(
      (params) => postTweet(client, params),
      texts,
      mediaIds,
      tweetType,
      referencedTweetId
    )
    const tweetUrl = `https://x.com/${legacyAccount.handle.replace('@', '')}/status/${tweetIds[0]}`
    return NextResponse.json({ tweetId: tweetIds[0], tweetUrl })

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

// Posts a sequence of tweets as a thread. Returns IDs in order.
// Images attach to the first tweet only.
async function postThread(
  poster: (params: { text: string; quoteId?: string; replyToId?: string; mediaIds?: string[] }) => Promise<string>,
  texts: string[],
  mediaIds: string[] | undefined,
  tweetType: string,
  referencedTweetId: string | undefined
): Promise<string[]> {
  const ids: string[] = []

  for (let i = 0; i < texts.length; i++) {
    const isFirst = i === 0
    const params: { text: string; quoteId?: string; replyToId?: string; mediaIds?: string[] } = {
      text: texts[i],
      ...(isFirst && mediaIds ? { mediaIds } : {}),
      ...(isFirst && tweetType === 'quote' && referencedTweetId ? { quoteId: referencedTweetId } : {}),
      ...(isFirst && tweetType === 'reply' && referencedTweetId ? { replyToId: referencedTweetId } : {}),
      ...(!isFirst ? { replyToId: ids[i - 1] } : {}),
    }
    const id = await poster(params)
    ids.push(id)
  }

  return ids
}
