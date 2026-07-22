import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/app/PageHeader';
import { ChevronRight } from '@/components/ui/Icon';
import { CALIBRATION_MODE, SCORE_CUT, TIER_S, TIER_A, TIER_B } from '@/lib/collect-config';

/**
 * Phase 0 보정 분석 — 기준서 docs/COLLECTION_CRITERIA_V2.md "학습 루프" 3단계.
 *
 * 운영자가 찍은 라벨(💰/🤔/❌)을 정답지로 삼아 "지금 기준이 맞았는지"를 역산한다.
 * 핵심 표는 '점수 구간별 소싱감 비율' — 여기서 SCORE_CUT 을 어디로 옮길지 결정한다.
 * admin layout 이 ADMIN 게이트를 이미 수행.
 */
export const dynamic = 'force-dynamic';

/** 10점 척도 구간. max 는 배타적이라 최상단만 10 을 포함하도록 11 로 둔다. */
const SCORE_BANDS = [
  { min: 8, max: 11, label: '8.0 – 10' },
  { min: 6, max: 8, label: '6.0 – 7.9' },
  { min: 4, max: 6, label: '4.0 – 5.9' },
  { min: 2, max: 4, label: '2.0 – 3.9' },
  { min: 0, max: 2, label: '0 – 1.9' },
];

interface Labeled {
  userVerdict: string | null;
  productScore: number;
  viewsPerDay: number;
  purchaseIntentScore: number;
  viewCount: bigint;
  likeCount: bigint;
  category: string | null;
  priceBand: string | null;
  platform: string;
  flags: string[];
  scoreBreakdown: unknown;
}

/**
 * 측정된 배점 합. 비전/댓글이 막힌 회차에 저장된 레코드는 이 값이 작고,
 * 그런 점수를 정상 점수와 같은 표에 섞으면 "몇 점부터 소싱감인가" 가 왜곡된다.
 */
function coverageOf(r: Labeled): number {
  const b = r.scoreBreakdown as { measurableMax?: number } | null;
  return typeof b?.measurableMax === 'number' ? b.measurableMax : 0;
}
const MIN_COMPARABLE_COVERAGE = 60;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** 소싱감 비율 — 이 값이 높은 구간이 실제로 건질 게 있는 구간이다. */
function winRate(rows: Labeled[]): number {
  const decided = rows.filter((r) => r.userVerdict === 'WINNER' || r.userVerdict === 'REJECT');
  return pct(decided.filter((r) => r.userVerdict === 'WINNER').length, decided.length);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card">
      <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1.5">{label}</div>
      <div className="text-display text-2xl font-bold text-zinc-50 tracking-[-0.025em]">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export default async function CalibrationPage() {
  const [labeled, totalVideos] = await Promise.all([
    prisma.video.findMany({
      where: { userVerdict: { not: null } },
      select: {
        userVerdict: true, productScore: true, viewsPerDay: true, purchaseIntentScore: true,
        viewCount: true, likeCount: true, category: true, priceBand: true, platform: true, flags: true,
        scoreBreakdown: true,
      },
      take: 3000,
    }),
    prisma.video.count(),
  ]);

  const rows = labeled as Labeled[];
  const winners = rows.filter((r) => r.userVerdict === 'WINNER');
  const maybes = rows.filter((r) => r.userVerdict === 'MAYBE');
  const rejects = rows.filter((r) => r.userVerdict === 'REJECT');

  // 점수 비교는 측정 조건이 같은 것끼리만 — 그래야 점수 컷을 옮길 근거가 된다
  const comparable = rows.filter((r) => coverageOf(r) >= MIN_COMPARABLE_COVERAGE);
  const excluded = rows.length - comparable.length;

  const likeRate = (r: Labeled) =>
    Number(r.viewCount) > 0 ? Math.round((Number(r.likeCount) / Number(r.viewCount)) * 1000) / 10 : 0;

  // 신호별 중앙값 비교 — 💰 와 ❌ 가 갈리는 지점이 곧 새 임계값 후보
  const signals = [
    { name: '위닝 점수 (10점 만점)', get: (r: Labeled) => r.productScore, unit: '' },
    { name: '일 조회수 (viewsPerDay)', get: (r: Labeled) => r.viewsPerDay, unit: '' },
    { name: '좋아요율', get: likeRate, unit: '%' },
    { name: '구매의도 댓글 비율', get: (r: Labeled) => r.purchaseIntentScore, unit: '%' },
  ];

  const bands = SCORE_BANDS.map((b) => {
    const inBand = comparable.filter((r) => r.productScore >= b.min && r.productScore < b.max);
    return { ...b, count: inBand.length, win: inBand.filter((r) => r.userVerdict === 'WINNER').length, rate: winRate(inBand) };
  });

  // 권장 컷 — 소싱감 비율이 50% 이상으로 유지되는 가장 낮은 구간
  const decidedBands = bands.filter((b) => b.count >= 3);
  const recommendedCut = [...decidedBands].reverse().find((b) => b.rate >= 50)?.min ?? null;

  const byCategory = Object.entries(
    rows.reduce<Record<string, Labeled[]>>((acc, r) => {
      const k = r.category || 'UNKNOWN';
      (acc[k] ||= []).push(r);
      return acc;
    }, {}),
  )
    .map(([name, rs]) => ({ name, count: rs.length, win: rs.filter((r) => r.userVerdict === 'WINNER').length, rate: winRate(rs) }))
    .sort((a, b) => b.count - a.count);

  const byPrice = Object.entries(
    rows.reduce<Record<string, Labeled[]>>((acc, r) => {
      const k = r.priceBand || 'unknown';
      (acc[k] ||= []).push(r);
      return acc;
    }, {}),
  )
    .map(([name, rs]) => ({ name, count: rs.length, win: rs.filter((r) => r.userVerdict === 'WINNER').length, rate: winRate(rs) }))
    .sort((a, b) => b.count - a.count);

  const enough = rows.length >= 30;

  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10 space-y-8">
      <nav className="text-xs text-zinc-400 flex items-center gap-1.5">
        <Link href="/admin" className="hover:text-zinc-100">관리자</Link>
        <ChevronRight size={12} />
        <span className="text-zinc-300">수집 기준 보정</span>
      </nav>

      <PageHeader title="수집 기준 보정" accent="캘리브레이션" emoji="🎯" />

      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-5 text-sm text-zinc-300 leading-relaxed">
        대시보드 영상 카드의 <strong className="text-zinc-50">💰 소싱감 / 🤔 애매 / ❌ 탈락</strong> 버튼으로 평가한 결과를
        정답지 삼아 지금 수집 기준이 맞는지 역산합니다. 아래 <strong className="text-zinc-50">점수 구간별 소싱감 비율</strong>에서
        건질 게 있는 구간을 찾아 <code className="text-sky-400">SCORE_CUT</code> 을 옮기면 됩니다.
        <div className="mt-2 text-xs text-zinc-400">
          현재 모드: <span className={CALIBRATION_MODE ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
            {CALIBRATION_MODE ? '캘리브레이션 (기준 완화, 점수 컷 없음)' : '정식 기준'}
          </span>
          {' · '}저장 컷 {SCORE_CUT} · 티어 S {TIER_S} / A {TIER_A} / B {TIER_B} (10점 만점)
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="평가 완료" value={rows.length.toLocaleString()} sub={`전체 ${totalVideos.toLocaleString()}개 중`} />
        <Stat label="💰 소싱감" value={winners.length.toLocaleString()} sub={`${pct(winners.length, rows.length)}%`} />
        <Stat label="🤔 애매" value={maybes.length.toLocaleString()} sub={`${pct(maybes.length, rows.length)}%`} />
        <Stat label="❌ 탈락" value={rejects.length.toLocaleString()} sub={`${pct(rejects.length, rows.length)}%`} />
      </section>

      {!enough && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 text-sm text-amber-300">
          표본이 {rows.length}개라 아직 결론을 내기 이릅니다. 최소 30개, 가능하면 100개 이상 평가한 뒤 보시는 걸 권합니다.
        </div>
      )}

      {/* 핵심 표 — 어느 점수부터 건질 게 있는가 */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-bold text-zinc-50">점수 구간별 소싱감 비율</h2>
          <p className="text-xs text-zinc-400 mt-1">
            비율 = 💰 ÷ (💰 + ❌). 🤔 는 판단 보류라 제외했습니다.
            {excluded > 0 && (
              <> · 측정 공백이 큰 <span className="text-amber-400 font-semibold">{excluded}건</span>은
                점수 비교에서 제외 (비전/댓글이 막힌 회차에 저장돼 같은 잣대로 못 봅니다)</>
            )}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 border-b border-zinc-700">
            <tr className="text-xs text-zinc-400 uppercase tracking-wider">
              <th className="text-left px-6 py-3 font-semibold">점수 구간</th>
              <th className="text-right px-6 py-3 font-semibold">평가 수</th>
              <th className="text-right px-6 py-3 font-semibold">💰</th>
              <th className="text-left px-6 py-3 font-semibold">소싱감 비율</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {bands.map((b) => (
              <tr key={b.label} className="text-zinc-200">
                <td className="px-6 py-3 font-semibold text-zinc-50">{b.label}</td>
                <td className="px-6 py-3 text-right tabular-nums text-zinc-400">{b.count}</td>
                <td className="px-6 py-3 text-right tabular-nums">{b.win}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden max-w-[240px]">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${b.rate}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-300 w-10">{b.count ? `${b.rate}%` : '–'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {enough && (
          <div className="px-6 py-4 border-t border-zinc-700 text-sm">
            {recommendedCut !== null ? (
              <>권장 <code className="text-sky-400">SCORE_CUT</code>: <span className="text-zinc-50 font-bold">{recommendedCut.toFixed(1)}</span>
                <span className="text-zinc-400"> — 이 구간부터 소싱감 비율이 50% 이상입니다.</span></>
            ) : (
              <span className="text-zinc-400">아직 소싱감 비율 50%를 넘는 구간이 없습니다. 배점(§4)이나 키워드를 손봐야 할 수 있습니다.</span>
            )}
          </div>
        )}
      </section>

      {/* 신호별 중앙값 — 💰 와 ❌ 가 갈리는 지점 */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-bold text-zinc-50">신호별 중앙값 — 💰 vs ❌</h2>
          <p className="text-xs text-zinc-400 mt-1">두 값이 크게 갈리는 신호일수록 좋은 필터입니다. 붙어 있으면 그 신호는 변별력이 없습니다.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 border-b border-zinc-700">
            <tr className="text-xs text-zinc-400 uppercase tracking-wider">
              <th className="text-left px-6 py-3 font-semibold">신호</th>
              <th className="text-right px-6 py-3 font-semibold">💰 소싱감</th>
              <th className="text-right px-6 py-3 font-semibold">❌ 탈락</th>
              <th className="text-right px-6 py-3 font-semibold">차이</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {signals.map((s) => {
              const w = median(winners.map(s.get));
              const r = median(rejects.map(s.get));
              const gap = w - r;
              return (
                <tr key={s.name} className="text-zinc-200">
                  <td className="px-6 py-3">{s.name}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-emerald-400 font-semibold">{w.toLocaleString()}{s.unit}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-zinc-400">{r.toLocaleString()}{s.unit}</td>
                  <td className={`px-6 py-3 text-right tabular-nums font-semibold ${gap > 0 ? 'text-emerald-400' : gap < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                    {gap > 0 ? '+' : ''}{gap.toLocaleString()}{s.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 카테고리 / 가격대별 적중률 — 키워드 로테이션을 어디에 몰아줄지 판단 */}
      <section className="grid md:grid-cols-2 gap-4">
        {[
          { title: '카테고리별 소싱감 비율', rows: byCategory },
          { title: '추정 가격대별 소싱감 비율', rows: byPrice },
        ].map((tbl) => (
          <div key={tbl.title} className="bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden shadow-card">
            <div className="px-6 py-4 border-b border-zinc-700">
              <h2 className="text-sm font-bold text-zinc-50">{tbl.title}</h2>
            </div>
            {tbl.rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-zinc-500">평가 데이터가 없습니다</div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-800">
                  {tbl.rows.map((r) => (
                    <tr key={r.name} className="text-zinc-200">
                      <td className="px-6 py-3">{r.name}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-zinc-500 text-xs">{r.count}개 중 💰 {r.win}</td>
                      <td className="px-6 py-3 text-right tabular-nums font-semibold w-16">{r.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      <div className="text-xs text-zinc-500 leading-relaxed">
        보정을 반영하려면 <code className="text-zinc-400">src/lib/collect-config.ts</code> 의 값을 고치거나 Railway 환경변수
        (<code className="text-zinc-400">MIN_VIEWS_PER_DAY</code>, <code className="text-zinc-400">MIN_VIEW_COUNT</code>,
        {' '}<code className="text-zinc-400">MIN_LIKE_RATE</code>, <code className="text-zinc-400">RECENCY_WINDOW_DAYS</code>)로 덮어쓰면 됩니다.
        정식 기준으로 전환할 때는 <code className="text-zinc-400">CALIBRATION_MODE=false</code>.
      </div>
    </div>
  );
}
