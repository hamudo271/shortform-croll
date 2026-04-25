import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';

export default function YouTubeDashboardPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="쇼츠"
        accent="유튜브"
        emoji="🎬"
        description="유튜브 쇼츠에서 매일 자동 수집된 바이럴 영상."
      />
      <VideoListPage platform="YOUTUBE" />
    </div>
  );
}
