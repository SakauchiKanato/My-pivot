/**
 * バックエンド（FastAPI）との通信をまとめたファイル
 *
 * ここを1箇所にまとめておくことで、
 * APIのURLが変わっても各コンポーネントを直さずに済む。
 */

// バックエンドのベースURL（開発中はlocalhost）
const API_BASE = "http://localhost:8000";

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
  const res = await fetch(`${API_BASE}/api/pivots`);
  if (!res.ok) throw new Error("ピボットの取得に失敗しました");
  return res.json();
}

/** 新規ピボットを作成（タグは自動整理される） */
export async function createPivot(data: PivotCreate): Promise<Pivot> {
  const res = await fetch(`${API_BASE}/api/pivots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("ピボットの作成に失敗しました");
  return res.json();
}

/** 成功/後悔の評価を更新 */
export async function updateFlag(id: number, flag: Flag): Promise<Pivot> {
  const res = await fetch(`${API_BASE}/api/pivots/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flag }),
  });
  if (!res.ok) throw new Error("評価の更新に失敗しました");
  return res.json();
}
