import { Translate } from '@google-cloud/translate/build/src/v2'

let client: Translate | null = null

function getClient(): Translate {
  if (!client) {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY is not set in .env.local')
    }
    client = new Translate({ key: apiKey })
  }
  return client
}

export async function translateToLanguages(
  text: string,
  targets: { code: string; googleCode: string }[]
): Promise<Record<string, string>> {
  const translateClient = getClient()
  const results: Record<string, string> = {}

  // Deduplicate by googleCode to avoid redundant API calls
  const googleCodeToLangCodes: Record<string, string[]> = {}
  for (const { code, googleCode } of targets) {
    if (!googleCodeToLangCodes[googleCode]) {
      googleCodeToLangCodes[googleCode] = []
    }
    googleCodeToLangCodes[googleCode].push(code)
  }

  const uniqueGoogleCodes = Object.keys(googleCodeToLangCodes)

  await Promise.all(
    uniqueGoogleCodes.map(async (googleCode) => {
      const [translation] = await translateClient.translate(text, googleCode)
      const translatedText = Array.isArray(translation) ? translation[0] : translation
      for (const langCode of googleCodeToLangCodes[googleCode]) {
        results[langCode] = translatedText
      }
    })
  )

  return results
}
