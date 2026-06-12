export function GameIcon({
  src,
  alt,
  size = 20,
  className = "",
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      crossOrigin="anonymous"
      className={`shrink-0 rounded object-cover ${className}`}
      loading="lazy"
    />
  );
}
