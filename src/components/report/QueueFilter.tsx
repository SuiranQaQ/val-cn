import {
  QUEUE_FILTER_OPTIONS,
  type QueueFilterId,
} from "@/lib/stats";

export function QueueFilter({
  value,
  onChange,
  counts,
}: {
  value: QueueFilterId;
  onChange: (id: QueueFilterId) => void;
  counts?: Partial<Record<QueueFilterId, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUEUE_FILTER_OPTIONS.map((opt) => {
        const active = value === opt.id;
        const count = counts?.[opt.id];
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
              active
                ? "border-[#ff4655]/50 bg-[#ff4655]/15 text-white"
                : "border-white/10 bg-white/5 text-gray-400 hover:text-gray-200"
            }`}
          >
            {opt.label}
            {count != null ? ` (${count})` : ""}
          </button>
        );
      })}
    </div>
  );
}
