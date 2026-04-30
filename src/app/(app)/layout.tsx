import { getCurrentUser } from '@/lib/auth';
import Sidebar from '@/components/app/Sidebar';

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getCurrentUser();
  const user = sessionUser
    ? {
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
        hasActiveSubscription: sessionUser.hasActiveSubscription,
      }
    : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 overflow-x-hidden pt-14 md:pt-0">{children}</main>
    </div>
  );
}
