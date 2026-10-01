import type { QueuedSong } from "../audio/queue.js";
import type { MusicProvider } from "../music/provider.js";

export async function hydrateQueuedSongMetadata(
  song: QueuedSong,
  provider: MusicProvider,
): Promise<void> {
  if (song.duration > 0) return;

  const detail = await provider.getSongDetail(song.id);
  if (!detail) return;

  if (detail.duration > 0) song.duration = detail.duration;
  if (!song.name && detail.name) song.name = detail.name;
  if (!song.artist && detail.artist) song.artist = detail.artist;
  if (!song.album && detail.album) song.album = detail.album;
  if (!song.coverUrl && detail.coverUrl) song.coverUrl = detail.coverUrl;
}
