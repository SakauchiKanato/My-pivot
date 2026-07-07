/**
 * ログイン / 新規登録 画面
 *
 * タブで「ログイン」と「新規登録」を切り替える。
 * 成功時は onSuccess() を呼んでメイン画面に移行する。
 */
import { useState } from "react";
import { login, register } from "../lib/auth";

interface Props {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");

  // ログインフォーム
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // 登録フォーム
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return;
    setLoading(true);
    setError(null);
    try {
      await login({ email: loginEmail, password: loginPassword });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regUsername || !regEmail || !regPassword) return;
    setLoading(true);
    setError(null);
    try {
      await register({ username: regUsername, email: regEmail, password: regPassword });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-brand">
          <h1 className="login-title">My Pivot</h1>
          <p className="login-tagline">迷った数だけ、私は進んだ。</p>
        </div>

        {/* タブ切り替え */}
        <div className="login-tabs">
          <button
            className={`login-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => { setTab("login"); setError(null); }}
          >
            ログイン
          </button>
          <button
            className={`login-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => { setTab("register"); setError(null); }}
          >
            新規登録
          </button>
        </div>

        {error && <p className="login-error">{error}</p>}

        {tab === "login" ? (
          <div className="login-form">
            <input
              id="login-email"
              className="login-input"
              type="email"
              placeholder="メールアドレス"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <input
              id="login-password"
              className="login-input"
              type="password"
              placeholder="パスワード"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button
              id="login-submit"
              className="login-submit"
              onClick={handleLogin}
              disabled={loading || !loginEmail || !loginPassword}
            >
              {loading ? "確認中…" : "ログイン"}
            </button>
          </div>
        ) : (
          <div className="login-form">
            <input
              id="reg-username"
              className="login-input"
              type="text"
              placeholder="ユーザー名"
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
            />
            <input
              id="reg-email"
              className="login-input"
              type="email"
              placeholder="メールアドレス"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <input
              id="reg-password"
              className="login-input"
              type="password"
              placeholder="パスワード（6文字以上）"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
            <button
              id="reg-submit"
              className="login-submit"
              onClick={handleRegister}
              disabled={loading || !regUsername || !regEmail || !regPassword}
            >
              {loading ? "登録中…" : "アカウントを作成"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
