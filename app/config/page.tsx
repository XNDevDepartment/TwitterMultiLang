'use client'

import { useState, useEffect } from 'react'
import { SUPPORTED_LANGUAGES } from '@/types'
import type { AccountMapping } from '@/types'

type Tab = 'api' | 'accounts'

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>('api')

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">Configuration</h1>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('api')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'api'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Twitter App API
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="font-medium text-gray-800">Twitter / X App Credentials</h2>
        <p className="text-xs text-gray-500 mt-1">
          These are the app-level credentials from your Twitter Developer Portal.
          {configured && (
            <span className="ml-2 text-green-600 font-medium">✓ Configured</span>
          )}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 space-y-1">
        <p className="font-medium">Note on OAuth</p>
        <p>
          Bearer Token is used for reading tweets. To post tweets, each account also needs
          per-user <strong>Access Token</strong> and <strong>Access Token Secret</strong> (OAuth
          1.0a) — configure those in the Account Mapping tab.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded border-gray-300 text-sm font-mono"
            placeholder="API Key (Consumer Key)"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            className="w-full rounded border-gray-300 text-sm font-mono"
            placeholder="API Secret (Consumer Secret)"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bearer Token</label>
          <input
            type="password"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            className="w-full rounded border-gray-300 text-sm font-mono"
            placeholder="Bearer Token"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {message && (
          <p
            className={`text-sm ${
              message.includes('success') ? 'text-green-600' : 'text-red-600'
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
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-gray-800">Per-Language Account Mapping</h2>
            <p className="text-xs text-gray-500 mt-1">
              Each language needs an X/Twitter account with OAuth 1.0a tokens to post.
            </p>
          </div>
          {editingId === null && (
            <button
              onClick={startAdd}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              + Add Account
            </button>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message === 'Saved.' ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        {/* Edit form */}
        {editingId !== null && (
          <div className="border border-blue-200 rounded p-4 space-y-3 bg-blue-50">
            <h3 className="text-sm font-medium text-gray-800">
              {editingId === 'new' ? 'Add Account' : 'Edit Account'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={form.languageCode ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, languageCode: e.target.value }))}
                  className="w-full rounded border-gray-300 text-sm"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.label} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Handle (display)
                </label>
                <input
                  type="text"
                  value={form.handle ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                  placeholder="@myaccount_pt"
                  className="w-full rounded border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Access Token
                </label>
                <input
                  type="text"
                  value={form.accessToken ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                  placeholder="User Access Token"
                  className="w-full rounded border-gray-300 text-sm font-mono"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Access Token Secret
                </label>
                <input
                  type="password"
                  value={form.accessTokenSecret ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, accessTokenSecret: e.target.value }))}
                  placeholder="User Access Token Secret"
                  className="w-full rounded border-gray-300 text-sm font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Account list */}
        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No accounts configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2 pr-4">Language</th>
                  <th className="pb-2 pr-4">Handle</th>
                  <th className="pb-2 pr-4">Access Token</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{langLabel(acc.languageCode)}</td>
                    <td className="py-2 pr-4 text-gray-600">{acc.handle}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                      {acc.accessToken}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(acc)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(acc.id)}
                          className="text-xs text-red-600 hover:underline"
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

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-700">How to get Access Tokens</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Go to developer.twitter.com → your App → &quot;Keys and tokens&quot;</li>
          <li>Under &quot;Authentication Tokens&quot;, generate Access Token & Secret</li>
          <li>Ensure your app has &quot;Read and Write&quot; permissions</li>
          <li>Repeat for each X/Twitter account you want to manage</li>
        </ol>
      </div>
    </div>
  )
}
