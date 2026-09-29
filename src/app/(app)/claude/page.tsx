import { PageHeader } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import { integrationStatus } from "@/lib/env";
import { ChatPanel } from "./chat-panel";

export default async function ClaudePage() {
  const account = await getRepository().getAccount();
  const status = integrationStatus();
  return (
    <>
      <PageHeader
        title="Claude"
        subtitle="Analista con acceso de solo lectura a tu base de datos mediante herramientas estructuradas. Cada cifra que da procede de una consulta; puedes ver cuáles en “Datos consultados”."
      />
      <ChatPanel configured={status.claudeConfigured} isMock={account.isMock} />
    </>
  );
}
