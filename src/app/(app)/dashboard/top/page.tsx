import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';

export default function TopPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="바이럴"
        accent="Top"
        emoji="🔥"
        description="조회수 급상승률(바이럴 점수) 기준 Top 영상."
      />
      <VideoListPage initialFilters={{ sortBy: 'viralScore', days: 7 }} />
    </div>
  );
}
