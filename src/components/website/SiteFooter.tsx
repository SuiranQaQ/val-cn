import Link from "next/link";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`relative z-10 border-t border-white/[0.06] px-5 py-8 text-center text-[11px] leading-6 text-[#5f6c74] ${className}`}
    >
      <p className="text-[#8b979f]">
        作者{" "}
        <span className="font-semibold text-[#c5cdd3]">隋然</span>
        {" · "}
        公益开发，请勿滥用
      </p>
      <p className="mt-1">
        未满 17 岁请合理规划游戏时长，抵制沉迷，享受健康生活
      </p>
      <p className="mt-2 text-[10px] text-[#4a565e]">
        VAL CN 国服战绩站 · 非 Riot / 腾讯官方产品 ·{" "}
        <Link href="/disclaimer" className="text-[#6d7a82] hover:text-[#ffb84d]">
          免责声明
        </Link>
      </p>
    </footer>
  );
}
