/**
 * 認証関連のAPI通信とトークン管理
 *
 * - register / login → JWTトークンを取得して localStorage に保存
 * - logout → localStorage からトークンを削除
 * - getToken → 保存済みトークンを返す（api.ts で使う）
 */

const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "my_pivot_token";
const USER_KEY = "my_pivot_user";

export interface AuthUser {
  user_id: number;
  username: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// --- トークン管理 ---

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// --- API 関数 ---

/** 新規ユーザー登録 */
export async function register(data: RegisterData): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "登録に失敗しました");
  }
  const json = await res.json();
  const user: AuthUser = { user_id: json.user_id, username: json.username };
  saveAuth(json.access_token, user);
  return user;
}

/** ログイン */
export async function login(data: LoginData): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "ログインに失敗しました");
  }
  const json = await res.json();
  const user: AuthUser = { user_id: json.user_id, username: json.username };
  saveAuth(json.access_token, user);
  return user;
}
