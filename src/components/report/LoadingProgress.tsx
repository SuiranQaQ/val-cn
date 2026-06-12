interface LoadingProgressProps {
  step: number;
  total: number;
  label: string;
}

export function LoadingProgress({ step, total, label }: LoadingProgressProps) {
  const percent = Math.round((step / total) * 100);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1a2332]/80 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
      </div>
      <div className="mt-3 text-[11px] font-medium text-gray-300">{label}</div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
        <span>
          {step} / {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#ff4655] to-orange-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
