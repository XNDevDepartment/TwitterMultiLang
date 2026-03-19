import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    // Disable Next.js extended fetch caching so every query hits the DB fresh
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
  },
})
