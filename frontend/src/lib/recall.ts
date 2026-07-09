/**
 * 召喚: 似た迷いの検索
 *
 * 現在は2段構え:
 * 1. サーバーの意味検索 /api/recall(embedding, AI候補A)… useSemanticRecall
 * 2. このファイルの bigram 一致 … サーバー側が使えないときのフォールバック
 *    (モデルロード中・fastembed未インストール・API障害でも召喚が止まらない)
 */
import { useEffect, useState } from "react";
import { apiRecall } from "./api";
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

const DEBOUNCE_MS = 400; // 入力停止からサーバー召喚までの待ち
const MIN_LEN = 12; // これ未満では召喚しない(従来と同じ)

/**
 * 意味検索召喚フック。
 * - サーバーが使えるとき: 意味検索の結果を返す(0件なら null = 出さない)
 * - サーバーが使えないとき: bigram 一致にフォールバック
 */
export function useSemanticRecall(text: string, entries: Entry[]): Entry | null {
  const [semantic, setSemantic] = useState<{ ok: boolean; entry: Entry | null }>({
    ok: false,
    entry: null,
  });

  const trimmed = text.trim();

  useEffect(() => {
    if (trimmed.length < MIN_LEN) {
      setSemantic({ ok: false, entry: null });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiRecall(trimmed);
        if (cancelled) return;
        if (!res.available) {
          setSemantic({ ok: false, entry: null }); // → bigram へ
          return;
        }
        const hit = res.results[0];
        const entry = hit ? entries.find((e) => e.id === hit.entryId) ?? null : null;
        setSemantic({ ok: true, entry });
      } catch {
        if (!cancelled) setSemantic({ ok: false, entry: null }); // → bigram へ
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, entries]);

  if (trimmed.length < MIN_LEN) return null;
  // 意味検索が生きていればその判断を信頼する(0件なら出さない)
  if (semantic.ok) return semantic.entry;
  return bestRecall(trimmed, entries);
}
