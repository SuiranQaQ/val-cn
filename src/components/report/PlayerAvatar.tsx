export function PlayerAvatar({
  src,
  name,
  size = 28,
  className = "",
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = (name.replace(/#.*$/, "").trim()[0] || "?").toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full border border-white/10 object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-bold text-gray-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}
