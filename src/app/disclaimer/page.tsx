import Link from "next/link";
import { SiteBrand } from "@/components/website/SiteBrand";
import { SiteFooter } from "@/components/website/SiteFooter";

export const metadata = {
  title: "免责声明 - VAL CN",
};

export default function DisclaimerPage() {
  return (
    <div className="val-website-shell min-h-screen text-[#ece8e1]">
      <header className="border-b border-white/[0.06] bg-[#0f1923]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <SiteBrand />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 text-sm leading-7 text-[#8b979f]">
        <h1 className="text-2xl font-bold text-white">免责声明</h1>
        <p className="mt-4">
          VAL CN 国服战绩站（以下简称「本站」）由个人开发者隋然公益维护，仅供玩家查询公开战绩信息，不构成任何官方服务。
        </p>

        <h2 className="mt-8 text-base font-semibold text-[#c5cdd3]">
          非官方说明
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            本站与 Riot Games、腾讯及其关联公司无关，未获官方授权或 endorsement。
          </li>
          <li>
            「无畏契约」「VALORANT」及相关标识的商标、美术资源归相应权利人所有，本站仅在说明游戏来源时引用。
          </li>
        </ul>

        <h2 className="mt-8 text-base font-semibold text-[#c5cdd3]">
          数据与准确性
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>战绩数据来自游戏官方接口或社区贡献 Token，可能存在延迟、缺失或错误。</li>
          <li>查询结果仅供参考，请勿作为竞技、交易、处罚等唯一依据。</li>
        </ul>

        <h2 className="mt-8 text-base font-semibold text-[#c5cdd3]">
          Companion 与反作弊
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            可选组件 Companion 通过本地 HTTPS 代理读取<strong className="text-[#c5cdd3]">本机</strong>客户端访问 Riot 国服 API 时的 JWT，供战绩查询与对局认人使用。
          </li>
          <li>
            本站<strong className="text-[#c5cdd3]">不</strong>注入游戏、不读写游戏内存、不修改游戏数据包、不提供任何获得不公平优势的功能。
          </li>
          <li>
            开启代理时默认使用 PAC：仅 pd/glz/shared/entitlements 等 API 走本地代理；反作弊（tc-anticheat）、遥测等流量直连，以降低被误判风险。
          </li>
          <li>
            安装本地根证书与局部 MITM 仍存在理论风险，是否处罚取决于游戏运营商策略；请自行评估，主号请谨慎使用。
          </li>
        </ul>

        <h2 className="mt-8 text-base font-semibold text-[#c5cdd3]">
          使用规范
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>本站公益免费开放，禁止用于商业售卖、批量爬取、攻击接口或任何滥用行为。</li>
          <li>本站不提供、不协助外挂、作弊、内存修改或任何破坏游戏公平性的功能。</li>
          <li>用户应遵守游戏用户协议及当地法律法规，因违规使用产生的后果由用户自行承担。</li>
        </ul>

        <h2 className="mt-8 text-base font-semibold text-[#c5cdd3]">
          未成年人提示
        </h2>
        <p className="mt-2">
          未满 17 周岁用户请在监护人指导下使用，合理规划游戏时长，抵制沉迷。
        </p>

        <p className="mt-10 text-xs text-[#5f6c74]">
          如有问题或侵权投诉，请通过站点维护者渠道联系处理。
        </p>

        <Link
          href="/"
          className="mt-6 inline-block text-[#ffb84d] hover:underline"
        >
          ← 返回首页
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
