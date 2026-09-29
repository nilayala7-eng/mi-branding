/** `InstagramSource` backed by the Instagram Graph API (Instagram Login). */
import { eachDay, addDays } from "@/lib/domain/periods";
import type { InstagramSource, SourceAccountDay, SourceMedia, SnapshotMetrics } from "@/services/instagram/sync";
import { GraphApiError, GraphClient } from "./graph-client";
import {
  ACCOUNT_DAY_METRICS,
  FALLBACK_MEDIA_METRICS,
  MEDIA_FIELDS,
  mapMedia,
  mediaMetricsFor,
  readFollowBreakdown,
  readInsightValues,
  toAccountDay,
  toPostMetrics,
  zonedMidnightUtc,
  type IgMedia,
  type InsightsResponse,
} from "./mapping";

export interface IgProfile {
  user_id?: string;
  id: string;
  username: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export const PROFILE_FIELDS = "user_id,username,name,account_type,profile_picture_url,followers_count,media_count";

export function getProfile(client: GraphClient): Promise<IgProfile> {
  return client.get<IgProfile>("me", { fields: PROFILE_FIELDS });
}

export class MetaInstagramSource implements InstagramSource {
  constructor(
    private readonly client: GraphClient,
    private readonly igUserId: string,
    private readonly timeZone: string,
  ) {}

  async listMedia(): Promise<SourceMedia[]> {
    const items = await this.client.getAll<IgMedia>(`${this.igUserId}/media`, { fields: MEDIA_FIELDS, limit: 100 });
    return items.map(mapMedia);
  }

  async getMediaInsights(media: SourceMedia): Promise<SnapshotMetrics> {
    const path = `${media.igMediaId}/insights`;
    try {
      const res = await this.client.get<InsightsResponse>(path, { metric: mediaMetricsFor(media.mediaType).join(",") });
      return toPostMetrics(readInsightValues(res), media);
    } catch (e) {
      // A metric the media does not support fails the whole request; retry minimal.
      if (e instanceof GraphApiError && !e.isAuthError && !e.isRateLimit) {
        const res = await this.client.get<InsightsResponse>(path, { metric: FALLBACK_MEDIA_METRICS.join(",") });
        return toPostMetrics(readInsightValues(res), media);
      }
      throw e;
    }
  }

  async getAccountDays(range: { from: string; to: string }): Promise<SourceAccountDay[]> {
    const days: SourceAccountDay[] = [];
    const profile = await getProfile(this.client);
    for (const date of eachDay(range)) {
      const since = Math.floor(zonedMidnightUtc(date, this.timeZone).getTime() / 1000);
      const until = Math.floor(zonedMidnightUtc(addDays(date, 1), this.timeZone).getTime() / 1000);
      const base = { period: "day", metric_type: "total_value", since, until };
      const [values, follow] = await Promise.all([
        this.client.get<InsightsResponse>(`${this.igUserId}/insights`, { ...base, metric: ACCOUNT_DAY_METRICS.join(",") }),
        this.client
          .get<InsightsResponse>(`${this.igUserId}/insights`, { ...base, metric: "follows_and_unfollows", breakdown: "follow_type" })
          .catch((e) => {
            // Not returned for accounts under 100 followers → treat as unknown.
            if (e instanceof GraphApiError && !e.isAuthError && !e.isRateLimit) return {} as InsightsResponse;
            throw e;
          }),
      ]);
      const f = readFollowBreakdown(follow);
      // Follower history is not available from the API: only today's count is known.
      const followers = date === range.to ? profile.followers_count ?? null : null;
      const day = toAccountDay(date, readInsightValues(values), f, followers);
      day.extra = { ...day.extra, ...Object.fromEntries(Object.entries(f.raw).map(([k, v]) => [`follow_type:${k}`, v])) };
      days.push(day);
    }
    return days;
  }
}
