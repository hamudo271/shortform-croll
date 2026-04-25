import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/**
 * Dashboard gate: only ACTIVE subscribers (or admins) may view shorts data.
 * Non-subscribers are bounced to /account.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  if (!user.hasActiveSubscription && user.role !== 'ADMIN') {
    redirect('/account?expired=1');
  }
  return <>{children}</>;
}
