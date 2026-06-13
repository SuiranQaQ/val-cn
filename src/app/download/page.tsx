import Link from "next/link";
import { isWebsiteApp } from "@/lib/app-mode";
import { getPoolStats } from "@/lib/session-pool";
import { SiteBrand } from "@/components/website/SiteBrand";
import { SiteFooter } from "@/components/website/SiteFooter";
import fs from "fs";
import path from "path";

function getDownloadInfo() {
  const zipPath = path.join(process.cwd(), "public", "downloads", "VAL-CN-portable.zip");
  try {
    if (!fs.existsSync(zipPath)) return null;
    const stat = fs.statSync(zipPath);
    const mb = Math.round(stat.size / (1024 * 1024));
    return {
      href: "/downloads/VAL-CN-portable.zip",
      sizeMb: mb,
      updatedAt: stat.mtime.toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

export default function DownloadPage() {
  const stats = getPoolStats();
  const download = getDownloadInfo();
  const website = isWebsiteApp();

  return (
    <div className="val-home-bg min-h-screen text-[#ece8e1]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <SiteBrand />
          <p className="text-[10px] tracking-widest text-[#6d7a82]">DOWNLOAD</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold text-white">下载 Windows 客户端</h1>
        <p className="mt-3 text-sm leading-6 text-[#8b979f]">
          官网负责查询与公用池；成品客户端在本机运行，支持 Companion 捕获 JWT、实时对局、个人战绩，并可选择老好人模式贡献 Token。
        </p>

        <div className="mt-8 space-y-4">
          <div className="border border-[#ff4655]/30 bg-[#1a242e]/90 p-6">
            <h2 className="text-lg font-bold text-white">VAL-CN 客户端（便携版）</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#8b979f]">
              <li>· 内置 Companion：自动截 JWT，无需手抓包</li>
              <li>· 查战绩、对局认人、个人数据</li>
              <li>· 老好人模式：可选提交 JWT 到官网公用池</li>
              <li>· 免安装 Node，解压即用</li>
            </ul>
            {download ? (
              <div className="mt-6">
                <a
                  href={download.href}
                  download="VAL-CN-portable.zip"
                  className="inline-block bg-[#ff4655] px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#ff5563]"
                >
                  下载 VAL-CN-portable.zip
                </a>
                <p className="mt-3 text-xs text-[#5f6c74]">
                  约 {download.sizeMb} MB · 更新于 {download.updatedAt}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#ffb84d]">
                安装包尚未发布。维护者执行{" "}
                <code className="text-[#ece8e1]">npm run package:local</code>{" "}
                后会自动生成下载文件。
              </p>
            )}
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-5 text-sm text-[#8b979f]">
            <p className="font-semibold text-white">使用步骤</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-6">
              <li>解压 zip 到任意目录</li>
              <li>首次运行 install-companion-ca.bat（管理员）</li>
              <li>start-companion.bat → 进游戏 → VAL-CN.vbs</li>
            </ol>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-5 text-sm text-[#8b979f]">
            <p className="font-semibold text-white">官网公用池</p>
            <p className="mt-2">
              当前池内会话：{stats.total} 条
              {stats.latest_at ? ` · 最近更新 ${stats.latest_at}` : ""}
            </p>
          </div>
        </div>
      </main>
      {website ? <SiteFooter /> : null}
    </div>
  );
}
