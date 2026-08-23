import { requireAdmin } from '@/lib/auth'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
