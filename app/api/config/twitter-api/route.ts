import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiConfig, saveTwitterApiConfig, maskSecret } from '@/lib/config'

export async function GET() {
  const config = getTwitterApiConfig()
  return NextResponse.json({
    apiKey: maskSecret(config.apiKey),
    apiSecret: maskSecret(config.apiSecret),
    bearerToken: maskSecret(config.bearerToken),
    configured: !!(config.apiKey && config.apiSecret && config.bearerToken),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const existing = getTwitterApiConfig()

    // If value looks like a masked secret (contains ****), keep the existing value
    const config = {
      apiKey: body.apiKey?.includes('****') ? existing.apiKey : body.apiKey ?? '',
      apiSecret: body.apiSecret?.includes('****') ? existing.apiSecret : body.apiSecret ?? '',
      bearerToken:
        body.bearerToken?.includes('****') ? existing.bearerToken : body.bearerToken ?? '',
    }

    saveTwitterApiConfig(config)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
