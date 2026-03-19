'use client'

import { useState, useEffect, useRef } from 'react'
import { SUPPORTED_LANGUAGES } from '@/types'
import type {
  TranslationEntry,
  InputMode,
  TweetType,
  FetchedTweet,
  AccountMapping,
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
  const [publishing, setPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/config/accounts')
      .then((r) => r.json())
      .then((accounts: AccountMapping[]) => setConfiguredAccounts(accounts))
      .catch(() => {})
  }, [])

  function hasAccount(langCode: string) {
    return configuredAccounts.some((a) => a.languageCode === langCode)
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
          className={`px-4 py-2 rounded text-sm font-medium ${
            inputMode === 'new'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          New Tweet
        </button>
        <button
          onClick={() => setInputMode('url')}
          className={`px-4 py-2 rounded text-sm font-medium ${
            inputMode === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          From URL
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Compose */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h2 className="font-semibold text-gray-800">Compose</h2>

          {inputMode === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tweet URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchTweet()}
                    placeholder="https://x.com/user/status/123..."
                    className="flex-1 rounded border-gray-300 text-sm"
                  />
                  <button
                    onClick={handleFetchTweet}
                    disabled={!tweetUrl || fetchLoading}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50 hover:bg-blue-700"
                  >
                    {fetchLoading ? '...' : 'Load'}
                  </button>
                </div>
                {fetchError && <p className="text-red-600 text-xs mt-1">{fetchError}</p>}
              </div>

              {fetchedTweet && (
                <div className="bg-gray-50 rounded p-3 text-sm space-y-1 border border-gray-200">
                  <p className="font-medium text-gray-700">
                    {fetchedTweet.authorName}{' '}
                    <span className="text-gray-500 font-normal">{fetchedTweet.authorHandle}</span>
                  </p>
                  <p className="text-gray-600 text-xs">{fetchedTweet.text}</p>
                </div>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tweetType"
                    value="quote"
                    checked={tweetType === 'quote'}
                    onChange={() => setTweetType('quote')}
                    className="text-blue-600"
                  />
                  Quote Tweet
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tweetType"
                    value="reply"
                    checked={tweetType === 'reply'}
                    onChange={() => setTweetType('reply')}
                    className="text-blue-600"
                  />
                  Reply
                </label>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Text</label>
              <span
                className={`text-xs ${
                  composedText.length > MAX_TWEET_LENGTH ? 'text-red-600' : 'text-gray-400'
                }`}
              >
                {composedText.length}/{MAX_TWEET_LENGTH}
              </span>
            </div>
            <textarea
              value={composedText}
              onChange={(e) => setComposedText(e.target.value)}
              rows={5}
              className="w-full rounded border-gray-300 text-sm"
              placeholder="What's happening?"
            />
          </div>

          {/* Image upload */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4}
              className="text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className="w-16 h-16 object-cover rounded border border-gray-200"
                    />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center"
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
            className="w-full py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {translating ? 'Translating...' : '→ Translate'}
          </button>
          {translationError && <p className="text-red-600 text-xs">{translationError}</p>}
        </div>

        {/* Right: Translations */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Translations</h2>
            {translations.length > 0 && (
              <button
                onClick={handlePublishAll}
                disabled={publishing || enabledCount === 0}
                className="px-4 py-1.5 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : `Publish All (${enabledCount})`}
              </button>
            )}
          </div>

          {translations.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              Compose your tweet and click &quot;Translate&quot; to see translations here.
            </p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {translations.map((entry, i) => {
                const meta = langMeta(entry.languageCode)
                const accountExists = hasAccount(entry.languageCode)
                return (
                  <div
                    key={entry.languageCode}
                    className={`rounded border p-3 space-y-2 ${
                      entry.enabled
                        ? 'border-gray-200'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta?.flag}</span>
                        <span className="text-sm font-medium text-gray-700">{meta?.label}</span>
                        {!accountExists && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            no account
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={entry.status} errorMessage={entry.errorMessage} />
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) => updateTranslation(i, 'enabled', e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span className="text-xs text-gray-500">publish</span>
                        </label>
                      </div>
                    </div>
                    <textarea
                      value={entry.text}
                      onChange={(e) => updateTranslation(i, 'text', e.target.value)}
                      rows={3}
                      className="w-full rounded border-gray-300 text-xs"
                    />
                    <div className="text-right">
                      <span
                        className={`text-xs ${
                          entry.text.length > MAX_TWEET_LENGTH ? 'text-red-600' : 'text-gray-400'
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
    return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">⏳</span>
  if (status === 'success')
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓</span>
  if (status === 'error')
    return (
      <span
        className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded cursor-help"
        title={errorMessage}
      >
        ✗
      </span>
    )
  return null
}
