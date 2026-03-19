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

  // Thread: array of tweet texts
  const [threadBlocks, setThreadBlocks] = useState<string[]>([''])
  const [images, setImages] = useState<string[]>([])
  const [translations, setTranslations] = useState<TranslationEntry[]>([])
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState('')

  const [configuredAccounts, setConfiguredAccounts] = useState<AccountMapping[]>([])
  const [oauthAccounts, setOauthAccounts] = useState<Omit<OAuthAccount, 'access_token' | 'refresh_token'>[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function loadAccounts() {
    return Promise.all([
      fetch('/api/config/accounts').then((r) => r.json()),
      fetch('/api/x/accounts').then((r) => r.json()),
    ]).then(([legacy, oauth]) => {
      setConfiguredAccounts(Array.isArray(legacy) ? legacy : [])
      setOauthAccounts(Array.isArray(oauth) ? oauth : [])
    }).catch(() => {})
  }

  useEffect(() => {
    loadAccounts().finally(() => setAccountsLoaded(true))
  }, [])

  useEffect(() => {
    if (translations.length === 0) return
    setTranslations((prev) =>
      prev.map((t) =>
        t.status === 'idle' ? { ...t, enabled: hasAccount(t.languageCode) } : t
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthAccounts, configuredAccounts])

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

  // ── Thread block helpers ────────────────────────────────────────────────────

  function updateBlock(index: number, value: string) {
    setThreadBlocks((prev) => prev.map((b, i) => (i === index ? value : b)))
  }

  function addBlock() {
    setThreadBlocks((prev) => [...prev, ''])
  }

  function removeBlock(index: number) {
    setThreadBlocks((prev) => prev.filter((_, i) => i !== index))
    // Also remove the block from existing translations
    setTranslations((prev) =>
      prev.map((t) => ({ ...t, texts: t.texts.filter((_, i) => i !== index) }))
    )
  }

  // ── Fetch tweet (URL mode) ──────────────────────────────────────────────────

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

  // ── Translate ───────────────────────────────────────────────────────────────

  async function handleTranslate() {
    const filledBlocks = threadBlocks.filter((b) => b.trim())
    if (filledBlocks.length === 0) return
    setTranslating(true)
    setTranslationError('')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: filledBlocks,
          targetLanguages: SUPPORTED_LANGUAGES.map((l) => l.code),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const entries: TranslationEntry[] = SUPPORTED_LANGUAGES.map((lang) => ({
        languageCode: lang.code,
        texts: data.translations[lang.code] ?? filledBlocks.map(() => ''),
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

  // ── Image upload ────────────────────────────────────────────────────────────

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (images.length + files.length > 4) {
      alert('Maximum 4 images per tweet')
      return
    }
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setImages((prev) => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // ── Publish ─────────────────────────────────────────────────────────────────

  async function handlePublishAll() {
    const enabled = translations.filter((t) => t.enabled && t.texts.some((tx) => tx.trim()))
    if (enabled.length === 0) return

    setPublishing(true)

    for (const entry of enabled) {
      setTranslations((prev) =>
        prev.map((t) => t.languageCode === entry.languageCode ? { ...t, status: 'pending' } : t)
      )

      try {
        const res = await fetch('/api/tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            languageCode: entry.languageCode,
            texts: entry.texts.filter((tx) => tx.trim()),
            images: images.length > 0 ? images : undefined,
            tweetType: inputMode === 'url' ? tweetType : 'new',
            referencedTweetId: inputMode === 'url' && fetchedTweet ? fetchedTweet.id : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        setTranslations((prev) =>
          prev.map((t) =>
            t.languageCode === entry.languageCode
              ? { ...t, status: 'success', errorMessage: data.warning }
              : t
          )
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed'
        setTranslations((prev) =>
          prev.map((t) =>
            t.languageCode === entry.languageCode ? { ...t, status: 'error', errorMessage: msg } : t
          )
        )
      }
    }

    setPublishing(false)
  }

  const langMeta = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)
  const enabledCount = translations.filter((t) => t.enabled).length
  const configuredCount =
    oauthAccounts.filter((a) => a.languageCode).length + configuredAccounts.length
  const isThread = threadBlocks.length > 1

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-2">
        {(['new', 'url'] as InputMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            className={`px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all ${
              inputMode === mode
                ? 'btn-gradient'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            {mode === 'new' ? 'New Tweet' : 'From URL'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Compose */}
        <div className="glass-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">
              {isThread ? `Thread (${threadBlocks.length} tweets)` : 'Compose'}
            </h2>
            <button
              onClick={addBlock}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors border border-violet-400/30 rounded-lg px-2.5 py-1.5"
            >
              + Add tweet
            </button>
          </div>

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
                    className="btn-gradient px-3 text-sm shrink-0"
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
                {(['quote', 'reply'] as TweetType[]).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
                    <input
                      type="radio"
                      name="tweetType"
                      value={t}
                      checked={tweetType === t}
                      onChange={() => setTweetType(t)}
                      className="text-violet-500"
                    />
                    {t === 'quote' ? 'Quote Tweet' : 'Reply'}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Thread blocks */}
          <div className="space-y-3">
            {threadBlocks.map((block, i) => (
              <div key={i} className="relative">
                {/* Thread connector line */}
                {isThread && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-400/40 flex items-center justify-center text-xs text-violet-400 font-medium">
                        {i + 1}
                      </div>
                      {i < threadBlocks.length - 1 && (
                        <div className="w-px flex-1 bg-violet-400/20 mt-1 min-h-[1.5rem]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <BlockInput
                        value={block}
                        onChange={(v) => updateBlock(i, v)}
                        onRemove={threadBlocks.length > 1 ? () => removeBlock(i) : undefined}
                      />
                    </div>
                  </div>
                )}
                {!isThread && (
                  <BlockInput
                    value={block}
                    onChange={(v) => updateBlock(i, v)}
                    onRemove={undefined}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Image upload — attaches to first tweet */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4}
              className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              📎 {isThread ? 'Attach image to first tweet' : 'Attach image'} ({images.length}/4)
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            {images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-red-400"
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
            disabled={threadBlocks.every((b) => !b.trim()) || translating || !accountsLoaded}
            className="btn-gradient w-full py-2 text-sm"
          >
            {translating ? 'Translating...' : !accountsLoaded ? 'Loading accounts...' : `→ Translate${isThread ? ' Thread' : ''}`}
          </button>
          {translationError && <p className="text-red-400 text-xs">{translationError}</p>}
        </div>

        {/* Right: Translations */}
        <div className="glass-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Translations</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadAccounts()}
                className="text-slate-500 hover:text-slate-300 transition-colors text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Refresh accounts"
              >
                ↻
              </button>
              {translations.length > 0 && (
                <button
                  onClick={handlePublishAll}
                  disabled={publishing || enabledCount === 0}
                  className="btn-gradient px-4 text-sm"
                >
                  {publishing ? 'Publishing...' : `Publish All (${enabledCount})`}
                </button>
              )}
            </div>
          </div>

          {translations.length === 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-slate-500 italic">
                Compose your tweet and click &quot;Translate&quot; to see translations here.
              </p>
              {accountsLoaded && (
                <p className="text-xs text-slate-600">
                  {configuredCount === 0
                    ? 'No accounts configured — go to Config to connect accounts.'
                    : `${configuredCount} language${configuredCount === 1 ? '' : 's'} configured.`}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] sm:max-h-[600px] overflow-y-auto pr-1">
              {translations.map((entry) => {
                const meta = langMeta(entry.languageCode)
                const badge = getAccountBadge(entry.languageCode)
                return (
                  <div
                    key={entry.languageCode}
                    className={`rounded-xl border p-3 space-y-2 transition-all ${
                      entry.enabled
                        ? 'border-white/10 bg-white/5 hover:border-white/20'
                        : 'border-white/5 bg-white/[0.02] opacity-60'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta?.flag}</span>
                        <span className="text-sm font-medium text-slate-300">{meta?.label}</span>
                        {!badge ? (
                          <span className="text-xs text-amber-400 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded-full">
                            no account
                          </span>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                            badge.type === 'oauth2'
                              ? 'text-violet-400 bg-violet-400/15 border-violet-400/30'
                              : 'text-slate-400 bg-white/5 border-white/10'
                          }`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={entry.status} errorMessage={entry.errorMessage} />
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) =>
                              setTranslations((prev) =>
                                prev.map((t) =>
                                  t.languageCode === entry.languageCode
                                    ? { ...t, enabled: e.target.checked }
                                    : t
                                )
                              )
                            }
                            className="rounded text-violet-500"
                          />
                          <span className="text-xs text-slate-500">publish</span>
                        </label>
                      </div>
                    </div>

                    {/* Thread blocks */}
                    <div className="space-y-2">
                      {entry.texts.map((text, blockIdx) => (
                        <div key={blockIdx} className={isThread ? 'flex gap-2' : undefined}>
                          {isThread && (
                            <div className="flex flex-col items-center pt-1 shrink-0">
                              <div className="w-5 h-5 rounded-full bg-violet-500/10 border border-violet-400/30 flex items-center justify-center text-xs text-violet-400">
                                {blockIdx + 1}
                              </div>
                              {blockIdx < entry.texts.length - 1 && (
                                <div className="w-px flex-1 bg-violet-400/20 mt-1 min-h-[0.75rem]" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <textarea
                              value={text}
                              onChange={(e) =>
                                setTranslations((prev) =>
                                  prev.map((t) =>
                                    t.languageCode === entry.languageCode
                                      ? {
                                          ...t,
                                          texts: t.texts.map((tx, ti) =>
                                            ti === blockIdx ? e.target.value : tx
                                          ),
                                        }
                                      : t
                                  )
                                )
                              }
                              rows={3}
                              className="input-dark text-xs resize-none"
                            />
                            <div className="text-right">
                              <span className={`text-xs ${text.length > MAX_TWEET_LENGTH ? 'text-red-400' : 'text-slate-600'}`}>
                                {text.length}/{MAX_TWEET_LENGTH}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function BlockInput({
  value,
  onChange,
  onRemove,
}: {
  value: string
  onChange: (v: string) => void
  onRemove?: () => void
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="input-dark text-sm resize-none"
          placeholder="What's happening?"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors text-xs"
            title="Remove tweet"
          >
            ✕
          </button>
        )}
      </div>
      <div className="text-right">
        <span className={`text-xs ${value.length > MAX_TWEET_LENGTH ? 'text-red-400' : 'text-slate-600'}`}>
          {value.length}/{MAX_TWEET_LENGTH}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status, errorMessage }: { status: string; errorMessage?: string }) {
  if (status === 'idle') return null
  if (status === 'pending')
    return (
      <span className="text-xs bg-amber-400/15 border border-amber-400/30 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">
        ⏳
      </span>
    )
  if (status === 'success')
    return (
      <span
        className="text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 px-2 py-0.5 rounded-full cursor-help"
        title={errorMessage ?? 'Published successfully'}
      >
        {errorMessage ? '✓ ⚠' : '✓'}
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
