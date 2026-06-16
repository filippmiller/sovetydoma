import AdminShell from '@/components/admin/AdminShell'
import AdminPushNotifications from '@/components/admin/AdminPushNotifications'

export default function AdminPushPage() {
  return (
    <AdminShell activeNav="push">
      <AdminPushNotifications />
    </AdminShell>
  )
}
