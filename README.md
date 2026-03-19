# TwitterMultiLang Hub

A local Next.js web app that lets you compose a tweet, translate it into 14 languages via Google Translate, and publish to per-language Twitter/X accounts — all from a single interface.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Google Translate API

Edit `.env.local` and add your Google Translate API key:

```
GOOGLE_TRANSLATE_API_KEY=your_key_here
```

To get a key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Cloud Translation API**
3. Create an API key under **APIs & Services → Credentials**

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Configure Twitter credentials

Go to **http://localhost:3000/config**:

**Tab 1 — Twitter App API:**
- Enter your app-level **API Key**, **API Secret**, and **Bearer Token**
- Get these from [developer.twitter.com](https://developer.twitter.com) → your App → "Keys and tokens"

**Tab 2 — Account Mapping:**
- Add one entry per language you want to publish to
- Each entry needs: language, display handle, **Access Token**, and **Access Token Secret**
- To get per-user tokens: Developer Portal → your App → "Keys and tokens" → "Authentication Tokens" → Generate Access Token & Secret
- Your app must have **Read and Write** permissions

## Supported Languages

| Language | Code |
|----------|------|
| Portuguese | pt |
| English | en |
| French | fr |
| German | de |
| Italian | it |
| Chinese Simplified | zh-CN |
| Japanese | ja |
| Polish | pl |
| Norwegian | no |
| Swedish | sv |
| Austrian German | de-AT |
| Spanish | es |
| Brazilian Portuguese | pt-BR |
| Arabic | ar |

Note: `de-AT` uses the German translation and `pt-BR` uses the Portuguese translation, but each can map to a separate Twitter account.

## Usage

1. **New Tweet**: Type text in the composer, click **→ Translate**, review/edit translations, click **Publish All**
2. **From URL**: Paste a tweet URL, load it, choose Quote or Reply mode, add your text, translate, publish
3. **Images**: Attach up to 4 images — they'll be uploaded and attached to every published tweet
4. Disable individual language toggles to skip specific languages when publishing
