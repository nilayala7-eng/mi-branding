/**
 * In-memory SyncStore. Reference implementation of the idempotency contract
 * (used by tests; the Supabase store must behave identically — the same
 * unique keys exist as constraints in supabase/migrations).
 */
import type { AccountDailyMetrics, ISODate, ISODateTime, PostMetrics } from "@/lib/domain/types";
import type { SourceMedia, SyncRunRecord, SyncStore } from "./sync";

export class InMemorySyncStore implements SyncStore {
  posts = new Map<string, { id: string; accountId: string; media: SourceMedia }>(); // key: account|igMediaId
  snapshots = new Map<string, { postId: string; capturedOn: ISODate; metrics: Partial<PostMetrics> }>(); // key: post|date
  accountDays = new Map<string, AccountDailyMetrics>(); // key: account|date
  runs = new Map<string, SyncRunRecord>();
  private locks = new Set<string>();
  private seq = 0;

  async acquireLock(accountId: string): Promise<boolean> {
    if (this.locks.has(accountId)) return false;
    this.locks.add(accountId);
    return true;
  }

  async releaseLock(accountId: string) {
    this.locks.delete(accountId);
  }

  async startRun(accountId: string, now: ISODateTime) {
    const id = `run-${++this.seq}`;
    this.runs.set(id, {
      id,
      accountId,
      startedAt: now,
      finishedAt: null,
      status: "running",
      postsCreated: 0,
      postsUpdated: 0,
      snapshotsWritten: 0,
      accountDaysWritten: 0,
      errors: [],
    });
    return id;
  }

  async finishRun(runId: string, record: Omit<SyncRunRecord, "id" | "accountId" | "startedAt">) {
    const run = this.runs.get(runId);
    if (run) this.runs.set(runId, { ...run, ...record });
  }

  async lastSuccessfulSync(accountId: string) {
    const ok = [...this.runs.values()].filter(
      (r) => r.accountId === accountId && (r.status === "success" || r.status === "partial"),
    );
    return ok.map((r) => r.finishedAt).filter(Boolean).sort().at(-1) ?? null;
  }

  async upsertPost(accountId: string, media: SourceMedia) {
    const key = `${accountId}|${media.igMediaId}`;
    const existing = this.posts.get(key);
    if (existing) {
      this.posts.set(key, { ...existing, media });
      return { postId: existing.id, created: false };
    }
    const id = `post-${this.posts.size + 1}`;
    this.posts.set(key, { id, accountId, media });
    return { postId: id, created: true };
  }

  async upsertPostSnapshot(postId: string, capturedOn: ISODate, metrics: Partial<PostMetrics>) {
    this.snapshots.set(`${postId}|${capturedOn}`, { postId, capturedOn, metrics });
  }

  async upsertAccountDays(accountId: string, days: AccountDailyMetrics[]) {
    for (const d of days) this.accountDays.set(`${accountId}|${d.date}`, d);
    return days.length;
  }
}
