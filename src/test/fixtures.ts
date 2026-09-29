import type { AccountSummary, DataRepository, ExperimentPatch, NewExperiment, PostFilter } from "@/lib/data/repository";
import { inRange, type DateRange } from "@/lib/domain/periods";
import type {
  AccountDailyMetrics,
  ContentTag,
  Experiment,
  Post,
  PostMetrics,
  TaxonomyDimensionKey,
  TaxonomyValue,
} from "@/lib/domain/types";
import { filterPosts } from "@/lib/metrics/filters";

let seq = 0;

export function tag(dimension: TaxonomyDimensionKey, slug: string, label = slug): ContentTag {
  return { dimension, valueId: `${dimension}:${slug}`, slug, label, source: "manual", confidence: 1 };
}

export function makePost(overrides: Partial<Omit<Post, "metrics">> & { metrics?: Partial<PostMetrics> } = {}): Post {
  seq++;
  const { metrics, ...rest } = overrides;
  return {
    id: `p${seq}`,
    accountId: "acc",
    igMediaId: `ig${seq}`,
    mediaType: "REEL",
    caption: `post ${seq}`,
    permalink: null,
    thumbnailUrl: null,
    publishedAt: "2026-01-10T12:00:00.000Z",
    durationSec: null,
    metricsUpdatedAt: null,
    tags: [],
    ...rest,
    metrics: {
      views: 1000,
      reach: 1000,
      likes: 40,
      comments: 5,
      shares: 5,
      saves: 5,
      follows: 2,
      profileVisits: 10,
      avgWatchTimeSec: null,
      ...metrics,
    },
  };
}

export function makeDay(date: string, overrides: Partial<AccountDailyMetrics> = {}): AccountDailyMetrics {
  return {
    date,
    followers: 1000,
    followsGained: 5,
    unfollows: 1,
    reach: 500,
    views: 800,
    likes: 20,
    comments: 2,
    shares: 3,
    saves: 4,
    profileVisits: 10,
    ...overrides,
  };
}

/** Minimal in-memory DataRepository for service tests (UTC calendar days). */
export class FixtureRepository implements DataRepository {
  experiments: Experiment[] = [];
  constructor(
    public posts: Post[] = [],
    public days: AccountDailyMetrics[] = [],
    public today = "2026-01-31",
    public isMock = false,
  ) {}
  async getAccount(): Promise<AccountSummary> {
    return {
      id: "acc",
      username: "test",
      displayName: "Test",
      connectionStatus: "connected",
      lastSyncAt: null,
      lastSyncError: null,
      isMock: this.isMock,
      today: this.today,
    };
  }
  async getAccountDays(range: DateRange) {
    return this.days.filter((d) => inRange(d.date, range));
  }
  async getPosts(filter: PostFilter = {}) {
    return filterPosts(this.posts, filter, "UTC");
  }
  async getPost(id: string) {
    return this.posts.find((p) => p.id === id) ?? null;
  }
  async getTaxonomy(): Promise<TaxonomyValue[]> {
    return [];
  }
  async listExperiments() {
    return this.experiments;
  }
  async createExperiment(input: NewExperiment) {
    const e: Experiment = {
      ...input,
      id: `e${this.experiments.length + 1}`,
      status: "draft",
      result: null,
      resultSampleSize: null,
      conclusion: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    this.experiments.push(e);
    return e;
  }
  async setManualTag(postId: string, valueId: string) {
    const post = this.posts.find((p) => p.id === postId);
    const [dimension, slug] = valueId.split(":") as [TaxonomyDimensionKey, string];
    if (post) post.tags = [...post.tags.filter((t) => t.dimension !== dimension), tag(dimension, slug)];
  }
  async removeTag(postId: string, dimension: TaxonomyDimensionKey) {
    const post = this.posts.find((p) => p.id === postId);
    if (post) post.tags = post.tags.filter((t) => t.dimension !== dimension);
  }
  async updateExperiment(id: string, patch: ExperimentPatch) {
    const e = this.experiments.find((x) => x.id === id);
    if (!e) throw new Error("not found");
    Object.assign(e, patch);
    return e;
  }
}
