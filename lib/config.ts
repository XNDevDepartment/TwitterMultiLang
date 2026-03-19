import fs from 'fs'
import path from 'path'
import type { TwitterApiConfig, AccountMapping, OAuthAccount } from '@/types'

const CONFIG_DIR = path.join(process.cwd(), 'config')
const TWITTER_API_FILE = path.join(CONFIG_DIR, 'twitter-api.json')
const ACCOUNTS_FILE = path.join(CONFIG_DIR, 'accounts.json')
const OAUTH_ACCOUNTS_FILE = path.join(CONFIG_DIR, 'oauth-accounts.json')

const KV_ACCOUNTS_KEY = 'accounts'
const KV_OAUTH_ACCOUNTS_KEY = 'oauth_accounts'
const STATE_TTL_SECONDS = 600 // 10 minutes

// In-memory fallback for local dev (resets on server restart — fine for dev)
const inMemoryStateStore = new Map<string, { verifier: string; ts: number }>()

function isKVEnabled(): boolean {
  return !!process.env.KV_REST_API_URL
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

// ─── Twitter App API Config ───────────────────────────────────────────────────

export function getTwitterApiConfig(): TwitterApiConfig {
  if (process.env.TWITTER_API_KEY) {
    return {
      apiKey: process.env.TWITTER_API_KEY ?? '',
      apiSecret: process.env.TWITTER_API_SECRET ?? '',
      bearerToken: process.env.TWITTER_BEARER_TOKEN ?? '',
    }
  }
  if (!fs.existsSync(TWITTER_API_FILE)) {
    return { apiKey: '', apiSecret: '', bearerToken: '' }
  }
  return JSON.parse(fs.readFileSync(TWITTER_API_FILE, 'utf-8'))
}

export function saveTwitterApiConfig(config: TwitterApiConfig): void {
  ensureConfigDir()
  fs.writeFileSync(TWITTER_API_FILE, JSON.stringify(config, null, 2))
}

// ─── Legacy OAuth 1.0a Accounts ──────────────────────────────────────────────

export async function getAccounts(): Promise<AccountMapping[]> {
  if (process.env.TWITTER_ACCOUNTS) {
    try { return JSON.parse(process.env.TWITTER_ACCOUNTS) } catch { return [] }
  }
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<AccountMapping[]>(KV_ACCOUNTS_KEY)) ?? []
  }
  if (!fs.existsSync(ACCOUNTS_FILE)) return []
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'))
}

export async function upsertAccount(account: AccountMapping): Promise<AccountMapping[]> {
  const accounts = await getAccounts()
  const idx = accounts.findIndex((a) => a.id === account.id)
  if (idx >= 0) accounts[idx] = account
  else accounts.push(account)
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(KV_ACCOUNTS_KEY, accounts)
  } else {
    ensureConfigDir()
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
  }
  return accounts
}

export async function deleteAccount(id: string): Promise<AccountMapping[]> {
  const accounts = (await getAccounts()).filter((a) => a.id !== id)
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(KV_ACCOUNTS_KEY, accounts)
  } else {
    ensureConfigDir()
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
  }
  return accounts
}

// ─── OAuth 2.0 Accounts ───────────────────────────────────────────────────────

function isSupabaseEnabled(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export async function getOAuthAccounts(): Promise<OAuthAccount[]> {
  if (isSupabaseEnabled()) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.from('oauth_accounts').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToAccount)
  }
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<OAuthAccount[]>(KV_OAUTH_ACCOUNTS_KEY)) ?? []
  }
  if (!fs.existsSync(OAUTH_ACCOUNTS_FILE)) return []
  return JSON.parse(fs.readFileSync(OAUTH_ACCOUNTS_FILE, 'utf-8'))
}

export async function upsertOAuthAccount(account: OAuthAccount): Promise<OAuthAccount[]> {
  if (isSupabaseEnabled()) {
    const { supabase } = await import('./supabase')
    const { error } = await supabase
      .from('oauth_accounts')
      .upsert(accountToRow(account), { onConflict: 'x_user_id' })
    if (error) throw new Error(error.message)
    return getOAuthAccounts()
  }
  const accounts = await getOAuthAccounts()
  const idx = accounts.findIndex((a) => a.x_user_id === account.x_user_id)
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account }
  } else {
    accounts.push(account)
  }
  await saveOAuthAccounts(accounts)
  return accounts
}

export async function updateOAuthAccount(
  id: string,
  patch: Partial<OAuthAccount>
): Promise<OAuthAccount[]> {
  if (isSupabaseEnabled()) {
    const { supabase } = await import('./supabase')
    const { error } = await supabase
      .from('oauth_accounts')
      .update(accountToRow(patch as OAuthAccount))
      .eq('id', id)
    if (error) throw new Error(error.message)
    return getOAuthAccounts()
  }
  const accounts = await getOAuthAccounts()
  const idx = accounts.findIndex((a) => a.id === id)
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...patch }
  await saveOAuthAccounts(accounts)
  return accounts
}

export async function deleteOAuthAccount(id: string): Promise<OAuthAccount[]> {
  if (isSupabaseEnabled()) {
    const { supabase } = await import('./supabase')
    const { error } = await supabase.from('oauth_accounts').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return getOAuthAccounts()
  }
  const accounts = (await getOAuthAccounts()).filter((a) => a.id !== id)
  await saveOAuthAccounts(accounts)
  return accounts
}

export async function getOAuthAccountForLanguage(
  languageCode: string
): Promise<OAuthAccount | undefined> {
  if (isSupabaseEnabled()) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase
      .from('oauth_accounts')
      .select('*')
      .eq('language_code', languageCode)
      .single()
    if (error || !data) return undefined
    return rowToAccount(data)
  }
  const accounts = await getOAuthAccounts()
  return accounts.find((a) => a.languageCode === languageCode)
}

async function saveOAuthAccounts(accounts: OAuthAccount[]): Promise<void> {
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(KV_OAUTH_ACCOUNTS_KEY, accounts)
  } else {
    ensureConfigDir()
    fs.writeFileSync(OAUTH_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
  }
}

// Map between camelCase OAuthAccount and snake_case DB rows
function accountToRow(account: Partial<OAuthAccount>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (account.id !== undefined) row.id = account.id
  if (account.x_user_id !== undefined) row.x_user_id = account.x_user_id
  if (account.username !== undefined) row.username = account.username
  if (account.languageCode !== undefined) row.language_code = account.languageCode
  if (account.access_token !== undefined) row.access_token = account.access_token
  if (account.refresh_token !== undefined) row.refresh_token = account.refresh_token
  if (account.expires_at !== undefined) row.expires_at = account.expires_at
  if (account.created_at !== undefined) row.created_at = account.created_at
  return row
}

function rowToAccount(row: Record<string, unknown>): OAuthAccount {
  return {
    id: row.id as string,
    x_user_id: row.x_user_id as string,
    username: row.username as string,
    languageCode: (row.language_code as string | null) ?? null,
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string,
    expires_at: row.expires_at as number,
    created_at: row.created_at as number,
  }
}

// ─── OAuth 2.0 State / PKCE Store ─────────────────────────────────────────────

export async function saveOAuthState(state: string, verifier: string): Promise<void> {
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(`oauth_state:${state}`, verifier, { ex: STATE_TTL_SECONDS })
  } else {
    inMemoryStateStore.set(state, { verifier, ts: Date.now() })
  }
}

export async function consumeOAuthState(state: string): Promise<string | null> {
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    const verifier = await kv.get<string>(`oauth_state:${state}`)
    if (verifier) await kv.del(`oauth_state:${state}`)
    return verifier ?? null
  }
  const entry = inMemoryStateStore.get(state)
  if (!entry) return null
  inMemoryStateStore.delete(state)
  // Expire stale local entries
  if (Date.now() - entry.ts > STATE_TTL_SECONDS * 1000) return null
  return entry.verifier
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

export function maskSecret(value: string): string {
  if (!value || value.length <= 8) return value ? '****' : ''
  return value.slice(0, 4) + '****' + value.slice(-4)
}
