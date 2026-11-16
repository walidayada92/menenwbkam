import { WorkspaceShell } from "@/components/workspace-shell";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <WorkspaceShell locale={(await params).locale}>{children}</WorkspaceShell>
  );
}
