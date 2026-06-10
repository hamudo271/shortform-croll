# TrendScope

GitHub에 올릴 TrendScope 프로젝트 폴더입니다.

## 포함된 파일

- `index.html`, `styles.css`, `app.js`: 프론트 화면
- `assets/products-square/`: 상품 이미지 20개
- `order.html`, `success.html`, `fail.html`: 토스페이먼츠 심사용 결제 페이지
- `server.js`, `package.json`, `render.yaml`: 커뮤니티 백엔드 초안(Render 배포용)
- `data/`: 로컬 JSON 저장소 초안
- `.env.example`: 환경변수 예시

## 주의

- 실제 비밀키가 들어 있는 `.env`는 일부러 포함하지 않았습니다.
- GitHub Pages에 올리면 프론트 화면은 열립니다.
- 여러 사람이 동시에 쓰는 실제 커뮤니티는 Render/Supabase 같은 서버/DB 연결이 필요합니다.

## GitHub Pages 기본 실행

레포지토리에 이 폴더 안의 파일들을 루트로 올리면 `index.html`이 메인 페이지가 됩니다.
