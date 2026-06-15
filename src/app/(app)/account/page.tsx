import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SUBSCRIPTION_PRICE_KRW, SUBSCRIPTION_DAYS } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { levelFromActivity, TIER_LABEL } from '@/lib/community';
import ProfileEditor from '@/components/app/ProfileEditor';
import { PlusCircle } from '@/components/ui/Icon';

function formatKRW(amount: number) {
  return amount.toLocaleString('ko-KR') + '원';
}

function formatDate(d: Date | null | undefined) {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function daysUntil(d: Date | null | undefined) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** 비관리자: 커뮤니티 활동 레벨 라벨 계산. */
async function communityLevelLabel(userId: string): Promise<string> {
  const [posts, comments] = await Promise.all([
    prisma.communityPost.findMany({
      where: { authorId: userId, status: 'PUBLISHED' },
      select: {
        id: true,
        likes: { where: { userId: { not: userId } }, select: { id: true } },
        comments: { where: { status: 'PUBLISHED', authorId: { not: userId } }, select: { id: true } },
      },
    }),
    prisma.communityComment.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
  ]);
  const receivedLikes = posts.reduce((s, p) => s + p.likes.length, 0);
  const receivedComments = posts.reduce((s, p) => s + p.comments.length, 0);
  const level = levelFromActivity({ posts: posts.length, comments, receivedLikes, receivedComments });
  return `${TIER_LABEL[level.tier] || level.tier} · ${level.xp} XP`;
}

export default async function AccountPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login');

  const isAdmin = session.role === 'ADMIN';
  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { profileImage: true },
  });
  const levelLabel = isAdmin ? '관리자' : await communityLevelLabel(session.id);

  const remaining = daysUntil(session.subscriptionEndAt);

  const subscriptionCard = (
    <section>
      <h2 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-4">구독 상태</h2>
      {session.hasActiveSubscription ? (
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-7 sm:p-8 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              활성
            </span>
            <span className="text-sm text-zinc-400">{remaining}일 남음</span>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-7">
            <div>
              <div className="text-xs text-zinc-400 mb-1.5 font-semibold">만료일</div>
              <div className="text-display text-2xl text-zinc-50 font-bold tracking-[-0.02em]">{formatDate(session.subscriptionEndAt)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1.5 font-semibold">상품</div>
              <div className="text-display text-2xl text-zinc-50 font-bold tracking-[-0.02em]">
                {SUBSCRIPTION_DAYS}일 · {formatKRW(SUBSCRIPTION_PRICE_KRW)}
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-5 h-11 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-sm"
          >
            <PlusCircle size={14} strokeWidth={2.25} />
            대시보드로 이동
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-7 sm:p-8 shadow-card">
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {session.subscriptionStatus === 'EXPIRED' ? '만료됨' : session.subscriptionStatus === 'CANCELED' ? '취소됨' : '미구독'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-display text-4xl sm:text-5xl font-bold text-zinc-50 tracking-[-0.04em]">
                {SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}
              </span>
              <span className="text-xl text-zinc-400 font-medium">원</span>
              <span className="text-sm text-zinc-400">/ {SUBSCRIPTION_DAYS}일</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              스마트렌드 상품 DB·커뮤니티를 이용하려면 구독이 필요합니다.
              카드로 결제하면 <b className="text-zinc-200">즉시 {SUBSCRIPTION_DAYS}일</b> 활성화됩니다. 자동 갱신 없음.
            </p>
            <Link
              href="/account/subscribe"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-6 h-12 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              <PlusCircle size={15} strokeWidth={2.25} />
              {formatKRW(SUBSCRIPTION_PRICE_KRW)} 결제하고 구독하기
            </Link>
          </div>
          <p className="text-xs text-zinc-500 text-center">
            카드 결제가 어려우면 관리자에게 문의해 직접 활성화받을 수 있습니다.
          </p>
        </div>
      )}
    </section>
  );

  return (
    <div className="max-w-[900px] mx-auto px-6 sm:px-10 py-10">
      <ProfileEditor
        email={session.email}
        initialName={session.name || ''}
        initialImage={dbUser?.profileImage || ''}
        isAdmin={isAdmin}
        levelLabel={levelLabel}
      >
        {subscriptionCard}
      </ProfileEditor>
    </div>
  );
}
