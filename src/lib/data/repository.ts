import type { DateRange } from "@/lib/domain/periods";
import type {
  AccountDailyMetrics,
  Experiment,
  ExperimentMetric,
  ISODate,
  ISODateTime,
  MediaType,
  Post,
  TaxonomyDimensionKey,
  TaxonomyValue,
} from "@/lib/domain/types";

export type ConnectionStatus = "not_connected" | "connected" | "token_expired" | "error";

export interface AccountSummary {
  id: string;
  username: string;
  displayName: string;
  connectionStatus: ConnectionStatus;
  lastSyncAt: ISODateTime | null;
  lastSyncError: string | null;
  /** True when the data comes from the mock generator. The UI must say so. */
  isMock: boolean;
  /** Account-local "today" used as the anchor for period presets. */
  today: ISODate;
}

export type PostSortKey =
  | "publishedAt"
  | "views"
  | "reach"
  | "shares"
  | "saves"
  | "follows"
  | "comments"
  | "likes"
  | "engagementRate"
  | "sharesPer1k"
  | "savesPer1k"
  | "followsPer1k";

export interface PostFilter {
  range?: DateRange;
  mediaTypes?: MediaType[];
  search?: string;
  tag?: { dimension: TaxonomyDimensionKey; slug: string };
  sort?: PostSortKey;
  order?: "asc" | "desc";
  limit?: number;
}

export interface NewExperiment {
  name: string;
  hypothesis: string;
  metric: ExperimentMetric;
  baseline: number | null;
  baselineDescription: string;
  test: string;
  startDate: ISODate;
  endDate: ISODate;
}

export type ExperimentPatch = Partial<
  Pick<Experiment, "status" | "result" | "resultSampleSize" | "conclusion" | "endDate" | "test">
>;

/**
 * The single data-access boundary. Services and the AI layer depend only on
 * this interface, never on Supabase or the mock directly.
 */
export interface DataRepository {
  getAccount(): Promise<AccountSummary>;
  getAccountDays(range: DateRange): Promise<AccountDailyMetrics[]>;
  getPosts(filter?: PostFilter): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  getTaxonomy(): Promise<TaxonomyValue[]>;
  listExperiments(): Promise<Experiment[]>;
  createExperiment(input: NewExperiment): Promise<Experiment>;
  updateExperiment(id: string, patch: ExperimentPatch): Promise<Experiment>;
  /** Manual tag (one per dimension); overrides automatic tags. */
  setManualTag(postId: string, valueId: string): Promise<void>;
  removeTag(postId: string, dimension: TaxonomyDimensionKey): Promise<void>;
}
