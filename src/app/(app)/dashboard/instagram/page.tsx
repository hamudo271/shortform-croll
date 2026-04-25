import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';

export default function InstagramDashboardPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="릴스"
        accent="인스타"
        emoji="📷"
        description="인스타그램 공식 브랜드 계정 + 인기 셀러의 릴스 모음."
      />
      <VideoListPage platform="INSTAGRAM" />
    </div>
  );
}
