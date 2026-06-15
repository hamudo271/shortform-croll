import { notFound } from 'next/navigation';
import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';
import { Category } from '@prisma/client';
import { requireAdminPage } from '@/lib/page-guards';

const CAT_LABELS: Record<string, string> = {
  beauty: '뷰티',
  food: '식품',
  fashion: '패션',
  electronics: '전자기기',
  lifestyle: '라이프',
  health: '헬스',
  kids: '키즈',
};

export default async function CategoryDetailPage({ params }: { params: Promise<{ cat: string }> }) {
  await requireAdminPage();
  const { cat } = await params;
  const label = CAT_LABELS[cat];
  if (!label) notFound();
  const upper = cat.toUpperCase() as Category;

  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title={label}
        accent="카테고리"
        description={`${label} 관련 스마트렌드 모음.`}
      />
      <VideoListPage category={upper} />
    </div>
  );
}
