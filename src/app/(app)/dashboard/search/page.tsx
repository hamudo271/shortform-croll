import PageHeader from '@/components/app/PageHeader';
import VideoListPage from '@/components/app/VideoListPage';

export default function SearchPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="검색"
        accent="키워드"
        emoji="🔎"
        description="제목·설명·작성자로 영상을 검색하고 데이터 새로고침으로 새 키워드 수집을 트리거하세요."
      />
      <VideoListPage />
    </div>
  );
}
