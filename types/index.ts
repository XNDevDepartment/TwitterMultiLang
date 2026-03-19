export interface TwitterApiConfig {
  apiKey: string
  apiSecret: string
  bearerToken: string
}

export interface AccountMapping {
  id: string
  languageCode: string // e.g. "pt-BR"
  handle: string // display only, e.g. "@myaccount_br"
  accessToken: string
  accessTokenSecret: string
}

export type PublishStatus = 'idle' | 'pending' | 'success' | 'error'
export type InputMode = 'new' | 'url'
export type TweetType = 'quote' | 'reply'

export interface TranslationEntry {
  languageCode: string
  texts: string[]       // one entry per thread block
  enabled: boolean
  status: PublishStatus
  errorMessage?: string
}

export interface FetchedTweet {
  id: string
  text: string
  authorHandle: string
  authorName: string
}

export interface PostTweetParams {
  text: string
  quoteId?: string
  replyToId?: string
  mediaIds?: string[]
}

export interface OAuthAccount {
  id: string
  x_user_id: string
  username: string        // without @
  languageCode: string | null  // null = unassigned
  access_token: string
  refresh_token: string
  expires_at: number      // ms since epoch
  created_at: number
}

export const SUPPORTED_LANGUAGES: {
  code: string
  googleCode: string
  label: string
  flag: string
}[] = [
  { code: 'pt', googleCode: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'en', googleCode: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', googleCode: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', googleCode: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'it', googleCode: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'zh-CN', googleCode: 'zh-CN', label: 'Chinese Simplified', flag: '🇨🇳' },
  { code: 'ja', googleCode: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'pl', googleCode: 'pl', label: 'Polish', flag: '🇵🇱' },
  { code: 'no', googleCode: 'no', label: 'Norwegian', flag: '🇳🇴' },
  { code: 'sv', googleCode: 'sv', label: 'Swedish', flag: '🇸🇪' },
  { code: 'de-AT', googleCode: 'de', label: 'Austrian German', flag: '🇦🇹' },
  { code: 'es', googleCode: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'pt-BR', googleCode: 'pt', label: 'Brazilian Portuguese', flag: '🇧🇷' },
  { code: 'ar', googleCode: 'ar', label: 'Arabic', flag: '🇸🇦' },
]
