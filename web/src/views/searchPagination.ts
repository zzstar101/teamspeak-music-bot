// Search.vue 使用的纯分页工具，保持无框架依赖以便单元测试。

/** Minimal shape shared by songs / albums / playlists: needs a stable dedup key. */
export interface Keyed {
  id: string;
  platform: string;
}

export type SearchResultType = "songs" | "albums" | "playlists";

const PAGE_SIZES: Record<SearchResultType, number> = {
  songs: 20,
  albums: 10,
  playlists: 10,
};

/** 返回指定结果类型的每页数量。 */
export function pageSizeFor(type: SearchResultType): number {
  return PAGE_SIZES[type];
}

/** 根据页码和结果类型计算服务端 offset。 */
export function pageOffset(page: number, type: SearchResultType): number {
  const normalizedPage = Math.max(1, Math.floor(page));
  return (normalizedPage - 1) * pageSizeFor(type);
}

/** Stable dedup key for a result item: `${platform}:${id}`. */
export function itemKey(item: Keyed): string {
  return `${item.platform}:${item.id}`;
}

/**
 * Merge `incoming` into `existing`, deduped by `${platform}:${id}`.
 * Order is preserved with existing items first; incoming items already present
 * (or duplicated within the incoming batch) are dropped.
 */
export function mergeDedup<T extends Keyed>(existing: T[], incoming: T[]): T[] {
  const seen = new Set<string>(existing.map(itemKey));
  const result = existing.slice();
  for (const item of incoming) {
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/** 对聚合搜索结果按音源分别截取首页数量。 */
export function limitPerPlatform<T extends Keyed>(items: T[], limit: number): T[] {
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const count = counts.get(item.platform) ?? 0;
    if (count >= limit) return false;
    counts.set(item.platform, count + 1);
    return true;
  });
}

/** 用新页替换指定音源的旧页，同时保留其他音源结果。 */
export function replacePlatformPage<T extends Keyed>(
  existing: T[],
  platform: string,
  incoming: T[],
): T[] {
  const retained = existing.filter((item) => item.platform !== platform);
  return [...retained, ...mergeDedup([], incoming)];
}

/**
 * Whether another page might exist: a full page (=== pageSize) means keep the
 * button; a short/empty page (< pageSize) means the source is exhausted.
 */
export function hasMore(returnedCount: number, pageSize: number): boolean {
  return returnedCount >= pageSize;
}
