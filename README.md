# 바이럴 숏폼 대시보드 🔥

틱톡, 인스타그램 릴스, 유튜브 쇼츠의 바이럴 영상을 한눈에 모니터링하는 대시보드입니다.

## 주요 기능

- **3대 플랫폼 통합**: YouTube Shorts, TikTok, Instagram Reels
- **바이럴 추적**: 조회수 급상승 영상 자동 감지
- **AI 카테고리 분류**: Gemini API를 활용한 자동 분류
- **필터링**: 플랫폼/카테고리/연령대별 필터
- **매일 자동 수집**: GitHub Actions 스케줄러

## 기술 스택

- **Frontend/Backend**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API
- **Deployment**: Railway

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 수정하세요:

```env
# Railway에서 제공받은 PostgreSQL URL
DATABASE_URL="postgresql://..."

# YouTube Data API 키 (https://console.cloud.google.com)
YOUTUBE_API_KEY="your_youtube_api_key"

# Gemini API 키 (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="your_gemini_api_key"

# 팀 접속용 비밀번호
AUTH_PASSWORD="your_password"
```

### 3. 데이터베이스 마이그레이션

```bash
npx prisma generate
npx prisma db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인하세요.

## Railway 배포

### 1. Railway 프로젝트 생성

1. [Railway](https://railway.app)에 로그인
2. New Project → Deploy from GitHub repo 선택
3. 이 저장소 연결

### 2. PostgreSQL 추가

1. Railway 대시보드에서 "+ New" 클릭
2. "PostgreSQL" 선택
3. 생성된 `DATABASE_URL`을 환경 변수에 자동 연결

### 3. 환경 변수 설정

Railway 대시보드에서 다음 환경 변수 추가:

- `YOUTUBE_API_KEY`
- `GEMINI_API_KEY`
- `AUTH_PASSWORD`
- `COLLECT_API_KEY` (GitHub Actions용, AUTH_PASSWORD와 동일 값 사용 가능)

### 4. 배포

Railway가 자동으로 빌드 및 배포합니다.

## GitHub Actions 설정

매일 자동 수집을 위해 GitHub Secrets 설정:

1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. 다음 시크릿 추가:
   - `APP_URL`: Railway 앱 URL (예: https://your-app.railway.app)
   - `COLLECT_API_KEY`: 수집 API 인증 키

## API 키 발급 가이드

### YouTube Data API

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성
3. "YouTube Data API v3" 활성화
4. 사용자 인증 정보 → API 키 생성

### Gemini API

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. "Create API Key" 클릭
3. API 키 복사

## 수동 데이터 수집

```bash
# 로컬에서 테스트
curl -X POST http://localhost:3000/api/collect \
  -H "Authorization: Bearer your_password" \
  -H "Content-Type: application/json"
```

## 폴더 구조

```
src/
├── app/
│   ├── api/
│   │   ├── videos/route.ts    # 영상 목록 API
│   │   └── collect/route.ts   # 데이터 수집 API
│   └── dashboard/page.tsx     # 메인 대시보드
├── components/
│   ├── VideoCard.tsx          # 영상 카드
│   └── FilterBar.tsx          # 필터 바
└── lib/
    ├── collectors/            # 플랫폼별 수집기
    ├── classifier.ts          # AI 분류
    └── utils.ts               # 유틸리티
```

## 주의사항

- **TikTok/Instagram 크롤링**: 트렌드 집계 사이트 구조 변경 시 크롤러 수정 필요
- **API 할당량**: YouTube API 일일 10,000 유닛 한도 확인
- **비용**: Railway Hobby Plan 약 $5/월, API는 무료 티어 사용

## 라이선스

MIT
