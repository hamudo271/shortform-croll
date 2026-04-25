import PageHeader from '@/components/app/PageHeader';
import RankedProductList from '@/components/app/RankedProductList';

export default function TikTokDashboardPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="인기 상품"
        accent="틱톡"
        emoji="🎵"
        description="틱톡에서 잘 팔리는 상품 순위. 클릭하면 상세 정보·도매처·판매처 링크를 볼 수 있습니다."
      />
      <RankedProductList platform="TIKTOK" />
    </div>
  );
}
