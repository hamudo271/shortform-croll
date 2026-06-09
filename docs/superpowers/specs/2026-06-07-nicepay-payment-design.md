# NicePay 단건결제 연동 — 설계 문서

작성일: 2026-06-07
대상: 스마트렌드 (Next.js App Router + Prisma/PostgreSQL on Railway)

## 1. 목표

현재 "계좌 입금 → 관리자 수동 활성화" 구독 결제를, **NicePay 카드/간편결제로
자동 결제 → 구독 자동 활성화**로 대체한다. 기존 수동 활성화 경로는 fallback 으로
유지한다(제거하지 않음).

## 2. 확정 결정 사항

| 항목 | 결정 |
|---|---|
| 결제 모델 | **단건결제** (28일 1회 결제, 자동 갱신 없음 — 현 정책 유지) |
| 연동 방식 | **NicePay 직접 연동** (NICEPAY 2.0, Server 승인 모델 / JS SDK) |
| 결제 수단 | **카드 + 간편결제** (`method: "cardAndEasyPay"` — 카카오/네이버페이 포함) |
| 승인 안정성 | **(A) returnUrl 리다이렉트만** (webhook 미사용 — 단순/빠른 출시) |
| 환불 | **Phase 1: NicePay 가맹점 콘솔에서 수동 취소** (코드 미구현) |
| 가맹점 | 계약 완료, 운영 키 보유 (테스트는 NicePay 테스트 모드로 선검증) |

## 3. 결제 금액 / 기간

- 금액: `SUBSCRIPTION_PRICE_KRW` = 29,800원 (src/lib/auth.ts 기존 상수 재사용)
- 기간: `SUBSCRIPTION_DAYS` = 28일
- 활성/연장 로직: 기존 `/api/admin/users/[id]/subscribe` 의 "isExtendable → 연장,
  아니면 신규 생성" 규칙을 공통 헬퍼로 추출해 결제 승인 시 재사용한다.

## 4. 결제 흐름 (NICEPAY 2.0 Server 승인 모델)

```
[사용자] 결제 버튼 클릭 (로그인 상태 필수)
   │
   ▼
[서버] POST /api/payments/nicepay/prepare
   - orderId 생성 (cuid 기반, 64바이트 이내, 유니크)
   - Payment(status=PENDING, userId, amount=29800) 생성
   - { clientId, orderId, amount, goodsName, returnUrl } 반환
   │
   ▼
[클라이언트] NicePay JS SDK 로드(https://pay.nicepay.co.kr/v1/js/)
   - AUTHNICE.requestPay({ clientId, method:"cardAndEasyPay",
       orderId, amount, goodsName, returnUrl })
   │
   ▼
[NicePay 결제창] 카드/간편결제 인증 (카드정보는 NicePay만 취급)
   │
   ▼ (인증 결과 POST)
[서버] POST /api/payments/nicepay/approve  ← returnUrl
   - 수신: authResultCode, tid, amount, signature, orderId, authToken, clientId
   - 1) authResultCode === "0000" 확인 (아니면 실패 처리)
   - 2) 서명 검증: hex(sha256(authToken + clientId + amount + SecretKey)) === signature
   - 3) Payment 조회 (orderId) — 존재·PENDING·금액 일치 확인 (멱등성)
   - 4) NicePay 승인 API 호출:
        POST https://api.nicepay.co.kr/v1/payments/{tid}
        Authorization: Basic base64(clientId:secretKey)
        body: { amount }
   - 5) 승인 응답 resultCode 성공 확인 + 응답 금액 == 29800 재확인
   - 6) Payment(status=PAID, tid, approvedAt, raw) 갱신
   - 7) 구독 28일 활성화/연장 (공통 헬퍼)
   - 8) 302 리다이렉트 → /payment/result?status=success
   │  (실패 시 Payment(status=FAILED) + /payment/result?status=fail&reason=...)
   ▼
[사용자] /payment/result 결과 페이지
```

## 5. 데이터 모델 — Payment (신규)

```prisma
model Payment {
  id         String        @id @default(cuid())
  orderId    String        @unique          // 우리가 발급, NicePay 주문번호
  tid        String?                         // NicePay 거래키 (승인 후)
  userId     String
  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount     Int                             // KRW
  status     PaymentStatus @default(PENDING) // PENDING | PAID | FAILED | CANCELED
  method     String?                         // 승인 응답의 결제수단 (card, kakaopay 등)
  goodsName  String?
  approvedAt DateTime?
  failReason String?
  raw        Json?                           // NicePay 승인 응답 원본 (감사/환불 참조)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@index([userId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  CANCELED
}
```

User 모델에 `payments Payment[]` 역참조 추가. 마이그레이션은 기존 관례대로
`npx prisma db push`.

## 6. 컴포넌트 / 파일

| 파일 | 역할 |
|---|---|
| `prisma/schema.prisma` | Payment 모델 + PaymentStatus enum |
| `src/lib/nicepay.ts` | 서버 헬퍼: `verifyAuthSignature()`, `approvePayment(tid, amount)`, `buildOrderId()`, 상수(API base, JS SDK URL) |
| `src/lib/subscription.ts` | `activateOrExtendSubscription(userId, {amount, days, memo})` — subscribe 라우트에서 추출한 공통 로직 |
| `src/app/api/payments/nicepay/prepare/route.ts` | 세션 인증 → orderId 발급 + Payment(PENDING) → 결제 파라미터 반환 |
| `src/app/api/payments/nicepay/approve/route.ts` | returnUrl 핸들러: 검증 → 승인 → 구독활성 → 결과페이지 리다이렉트 |
| `src/app/payment/result/page.tsx` | 성공/실패 결과 페이지 (status 쿼리 파싱) |
| `src/components/app/CheckoutButton.tsx` | JS SDK 로드 + prepare 호출 + AUTHNICE.requestPay 트리거 |
| `src/app/(app)/pricing/page.tsx`, `account/page.tsx` | "결제하기" 버튼 연결, "PG 준비 중" 안내문 교체 |

## 7. 환경변수

| 키 | 노출 | 용도 |
|---|---|---|
| `NICEPAY_CLIENT_ID` | 서버 | 승인 API Basic 인증 |
| `NICEPAY_SECRET_KEY` | **서버 전용** | 승인 API + 서명 검증 (절대 클라이언트 노출 X) |
| `NEXT_PUBLIC_NICEPAY_CLIENT_ID` | 클라이언트 | JS SDK clientId (공개 가능 값) |
| `NEXT_PUBLIC_APP_URL` | 클라이언트 | returnUrl 절대경로 구성 |

Railway 환경변수로 사용자가 직접 등록 (RapidAPI 때와 동일). 테스트 키로 먼저
검증 후 운영 키 교체.

## 8. 보안

- **secretKey 서버 전용** — 클라이언트 번들에 절대 포함 금지.
- **승인 전 3중 검증**: ① 서명(hex(sha256(authToken+clientId+amount+SecretKey)))
  ② Payment.amount == 수신 amount == 29,800 ③ orderId 존재·PENDING 상태.
- **멱등성**: orderId unique. approve 가 중복 호출되면 이미 PAID 인 Payment 는
  재승인하지 않고 성공 리다이렉트만.
- **금액 변조 방지**: 승인 API 응답 금액도 기대 금액과 재대조.
- 모든 결제 이벤트를 ActivityLog 또는 Payment.raw 로 감사 기록.

## 9. 리다이렉트-only(A) 트레이드오프 & 완화

webhook 미사용이므로, 사용자가 NicePay 인증 직후 returnUrl 도달 전에 창을 닫으면
"승인 API 미호출 = 결제 미완료" 상태가 될 수 있다. 단, NICEPAY 2.0 는 승인 API 를
호출해야만 실제 매출이 발생하므로 **돈은 빠져나가지 않는다**(인증만 되고 미승인).

완화책:
- prepare 가 Payment(PENDING) 를 남기므로, 관리자 페이지에서 **PENDING 결제 목록**을
  조회해 미완료 건을 식별 가능.
- 결과 페이지에 "결제가 안 되었나요? 다시 시도" 경로 제공.
- (향후) Phase 2 에서 webhook 도입 시 자동 보정.

## 10. 범위 밖 (향후)

- webhook 기반 승인 보정 (Phase 2)
- 관리자 환불 버튼 → NicePay 취소 API (Phase 2)
- 정기결제(빌링키) 자동 갱신 (별도 스펙)
- 가상계좌 입금대기/통지 (현재 cardAndEasyPay 만)

## 11. 테스트 계획

1. NicePay **테스트 키**로 prepare → requestPay → 테스트 카드 결제 → approve →
   구독 활성 확인 (로컬, prod DB 또는 로컬 DB).
2. 멱등성: 동일 orderId 로 approve 재호출 시 중복 구독 연장 없음 확인.
3. 변조: amount 를 조작한 요청이 서명 검증에서 거부되는지 확인.
4. 실패 플로우: authResultCode != 0000 → Payment(FAILED) + 실패 페이지.
5. 운영 키 교체 후 소액 실결제 1건으로 최종 검증 (환불은 콘솔에서).

## 12. 기존 정책/문구 영향

- pricing 페이지의 "카드 결제(PG)는 준비 중입니다... 계좌 입금 후 관리자 활성화"
  안내문을 결제 버튼으로 교체. 단 "자동 갱신 없음" 문구는 유지(단건결제라 정확).
- FAQ "7일 환불"은 콘솔 수동 환불로 이행 가능 — 문구 변경 불필요.
