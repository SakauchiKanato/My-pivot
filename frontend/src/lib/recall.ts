/**
 * 召喚: 似た迷いの検索(v3 の bigram 一致を移植)
 * 入力のたびに走るためクライアント側で計算する(サーバー往復を避ける)。
 */
import type { Entry } from "./api";

function bigrams(str: string): Set<string> {
  const s = String(str || "").replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
  return set;
}

function similarity(text: string, entry: Entry): number {
  const a = bigrams(text);
  const b = bigrams(entry.title + (entry.body || "") + (entry.tags || []).join(""));
  let score = 0;
  a.forEach((g) => {
    if (b.has(g)) score++;
  });
  (entry.tags || []).forEach((t) => {
    if (text.includes(t)) score += 3;
  });
  return score;
}

export function bestRecall(text: string, entries: Entry[]): Entry | null {
  let best: Entry | null = null;
  let bestScore = 0;
  for (const e of entries) {
    const s = similarity(text, e);
    if (s > bestScore) {
      bestScore = s;
      best = e;
    }
  }
  return bestScore >= 3 ? best : null;
}
