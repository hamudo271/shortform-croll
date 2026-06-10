(function () {
  const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
  const testAmount = 15000;
  const $ = (selector) => document.querySelector(selector);
  let widgets = null;
  let rendered = false;

  function setStatus(message) {
    const status = $("#paymentStatus");
    if (status) status.textContent = message;
  }

  function ensurePolicyLinks() {
    const footer = document.querySelector("footer");
    if (!footer || document.querySelector(".footer-links")) return;

    const links = document.createElement("div");
    links.className = "footer-links";
    links.setAttribute("aria-label", "정책 문서");
    Object.assign(links.style, {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: "8px 14px",
      width: "100%",
      marginTop: "14px",
      fontSize: "13px",
    });
    links.innerHTML = [
      '<a href="terms.html">이용약관</a>',
      '<a href="privacy.html">개인정보처리방침</a>',
      '<a href="refund.html">환불정책</a>',
    ].join("");
    footer.appendChild(links);
  }

  async function renderTestWidget() {
    if (rendered) return;
    if (!window.TossPayments) throw new Error("TossPayments SDK가 로드되지 않았습니다.");

    const tossPayments = TossPayments(clientKey);
    widgets = tossPayments.widgets({ customerKey: "ANONYMOUS" });

    await widgets.setAmount({
      currency: "KRW",
      value: testAmount,
    });

    await Promise.all([
      widgets.renderPaymentMethods({
        selector: "#payment-method",
        variantKey: "DEFAULT",
      }),
      widgets.renderAgreement({
        selector: "#agreement",
        variantKey: "DEFAULT",
      }),
    ]);

    const button = $("#paymentButton");
    if (button) button.textContent = "토스 테스트 결제하기";
    rendered = true;
    setStatus("결제수단을 선택한 뒤 결제하기를 누르면 토스 테스트 결제창이 열립니다.");
  }

  async function requestTestPayment() {
    await renderTestWidget();
    if (!widgets) return;

    const orderId = `test_order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await widgets.requestPayment({
      orderId,
      orderName: "TrendScope 결제 테스트",
      successUrl: new URL("success.html?testCheckout=1", location.href).href,
      failUrl: new URL("fail.html", location.href).href,
    });
  }

  function bind() {
    const form = $("#orderForm");
    if (!form) return;

    form.removeAttribute("action");
    $("#coupon-box")?.closest(".coupon-row")?.remove();
    $("#orderEmail")?.closest("label")?.remove();
    $("#orderName")?.closest("label")?.remove();

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const button = $("#paymentButton");
        if (button) button.disabled = true;
        setStatus("토스 테스트 결제창을 여는 중입니다.");

        try {
          await requestTestPayment();
        } catch (error) {
          setStatus(error.message || "토스 테스트 결제창을 열지 못했습니다.");
          if (button) button.disabled = false;
        }
      },
      true,
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensurePolicyLinks();
    bind();
    if (location.hash === "#subscribe") renderTestWidget().catch((error) => setStatus(error.message));
  });

  window.addEventListener("hashchange", () => {
    if (location.hash === "#subscribe") renderTestWidget().catch((error) => setStatus(error.message));
  });
})();
