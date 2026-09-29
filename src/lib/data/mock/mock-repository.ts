import { filterPosts, localDate } from "@/lib/metrics/filters";
import { inRange, type DateRange } from "@/lib/domain/periods";
import type { Experiment, TaxonomyValue } from "@/lib/domain/types";
import type {
  AccountSummary,
  DataRepository,
  ExperimentPatch,
  NewExperiment,
  PostFilter,
} from "../repository";
import { generateMockDataset, MOCK_ACCOUNT_ID, type MockDataset } from "./generator";

export const MOCK_TIMEZONE = "Europe/Madrid";

function seedExperiments(today: string): Experiment[] {
  return [
    {
      id: "exp-1",
      name: "Hooks de falta de tiempo",
      hypothesis: "Los hooks relacionados con falta de tiempo generan más shares por cada 1.000 cuentas alcanzadas.",
      metric: "shares_per_1k_reach",
      baseline: null,
      baselineDescription: "Mediana de Reels de los últimos 90 días (se calcula al conectar datos reales).",
      test: "Publicar 6 Reels con hook 'falta de tiempo' en 3 semanas, mismo formato talking head + B-roll.",
      startDate: today,
      endDate: today,
      status: "draft",
      result: null,
      resultSampleSize: null,
      conclusion: null,
      createdAt: `${today}T09:00:00.000Z`,
    },
  ];
}

/**
 * In-memory repository backed by the deterministic mock generator.
 * Experiments are mutable for the lifetime of the server process only.
 */
export class MockRepository implements DataRepository {
  private readonly data: MockDataset;
  private experiments: Experiment[];

  constructor(private readonly today: string, seed = 42) {
    this.data = generateMockDataset(today, seed);
    this.experiments = seedExperiments(today);
  }

  async getAccount(): Promise<AccountSummary> {
    return {
      id: MOCK_ACCOUNT_ID,
      username: "ayala.fit_",
      displayName: "Ayala Fitness",
      connectionStatus: "not_connected",
      lastSyncAt: null,
      lastSyncError: null,
      isMock: true,
      today: this.today,
    };
  }

  async getAccountDays(range: DateRange) {
    return this.data.accountDays.filter((d) => inRange(d.date, range));
  }

  async getPosts(filter: PostFilter = {}) {
    return filterPosts(this.data.posts, filter, MOCK_TIMEZONE);
  }

  async getPost(id: string) {
    return this.data.posts.find((p) => p.id === id) ?? null;
  }

  async getTaxonomy(): Promise<TaxonomyValue[]> {
    return this.data.taxonomy;
  }

  async listExperiments() {
    return [...this.experiments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createExperiment(input: NewExperiment) {
    const exp: Experiment = {
      ...input,
      id: `exp-${this.experiments.length + 1}-${Date.now().toString(36)}`,
      status: "draft",
      result: null,
      resultSampleSize: null,
      conclusion: null,
      createdAt: new Date().toISOString(),
    };
    this.experiments.push(exp);
    return exp;
  }

  async updateExperiment(id: string, patch: ExperimentPatch) {
    const idx = this.experiments.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Experiment ${id} not found`);
    this.experiments[idx] = { ...this.experiments[idx], ...patch };
    return this.experiments[idx];
  }

  /** Exposed for tests. */
  localDateOf(iso: string) {
    return localDate(iso, MOCK_TIMEZONE);
  }
}
