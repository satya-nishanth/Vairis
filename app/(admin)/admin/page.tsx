import { redirect } from 'next/navigation'

/** /admin has no content of its own — land admins on the dashboard. */
export default function AdminIndexPage() {
  redirect('/admin/dashboard')
}
