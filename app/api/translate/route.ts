import { NextRequest, NextResponse } from 'next/server'
import { translateToLanguages } from '@/lib/translate'
import { SUPPORTED_LANGUAGES } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { texts, targetLanguages } = await req.json()

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 })
    }

    const targets = SUPPORTED_LANGUAGES.filter((lang) =>
      !targetLanguages || targetLanguages.includes(lang.code)
    ).map((lang) => ({ code: lang.code, googleCode: lang.googleCode }))

    // Translate each thread block independently, in parallel
    const perBlock = await Promise.all(
      texts.map((text: string) => translateToLanguages(text, targets))
    )

    // Reshape: { langCode: [block0, block1, ...] }
    const translations: Record<string, string[]> = {}
    for (const langCode of targets.map((t) => t.code)) {
      translations[langCode] = perBlock.map((block) => block[langCode] ?? '')
    }

    return NextResponse.json({ translations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
