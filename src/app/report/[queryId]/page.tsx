import { ReportPage } from "@/components/report/ReportPage";

export default async function Page({
  params,
}: {
  params: Promise<{ queryId: string }>;
}) {
  const { queryId } = await params;
  return <ReportPage queryId={queryId} />;
}
