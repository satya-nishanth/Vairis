export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    ok: true,
    // Deploy fingerprint — bump when upload path changes so staging can be verified.
    upload: 'sas-v1',
    storage: process.env.STORAGE_PROVIDER ?? 'supabase',
  })
}
