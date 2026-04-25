import PageHeader from '@/components/app/PageHeader';
import RankedProductList from '@/components/app/RankedProductList';

export default function InstagramDashboardPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="인기 상품"
        accent="인스타"
        emoji="📷"
        description="인스타 릴스에서 잘 팔리는 상품 순위. 클릭하면 상세 정보·도매처·판매처 링크를 볼 수 있습니다."
      />
      <RankedProductList platform="INSTAGRAM" />
    </div>
  );
}
