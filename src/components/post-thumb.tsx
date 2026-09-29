import { Clapperboard, GalleryHorizontalEnd, Image as ImageIcon } from "lucide-react";
import type { MediaType } from "@/lib/domain/types";

const ICON = { REEL: Clapperboard, CAROUSEL: GalleryHorizontalEnd, IMAGE: ImageIcon, STORY: ImageIcon };

/**
 * Thumbnail. Instagram CDN URLs expire, so Phase 2 will cache thumbnails in
 * Supabase Storage; until then (and in mock mode) a typed placeholder is shown.
 */
export function PostThumb({ url, type, size = 48 }: { url: string | null; type: MediaType; size?: number }) {
  const Icon = ICON[type];
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- external, expiring CDN URLs
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-muted"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.38)} strokeWidth={1.5} />
    </div>
  );
}
