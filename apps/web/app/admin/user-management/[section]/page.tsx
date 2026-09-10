import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminApp } from "@/components/admin-app";
import { userManagementLinks } from "@/features/admin/lib/navigation";

type Props = { params: Promise<{ section: string }> };
export function generateStaticParams() { return userManagementLinks.map(({ view }) => ({ section: view })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const item = userManagementLinks.find(({ view }) => view === section);
  return { title: `${item?.label ?? "User Management"} | Admin` };
}
export default async function Page({ params }: Props) {
  const { section } = await params;
  const item = userManagementLinks.find(({ view }) => view === section);
  if (!item) notFound();
  return <AdminApp view={item.view} />;
}
