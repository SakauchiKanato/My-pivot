/**
 * バックエンド（FastAPI）との通信をまとめたファイル
 *
 * ここを1箇所にまとめておくことで、
 * APIのURLが変わっても各コンポーネントを直さずに済む。
 * 全リクエストに Authorization: Bearer <token> を付与する。
 */

import { getToken } from "./auth";

// バックエンドのベースURL（開発中はlocalhost）
const API_BASE = "http://localhost:8000";

// --- 共通ヘッダー生成 ---
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// --- 型定義（バックエンドのモデルと対応） ---
export type Flag = "success" | "regret" | null;

export interface Tag {
  name: string;
  category: string;
}

export interface Pivot {
  id: number;
  title: string;
  content: string;
  layer: string;
  flag: Flag;
  confidence: number | null;
  created_at: string;
  tags: Tag[];
  is_ai_intervened?: boolean;
  ai_question?: string;
  ai_chat_history?: string;
}

export interface PivotCreate {
  title: string;
  content: string;
  confidence?: number;
  tag_names: string[];
}

// --- API関数 ---

/** タイムライン用に全ピボットを取得 */
export async function fetchPivots(): Promise<Pivot[]> {
  const res = await fetch(`${API_BASE}/api/pivots`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("ピボットの取得に失敗しました");
  return res.json();
}

/** 新規ピボットを作成（タグは自動整理される） */
export async function createPivot(data: PivotCreate): Promise<Pivot> {
  const res = await fetch(`${API_BASE}/api/pivots`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("ピボットの作成に失敗しました");
  return res.json();
}

/** 成功/後悔の評価を更新 */
export async function updateFlag(id: number, flag: Flag, reasonJudgment?: string, aiQuestion?: string, aiChatHistory?: string): Promise<Pivot> {
  const res = await fetch(`${API_BASE}/api/pivots/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ flag, reason_judgment: reasonJudgment, ai_question: aiQuestion, ai_chat_history: aiChatHistory }),
  });
  if (!res.ok) throw new Error("評価の更新に失敗しました");
  return res.json();
}

/** AIによるアウトカムバイアス判定を呼び出す関数 */
export async function checkOutcomeBias(
  pivotId: number,
  flag: Flag,
  reasonJudgment: string
): Promise<{ has_bias: boolean; question_to_user: string }> {
  const res = await fetch(`${API_BASE}/api/pivots/${pivotId}/check_bias`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ flag, reason_judgment: reasonJudgment }),
  });
  if (!res.ok) throw new Error("バイアス判定に失敗しました");
  return res.json();
}
