/**
 * バックエンド(FastAPI)との通信を1箇所に集約。
 * 全リクエストに Authorization: Bearer <token> を付与する。
 */
import { getToken } from "./auth";
import type { ServerFlags } from "../config/flags";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type Shelf = "mine" | "shared" | "senpai";
export type Outcome = "ok" | "ng" | "pending";
export type Judgment = "sound" | "flawed" | null;

export interface Append {
  id: number;
  date: string;
  text: string;
}

export interface Entry {
  id: number;
  bookId: number;
  authorId: number | null;
  date: string;
  title: string;
  body: string;
  tags: string[];
  confidence: number;
  outcome: Outcome;
  judgment: Judgment;
  reasonOutcome: string;
  reasonJudgment: string;
  resolveDate: string | null;
  resolvedOn: string | null;
  sourceEntryId: number | null;
  fixable: boolean;
  appends: Append[];
}

export interface Book {
  id: number;
  shelf: Shelf;
  title: string;
  fill: string;
  height: number;
  ownerId: number | null;
  // 作成/参加した直後のレスポンスにだけ入る(以後の一覧取得では常にnull)
  passcode: string | null;
  entries: Entry[];
}

export interface Library {
  books: Book[];
  // タグ名→カテゴリ(感情/研究/…)。チップのカテゴリ折りたたみ表示に使う
  tagCategories: Record<string, string>;
  flags: ServerFlags;
}

export interface CalibrationStats {
  total: number;
  resolvedN: number;
  okRate: number | null;
  avgConf: number;
  buckets: Record<string, { n: number; ok: number; rate: number | null; mid: number }>;
  tags: { tag: string; n: number; rate: number }[];
}

function headers(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(), ...init, ...(init?.body ? {} : {}) });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return req<T>(path, { method: "POST", body: JSON.stringify(body), headers: headers() });
}

//  認証 
export interface TokenResponse {
  access_token: string;
  username: string;
  user_id: number;
}
export const apiRegister = (username: string, email: string, password: string) =>
  post<TokenResponse>("/api/auth/register", { username, email, password });
export const apiLogin = (email: string, password: string) =>
  post<TokenResponse>("/api/auth/login", { email, password });
export const apiGoogleLogin = (idToken: string) =>
  post<TokenResponse>("/api/auth/google", { id_token: idToken });

//  書庫
export const fetchLibrary = () => req<Library>("/api/library");
export const createBook = (shelf: Shelf, title: string, passcode?: string) =>
  post<Book>("/api/books", { shelf, title, passcode });
export const updateBookColor = (bookId: number, fill: string) =>
  req<Book>(`/api/books/${bookId}/color`, { method: "PUT", body: JSON.stringify({ fill }), headers: headers() });
export const deleteBook = (bookId: number) =>
  req<{ ok: boolean }>(`/api/books/${bookId}`, { method: "DELETE", headers: headers() });
export const joinSharedBook = (passcode: string) =>
  post<Book>("/api/shared/join", { passcode });
export const createEntry = (
  bookId: number,
  data: { title: string; body: string; tags: string[]; confidence: number; resolveDate?: string | null }
) => post<Entry>(`/api/books/${bookId}/entries`, data);
export const resolveEntry = (
  entryId: number,
  data: { outcome: "ok" | "ng"; judgment: "sound" | "flawed"; reasonOutcome: string; reasonJudgment: string }
) => post<Entry>(`/api/entries/${entryId}/resolve`, data);
export const postponeEntry = (entryId: number) =>
  post<Entry>(`/api/entries/${entryId}/postpone`, {});
export const appendEntry = (entryId: number, text: string) =>
  post<Entry>(`/api/entries/${entryId}/appends`, { text });
export const withdrawEntry = (entryId: number) =>
  req<{ withdrawn: Entry }>(`/api/entries/${entryId}`, { method: "DELETE", headers: headers() });
export const publishEntry = (
  entryId: number,
  data: {
    targetShelf: "shared" | "senpai";
    targetBookId?: number;
    newBookTitle?: string;
    passcode?: string;
    body?: string;
  }
) => post<{ published: Entry; bookId: number; passcode: string | null }>(`/api/entries/${entryId}/publish`, data);

// --- 通知・計器 ---
export const fetchDue = () => req<Entry[]>("/api/notifications/due");
export const fetchCalibration = () => req<CalibrationStats>("/api/stats/calibration");

export const fetchMyTimeline = (limit: number = 30, search: string = "") => {
  let url = `/api/entries/me/timeline?limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return req<any[]>(url);
};

// --- 召喚(意味検索・AI候補A) ---
// available=false のときは呼び出し側が bigram 一致にフォールバックする。
// サーバーは entryId とスコアしか返さない(本文は手元の生データを表示する)。
export interface RecallHit {
  entryId: number;
  score: number;
}
export interface RecallResponse {
  available: boolean;
  results: RecallHit[];
  minSimilarity: number;
}
export const apiRecall = (text: string, limit = 3) =>
  post<RecallResponse>("/api/recall", { text, limit });

// --- アウトカムバイアス検出(候補B・T2) ---
// 結果を綴じる「前」に呼ぶ。疑いがあれば question に「問い」が入る。
// available=false(APIキー未設定・障害)のときは何も表示せず普通に綴じる。
export interface BiasCheckResponse {
  available: boolean;
  biasSuspected: boolean;
  question: string | null;
}
export const apiBiasCheck = (
  entryId: number,
  data: { outcome: "ok" | "ng"; judgment: "sound" | "flawed"; reasonOutcome: string; reasonJudgment: string }
) => post<BiasCheckResponse>(`/api/entries/${entryId}/bias-check`, data);
