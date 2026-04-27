import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';

export default function DashboardMainPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="대시보드"
        accent="전체"
        emoji="📊"
        description="3대 플랫폼에서 매일 자동 수집된 스마트렌드를 한눈에."
      />
      <VideoListPage />
    </div>
  );
}
