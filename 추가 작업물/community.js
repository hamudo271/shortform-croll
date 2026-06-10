(function () {
  let currentUser = null;
  let activeSort = "hot";
  let pendingImage = "";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const apiBase = () =>
    (window.TRENDSCOPE_API_BASE ||
      document.querySelector('meta[name="trendscope-api-base"]')?.content ||
      localStorage.getItem("trendscopeApiBase") ||
      "").replace(/\/+$/, "");
  const apiUrl = (path) => `${apiBase()}${path}`;
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  function setStatus(message) {
    const status = $("#communityStatus");
    if (status) status.textContent = message;
  }

  function timeAgo(value) {
    const timestamp = new Date(value).getTime();
    if (!timestamp) return "";
    const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "방금 전";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  }

  function avatar(name, image, size = "") {
    const letter = escapeHtml((name || "M").slice(0, 1).toUpperCase());
    return `<span class="avatar ${size}">${image ? `<img src="${escapeHtml(image)}" alt="" />` : letter}</span>`;
  }

  function renderLevel(level) {
    if (!level) return;
    $("#tierBadge") && ($("#tierBadge").textContent = level.tier || "Starter");
    $("#tierScore") && ($("#tierScore").textContent = `${level.xp || 0} XP${level.nextTier ? ` · 다음 ${level.nextTier} ${level.nextXp} XP` : ""}`);
    $("#tierProgressBar") && ($("#tierProgressBar").style.width = `${Math.max(0, Math.min(100, Number(level.progress || 0)))}%`);
    $$("[data-tier]").forEach((item) => item.classList.toggle("active", item.dataset.tier === level.tier));
  }

  async function refreshLevel() {
    if (!apiBase()) return;
    try {
      const response = await fetch(apiUrl("/api/community/level"), { credentials: "include" });
      if (response.ok) renderLevel(await response.json());
    } catch {}
  }

  function renderAuth(user) {
    currentUser = user;
    const loggedIn = Boolean(user);
    $("#authPanel")?.classList.toggle("is-hidden", loggedIn);
    $("#userPanel")?.classList.toggle("is-hidden", !loggedIn);
    $("#communityForm")?.classList.toggle("is-hidden", !loggedIn);
    if (!user) return;
    const avatarEl = $("#currentUserAvatar");
    if (avatarEl) {
      avatarEl.innerHTML = user.profileImage ? `<img src="${escapeHtml(user.profileImage)}" alt="" />` : escapeHtml((user.name || user.email || "M").slice(0, 1).toUpperCase());
    }
    $("#currentUserName") && ($("#currentUserName").textContent = user.name || "Member");
    $("#currentUserEmail") && ($("#currentUserEmail").textContent = user.email || "로그인됨");
  }

  async function refreshAuth() {
    if (!apiBase()) return;
    try {
      const response = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
      if (!response.ok) throw new Error("auth failed");
      const data = await response.json();
      renderAuth(data.authenticated ? data.user : null);
    } catch {
      renderAuth(null);
    }
  }

  function renderComment(comment, postId) {
    const reply = Boolean(comment.parentId);
    return `
      <div class="comment ${reply ? "reply" : ""}">
        ${avatar(comment.name, comment.profileImage, "small")}
        <div>
          <strong>${escapeHtml(comment.name || "Member")}</strong>
          <span>${timeAgo(comment.createdAt)}</span>
          <p>${escapeHtml(comment.message)}</p>
          ${!reply ? `<button class="reply-link" type="button" data-reply-to="${escapeHtml(comment.id)}" data-post-id="${escapeHtml(postId)}">답글</button>` : ""}
        </div>
      </div>
    `;
  }

  function renderPost(post) {
    const comments = (post.comments || []).filter((comment) => comment.status !== "hidden" && comment.status !== "deleted");
    const liked = currentUser && post.likedBy?.includes(currentUser.id);
    return `
      <article class="community-post" data-post-id="${escapeHtml(post.id)}">
        <div class="post">
          ${avatar(post.name, post.profileImage)}
          <div class="post-main">
            <div class="post-meta"><strong>${escapeHtml(post.name || "Member")}</strong><span>${timeAgo(post.createdAt)}</span></div>
            <h4>${escapeHtml(post.title)}</h4>
            <p>${escapeHtml(post.message)}</p>
            ${post.image ? `<img class="attached-image" src="${escapeHtml(post.image)}" alt="" />` : ""}
            <div class="post-actions">
              <button class="${liked ? "liked" : ""}" type="button" data-like-post="${escapeHtml(post.id)}">좋아요 ${post.likes || 0}</button>
              <button type="button" data-toggle-comments="${escapeHtml(post.id)}">댓글 ${comments.length}</button>
            </div>
            <div class="comment-drawer" data-comments-for="${escapeHtml(post.id)}">
              ${comments.map((comment) => renderComment(comment, post.id)).join("") || `<p class="profile-empty">첫 댓글을 남겨보세요.</p>`}
              <form class="comment-form" data-comment-form="${escapeHtml(post.id)}">
                <input name="message" maxlength="260" placeholder="댓글을 입력하세요" required />
                <button type="submit">댓글</button>
              </form>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  async function refreshFeed() {
    if (!apiBase()) return;
    try {
      setStatus("Loading");
      const response = await fetch(apiUrl(`/api/community?sort=${activeSort}`), { credentials: "include" });
      if (!response.ok) throw new Error("feed failed");
      const posts = await response.json();
      const feed = $("#communityFeed");
      if (feed) feed.innerHTML = posts.length ? posts.map(renderPost).join("") : `<div class="profile-empty">아직 게시글이 없습니다. 첫 제품 소스를 공유해보세요.</div>`;
      $("#postCount") && ($("#postCount").textContent = posts.length);
      $("#replyCount") && ($("#replyCount").textContent = posts.flatMap((post) => post.comments || []).length);
      setStatus("Live");
    } catch {
      setStatus("Server offline");
    }
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      if (!file.type.startsWith("image/")) return reject(new Error("이미지 파일만 올릴 수 있습니다."));
      if (file.size > 2_000_000) return reject(new Error("이미지는 2MB 이하만 올릴 수 있습니다."));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function renderPreview(image) {
    const preview = $("#postImagePreview");
    if (!preview) return;
    preview.classList.toggle("is-hidden", !image);
    preview.innerHTML = image ? `<img src="${escapeHtml(image)}" alt="" /><button type="button">×</button>` : "";
    preview.querySelector("button")?.addEventListener("click", () => {
      pendingImage = "";
      $("#communityImage") && ($("#communityImage").value = "");
      renderPreview("");
    });
  }

  async function submitPost(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!currentUser) {
      $("#loginModal")?.classList.remove("is-hidden");
      return;
    }
    const title = $("#communityTitle")?.value.trim();
    const message = $("#communityMessage")?.value.trim();
    if (!title || !message) return;
    try {
      setStatus("Posting");
      const response = await fetch(apiUrl("/api/community"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, image: pendingImage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글 작성에 실패했습니다.");
      form?.reset();
      pendingImage = "";
      renderPreview("");
      await refreshFeed();
      await refreshLevel();
      setStatus("Level updated");
    } catch (error) {
      alert(error.message || "게시글 작성에 실패했습니다.");
      setStatus("Live");
    }
  }

  async function likePost(postId) {
    if (!currentUser) {
      $("#loginModal")?.classList.remove("is-hidden");
      return;
    }
    await fetch(apiUrl(`/api/community/${encodeURIComponent(postId)}/like`), { method: "POST", credentials: "include" });
    await refreshFeed();
    await refreshLevel();
  }

  async function submitComment(event, postId, parentId = "") {
    event.preventDefault();
    if (!currentUser) {
      $("#loginModal")?.classList.remove("is-hidden");
      return;
    }
    const form = event.target.closest("[data-comment-form]");
    const input = form?.querySelector("input[name='message']");
    const message = input?.value.trim();
    if (!message) return;
    const response = await fetch(apiUrl(`/api/community/${encodeURIComponent(postId)}/comments`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, parentId }),
    });
    if (!response.ok) alert("댓글 작성에 실패했습니다.");
    if (input) {
      input.value = "";
      input.dataset.parentId = "";
    }
    await refreshFeed();
    await refreshLevel();
  }

  function bind() {
    $("#communityForm")?.addEventListener("submit", submitPost);
    $("#communityImage")?.addEventListener("change", async (event) => {
      try {
        pendingImage = await readImage(event.target.files?.[0]);
        renderPreview(pendingImage);
      } catch (error) {
        alert(error.message);
        event.target.value = "";
      }
    });
    $$("[data-feed-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        $$("[data-feed-sort]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        activeSort = button.dataset.feedSort || "hot";
        refreshFeed();
      });
    });
    $("#communityFeed")?.addEventListener("click", (event) => {
      const like = event.target.closest("[data-like-post]");
      if (like) return void likePost(like.dataset.likePost);
      const toggle = event.target.closest("[data-toggle-comments]");
      if (toggle) {
        $$("[data-comments-for]").find((item) => item.dataset.commentsFor === toggle.dataset.toggleComments)?.classList.toggle("open");
        return;
      }
      const reply = event.target.closest("[data-reply-to]");
      if (reply) {
        const drawer = $$("[data-comments-for]").find((item) => item.dataset.commentsFor === reply.dataset.postId);
        const input = drawer?.querySelector("input[name='message']");
        if (input) {
          input.value = `@${reply.closest(".comment")?.querySelector("strong")?.textContent || "reply"} `;
          input.dataset.parentId = reply.dataset.replyTo;
          input.focus();
        }
      }
    });
    $("#communityFeed")?.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-comment-form]");
      if (!form) return;
      const input = form.querySelector("input[name='message']");
      submitComment(event, form.dataset.commentForm, input?.dataset.parentId || "");
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bind();
    await refreshAuth();
    await refreshFeed();
    await refreshLevel();
  });
})();
