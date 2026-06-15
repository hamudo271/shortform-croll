import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/**
 * 페이지 가드: 관리자 전용.
 * 원본 영상 수집 데이터(대시보드·틱톡·릴스·카테고리·검색·Top)는 관리자만 본다.
 * 비로그인 → 로그인, 비관리자 → 구독자용 상품목록으로 보냄.
 */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/dashboard/products');
  return user;
}
