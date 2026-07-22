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
| `collect-gate.ts` | 후보 1건 판정 — 하드필터 → 비전 → 댓글 → 스코어링. 세 수집 루프가 공유 |
| `scoring.ts` | 100점 배점 모델(수요35/속도25/제품성25/시장15) → S/A/B 티어 + 플래그 |
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
| RapidAPI `instagram-scraper-20251` | **무료 30회/월**. 초과 시 429 → IG 0건. 캘리브레이션은 TikTok 중심으로 |
| Gemini | 썸네일 분석. 영상당 1콜 — 여기에 콜을 더 추가하면 wall-clock budget 초과 |
| Railway PostgreSQL | 재시작마다 `db push` (위 §2) |

## 7. 작업할 때 조심할 것

- **`HARD_BUDGET_MS`(520s) < GitHub Actions `curl --max-time`(600s)** 순서를 깨지 말 것.
  넘기면 curl 이 먼저 끊어 그 회차 수집분이 통째로 날아간다.
- **수집 기준을 바꿀 땐 `docs/COLLECTION_CRITERIA_V2.md` 를 먼저 고치고 코드를 맞춘다.** 반대로 하면 문서가 죽는다.
- `CALIBRATION_MODE` 는 기본 ON(Phase 0). 임계값이 확정되면 Railway 에 `CALIBRATION_MODE=false`.
  이 값 하나로 하드필터 문턱과 `SCORE_CUT` 이 동시에 바뀐다 — 개별 상수만 고치고 끝내지 말 것.
- `collect-gate.ts` 를 건드리면 `scoring.ts` 배점과 `docs/COLLECTION_CRITERIA_V2.md` §4 를 같이 봐야 한다.
- `Video.userVerdict` 는 **학습 데이터**다. `hidden` (노출 제어)과 다른 축이니 섞지 말 것.
- `EXCLUDE_PATTERNS` 가 `lib/exclude.ts` 와 `api/cleanup/route.ts` 에 각각 있고 **값이 다르다**.
  한쪽만 고치면 수집/정리 기준이 어긋난다 (통합은 아직 안 됨).
- 운영에 `AUTH_SECRET` 미설정 → 세션 HMAC 키가 `COLLECT_API_KEY` 로 폴백된다 (`auth.ts`). **알려진 보안 취약점, 미해결.**
- 나이스페이 webhook 에 서명 검증이 없다. **알려진 취약점, 미해결.**
- 테스트가 0개다. 변경 후 검증은 `npm run lint` → `npx tsc --noEmit` → `npm run build` → 실제 수집 1회.
