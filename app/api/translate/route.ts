import { NextRequest, NextResponse } from 'next/server'
import { translateToLanguages } from '@/lib/translate'
import { SUPPORTED_LANGUAGES } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguages } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const targets = SUPPORTED_LANGUAGES.filter((lang) =>
      !targetLanguages || targetLanguages.includes(lang.code)
    ).map((lang) => ({ code: lang.code, googleCode: lang.googleCode }))

    const translations = await translateToLanguages(text, targets)

    return NextResponse.json({ translations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
