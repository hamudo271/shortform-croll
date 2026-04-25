interface Props {
  title: string;
  accent?: string;
  emoji?: string;
  description?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, accent, emoji, description, children }: Props) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.02em] leading-tight">
          {accent ? (
            <>
              <span className="text-emerald-500">{accent}</span>{' '}
            </>
          ) : null}
          {title}
          {emoji ? <span className="ml-2">{emoji}</span> : null}
        </h1>
        {description && <p className="text-base text-zinc-400 mt-2 leading-relaxed">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
