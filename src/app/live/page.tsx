import Link from "next/link";
import { LiveMatchPanel } from "@/components/live/LiveMatchPanel";

export default function LivePage() {
  return (
    <div className="val-home-bg min-h-screen text-[#ece8e1]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="text-sm font-bold tracking-widest text-white">
            ← VAL CN
          </Link>
          <p className="text-[10px] tracking-widest text-[#6d7a82]">LIVE MATCH</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4655]">
            本机对局
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">对局认人面板</h1>
          <p className="mt-2 text-sm leading-6 text-[#8b979f]">
            需在本机启动瓦罗兰特并进入选人或对局。自动识别 10 人、组队关系，并结合近期战绩标记炸鱼/可疑行为。
          </p>
        </div>

        <LiveMatchPanel />

        <ul className="mt-8 space-y-2 text-[11px] text-[#5f6c74]">
          <li>· 选人阶段即可看到 PartyID 组队（2黑/3黑/5黑）</li>
          <li>· 每 8 秒自动刷新；首次快速认人，随后拉取历史分析</li>
          <li>· 炸鱼分依据等级、段位、ACS、胜率；可疑分依据 AFK/处罚记录</li>
          <li>· 不会检测外挂，仅历史数据参考</li>
        </ul>
      </main>
    </div>
  );
}
