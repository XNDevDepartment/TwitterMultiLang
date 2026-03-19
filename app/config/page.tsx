'use client'

import { useState, useEffect } from 'react'
import { SUPPORTED_LANGUAGES } from '@/types'
import type { AccountMapping, OAuthAccount } from '@/types'

type Tab = 'api' | 'oauth' | 'legacy'

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>('api')
  const [oauthBanner, setOauthBanner] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauthError = params.get('oauth_error')
    const tabParam = params.get('tab') as Tab | null

    if (connected) {
      setOauthBanner(`✓ @${connected} connected successfully`)
      setTab('oauth')
      window.history.replaceState({}, '', '/config?tab=oauth')
    } else if (oauthError) {
      setOauthBanner(`Error: ${oauthError.replace(/_/g, ' ')}`)
      setTab('oauth')
      window.history.replaceState({}, '', '/config?tab=oauth')
    } else if (tabParam) {
      setTab(tabParam)
    }
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'api', label: 'Twitter App API' },
    { key: 'oauth', label: 'Connected Accounts' },
    { key: 'legacy', label: 'Legacy Accounts' },
  ]

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-200">Configuration</h1>

      {oauthBanner && (
        <div
          className={`px-4 py-3 rounded-xl text-sm border ${
            oauthBanner.startsWith('✓')
              ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400'
              : 'bg-red-400/10 border-red-400/20 text-red-400'
          }`}
        >
          {oauthBanner}
          <button onClick={() => setOauthBanner(null)} className="ml-3 opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      <div className="bg-white/5 p-1 rounded-xl flex gap-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 px-2 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all leading-tight text-center ${
              tab === key ? 'btn-gradient' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={tab === 'api' ? undefined : 'hidden'}><ApiConfigTab /></div>
      <div className={tab === 'oauth' ? undefined : 'hidden'}><OAuthAccountsTab /></div>
      <div className={tab === 'legacy' ? undefined : 'hidden'}><AccountsTab /></div>
    </div>
  )
}

// ─── Twitter App API Tab ──────────────────────────────────────────────────────

function ApiConfigTab() {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    fetch('/api/config/twitter-api')
      .then((r) => r.json())
      .then((data) => {
        setApiKey(data.apiKey || '')
        setApiSecret(data.apiSecret || '')
        setBearerToken(data.bearerToken || '')
        setConfigured(data.configured)
      })
      .catch(() => {})
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/config/twitter-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret, bearerToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage('Saved successfully.')
      setConfigured(true)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <h2 className="font-medium text-slate-200">Twitter / X App Credentials</h2>
        <p className="text-xs text-slate-500 mt-1">
          App-level credentials from your Twitter Developer Portal.
          {configured && <span className="ml-2 text-emerald-400 font-medium">✓ Configured</span>}
        </p>
      </div>

      <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-xs text-amber-300 space-y-1">
        <p className="font-medium">Required for OAuth 2.0 flow</p>
        <p>
          Set <code className="font-mono bg-white/10 px-1 rounded">TWITTER_CLIENT_ID</code> and{' '}
          <code className="font-mono bg-white/10 px-1 rounded">TWITTER_CLIENT_SECRET</code> in
          your environment to enable the &quot;Connect Account&quot; OAuth 2.0 flow. Bearer Token is used
          for reading tweets (fetching from URL mode).
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {[
          { label: 'API Key', value: apiKey, set: setApiKey, type: 'text', placeholder: 'API Key (Consumer Key)' },
          { label: 'API Secret', value: apiSecret, set: setApiSecret, type: 'password', placeholder: 'API Secret (Consumer Secret)' },
          { label: 'Bearer Token', value: bearerToken, set: setBearerToken, type: 'password', placeholder: 'Bearer Token' },
        ].map(({ label, value, set, type, placeholder }) => (
          <div key={label}>
            <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => set(e.target.value)}
              className="input-dark text-sm font-mono"
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>
        ))}
        <button type="submit" disabled={saving} className="btn-gradient px-4 py-2 text-sm">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {message && (
          <p className={`text-sm ${message.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

// ─── OAuth 2.0 Connected Accounts Tab ────────────────────────────────────────

type SafeOAuthAccount = Omit<OAuthAccount, 'access_token' | 'refresh_token'>

function OAuthAccountsTab() {
  const [accounts, setAccounts] = useState<SafeOAuthAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/x/accounts')
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load accounts')
      } else {
        setAccounts(data)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  async function handleAssignLanguage(id: string, languageCode: string | null) {
    const res = await fetch(`/api/x/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode }),
    })
    const data = await res.json()
    if (res.ok) {
      setAccounts(data)
    } else {
      setMessage(`Failed to assign language: ${data.error ?? 'unknown error'}`)
      await loadAccounts()
    }
  }

  async function handleDisconnect(id: string, username: string) {
    if (!confirm(`Disconnect @${username}?`)) return
    const res = await fetch(`/api/x/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAccounts(await res.json())
      setMessage(`@${username} disconnected.`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-medium text-slate-200">Connected X Accounts</h2>
            <p className="text-xs text-slate-500 mt-1">
              Authorize each X account via OAuth 2.0, then assign it a language.
            </p>
          </div>
          <a
            href="/api/x/connect"
            className="btn-gradient px-3 text-sm shrink-0"
          >
            + Connect Account
          </a>
        </div>

        {message && (
          <p className="text-sm text-emerald-400">{message}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 italic">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-400">Error loading accounts: {loadError}</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No accounts connected yet. Click &quot;Connect Account&quot; to authorize your first X account.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 text-sm">@{acc.username}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {acc.expires_at > Date.now()
                        ? `Token valid until ${new Date(acc.expires_at).toLocaleString()}`
                        : <span className="text-amber-400">Token expired — will auto-refresh on next post</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(acc.id, acc.username)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors whitespace-nowrap shrink-0 min-h-[44px] px-1"
                  >
                    Disconnect
                  </button>
                </div>

                <select
                  value={acc.languageCode ?? ''}
                  onChange={(e) =>
                    handleAssignLanguage(acc.id, e.target.value || null)
                  }
                  className="input-dark text-sm w-full"
                >
                  <option value="" className="bg-[#080b14]">— Assign language —</option>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#080b14]">
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-4 text-xs text-slate-500 space-y-2">
        <p className="font-medium text-slate-400">Setup checklist</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>In your X App settings, enable OAuth 2.0 with PKCE</li>
          <li>
            Add callback URL:{' '}
            <code className="font-mono bg-white/10 px-1 rounded text-slate-300 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/x/callback
            </code>
          </li>
          <li>
            Enable scopes:{' '}
            <code className="font-mono bg-white/10 px-1 rounded text-slate-300 break-all">
              tweet.read users.read tweet.write offline.access
            </code>
          </li>
          <li>
            Set env vars{' '}
            <code className="font-mono bg-white/10 px-1 rounded text-slate-300 break-all">TWITTER_CLIENT_ID</code>{' '}
            and{' '}
            <code className="font-mono bg-white/10 px-1 rounded text-slate-300 break-all">TWITTER_CLIENT_SECRET</code>
          </li>
          <li>Click &quot;Connect Account&quot; for each X account you want to manage</li>
          <li>Assign each connected account to a language</li>
        </ol>
        <p className="text-slate-600 mt-2">
          Note: OAuth 2.0 accounts support text tweets. Image upload requires Legacy Account credentials.
        </p>
      </div>
    </div>
  )
}

// ─── Legacy OAuth 1.0a Accounts Tab ──────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountMapping[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<AccountMapping>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadAccounts() }, [])

  async function loadAccounts() {
    const res = await fetch('/api/config/accounts')
    setAccounts(await res.json())
  }

  function startAdd() {
    setEditingId('new')
    setForm({ languageCode: SUPPORTED_LANGUAGES[0].code, handle: '', accessToken: '', accessTokenSecret: '' })
    setMessage('')
  }

  function startEdit(account: AccountMapping) {
    setEditingId(account.id)
    setForm({ ...account })
    setMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({})
  }

  async function handleSave() {
    if (!form.languageCode || !form.handle) {
      setMessage('Language and handle are required.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const payload = editingId === 'new' ? { ...form } : { id: editingId, ...form }
      const res = await fetch('/api/config/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAccounts(data)
      setEditingId(null)
      setForm({})
      setMessage('Saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account mapping?')) return
    try {
      const res = await fetch('/api/config/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAccounts(data)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const langLabel = (code: string) => {
    const l = SUPPORTED_LANGUAGES.find((l) => l.code === code)
    return l ? `${l.flag} ${l.label}` : code
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-medium text-slate-200">Legacy — OAuth 1.0a Accounts</h2>
            <p className="text-xs text-slate-500 mt-1">
              Manual token entry. Used as fallback when no OAuth 2.0 account is assigned to a language. Also required for image uploads.
            </p>
          </div>
          {editingId === null && (
            <button onClick={startAdd} className="btn-gradient px-3 text-sm shrink-0">
              + Add Account
            </button>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message === 'Saved.' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        {editingId !== null && (
          <div className="border border-violet-400/30 bg-violet-400/5 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-200">
              {editingId === 'new' ? 'Add Account' : 'Edit Account'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Language</label>
                <select
                  value={form.languageCode ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, languageCode: e.target.value }))}
                  className="input-dark text-sm"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#080b14]">
                      {l.flag} {l.label} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Handle</label>
                <input
                  type="text"
                  value={form.handle ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                  placeholder="@myaccount_pt"
                  className="input-dark text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Access Token</label>
                <input
                  type="text"
                  value={form.accessToken ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                  placeholder="User Access Token"
                  className="input-dark text-sm font-mono"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Access Token Secret</label>
                <input
                  type="password"
                  value={form.accessTokenSecret ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, accessTokenSecret: e.target.value }))}
                  placeholder="User Access Token Secret"
                  className="input-dark text-sm font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-gradient px-3 py-1.5 text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 text-sm rounded-lg hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No legacy accounts configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/5">
                  <th className="pb-2 pr-4">Language</th>
                  <th className="pb-2 pr-4">Handle</th>
                  <th className="pb-2 pr-4 hidden sm:table-cell">Access Token</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 text-slate-300">{langLabel(acc.languageCode)}</td>
                    <td className="py-2 pr-4 text-slate-400">{acc.handle}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-500 hidden sm:table-cell">{acc.accessToken}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(acc)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Edit</button>
                        <button onClick={() => handleDelete(acc.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-card p-4 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-400">How to get OAuth 1.0a tokens</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Go to developer.twitter.com → your App → &quot;Keys and tokens&quot;</li>
          <li>Under &quot;Authentication Tokens&quot;, generate Access Token &amp; Secret</li>
          <li>Ensure your app has &quot;Read and Write&quot; permissions</li>
          <li>Repeat for each X/Twitter account you want to manage</li>
        </ol>
      </div>
    </div>
  )
}
