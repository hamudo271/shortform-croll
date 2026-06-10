'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, MessageSquare } from '@/components/ui/Icon';
import { TIER_LABEL } from '@/lib/community';

interface Comment {
  id: string;
  authorId: string;
  name: string;
  message: string;
  parentId: string | null;
  createdAt: string;
}
interface Post {
  id: string;
  authorId: string;
  name: string;
  profileImage: string | null;
  title: string;
  message: string;
  image: string | null;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  comments: Comment[];
}
interface Level {
  tier: string;
  xp: number;
  progress: number;
  nextTier: string;
  nextXp: number;
  stats?: { posts: number; comments: number; receivedLikes: number; receivedComments: number };
}

const TIERS = [
  { name: 'Starter', min: 0, desc: '게시물 작성과 댓글 참여 시작' },
  { name: 'Builder', min: 40, desc: '꾸준한 댓글, 질문, 제품 소스 공유' },
  { name: 'Operator', min: 100, desc: '좋아요를 받는 게시물과 활발한 답글' },
  { name: 'Insider', min: 180, desc: '커뮤니티에서 검증된 고활동 멤버' },
];

const TIER_GRADIENT: Record<string, string> = {
  Starter: 'from-zinc-500 to-zinc-600',
  Builder: 'from-sky-500 to-blue-600',
  Operator: 'from-violet-500 to-purple-600',
  Insider: 'from-amber-400 to-orange-500',
};

function timeAgo(value: string): string {
  const t = new Date(value).getTime();
  if (!t) return '';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return '방금 전';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const letter = (name || 'M').slice(0, 1).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-zinc-800 text-zinc-200 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </span>
  );
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  const [sort, setSort] = useState<'hot' | 'new'>('hot');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState('');
  const [err, setErr] = useState('');

  const loadFeed = useCallback(async () => {
    const r = await fetch(`/api/community?sort=${sort}`);
    if (r.ok) setPosts(await r.json());
  }, [sort]);
  const loadLevel = useCallback(async () => {
    const r = await fetch('/api/community/level');
    if (r.ok) setLevel(await r.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFeed(), loadLevel()]).finally(() => setLoading(false));
  }, [loadFeed, loadLevel]);

  const onImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('이미지 파일만 올릴 수 있습니다.');
    if (file.size > 2_000_000) return setErr('이미지는 2MB 이하만 가능합니다.');
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setPosting(true);
    setErr('');
    try {
      const r = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, image }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '작성 실패');
      setTitle('');
      setMessage('');
      setImage('');
      await Promise.all([loadFeed(), loadLevel()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '작성 실패');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    await fetch(`/api/community/${postId}/like`, { method: 'POST' });
    await Promise.all([loadFeed(), loadLevel()]);
  };

  const totalReplies = useMemo(() => posts.reduce((n, p) => n + p.comments.length, 0), [posts]);
  const tier = level?.tier || 'Starter';

  return (
    <div className="space-y-4">
      {/* ===== 레벨 카드 (히어로 + 4등급 그리드) ===== */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center justify-center px-3 h-8 rounded-lg bg-gradient-to-br ${TIER_GRADIENT[tier] || TIER_GRADIENT.Starter} text-white text-sm font-bold shadow-sm`}>
              {TIER_LABEL[tier] || tier}
            </span>
            <div>
              <div className="text-lg font-bold text-zinc-50 tabular-nums">{level?.xp ?? 0} XP</div>
              <div className="text-xs text-zinc-500">
                {level?.nextTier
                  ? `다음 ${TIER_LABEL[level.nextTier] || level.nextTier}까지 ${Math.max(0, level.nextXp - level.xp)} XP`
                  : '최고 등급 달성'}
              </div>
            </div>
          </div>
          {level?.stats && (
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span>글 <b className="text-zinc-200 tabular-nums">{level.stats.posts}</b></span>
              <span>댓글 <b className="text-zinc-200 tabular-nums">{level.stats.comments}</b></span>
              <span>받은 좋아요 <b className="text-zinc-200 tabular-nums">{level.stats.receivedLikes}</b></span>
            </div>
          )}
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-[width]" style={{ width: `${level?.progress ?? 0}%` }} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {TIERS.map((t) => {
            const active = tier === t.name;
            return (
              <div
                key={t.name}
                className={`p-3 rounded-xl border transition-colors ${
                  active ? 'border-blue-500/40 bg-blue-500/5' : 'border-zinc-800 bg-zinc-950/40'
                }`}
              >
                <div className="text-[11px] font-bold text-blue-500 tabular-nums">{t.min} XP</div>
                <div className="text-sm font-bold text-zinc-50 mt-0.5">{TIER_LABEL[t.name] || t.name}</div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 피드 + About ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] items-start gap-4">
        {/* Feed */}
        <section className="space-y-4">
          {/* 작성 폼 */}
          <form onSubmit={submitPost} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="제목 — 어떤 제품/소스를 공유하시나요?"
              className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={360}
              rows={3}
              placeholder="제품 소스, 판매 인증, 질문을 남겨보세요."
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none"
            />
            {image && (
              <div className="relative inline-block w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="max-h-36 rounded-lg border border-zinc-700" />
                <button type="button" onClick={() => setImage('')} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs">×</button>
              </div>
            )}
            {err && <p className="text-xs text-rose-500">{err}</p>}
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                📷 사진 추가
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
              </label>
              <button
                type="submit"
                disabled={posting || !title.trim() || !message.trim()}
                className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {posting ? '게시 중…' : '게시하기'}
              </button>
            </div>
          </form>

          {/* 정렬 */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
              {(['hot', 'new'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-3 h-7 rounded-md text-xs font-semibold transition-colors ${
                    sort === s ? 'bg-zinc-50 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {s === 'hot' ? '인기' : '최신'}
                </button>
              ))}
            </div>
            <span className="text-xs text-zinc-500">
              글 <b className="text-zinc-300 tabular-nums">{posts.length}</b> · 댓글 <b className="text-zinc-300 tabular-nums">{totalReplies}</b>
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-500">불러오는 중…</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 py-12 text-center text-sm text-zinc-500">아직 게시글이 없습니다. 첫 제품 소스를 공유해보세요.</div>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  open={openComments.has(p.id)}
                  onToggleComments={() =>
                    setOpenComments((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
                  }
                  onLike={() => toggleLike(p.id)}
                  onCommented={() => Promise.all([loadFeed(), loadLevel()])}
                />
              ))}
            </div>
          )}
        </section>

        {/* About */}
        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 grid gap-3 self-start">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-50">커뮤니티 안내</h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            좋아요와 댓글이 많이 달린 글은 <b className="text-zinc-300">인기</b> 상단으로 올라갑니다.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
              <div className="text-lg font-bold text-zinc-50 tabular-nums">{posts.length}</div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Posts</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
              <div className="text-lg font-bold text-zinc-50 tabular-nums">{totalReplies}</div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Comments</div>
            </div>
          </div>
          <div className="h-px bg-zinc-800" />
          {[
            { label: '제품 소스 공유', on: true },
            { label: '판매 테스트 인증', on: true },
            { label: '우수 글 공지 고정 예정', on: false },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 text-[11px] font-medium text-zinc-400">
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded ${m.on ? 'bg-blue-600 text-white' : 'border border-zinc-700 text-transparent'}`}>
                {m.on ? '✓' : ''}
              </span>
              {m.label}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function PostCard({
  post,
  open,
  onToggleComments,
  onLike,
  onCommented,
}: {
  post: Post;
  open: boolean;
  onToggleComments: () => void;
  onLike: () => void;
  onCommented: () => Promise<unknown>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const topComments = post.comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => post.comments.filter((c) => c.parentId === id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    await fetch(`/api/community/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, parentId: replyTo?.id || '' }),
    });
    setText('');
    setReplyTo(null);
    setSending(false);
    await onCommented();
  };

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 hover:border-zinc-700 transition-colors">
      <div className="flex gap-3">
        <Avatar name={post.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <strong className="text-zinc-200">{post.name}</strong>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
          <h4 className="mt-1 text-[15px] font-semibold text-zinc-50 leading-snug">{post.title}</h4>
          <p className="mt-1 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">{post.message}</p>
          {post.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image} alt="" className="mt-3 max-h-80 rounded-lg border border-zinc-800" loading="lazy" />
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onLike}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                post.likedByMe
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Heart size={13} strokeWidth={post.likedByMe ? 2.5 : 1.75} />
              {post.likes}
            </button>
            <button
              onClick={onToggleComments}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-700/60 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 text-xs font-medium transition-colors"
            >
              <MessageSquare size={13} />
              {post.comments.length}
            </button>
          </div>

          {open && (
            <div className="mt-4 space-y-3 border-t border-zinc-800 pt-3">
              {topComments.length === 0 && <p className="text-xs text-zinc-500">첫 댓글을 남겨보세요.</p>}
              {topComments.map((c) => (
                <div key={c.id} className="space-y-2">
                  <CommentRow c={c} onReply={() => setReplyTo({ id: c.id, name: c.name })} />
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="ml-9">
                      <CommentRow c={r} />
                    </div>
                  ))}
                </div>
              ))}
              {replyTo && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span><b className="text-zinc-300">@{replyTo.name}</b> 님에게 답글</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="hover:text-zinc-300">취소</button>
                </div>
              )}
              <form onSubmit={submit} className="flex gap-2 pt-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={260}
                  placeholder={replyTo ? `@${replyTo.name} 에게 답글…` : '댓글을 입력하세요'}
                  className="flex-1 h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-sm font-semibold transition-colors"
                >
                  댓글
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CommentRow({ c, onReply }: { c: Comment; onReply?: () => void }) {
  return (
    <div className="flex gap-2">
      <Avatar name={c.name} size={26} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <strong className="text-zinc-300">{c.name}</strong>
          <span>{timeAgo(c.createdAt)}</span>
        </div>
        <p className="text-sm text-zinc-300 break-words">{c.message}</p>
        {onReply && (
          <button onClick={onReply} className="mt-0.5 text-[11px] text-zinc-500 hover:text-blue-500">답글</button>
        )}
      </div>
    </div>
  );
}
