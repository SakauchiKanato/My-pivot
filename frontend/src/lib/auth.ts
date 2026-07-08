/** ローカルの認証状態(トークン保管)。 */
export interface AuthUser {
  userId: number;
  username: string;
}

const TOKEN_KEY = "myPivotToken";
const USER_KEY = "myPivotUser";

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
