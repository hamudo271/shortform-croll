# CLAUDE.md — viral-shorts-dashboard (스마트렌드 / SMARTREND)

## 1. 목적
해외(주로 미국) TikTok·Instagram의 **상업(세일즈) 숏폼**을 자동 수집해, 한국 유통업자에게
바이럴 상품 트렌드를 보여주는 구독형 대시보드. 밈/댄스/일상 콘텐츠는 게이트에서 제외한다.

## 2. 스택 / 배포
- Next.js 16 (App Router) · React · TailwindCSS · TypeScript
- Prisma 5.22 + PostgreSQL(Railway). 배포: Railway (`railway.json`).
- 자동 수집: GitHub Actions `.github/workflows/collect.yml` (하루 4회 cron → `/api/collect` 호출).
- 명령어: `npm run dev` / `npm run build`(= `prisma generate && next build`) / `npm run lint`(`eslint src`).
  타입체크는 `npx tsc --noEmit` (`.next/` 노이즈 1건은 무시).

## 3. 폴더 구조
```
src/app/
  (app)/           로그인 필요 영역. layout=getCurrentUser 게이트
    dashboard/       영상 목록·상세 (구독 or ADMIN 게이트)
    admin/           관리자 전용 (ADMIN 게이트)
    account/         구독·프로필
  login, signup/   인증 페이지(클라이언트 폼)
  api/             ↓ 4번 참고
src/components/    landing/(랜딩) · app/(대시보드 UI) · ui/(공용 위젯)
src/lib/          ↓ 아래
prisma/schema.prisma   모델 정의
scripts/          seed·수집 테스트 스크립트(라이브 DB/키 사용 주의)
```
**핵심 lib (자주 수정)**
| 파일 | 역할 |
|---|---|
| `lib/collect-config.ts` | 수집 튜닝 상수 — 조회수 하한·예산(ms)·viralScore 구간·`TIKTOK_KEYWORDS`. **매직넘버는 여기로.** |
| `lib/seller-rules.ts` | 셀러 판정 규칙(정규식+순수함수) `isQualifiedSeller`/`computeHasSalesLink`. 튜닝 잦음. |
| `lib/creators.ts` | Creator 캐시(7일 TTL) `getOrFetchCreator`. 규칙은 seller-rules 재노출. |
| `lib/comments.ts` | 댓글 구매의도 점수 `scorePurchaseIntent`/`evaluatePass` + 임계값. |
| `lib/collectors/` | `tiktok-api`(tikwm), `instagram-api`(RapidAPI), `instagram-public`, `trendCollector`. |
| `lib/classifier.ts`·`vision.ts` | 카테고리 분류(Gemini/키워드), 썸네일 얼굴 판정. |
| `lib/auth.ts`·`oauth.ts`·`page-guards.ts` | 세션(HMAC 쿠키)·소셜로그인·페이지 권한 가드. |
| `lib/utils.ts` | 표시 유틸: `formatCount`·`formatDate`·`PLATFORM_BADGE`·`PLATFORM_NAMES` 등. |
| `lib/subscription.ts`·`nicepay.ts`·`toss.ts` | 구독 활성화 / 결제 게이트웨이. |

## 4. 핵심 동작 흐름
### 수집 (제품의 심장) — `POST /api/collect`
```
collect.yml (cron) → curl POST /api/collect (Authorization: Bearer COLLECT_API_KEY)
  route.ts POST():  wall-clock budget 관리
    STEP3a TikTok 트렌딩: getTikTokTrending → 게이트 → prisma.video.upsert
    STEP3b TikTok 키워드: TIKTOK_KEYWORDS 순회 → searchTikTokVideos → 게이트 → upsert
    STEP4  Instagram:     collectReelsByHashtags(RapidAPI) → 게이트 → upsert
  게이트 공통: 조회수≥MIN_VIEW_COUNT → 영어권/한글제외 → 최신성(RECENCY_WINDOW_DAYS)
             → 셀러링크(getOrFetchCreator+seller-rules) → 얼굴제외(vision) → 분류
```
- `GET /api/collect` = 수집 현황(플랫폼별 건수·최근 수집시각).
- `/api/cron?key=` = 30일/한글 정리 + `/api/collect` 호출 + 썸네일 갱신(별도 스케줄).
### 인증
`middleware.ts`(토큰 존재만) → 서버 컴포넌트 `getCurrentUser()`(서명검증+DB) → layout/`page-guards` 게이트.
### 결제/구독
`/account` → `payments/(nicepay/)prepare` → 결제창 → `nicepay/return`·`webhook` → `activateSubscription()`.
**운영은 나이스페이(NICEPAY)**, 토스 코드는 잔재.

## 5. 코딩 컨벤션 (이 리포의 실제 방식)
- **파일 상단 한국어 주석**으로 "왜 이렇게"를 남긴다(의뢰인 요구/함정 명시). 유지할 것.
- **매직넘버 금지** → 튜닝값은 `collect-config.ts`/`comments.ts`/`seller-rules.ts` 상수로. 인라인 숫자 넣지 말 것.
- 카운트류는 Prisma `BigInt`. viralScore는 `computeViralScore(views)` 사용(직접 ternary 금지).
- **API 인증**: 수집/크론 계열은 `Bearer`/`?key=` = `COLLECT_API_KEY || AUTH_PASSWORD`. 사용자 API는 `getCurrentUser`.
- **에러 처리 두 갈래**: 수집 내부 루프는 개별 `try/catch`로 삼켜 **다음 항목 계속**(한 건 실패가 전체를 막지 않음);
  표시/배치 API는 `results.errors[]`에 누적해 200으로 반환. 이 패턴을 따를 것.
- 표시 문자열/색상은 `lib/utils.ts` 상수 재사용. UI 컴포넌트에 비즈니스 로직 넣지 말 것.

## 6. 작업 시 주의 (함정)
- **`collect-config.ts`의 `HARD_BUDGET_MS`(520s)는 collect.yml의 `curl --max-time 600`보다 작아야** 한다.
  넘기면 GitHub Actions가 먼저 끊어 partial 응답조차 못 받는다(과거 0건 수집 원인).
- **`PLATFORM_DOT`은 VideoCard(`teal-500`)와 VideoDetailModal(`teal-400`) 값이 다르다** — 공용화하면 색이 바뀐다.
  통일하려면 겉보기 변화 확인 후.
- **`EXCLUDE_PATTERNS`가 `lib/exclude.ts`와 `api/cleanup/route.ts`에 각각 다른 값으로 존재** — 이름만 같은 별개 필터.
  한쪽만 고치면 다른 필터는 안 바뀐다. 통합 금지(값 상이).
- **collect의 두 TikTok 루프 upsert는 `update` 필드가 다르다**(키워드 루프는 title/category/tags 등 미갱신).
  이건 알려진 이슈(별도 목록). 함부로 통일하면 재수집 동작이 바뀐다.
- 수집 게이트를 손대면 **seller-rules ↔ comments ↔ collect/route 게이트 순서**를 함께 봐야 한다(값싼 필터 먼저).
- `getOrFetchCreator` 수정 시 TikTok/Instagram 양쪽 호출부(collect/route.ts) 영향 확인.
- **외부 의존성 한계**: RapidAPI(instagram-scraper-20251)는 무료 30회/월 → 쉽게 429. tikwm은 불안정.
  수집 0건일 때 코드보다 **쿼터/외부 API 상태를 먼저 의심**.
- 운영에 `AUTH_SECRET` 미설정 → 현재 세션 서명이 `COLLECT_API_KEY`로 대체됨(보안 약점, 별도 이슈).
- `railway.json`이 컨테이너 기동마다 `prisma db push` 실행(마이그레이션 아님) — 스키마 변경 시 데이터 위험 주의.
- 실제 배포 기준은 **메인 체크아웃의 `main` 브랜치**. `.claude/worktrees/*`는 옛 커밋 스냅샷이라 검증에 쓰지 말 것.
- 테스트 없음 — 변경 후 `npm run lint` + `npx tsc --noEmit`, 가능하면 수집/결제/로그인 수동 확인.
