'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X } from '@/components/ui/Icon';

function Avatar({ image, name, size }: { image: string; name: string; size: number }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="rounded-full object-cover border border-zinc-700 bg-zinc-800"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[#0b1220] text-white font-bold border border-zinc-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || 'M').charAt(0).toUpperCase()}
    </span>
  );
}

export default function ProfileEditor({
  email,
  initialName,
  initialImage,
  isAdmin,
  levelLabel,
  children,
}: {
  email: string;
  initialName: string;
  initialImage: string;
  isAdmin: boolean;
  levelLabel: string; // 비관리자: 활동 레벨 라벨 / 관리자: "관리자"
  children?: React.ReactNode; // 구독 상태 카드(서버 렌더)
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const patch = async (payload: Record<string, string>) => {
    const r = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '수정 실패');
  };

  const onPickImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('이미지 파일만 가능합니다.');
    if (file.size > 2_000_000) return setErr('이미지는 2MB 이하만 가능합니다.');
    setErr('');
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setBusy(true);
      try {
        await patch({ profileImage: dataUrl });
        setImage(dataUrl);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '사진 변경 실패');
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveName = async () => {
    const next = draftName.trim();
    if (!next) return setErr('이름을 입력하세요.');
    setBusy(true);
    setErr('');
    try {
      await patch({ name: next });
      setName(next);
      setEditingName(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '이름 변경 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* 헤더: 큰 아바타 + 이름 */}
      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer group shrink-0" title="프로필 사진 변경">
          <Avatar image={image} name={name} size={72} />
          <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold">
            변경
          </span>
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => onPickImage(e.target.files?.[0])} />
        </label>
        <div className="min-w-0">
          <h1 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.02em] leading-tight">
            <span className="text-blue-500">내</span> 정보
          </h1>
          <p className="text-sm text-zinc-400 mt-1 truncate">{name} · {email}</p>
        </div>
      </div>

      {err && <p className="-mt-6 text-xs text-rose-500">{err}</p>}

      {/* 구독 상태(서버 렌더) */}
      {children}

      {/* 계정 정보 */}
      <section>
        <h2 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-4">계정 정보</h2>
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl divide-y divide-zinc-700 shadow-card">
          {/* 프로필 사진 */}
          <div className="flex items-center justify-between px-7 py-5 text-sm">
            <span className="text-zinc-400 font-medium">프로필</span>
            <label className="flex items-center gap-3 cursor-pointer" title="프로필 사진 변경">
              <Avatar image={image} name={name} size={40} />
              <span className="text-xs font-semibold text-blue-500 hover:text-blue-400">사진 변경</span>
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => onPickImage(e.target.files?.[0])} />
            </label>
          </div>

          {/* 이메일 */}
          <div className="flex items-center justify-between px-7 py-5 text-sm">
            <span className="text-zinc-400 font-medium">이메일</span>
            <span className="text-zinc-50 font-semibold">{email}</span>
          </div>

          {/* 이름 (연필 수정) */}
          <div className="flex items-center justify-between px-7 py-5 text-sm gap-3">
            <span className="text-zinc-400 font-medium shrink-0">이름</span>
            {editingName ? (
              <div className="flex items-center gap-2 min-w-0">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={40}
                  autoFocus
                  className="h-9 px-3 rounded-lg bg-background border border-zinc-700 text-sm text-zinc-50 focus:border-blue-500 focus:outline-none min-w-0 w-40"
                />
                <button onClick={saveName} disabled={busy} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shrink-0" title="저장">
                  <Check size={15} />
                </button>
                <button onClick={() => { setEditingName(false); setDraftName(name); }} disabled={busy} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 shrink-0" title="취소">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-zinc-50 font-semibold">{name || '-'}</span>
                <button onClick={() => { setDraftName(name); setEditingName(true); }} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors" title="이름 수정">
                  <Pencil size={14} />
                </button>
              </span>
            )}
          </div>

          {/* 레벨(비관리자) / 권한(관리자) */}
          <div className="flex items-center justify-between px-7 py-5 text-sm">
            <span className="text-zinc-400 font-medium">{isAdmin ? '권한' : '레벨'}</span>
            {isAdmin ? (
              <span className="text-zinc-50 font-semibold">관리자</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400 text-xs font-bold">
                {levelLabel}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
