import { notFound } from 'next/navigation';
import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';
import { Category } from '@prisma/client';

const CAT_LABELS: Record<string, { label: string; emoji: string }> = {
  beauty: { label: '뷰티', emoji: '💄' },
  food: { label: '식품', emoji: '🍱' },
  fashion: { label: '패션', emoji: '👗' },
  electronics: { label: '전자기기', emoji: '🎧' },
  lifestyle: { label: '라이프', emoji: '🏠' },
  health: { label: '헬스', emoji: '💪' },
  kids: { label: '키즈', emoji: '🧸' },
};

export default async function CategoryDetailPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const meta = CAT_LABELS[cat];
  if (!meta) notFound();
  const upper = cat.toUpperCase() as Category;

  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title={meta.label}
        accent="카테고리"
        emoji={meta.emoji}
        description={`${meta.label} 관련 바이럴 쇼츠 모음.`}
      />
      <VideoListPage category={upper} />
    </div>
  );
}
