import { TwitterApi } from 'twitter-api-v2'
import type { AccountMapping, TwitterApiConfig, FetchedTweet, PostTweetParams } from '@/types'

function decodeToken(token: string): string {
  try {
    return decodeURIComponent(token)
  } catch {
    return token
  }
}

export function getTwitterClient(
  account: AccountMapping,
  apiConfig: TwitterApiConfig
): TwitterApi {
  return new TwitterApi({
    appKey: decodeToken(apiConfig.apiKey),
    appSecret: decodeToken(apiConfig.apiSecret),
    accessToken: decodeToken(account.accessToken),
    accessSecret: decodeToken(account.accessTokenSecret),
  })
}

export async function postTweet(
  client: TwitterApi,
  params: PostTweetParams
): Promise<string> {
  const payload: Record<string, unknown> = { text: params.text }

  if (params.quoteId) {
    payload.quote_tweet_id = params.quoteId
  }

  if (params.replyToId) {
    payload.reply = { in_reply_to_tweet_id: params.replyToId }
  }

  if (params.mediaIds && params.mediaIds.length > 0) {
    payload.media = { media_ids: params.mediaIds }
  }

  const response = await client.v2.tweet(payload as Parameters<typeof client.v2.tweet>[0])
  return response.data.id
}

export async function uploadImages(
  client: TwitterApi,
  base64Images: string[]
): Promise<string[]> {
  const mediaIds: string[] = []
  for (const base64 of base64Images) {
    // Strip data URL prefix if present
    const data = base64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(data, 'base64')
    const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' })
    mediaIds.push(mediaId)
  }
  return mediaIds
}

export async function fetchTweetById(
  bearerToken: string,
  tweetId: string
): Promise<FetchedTweet> {
  const client = new TwitterApi(decodeToken(bearerToken))
  const tweet = await client.v2.singleTweet(tweetId, {
    expansions: ['author_id'],
    'tweet.fields': ['text'],
    'user.fields': ['name', 'username'],
  })

  const author = tweet.includes?.users?.[0]

  return {
    id: tweet.data.id,
    text: tweet.data.text,
    authorHandle: author ? `@${author.username}` : '',
    authorName: author?.name ?? '',
  }
}

export function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/)
  return match ? match[1] : null
}
