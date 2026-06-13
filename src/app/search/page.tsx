import { redirect } from "next/navigation";
import { ClientSearchPage } from "@/components/client/ClientSearchPage";
import { isClientApp } from "@/lib/app-mode";

export default function SearchRoutePage() {
  if (!isClientApp()) {
    redirect("/");
  }
  return <ClientSearchPage />;
}
