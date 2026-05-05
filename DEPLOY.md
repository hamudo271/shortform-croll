# 배포 가이드

스마트렌드(SMARTREND) 운영 배포 절차. 다른 작업자가 처음부터 배포 환경에 접근하거나 새 변경을 운영에 반영할 때 이 문서를 따른다.

---

## 시스템 개요

| 항목 | 값 |
|---|---|
| **GitHub** | <https://github.com/hamudo271/shortform-croll> |
| **운영 URL** | <https://shortform-croll-production.up.railway.app> |
| **호스팅** | Railway (Nixpacks 빌드) |
| **DB** | Railway PostgreSQL (이미 프로비저닝됨, `DATABASE_URL` 환경변수로 연결) |
| **자동 배포 트리거** | `main` 브랜치 push 시 Railway가 감지하여 자동 빌드·배포 |
| **데이터 수집 cron** | GitHub Actions, 매일 KST 06:00 (`UTC 21:00`) — `.github/workflows/collect.yml` |

---

## 배포 (코드 변경 → 운영 반영)

가장 일반적인 흐름. **GitHub의 `main`에 push 하면 자동 배포된다.**

```bash
# 1. 변경 사항 커밋
git add <변경 파일>
git commit -m "feat: ..."

# 2. main으로 push (Railway 자동 트리거)
git push origin main
```

**소요시간**: push 후 약 2~5분 (Nixpacks 빌드 + 컨테이너 재기동).

**Railway가 자동으로 실행하는 명령** (`railway.json`에 정의):
- Build: `npm run build`
- Start: `npx prisma db push && npx next start`
  - `prisma db push`는 Prisma 스키마와 운영 DB를 자동 동기화 (별도 마이그레이션 명령 불필요)

### 브랜치 작업 후 머지하는 경우

```bash
# 작업 브랜치에서 커밋
git checkout claude/feature-x
git commit -am "..."
git push origin claude/feature-x

# main에 머지 (PR을 거치든, 직접 머지하든)
git checkout main
git merge claude/feature-x --ff-only
git push origin main   # → Railway 자동 배포
```

> ⚠️ 워크트리(`.claude/worktrees/...`)에서 작업 중이라면 main을 그쪽에서 직접 체크아웃할 수 없다. 메인 워크트리(`/Users/mcthemax/Desktop/viral-shorts-dashboard`)에서 머지·푸시할 것.

---

## 운영 즉시 검증 (배포 후 1~2분)

```bash
# 1) 사이트 응답 확인
curl -I https://shortform-croll-production.up.railway.app/

# 2) 수집 endpoint 작동 확인 (실제로 1회 수집 트리거됨, ~60초 소요)
curl -X POST 'https://shortform-croll-production.up.railway.app/api/collect' \
  -H "Authorization: Bearer $COLLECT_API_KEY" \
  -H "Content-Type: application/json" \
  --max-time 300
# 응답에 success:true + videosCollected/tiktokCollected/instagramCollected 포함이면 정상
```

---

## 환경변수 (Railway 대시보드 → Variables)

운영에서 반드시 설정돼 있어야 하는 키. **Railway 대시보드 → Project → Variables 탭에서 관리.** 코드 push로는 못 바꾼다.

| 키 | 용도 | 비고 |
|---|---|---|
| `DATABASE_URL` | Postgres 연결 | Railway가 PostgreSQL 플러그인 추가하면 자동 주입 |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | Google Cloud Console에서 발급 |
| `GEMINI_API_KEY` | (선택) Gemini AI 분류 | 없으면 키워드 기반 fallback |
| `NEXTAUTH_SECRET` | 세션 토큰 서명 | 32자+ 랜덤 문자열 |
| `NEXTAUTH_URL` | 운영 도메인 | `https://shortform-croll-production.up.railway.app` |
| `AUTH_PASSWORD` | 레거시 보호 | 사용 중 |
| `COLLECT_API_KEY` | `/api/collect` 보호 토큰 | GitHub Actions cron에서도 사용 |
| `RAPIDAPI_KEY` | (선택) Instagram RapidAPI 우회 | 활성화 시 IG 메뉴 다시 노출 가능 |
| `ADMIN_EMAIL` | (선택) 새 가입자 자동 ADMIN 승격 | 단일 이메일만 |

> 환경변수를 바꾸면 Railway가 자동으로 컨테이너를 재기동한다.

---

## GitHub Actions Secrets (cron용)

데이터 수집 cron이 운영 endpoint를 호출하기 위해 필요. **GitHub repo → Settings → Secrets and variables → Actions**:

| 키 | 값 |
|---|---|
| `APP_URL` | `https://shortform-croll-production.up.railway.app` |
| `COLLECT_API_KEY` | Railway의 `COLLECT_API_KEY`와 동일한 값 |

수집 워크플로 정의: [`.github/workflows/collect.yml`](.github/workflows/collect.yml)

수동 트리거 가능: GitHub repo → Actions → Daily Data Collection → Run workflow.

---

## 로컬 개발

```bash
# 1) 의존성 설치
npm install

# 2) .env 파일 (운영과 별개의 DB로 권장. 운영 DB를 그대로 쓰려면 Railway DATABASE_URL을 복붙)
cp .env.example .env  # .env.example가 있으면. 없으면 직접 작성.

# 3) Prisma client 생성 (스키마 변경 시 매번)
npx prisma generate

# 4) 스키마와 DB 동기화 (DB가 비어있거나 마이그레이션 필요할 때)
npx prisma db push

# 5) 개발 서버 시작
npm run dev   # http://localhost:3000

# 6) (선택) 로컬에서 수집 1회 실행
curl -X POST 'http://localhost:3000/api/collect' \
  -H "Authorization: Bearer $COLLECT_API_KEY"
```

---

## DB 직접 쿼리 (긴급 시)

```bash
# Prisma Studio (GUI)
npx prisma studio

# Node REPL로 직접 쿼리
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log(await p.video.count());
  await p.\$disconnect();
})();
"
```

운영 DB 접속 정보는 `.env`의 `DATABASE_URL` 또는 Railway 대시보드 → PostgreSQL → Connect 탭.

---

## 롤백

운영에 문제 있는 변경이 나갔을 때:

```bash
# 1) 안전한 마지막 커밋 SHA 확인
git log --oneline origin/main -10

# 2) 그 시점으로 되돌리는 새 커밋 만들기 (history는 보존, force-push 안 함)
git revert <문제 커밋 SHA>
git push origin main   # Railway가 다시 자동 배포
```

force-push로 history를 덮어쓰는 건 권장하지 않음. revert가 안전.

---

## 자주 막히는 지점

- **"수집 실패" UI 에러**: 라우트가 `geo:'KR'` 같은 옛 파라미터를 보내고 있는지 / inner fetch 타임아웃인지 확인. `src/app/api/trigger-collect/route.ts` + `maxDuration` 검사.
- **Edge/Safari에서만 옛 화면**: 브라우저 캐시. Ctrl+F5 또는 InPrivate 창. 코드 문제 아님.
- **`prisma db push` 실패**: 운영 중인 행을 손실시킬 수 있는 변경(컬럼 삭제, NOT NULL 추가 등)이면 `--accept-data-loss` 필요. 하지만 가능하면 변경을 단계적으로 (예: nullable로 추가 → 백필 → NOT NULL 변경).
- **GitHub Actions cron이 401 반환**: GitHub Secrets의 `COLLECT_API_KEY`가 Railway의 값과 일치하는지 확인.
- **Railway 빌드 실패**: 보통 `npx tsc --noEmit`이 통과하는데도 빌드는 깨질 수 있음 (Next.js 빌드 시 Prisma 타입까지 엄격). `npm run build`를 로컬에서 한 번 돌려보고 push.

---

## 개정 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-04 | 최초 문서화 |
