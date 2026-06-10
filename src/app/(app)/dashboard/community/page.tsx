import PageHeader from '@/components/app/PageHeader';
import CommunityPage from '@/components/app/CommunityPage';

export const metadata = { title: '커뮤니티 · 스마트렌드' };

export default function Page() {
  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        title="멤버 커뮤니티"
        accent="셀러"
        description="글을 작성하면 서버에 저장되고 다른 멤버 화면에도 표시됩니다. 활동량에 따라 등급이 오릅니다."
      />
      <CommunityPage />
    </div>
  );
}
