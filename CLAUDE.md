# CLAUDE.md — viral-shorts-dashboard

## 1. 목적

미국·영어권 숏폼(TikTok/Instagram)에서 **한국 유통업자가 소싱할 만한 "위닝 프로덕트"** 를 자동 발굴해
구독제 대시보드로 보여준다. 수집 기준이 이 제품의 본체다 — 나머지(결제·커뮤니티·관리자)는 부속.

## 2. 스택 / 배포

Next.js 16 App Router · TypeScript · Tailwind · Prisma 5 + PostgreSQL · Railway.
- 배포 소스는 **main 브랜치** (main 에 push → Railway 자동 배포). 워크트리/미머지 브랜치로 검증하지 말 것.
- `railway.json` 의 `startCommand` 가 재시작마다 `npx prisma db push` 를 돈다 →
  **스키마는 추가(additive)만 안전**. 컬럼 삭제/이름변경은 데이터 손실 위험.
- 수집 트리거: `.github/workflows/collect.yml` (하루 4회 cron) → `POST /api/collect` (Bearer `COLLECT_API_KEY`).

## 3. 폴더 구조

```
src/app/(app)/     로그인 필요 화면. dashboard/* (구독 게이트), admin/* (ADMIN 게이트), account/*
src/app/api/       라우트 핸들러. collect · videos · products · community · payments/nicepay · admin/*
src/components/    VideoCard, FilterBar, VideoDetailModal + app/ 하위 페이지 컴포넌트
src/lib/           도메인 로직 (아래 표)
prisma/schema.prisma
docs/COLLECTION_CRITERIA_V2.md   ← 수집 기준 원문. 코드보다 이 문서가 먼저다
```

### src/lib 핵심 파일

| 파일 | 역할 |
|---|---|
| `collect-config.ts` | **수집 기준 v2 파라미터 전부.** 임계값·키워드·budget·캘리브레이션 토글 |
| `collect-gate.ts` | 후보 1건 판정 — 학습규칙 → 하드필터 → 비전 → 댓글 → 스코어링. 세 수집 루프가 공유 |
| `learning.ts` | **학습 루프.** 운영자 라벨(userVerdict)에서 차단제품/차단계정/키워드 적중률/점수 컷을 도출 — 매 수집 시작 시 로드되어 자동 반영 |
| `scoring.ts` | 배점 모델(수요35/속도25/제품성25/시장15, 내부 100점) → **10점 만점 환산** + S/A/B 티어 + 플래그. 측정 커버리지 60 미만이면 티어 미부여 |
| `vision.ts` | Gemini 썸네일 분석. `analyzeProductThumbnail()` 이 제품여부·제품명·가격대·브랜드를 **1콜로** 반환 |
| `comments.ts` | 댓글 구매 신호 추출(`analyzeComments`) + DPM 계산 |
| `collectors/` | 외부 수집기. `tiktok-api`(tikwm), `instagram-api`(RapidAPI), `instagram-public`(fallback) |
| `creators.ts` | 크리에이터 프로필 캐시 + bio 판매링크 판정 |
| `exclude.ts` | 비영어권/부적합 콘텐츠 제외 정규식 |
| `classifier.ts` | 카테고리·타겟연령·태그 분류 |
| `auth.ts` / `oauth.ts` / `page-guards.ts` / `admin.ts` | 세션·소셜로그인·페이지 게이트·`requireAdmin()` |
| `subscription.ts` / `nicepay.ts` | 구독 활성화 · 나이스페이 결제(운영). `toss.ts` 는 미사용 잔재 |
| `utils.ts` | 표시 포맷(formatDate/formatKRW/PLATFORM_BADGE 등) |

## 4. 핵심 동작 흐름

### 수집 (이 프로젝트의 심장)
```
GitHub Actions cron → POST /api/collect (Bearer)
  └ collectTikTokTrending / collectTikTokKeywords / collectInstagram
       각 후보 → evaluateCandidate()  [collect-gate.ts]
          H1~H4,H6 로컬필터(조회수·최신성·속도·좋아요율·영어권)
          → H5 Gemini 썸네일 1콜 (제품여부·빅브랜드·크기·가격대·제품명)
          → 댓글 수요 조회 (H5 통과분만)  ※ IG 는 댓글 API 없음 → NO_COMMENTS
          → 동일제품 계정 수 카운트(포화 판정)
          → scoreCandidate() → 0-100점 + 티어 + 플래그
       → saveVideo() upsert (create/update 동일 필드셋)
```
- 판정 순서는 **비용 순**이다. Gemini/댓글 호출을 로컬 필터 앞으로 옮기지 말 것.
- 탈락 사유는 `results.skipReasons` 로 집계되어 응답에 담긴다 — "왜 0건인지" 진단용.

### 인증 / 결제
- `middleware.ts` 는 토큰 존재만 확인, 실제 검증은 `getCurrentUser()`.
- 결제는 **나이스페이가 운영**: prepare → 결제창 → return/webhook → `activateSubscription()`. 29,800원/28일.

## 5. 코딩 컨벤션

- 주석은 **한국어로 "왜"를 적는다.** 무엇을 하는지는 코드가 말하게 둔다.
- **매직넘버 금지** — 수집 관련 상수는 전부 `collect-config.ts`. 라우트/게이트에 숫자를 박지 말 것.
- 조회수 등 카운트는 DB에서 `BigInt` → 응답 직전 `Number()` 변환.
- 에러 처리 두 가지 패턴: 루프 안에서는 `try/catch` 로 삼키고 계속 진행,
  단계 실패는 `results.errors[]` 에 누적해 200 응답으로 보고(수집 전체가 죽지 않게).
- 관리자 API 는 반드시 서버에서 `requireAdmin()` 재검증. 버튼 숨김은 보호가 아니다.
- 관리자 전용 데이터가 섞인 응답은 `Cache-Control: private, no-store`.

## 6. 외부 의존성

| 대상 | 주의 |
|---|---|
| tikwm.com (TikTok) | 무료·불안정. 레이트리밋 상태가 모듈 전역변수라 병렬에 취약 |
| RapidAPI `instagram-scraper-20251` | **무료 30회/월** → 하루 1회차 × 해시태그 1개 로테이션으로 배분(`isIgRunSlot`/`pickIgHashtags`). userinfo 는 캐시만. 유료 전환 시 env 로 확대 |
| Gemini | 썸네일 분석, 영상당 1콜. **무료 티어는 하루 20회**(실측) — 사실상 못 씀. 소진되면 서킷 브레이커가 30분간 비전을 끄고 `NO_VISION` 플래그로 수집 지속. 유료 전환 시 `GEMINI_MIN_INTERVAL_MS=0` |
| Railway PostgreSQL | 재시작마다 `db push` (위 §2) |

## 7. 작업할 때 조심할 것

- **수집 트리거는 반드시 Railway 원본 도메인(`*.up.railway.app`)으로 호출**한다.
  커스텀 도메인(`smartrend.co.kr`)은 Cloudflare 를 거쳐 ~100초에서 524 로 끊긴다.
  `HARD_BUDGET_MS`(280s)는 이 제약들보다 앞서 끝나도록 잡은 값 — 올릴 때 같이 확인할 것.
- **수집 기준을 바꿀 땐 `docs/COLLECTION_CRITERIA_V2.md` 를 먼저 고치고 코드를 맞춘다.** 반대로 하면 문서가 죽는다.
- `CALIBRATION_MODE` 는 기본 ON(Phase 0). 임계값이 확정되면 Railway 에 `CALIBRATION_MODE=false`.
  이 값 하나로 하드필터 문턱과 `SCORE_CUT` 이 동시에 바뀐다 — 개별 상수만 고치고 끝내지 말 것.
- `collect-gate.ts` 를 건드리면 `scoring.ts` 배점과 `docs/COLLECTION_CRITERIA_V2.md` §4 를 같이 봐야 한다.
- `Video.userVerdict` 는 **학습 데이터이자 수집기의 입력**이다 — `learning.ts` 가 매 회차
  이 라벨에서 규칙(차단/가점/키워드 순서/점수 컷)을 도출한다. `hidden` (노출 제어)과 다른 축.
  라벨 관련 로직을 바꾸면 `learning.ts` 의 최소 표본 임계값(LEARN_*)도 같이 볼 것.
- `EXCLUDE_PATTERNS` 가 `lib/exclude.ts` 와 `api/cleanup/route.ts` 에 각각 있고 **값이 다르다**.
  한쪽만 고치면 수집/정리 기준이 어긋난다 (통합은 아직 안 됨).
- 세션 HMAC 키는 운영 env `AUTH_SECRET` (2026-07-31 설정됨). 지우면 `COLLECT_API_KEY` 폴백으로
  떨어지며 경고 로그가 찍힌다 — 이 값을 바꾸면 전 사용자 세션이 무효화(재로그인)된다.
- 나이스페이 webhook 은 통보를 믿지 않는다 — `fetchNicepayPayment(tid)` 로 나이스페이 원장을
  직접 조회해 상태·금액이 맞아야 활성화 (2026-07-31). 이 검증을 우회하는 코드를 넣지 말 것.
- `/api/cron`·`/api/cleanup` 의 삭제는 **라벨(userVerdict) 있는 영상을 건드리지 않는다** —
  라벨은 학습 정답지다. 새 정리 로직을 추가할 때도 이 보호를 유지할 것.
- 테스트가 0개다. 변경 후 검증은 `npm run lint` → `npx tsc --noEmit` → `npm run build` → 실제 수집 1회.
