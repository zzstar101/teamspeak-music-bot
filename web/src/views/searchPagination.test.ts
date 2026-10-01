import { describe, it, expect } from "vitest";
import {
  hasMore,
  itemKey,
  limitPerPlatform,
  mergeDedup,
  pageOffset,
  pageSizeFor,
  replacePlatformPage,
  type Keyed,
} from "./searchPagination.js";

const item = (platform: string, id: string): Keyed & { label: string } => ({
  platform,
  id,
  label: `${platform}:${id}`,
});

describe("searchPagination helpers (#115)", () => {
  describe("itemKey", () => {
    it("builds a `${platform}:${id}` key", () => {
      expect(itemKey({ platform: "netease", id: "42" })).toBe("netease:42");
    });

    it("distinguishes same id across platforms", () => {
      expect(itemKey({ platform: "qq", id: "1" })).not.toBe(itemKey({ platform: "netease", id: "1" }));
    });
  });

  describe("mergeDedup", () => {
    it("appends incoming items, existing first, order preserved", () => {
      const existing = [item("netease", "1"), item("netease", "2")];
      const incoming = [item("netease", "3"), item("netease", "4")];
      expect(mergeDedup(existing, incoming).map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    });

    it("drops incoming items already present in existing", () => {
      const existing = [item("netease", "1"), item("netease", "2")];
      const incoming = [item("netease", "2"), item("netease", "3")];
      expect(mergeDedup(existing, incoming).map((x) => x.id)).toEqual(["1", "2", "3"]);
    });

    it("drops duplicates within the incoming batch", () => {
      const existing = [item("netease", "1")];
      const incoming = [item("netease", "2"), item("netease", "2"), item("netease", "3")];
      expect(mergeDedup(existing, incoming).map((x) => x.id)).toEqual(["1", "2", "3"]);
    });

    it("treats same id on different platforms as distinct", () => {
      const existing = [item("netease", "1")];
      const incoming = [item("qq", "1")];
      const merged = mergeDedup(existing, incoming);
      expect(merged.map(itemKey)).toEqual(["netease:1", "qq:1"]);
    });

    it("does not mutate the existing array", () => {
      const existing = [item("netease", "1")];
      const before = existing.slice();
      mergeDedup(existing, [item("netease", "2")]);
      expect(existing).toEqual(before);
    });

    it("handles empty incoming", () => {
      const existing = [item("netease", "1")];
      expect(mergeDedup(existing, []).map((x) => x.id)).toEqual(["1"]);
    });
  });

  describe("hasMore", () => {
    it("is true when a full page came back", () => {
      expect(hasMore(20, 20)).toBe(true);
    });

    it("is false when a short page came back", () => {
      expect(hasMore(7, 20)).toBe(false);
    });

    it("is false when nothing came back", () => {
      expect(hasMore(0, 20)).toBe(false);
    });
  });

  describe("page sizing", () => {
    it("uses 20 songs and 10 albums/playlists per page", () => {
      expect(pageSizeFor("songs")).toBe(20);
      expect(pageSizeFor("albums")).toBe(10);
      expect(pageSizeFor("playlists")).toBe(10);
    });

    it("calculates offsets from the page number and result type", () => {
      expect(pageOffset(1, "songs")).toBe(0);
      expect(pageOffset(2, "songs")).toBe(20);
      expect(pageOffset(3, "albums")).toBe(20);
      expect(pageOffset(2, "playlists")).toBe(10);
    });
  });

  describe("page result shaping", () => {
    it("limits every platform independently", () => {
      const items = [
        ...Array.from({ length: 12 }, (_, i) => item("netease", String(i))),
        ...Array.from({ length: 12 }, (_, i) => item("qq", String(i))),
      ];

      const limited = limitPerPlatform(items, 10);
      expect(limited.filter((x) => x.platform === "netease")).toHaveLength(10);
      expect(limited.filter((x) => x.platform === "qq")).toHaveLength(10);
    });

    it("replaces only the selected platform page", () => {
      const existing = [item("netease", "old"), item("qq", "keep")];
      const incoming = [item("netease", "new-1"), item("netease", "new-2")];

      expect(replacePlatformPage(existing, "netease", incoming).map(itemKey)).toEqual([
        "qq:keep",
        "netease:new-1",
        "netease:new-2",
      ]);
    });
  });
});
