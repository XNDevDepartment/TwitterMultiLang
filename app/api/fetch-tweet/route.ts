import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiConfig } from '@/lib/config'
import { fetchTweetById, extractTweetId } from '@/lib/twitter'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url')
    if (!url) {
      return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
    }

    const tweetId = extractTweetId(url)
    if (!tweetId) {
      return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 })
    }

    const apiConfig = getTwitterApiConfig()
    if (!apiConfig.bearerToken) {
      return NextResponse.json({ error: 'Bearer token not configured' }, { status: 400 })
    }

    const tweet = await fetchTweetById(apiConfig.bearerToken, tweetId)
    return NextResponse.json(tweet)
  } catch (err: unknown) {
    const twitterErr = err as { code?: number; data?: { detail?: string; title?: string } }
    const message =
      twitterErr?.data?.detail ??
      twitterErr?.data?.title ??
      (err instanceof Error ? err.message : 'Failed to fetch tweet')
    const code = twitterErr?.code ?? 500
    return NextResponse.json({ error: message, code }, { status: 500 })
  }
}
