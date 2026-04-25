import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';

export default function TikTokDashboardPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="바이럴"
        accent="틱톡"
        emoji="🎵"
        description="한국 틱톡에서 상품·리뷰·추천 콘텐츠만 필터링한 인기 영상."
      />
      <VideoListPage platform="TIKTOK" />
    </div>
  );
}
