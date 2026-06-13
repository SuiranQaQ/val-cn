import Link from "next/link";

interface SiteBrandProps {
  href?: string;
  showSubtitle?: boolean;
}

/** 官网左上角品牌：透明 PNG 须用原生 img，避免 Next 优化铺白底 */
export function SiteBrand({ href = "/", showSubtitle = true }: SiteBrandProps) {
  return (
    <Link href={href} className="flex items-center gap-3" aria-label="VAL CN 首页">
      <div
        className="relative h-9 w-9 shrink-0 overflow-hidden"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/valorant-cn-logo.png"
          alt=""
          width={38}
          height={38}
          className="absolute left-1/2 top-0 h-9 w-auto max-w-none -translate-x-1/2 object-contain object-top"
          decoding="async"
        />
      </div>
      {showSubtitle ? (
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-white">
            VAL CN
          </p>
          <p className="text-[10px] text-[#6d7a82]">国服战绩站</p>
        </div>
      ) : null}
    </Link>
  );
}
