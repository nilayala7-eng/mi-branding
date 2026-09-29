import { MetaIntegrationPendingError, META_FACTS } from "@/lib/meta";

/** Shared 501 response for Instagram endpoints until Meta facts are verified. */
export function pendingResponse(endpoint: string) {
  const err = new MetaIntegrationPendingError();
  return Response.json(
    {
      error: err.message,
      endpoint,
      pendingFacts: META_FACTS.filter((f) => f.level !== "verified").map((f) => f.id),
    },
    { status: err.status },
  );
}
