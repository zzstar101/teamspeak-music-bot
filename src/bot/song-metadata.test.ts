import { describe, expect, it, vi } from "vitest";
import type { QueuedSong } from "../audio/queue.js";
import type { MusicProvider } from "../music/provider.js";
import { hydrateQueuedSongMetadata } from "./song-metadata.js";

function makeSong(overrides: Partial<QueuedSong> = {}): QueuedSong {
  return {
    id: "song-1",
    name: "History Song",
    artist: "History Artist",
    album: "",
    duration: 0,
    coverUrl: "",
    platform: "netease",
    ...overrides,
  };
}

function makeProvider(detail: Partial<QueuedSong> | null): MusicProvider {
  return {
    platform: "netease",
    search: vi.fn(),
    getSongUrl: vi.fn(),
    setQuality: vi.fn(),
    getQuality: vi.fn(),
    getSongDetail: vi.fn(async () => detail
      ? {
          id: detail.id ?? "song-1",
          name: detail.name ?? "Detailed Song",
          artist: detail.artist ?? "Detailed Artist",
          album: detail.album ?? "Detailed Album",
          duration: detail.duration ?? 245,
          coverUrl: detail.coverUrl ?? "https://x/cover.jpg",
          platform: detail.platform ?? "netease",
        }
      : null),
    getPlaylistSongs: vi.fn(),
    getRecommendPlaylists: vi.fn(),
    getAlbumSongs: vi.fn(),
    getLyrics: vi.fn(),
    getQrCode: vi.fn(),
    checkQrCodeStatus: vi.fn(),
    setCookie: vi.fn(),
    getCookie: vi.fn(),
    getAuthStatus: vi.fn(),
  } as unknown as MusicProvider;
}

describe("song metadata hydration", () => {
  it("fills missing queue song duration from provider detail before playback", async () => {
    const song = makeSong();
    const provider = makeProvider({ duration: 245 });

    await hydrateQueuedSongMetadata(song, provider);

    expect(provider.getSongDetail).toHaveBeenCalledWith("song-1");
    expect(song.duration).toBe(245);
  });

  it("does not fetch detail when queue song already has duration", async () => {
    const song = makeSong({ duration: 180 });
    const provider = makeProvider({ duration: 245 });

    await hydrateQueuedSongMetadata(song, provider);

    expect(provider.getSongDetail).not.toHaveBeenCalled();
    expect(song.duration).toBe(180);
  });
});
