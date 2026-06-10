import PageHeader from '@/components/app/PageHeader';
import CommunityPage from '@/components/app/CommunityPage';

export const metadata = { title: '커뮤니티 · 스마트렌드' };

export default function Page() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        title="커뮤니티"
        accent="셀러"
        description="제품 소스·경쟁도·시연 아이디어를 공유하세요. 활동할수록 등급이 올라갑니다."
      />
      <CommunityPage />
    </div>
  );
}
