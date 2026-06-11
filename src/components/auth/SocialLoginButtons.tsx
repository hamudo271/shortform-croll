/**
 * 구글 / 네이버 간편 로그인 버튼. 클릭 시 OAuth 시작 라우트로 전체 페이지 이동.
 * (서버가 state 쿠키 심고 공급자 동의화면으로 리다이렉트)
 */
export default function SocialLoginButtons({ label = '간편 로그인' }: { label?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-zinc-700" />
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="h-px flex-1 bg-zinc-700" />
      </div>

      <a
        href="/api/auth/google"
        className="w-full inline-flex items-center justify-center gap-2.5 h-11 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 text-sm font-semibold border border-zinc-300 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        Google로 계속하기
      </a>

      <a
        href="/api/auth/naver"
        className="w-full inline-flex items-center justify-center gap-2.5 h-11 rounded-xl bg-[#03C75A] hover:bg-[#02b350] text-white text-sm font-semibold transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true">
          <path fill="#fff" d="M13.06 10.69 6.66 1.5H1.5v17h5.44V9.31l6.4 9.19h5.16v-17h-5.44v9.19z" />
        </svg>
        네이버로 계속하기
      </a>
    </div>
  );
}
