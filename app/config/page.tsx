'use client'

import { useState, useEffect } from 'react'
import { SUPPORTED_LANGUAGES } from '@/types'
import type { AccountMapping } from '@/types'

type Tab = 'api' | 'accounts'

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>('api')

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-200">Configuration</h1>

      <div className="bg-white/5 p-1 rounded-xl flex gap-1">
        <button
          onClick={() => setTab('api')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'api'
              ? 'btn-gradient'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Twitter App API
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'accounts'
              ? 'btn-gradient'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Account Mapping
        </button>
      </div>

      {tab === 'api' ? <ApiConfigTab /> : <AccountsTab />}
    </div>
  )
}

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
          These are the app-level credentials from your Twitter Developer Portal.
          {configured && (
            <span className="ml-2 text-emerald-400 font-medium">✓ Configured</span>
          )}
        </p>
      </div>

      <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-xs text-amber-300 space-y-1">
        <p className="font-medium">Note on OAuth</p>
        <p>
          Bearer Token is used for reading tweets. To post tweets, each account also needs
          per-user <strong>Access Token</strong> and <strong>Access Token Secret</strong> (OAuth
          1.0a) — configure those in the Account Mapping tab.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">API Key</label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-dark text-sm font-mono"
            placeholder="API Key (Consumer Key)"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">API Secret</label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            className="input-dark text-sm font-mono"
            placeholder="API Secret (Consumer Secret)"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Bearer Token</label>
          <input
            type="password"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            className="input-dark text-sm font-mono"
            placeholder="Bearer Token"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn-gradient px-4 py-2 text-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {message && (
          <p
            className={`text-sm ${
              message.includes('success') ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountMapping[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<AccountMapping>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    const res = await fetch('/api/config/accounts')
    const data = await res.json()
    setAccounts(data)
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-slate-200">Per-Language Account Mapping</h2>
            <p className="text-xs text-slate-500 mt-1">
              Each language needs an X/Twitter account with OAuth 1.0a tokens to post.
            </p>
          </div>
          {editingId === null && (
            <button
              onClick={startAdd}
              className="btn-gradient px-3 py-1.5 text-sm"
            >
              + Add Account
            </button>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message === 'Saved.' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        {/* Edit form */}
        {editingId !== null && (
          <div className="border border-violet-400/30 bg-violet-400/5 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-200">
              {editingId === 'new' ? 'Add Account' : 'Edit Account'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Handle (display)
                </label>
                <input
                  type="text"
                  value={form.handle ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                  placeholder="@myaccount_pt"
                  className="input-dark text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Access Token
                </label>
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Access Token Secret
                </label>
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
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient px-3 py-1.5 text-sm"
              >
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

        {/* Account list */}
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No accounts configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/5">
                  <th className="pb-2 pr-4">Language</th>
                  <th className="pb-2 pr-4">Handle</th>
                  <th className="pb-2 pr-4">Access Token</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 text-slate-300">{langLabel(acc.languageCode)}</td>
                    <td className="py-2 pr-4 text-slate-400">{acc.handle}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                      {acc.accessToken}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(acc)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(acc.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
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
        <p className="font-medium text-slate-400">How to get Access Tokens</p>
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
