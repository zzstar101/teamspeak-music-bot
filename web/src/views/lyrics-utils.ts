export interface LyricWord {
  start: number;
  duration: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
  romanization?: string;
  words?: LyricWord[];
}

export interface LyricsDisplayOptions {
  translation: boolean;
  romanization: boolean;
  wordTiming: boolean;
}

export interface LyricsSongIdentity {
  id: string | number;
  platform?: string | null;
}

export function getLyricsSongKey(song: LyricsSongIdentity | null | undefined): string {
  if (!song) return "";
  return `${song.platform ?? "unknown"}:${song.id}`;
}

export function findActiveLine(lines: LyricLine[], elapsed: number): number {
  if (lines.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= elapsed) idx = i;
    else break;
  }
  return idx;
}

/** 歌词页首次打开时优先定位当前播放行，前奏阶段回退到第一行。 */
export function getInitialLyricLineIndex(lines: LyricLine[], elapsed: number): number {
  const activeIndex = findActiveLine(lines, elapsed);
  if (activeIndex >= 0) return activeIndex;
  return lines.length > 0 ? 0 : -1;
}

export function getActiveWordIndex(line: LyricLine | undefined, elapsed: number): number {
  if (!line?.words || line.words.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < line.words.length; i++) {
    if (line.words[i].start <= elapsed) idx = i;
    else break;
  }
  return idx;
}

export function getWordProgress(word: LyricWord, elapsed: number): number {
  if (elapsed < word.start) return 0;
  if (word.duration <= 0) return 1;
  return Math.max(0, Math.min(1, (elapsed - word.start) / word.duration));
}

export function normalizeLyricsOptions(
  raw: Partial<LyricsDisplayOptions> | null | undefined,
): LyricsDisplayOptions {
  return {
    translation: raw?.translation ?? true,
    romanization: raw?.romanization ?? false,
    wordTiming: raw?.wordTiming ?? true,
  };
}
