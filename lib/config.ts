import fs from 'fs'
import path from 'path'
import type { TwitterApiConfig, AccountMapping } from '@/types'

const CONFIG_DIR = path.join(process.cwd(), 'config')
const TWITTER_API_FILE = path.join(CONFIG_DIR, 'twitter-api.json')
const ACCOUNTS_FILE = path.join(CONFIG_DIR, 'accounts.json')

const KV_ACCOUNTS_KEY = 'accounts'

function isKVEnabled(): boolean {
  return !!process.env.KV_REST_API_URL
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function getTwitterApiConfig(): TwitterApiConfig {
  // Env vars take priority (required on Vercel, optional locally)
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

export async function getAccounts(): Promise<AccountMapping[]> {
  // Env var: TWITTER_ACCOUNTS = JSON array string
  if (process.env.TWITTER_ACCOUNTS) {
    try {
      return JSON.parse(process.env.TWITTER_ACCOUNTS)
    } catch {
      return []
    }
  }
  if (isKVEnabled()) {
    const { kv } = await import('@vercel/kv')
    const accounts = await kv.get<AccountMapping[]>(KV_ACCOUNTS_KEY)
    return accounts ?? []
  }
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return []
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'))
}

export async function upsertAccount(account: AccountMapping): Promise<AccountMapping[]> {
  const accounts = await getAccounts()
  const idx = accounts.findIndex((a) => a.id === account.id)
  if (idx >= 0) {
    accounts[idx] = account
  } else {
    accounts.push(account)
  }
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

export function maskSecret(value: string): string {
  if (!value || value.length <= 8) return value ? '****' : ''
  return value.slice(0, 4) + '****' + value.slice(-4)
}
