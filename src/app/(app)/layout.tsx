import { Sidebar } from "@/components/shell/sidebar";
import { MockBanner } from "@/components/ui/mock-banner";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await getRepository().getAccount();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar isMock={account.isMock} username={account.username} />
      <main className="min-w-0 flex-1">
        {account.isMock && <MockBanner />}
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
