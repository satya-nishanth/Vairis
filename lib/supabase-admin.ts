import { createClient } from '@supabase/supabase-js'

// Lazy-initialized: constructing eagerly at module load time crashes `next build`'s static
// page-data collection for any route that imports this file, if SUPABASE_SERVICE_ROLE_KEY isn't
// set at build time (it's a runtime-only secret here, sourced from Key Vault in Azure) — even
// though the value is only actually needed once a request comes in.
let client: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return client
}
