import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiConfig, getAccounts } from '@/lib/config'
import { getTwitterClient, postTweet, uploadImages } from '@/lib/twitter'

export async function POST(req: NextRequest) {
  try {
    const { languageCode, text, images, tweetType, referencedTweetId } = await req.json()

    if (!languageCode || !text) {
      return NextResponse.json({ error: 'languageCode and text are required' }, { status: 400 })
    }

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

    const params = {
      text,
      mediaIds,
      ...(tweetType === 'quote' && referencedTweetId ? { quoteId: referencedTweetId } : {}),
      ...(tweetType === 'reply' && referencedTweetId ? { replyToId: referencedTweetId } : {}),
    }

    const tweetId = await postTweet(client, params)
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
