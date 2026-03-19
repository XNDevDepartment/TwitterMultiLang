import fs from 'fs'
import path from 'path'
import type { TwitterApiConfig, AccountMapping } from '@/types'

const CONFIG_DIR = path.join(process.cwd(), 'config')
const TWITTER_API_FILE = path.join(CONFIG_DIR, 'twitter-api.json')
const ACCOUNTS_FILE = path.join(CONFIG_DIR, 'accounts.json')

// On Vercel (or any read-only filesystem), writes are skipped gracefully.
const isReadOnly = process.env.VERCEL === '1'

function ensureConfigDir() {
  if (!isReadOnly && !fs.existsSync(CONFIG_DIR)) {
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
  if (isReadOnly) return
  ensureConfigDir()
  fs.writeFileSync(TWITTER_API_FILE, JSON.stringify(config, null, 2))
}

export function getAccounts(): AccountMapping[] {
  // Env var: TWITTER_ACCOUNTS = JSON array string
  if (process.env.TWITTER_ACCOUNTS) {
    try {
      return JSON.parse(process.env.TWITTER_ACCOUNTS)
    } catch {
      return []
    }
  }
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return []
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'))
}

export function upsertAccount(account: AccountMapping): AccountMapping[] {
  if (isReadOnly) return getAccounts()
  ensureConfigDir()
  const accounts = getAccounts()
  const idx = accounts.findIndex((a) => a.id === account.id)
  if (idx >= 0) {
    accounts[idx] = account
  } else {
    accounts.push(account)
  }
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
  return accounts
}

export function deleteAccount(id: string): AccountMapping[] {
  if (isReadOnly) return getAccounts()
  ensureConfigDir()
  const accounts = getAccounts().filter((a) => a.id !== id)
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
  return accounts
}

export function maskSecret(value: string): string {
  if (!value || value.length <= 8) return value ? '****' : ''
  return value.slice(0, 4) + '****' + value.slice(-4)
}
