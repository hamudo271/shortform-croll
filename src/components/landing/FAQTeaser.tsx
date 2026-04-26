import Link from 'next/link';
import { ArrowRight, ChevronDown } from '@/components/ui/Icon';

const FAQS = [
  {
    q: '데이터는 얼마나 신선한가요?',
    a: '매일 새벽 자동 수집됩니다. 24시간 이내의 최신 트렌드를 매일 받아보실 수 있습니다.',
  },
  {
    q: '환불이 되나요?',
    a: '결제 후 7일 이내 사용 이력이 없으면 100% 환불해 드립니다.',
  },
  {
    q: '자동 갱신되나요?',
    a: '자동 갱신은 없습니다. 28일 후 만료되며, 연장은 재입금하시면 됩니다.',
  },
  {
    q: '회원가입만 하고 결제는 나중에 할 수 있나요?',
    a: '네, 가입은 무료이며 결제 전까지는 대시보드만 잠금 상태로 유지됩니다.',
  },
];

export default function FAQTeaser() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl divide-y divide-zinc-700 shadow-card">
        {FAQS.map((f, i) => (
          <details key={i} className="group">
            <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-900 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <span className="text-base font-semibold text-zinc-50 pr-4 tracking-tight">{f.q}</span>
              <ChevronDown className="text-zinc-400 shrink-0 transition-transform group-open:rotate-180" size={18} />
            </summary>
            <div className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed">{f.a}</div>
          </details>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/pricing#faq"
          className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4"
        >
          전체 FAQ 보기
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
