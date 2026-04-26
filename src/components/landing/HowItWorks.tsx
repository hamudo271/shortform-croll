import { Refresh, Sparkles, TrendingUp } from '@/components/ui/Icon';

const STEPS = [
  {
    n: '01',
    Icon: Refresh,
    title: '매일 자동 수집',
    body: '유튜브 쇼츠·틱톡·인스타 릴스에서 새 인기 영상을 매일 새벽 자동으로 가져옵니다.',
  },
  {
    n: '02',
    Icon: Sparkles,
    title: 'AI 자동 분류',
    body: 'Gemini AI가 7개 카테고리·연령대로 분류. 상품/리뷰 콘텐츠만 골라냅니다.',
  },
  {
    n: '03',
    Icon: TrendingUp,
    title: '순위·매출 계산',
    body: '조회수·좋아요로 1·2·3등 순위를 매기고, 예상 매출까지 자동 산출합니다.',
  },
];

export default function HowItWorks() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {STEPS.map((s) => (
        <div
          key={s.n}
          className="bg-zinc-950 border border-zinc-700 rounded-2xl p-8 shadow-card hover:shadow-card-hover hover:border-blue-500/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/20">
              <s.Icon size={20} strokeWidth={2} />
            </div>
            <span className="text-display text-3xl font-bold text-zinc-700 tabular-nums tracking-[-0.02em]">
              {s.n}
            </span>
          </div>
          <h3 className="text-display text-lg font-bold text-zinc-50 mb-2 tracking-[-0.015em]">
            {s.title}
          </h3>
          <p className="text-sm text-zinc-400 leading-[1.7]">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
