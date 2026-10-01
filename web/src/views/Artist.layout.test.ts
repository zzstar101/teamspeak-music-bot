import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = () => readFileSync(join(currentDir, "Artist.vue"), "utf8");

describe("Artist page 全部歌曲 layout", () => {
  it("renders a paged 全部歌曲 section with load-more controls", () => {
    const src = source();

    expect(src).toContain("全部歌曲");
    expect(src).toContain("加载全部歌曲");
    expect(src).toContain("加载更多");
    expect(src).toContain("ALL_SONGS_PAGE");
  });

  it("pages the artist songs endpoint from the current list length", () => {
    const src = source();

    expect(src).toContain("/songs`");
    expect(src).toContain("offset: allSongs.value.length");
    expect(src).toContain("limit: ALL_SONGS_PAGE");
  });

  it("queues the whole catalogue through playArtist(..., true)", () => {
    const src = source();

    expect(src).toContain("store.playArtist(artistId(), platform.value, true)");
    expect(src).toContain("播放全部");
  });

  it("hides the all-songs controls when the source cannot page a catalogue", () => {
    const src = source();

    expect(src).toContain("allSupported");
    expect(src).toContain("status === 501");
  });

  it("refetches when navigating between artists", () => {
    const src = source();

    expect(src).toContain("watch(");
    expect(src).toContain("route.params.id");
  });
});
