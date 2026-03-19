'use client'

import { useState, useEffect, useRef } from 'react'
import { SUPPORTED_LANGUAGES } from '@/types'
import type {
  TranslationEntry,
  InputMode,
  TweetType,
  FetchedTweet,
  AccountMapping,
  OAuthAccount,
} from '@/types'

const MAX_TWEET_LENGTH = 280

export default function ComposerPage() {
  const [inputMode, setInputMode] = useState<InputMode>('new')
  const [tweetUrl, setTweetUrl] = useState('')
  const [tweetType, setTweetType] = useState<TweetType>('quote')
  const [fetchedTweet, setFetchedTweet] = useState<FetchedTweet | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const [composedText, setComposedText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [translations, setTranslations] = useState<TranslationEntry[]>([])
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState('')

  const [configuredAccounts, setConfiguredAccounts] = useState<AccountMapping[]>([])
  const [oauthAccounts, setOauthAccounts] = useState<Omit<OAuthAccount, 'access_token' | 'refresh_token'>[]>([])
  const [publishing, setPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/config/accounts')
      .then((r) => r.json())
      .then((accounts: AccountMapping[]) => setConfiguredAccounts(accounts))
      .catch(() => {})
    fetch('/api/x/accounts')
      .then((r) => r.json())
      .then(setOauthAccounts)
      .catch(() => {})
  }, [])

  function hasAccount(langCode: string) {
    return (
      oauthAccounts.some((a) => a.languageCode === langCode) ||
      configuredAccounts.some((a) => a.languageCode === langCode)
    )
  }

  function getAccountBadge(langCode: string): { label: string; type: 'oauth2' | 'legacy' } | null {
    if (oauthAccounts.some((a) => a.languageCode === langCode)) return { label: 'OAuth 2.0', type: 'oauth2' }
    if (configuredAccounts.some((a) => a.languageCode === langCode)) return { label: 'Legacy', type: 'legacy' }
    return null
  }

  async function handleFetchTweet() {
    setFetchError('')
    setFetchLoading(true)
    try {
      const res = await fetch(`/api/fetch-tweet?url=${encodeURIComponent(tweetUrl)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFetchedTweet(data)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch tweet')
    } finally {
      setFetchLoading(false)
    }
  }

  async function handleTranslate() {
    if (!composedText.trim()) return
    setTranslating(true)
    setTranslationError('')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: composedText,
          targetLanguages: SUPPORTED_LANGUAGES.map((l) => l.code),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const entries: TranslationEntry[] = SUPPORTED_LANGUAGES.map((lang) => ({
        languageCode: lang.code,
        text: data.translations[lang.code] ?? '',
        enabled: hasAccount(lang.code),
        status: 'idle',
      }))
      setTranslations(entries)
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  function updateTranslation(index: number, field: 'text' | 'enabled', value: string | boolean) {
    setTranslations((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (images.length + files.length > 4) {
      alert('Maximum 4 images per tweet')
      return
    }
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  async function handlePublishAll() {
    const enabled = translations.filter((t) => t.enabled && t.text.trim())
    if (enabled.length === 0) return

    setPublishing(true)

    for (const entry of enabled) {
      setTranslations((prev) =>
        prev.map((t) =>
          t.languageCode === entry.languageCode ? { ...t, status: 'pending' } : t
        )
      )

      try {
        const res = await fetch('/api/tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            languageCode: entry.languageCode,
            text: entry.text,
            images: images.length > 0 ? images : undefined,
            tweetType: inputMode === 'url' ? tweetType : 'new',
            referencedTweetId:
              inputMode === 'url' && fetchedTweet ? fetchedTweet.id : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        setTranslations((prev) =>
          prev.map((t) =>
            t.languageCode === entry.languageCode ? { ...t, status: 'success' } : t
          )
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed'
        setTranslations((prev) =>
          prev.map((t) =>
            t.languageCode === entry.languageCode
              ? { ...t, status: 'error', errorMessage: msg }
              : t
          )
        )
      }
    }

    setPublishing(false)
  }

  const langMeta = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)
  const enabledCount = translations.filter((t) => t.enabled).length

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputMode('new')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'new'
              ? 'btn-gradient'
              : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          New Tweet
        </button>
        <button
          onClick={() => setInputMode('url')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'url'
              ? 'btn-gradient'
              : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          From URL
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Compose */}
        <div className="glass-card p-5 space-y-4 animate-slide-up">
          <h2 className="font-semibold text-slate-200">Compose</h2>

          {inputMode === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tweet URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchTweet()}
                    placeholder="https://x.com/user/status/123..."
                    className="input-dark flex-1 text-sm"
                  />
                  <button
                    onClick={handleFetchTweet}
                    disabled={!tweetUrl || fetchLoading}
                    className="btn-gradient px-3 py-2 text-sm"
                  >
                    {fetchLoading ? '...' : 'Load'}
                  </button>
                </div>
                {fetchError && <p className="text-red-400 text-xs mt-1">{fetchError}</p>}
              </div>

              {fetchedTweet && (
                <div className="bg-white/5 rounded-xl p-3 text-sm space-y-1 border border-white/10">
                  <p className="font-medium text-slate-300">
                    {fetchedTweet.authorName}{' '}
                    <span className="text-slate-500 font-normal">{fetchedTweet.authorHandle}</span>
                  </p>
                  <p className="text-slate-400 text-xs">{fetchedTweet.text}</p>
                </div>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="radio"
                    name="tweetType"
                    value="quote"
                    checked={tweetType === 'quote'}
                    onChange={() => setTweetType('quote')}
                    className="text-violet-500"
                  />
                  Quote Tweet
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="radio"
                    name="tweetType"
                    value="reply"
                    checked={tweetType === 'reply'}
                    onChange={() => setTweetType('reply')}
                    className="text-violet-500"
                  />
                  Reply
                </label>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-slate-400">Text</label>
              <span
                className={`text-xs ${
                  composedText.length > MAX_TWEET_LENGTH ? 'text-red-400' : 'text-slate-500'
                }`}
              >
                {composedText.length}/{MAX_TWEET_LENGTH}
              </span>
            </div>
            <textarea
              value={composedText}
              onChange={(e) => setComposedText(e.target.value)}
              rows={5}
              className="input-dark text-sm resize-none"
              placeholder="What's happening?"
            />
          </div>

          {/* Image upload */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4}
              className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              📎 Attach image ({images.length}/4)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            {images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg border border-white/10"
                    />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center hover:bg-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleTranslate}
            disabled={!composedText.trim() || translating}
            className="btn-gradient w-full py-2 text-sm"
          >
            {translating ? 'Translating...' : '→ Translate'}
          </button>
          {translationError && <p className="text-red-400 text-xs">{translationError}</p>}
        </div>

        {/* Right: Translations */}
        <div className="glass-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Translations</h2>
            {translations.length > 0 && (
              <button
                onClick={handlePublishAll}
                disabled={publishing || enabledCount === 0}
                className="btn-gradient px-4 py-1.5 text-sm"
              >
                {publishing ? 'Publishing...' : `Publish All (${enabledCount})`}
              </button>
            )}
          </div>

          {translations.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Compose your tweet and click &quot;Translate&quot; to see translations here.
            </p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {translations.map((entry, i) => {
                const meta = langMeta(entry.languageCode)
                return (
                  <div
                    key={entry.languageCode}
                    className={`rounded-xl border p-3 space-y-2 transition-all ${
                      entry.enabled
                        ? 'border-white/10 bg-white/5 hover:border-white/20'
                        : 'border-white/5 bg-white/[0.02] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base transition-transform hover:scale-125 inline-block">
                          {meta?.flag}
                        </span>
                        <span className="text-sm font-medium text-slate-300">{meta?.label}</span>
                        {(() => {
                          const badge = getAccountBadge(entry.languageCode)
                          if (!badge) return (
                            <span className="text-xs text-amber-400 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded-full">
                              no account
                            </span>
                          )
                          return (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                              badge.type === 'oauth2'
                                ? 'text-violet-400 bg-violet-400/15 border-violet-400/30'
                                : 'text-slate-400 bg-white/5 border-white/10'
                            }`}>
                              {badge.label}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={entry.status} errorMessage={entry.errorMessage} />
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) => updateTranslation(i, 'enabled', e.target.checked)}
                            className="rounded text-violet-500"
                          />
                          <span className="text-xs text-slate-500">publish</span>
                        </label>
                      </div>
                    </div>
                    <textarea
                      value={entry.text}
                      onChange={(e) => updateTranslation(i, 'text', e.target.value)}
                      rows={3}
                      className="input-dark text-xs resize-none"
                    />
                    <div className="text-right">
                      <span
                        className={`text-xs ${
                          entry.text.length > MAX_TWEET_LENGTH ? 'text-red-400' : 'text-slate-600'
                        }`}
                      >
                        {entry.text.length}/{MAX_TWEET_LENGTH}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status, errorMessage }: { status: string; errorMessage?: string }) {
  if (status === 'idle') return null
  if (status === 'pending')
    return (
      <span className="text-xs bg-amber-400/15 border border-amber-400/30 text-amber-400 px-2 py-0.5 rounded-full animate-pulse-glow animate-pulse">
        ⏳
      </span>
    )
  if (status === 'success')
    return (
      <span className="text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 px-2 py-0.5 rounded-full">
        ✓
      </span>
    )
  if (status === 'error')
    return (
      <span
        className="text-xs bg-red-400/15 border border-red-400/30 text-red-400 px-2 py-0.5 rounded-full cursor-help"
        title={errorMessage}
      >
        ✗
      </span>
    )
  return null
}
