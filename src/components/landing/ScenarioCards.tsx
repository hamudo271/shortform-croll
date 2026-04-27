const SCENARIOS = [
  {
    tag: '뷰티',
    title: '올리브영 신상 발견',
    flow: [
      '스마트렌드에서 BEAUTY 카테고리 인기 영상 확인',
      '"00 클렌징 디바이스" 제품 정보 확보',
      '도매처 바로가기 → 1688에서 동일 상품 검색',
      '입고 후 SmartStore에 등록 · 매출 발생',
    ],
  },
  {
    tag: '라이프',
    title: '다이소 꿀템 알리 직구',
    flow: [
      'LIFESTYLE 카테고리 Top 10 매일 확인',
      '저가 인기 아이템 점찍기',
      '알리바바·1688에서 도매가 비교',
      '마진 30%+ 확보 후 쿠팡 입점',
    ],
  },
  {
    tag: '라이브',
    title: '라이브 방송 큐레이션',
    flow: [
      '오늘의 Top 바이럴 5분 만에 스캔',
      '예상 매출 높은 3-5개 상품 픽',
      '라이브 셋업 + 협찬 컨택',
      '방송 당일 매출 극대화',
    ],
  },
];

export default function ScenarioCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {SCENARIOS.map((s) => (
        <div
          key={s.title}
          className="bg-zinc-950 border border-zinc-700 rounded-2xl p-7 shadow-card hover:shadow-card-hover hover:border-blue-500/40 transition-all duration-200"
        >
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold mb-5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 uppercase tracking-wider">
            {s.tag}
          </span>
          <h3 className="text-display text-lg font-bold text-zinc-50 mb-5 tracking-[-0.015em] leading-snug">
            {s.title}
          </h3>
          <ol className="space-y-3">
            {s.flow.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold mt-0.5 tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm text-zinc-300 leading-[1.6]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
