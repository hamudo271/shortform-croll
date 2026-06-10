# TrendScope Developer Handoff

이 폴더는 TrendScope 웹사이트와 커뮤니티/결제 테스트 서버 코드를 개발자에게 전달하기 위한 묶음입니다.

## 구성

- `index.html`: 메인 화면, 상품 목록, 커뮤니티, 구독 섹션
- `styles.css`: 전체 UI 스타일
- `app.js`: 상품 목록, 탭 전환 등 프론트엔드 동작
- `server.js`: Node.js 기본 HTTP 서버, 정적 파일 서빙, 커뮤니티 API, OAuth 초안, 토스 테스트 승인 엔드포인트
- `checkout.html`: 토스페이먼츠 테스트 결제위젯 페이지
- `success.html`: 결제 성공 후 `/confirm` 승인 요청
- `fail.html`: 결제 실패 페이지
- `order.html`: 기존 주문/결제 페이지 초안
- `terms.html`, `privacy.html`, `refund.html`: 심사용 정책 문서
- `assets/products-square/`: 상품 이미지
- `.env.example`: 실제 운영 환경변수 예시
- `render.yaml`: Render 배포 설정 예시

## 로컬 실행

```bash
node server.js
```

기본 주소:

```text
http://127.0.0.1:4174/
```

토스 테스트 결제 페이지:

```text
http://127.0.0.1:4174/checkout.html
```

## 환경변수

실제 키는 `.env`에 넣고, GitHub나 전달용 압축본에는 넣지 마세요.

필수 후보:

```text
BASE_URL=http://localhost:4174
HOST=127.0.0.1
PORT=4174

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_REDIRECT_URI=

TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
TOSS_TEST_CHECKOUT_AMOUNT=15000

NICEPAY_CLIENT_KEY=
NICEPAY_SECRET_KEY=
NICEPAY_MEMBERSHIP_AMOUNT=29800
```

## 현재 저장 방식

현재 서버는 DB 대신 `data/*.json` 파일을 임시 저장소처럼 사용합니다.

운영용 DB로 옮길 때 우선 필요한 테이블:

- `users`: 회원 정보, OAuth 계정 연결, 권한, 멤버십 상태
- `profiles`: 프로필 이름, 소개, 프로필 이미지
- `posts`: 커뮤니티 게시글
- `comments`: 댓글/대댓글
- `post_likes`: 게시글 좋아요, 유저당 1개 제한
- `reports`: 신고 기능 확장용
- `payments`: 결제 승인 기록
- `subscriptions`: 정기결제/빌링키 기록

## API 주요 경로

- `GET /api/health`
- `GET /api/community`
- `POST /api/community`
- `POST /api/community/:postId/comments`
- `POST /api/community/:postId/like`
- `GET /api/auth/me`
- `GET /api/auth/google`
- `GET /api/auth/naver`
- `POST /confirm`

## 전달 시 제외한 파일

보안상 아래 파일은 전달용 압축본에서 제외하는 것을 권장합니다.

- `.env`
- `data/sessions.json`
- `data/oauth_accounts.json`
- `data/payments.json`
- `data/billings.json`

## 공개 URL

현재 GitHub Pages 기준:

```text
https://juhyuk061210.github.io/-_-/
```

토스 테스트 페이지:

```text
https://juhyuk061210.github.io/-_-/checkout.html
```

## 2026-06-09 추가 포함 파일

- `community.js`: 커뮤니티 게시글, 댓글, 프로필, 좋아요 등 프론트엔드 동작
- `payment-widget.js`: 구독 화면 안에서 토스 테스트 결제위젯을 렌더링하는 스크립트
- `server-wrapper.js`: Render 배포 시 결제 API를 외부 포트에서 받고 내부 서버로 프록시하는 래퍼

주의: OAuth 로그인과 결제 승인은 코드 구조가 포함되어 있지만 실제 동작에는 `.env`의 Google/Naver/Toss/Nicepay 키 설정과 콜백 URL 등록이 필요합니다.
