/**
 * 운영자 알림 (텔레그램) — 위닝 프로덕트는 타이밍 싸움이다.
 * S티어 진입·급상승(RISING)을 대시보드를 열어보기 전에 폰으로 알려준다.
 *
 * 설정 (없으면 조용히 no-op, 수집은 정상 진행):
 *   1. 텔레그램 @BotFather 에서 봇 생성 → 토큰을 TELEGRAM_BOT_TOKEN 에
 *   2. 만든 봇에게 아무 메시지 전송 후
 *      https://api.telegram.org/bot<토큰>/getUpdates 에서 chat.id 확인
 *      → TELEGRAM_CHAT_ID 에
 *   3. Railway 환경변수로 등록 (재배포 자동)
 */

const TG_API = 'https://api.telegram.org';
/** 텔레그램 sendMessage 본문 한도 — 초과분은 자르고 "외 N건"으로 요약 */
const TG_TEXT_LIMIT = 4000;
const MAX_ALERT_ITEMS = 8;

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

/** 단문 발송. 실패해도 수집을 막지 않는다 — 알림은 부가 기능. */
export async function sendTelegram(text: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  try {
    const res = await fetch(
      `${TG_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: text.slice(0, TG_TEXT_LIMIT),
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      console.error('[notify] telegram HTTP', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notify] telegram error:', err);
    return false;
  }
}

/**
 * 수집 회차의 알림 묶음 발송 — 건당 쏘면 스팸이라 회차당 1통으로 모은다.
 */
export async function sendCollectAlerts(alerts: string[]): Promise<void> {
  if (alerts.length === 0) return;
  if (!isTelegramConfigured()) {
    // 놓치고 있다는 사실은 로그로 남긴다 — 설정하면 받을 수 있는 알림이다
    console.log(`[notify] 텔레그램 미설정 — 알림 ${alerts.length}건 미발송:`, alerts.map((a) => a.split('\n')[0]));
    return;
  }
  const shown = alerts.slice(0, MAX_ALERT_ITEMS);
  const rest = alerts.length - shown.length;
  const body = [
    `🎯 위닝 프로덕트 알림 (${alerts.length}건)`,
    '',
    ...shown.map((a, i) => `${i + 1}. ${a}`),
    ...(rest > 0 ? [`…외 ${rest}건 — 대시보드에서 확인`] : []),
  ].join('\n');
  await sendTelegram(body);
}
