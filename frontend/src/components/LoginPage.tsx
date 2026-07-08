import { useState } from "react";
import { apiLogin, apiRegister } from "../lib/api";
import { saveAuth } from "../lib/auth";
import { FLAGS } from "../config/flags";

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await apiLogin(email, password)
          : await apiRegister(username, email, password);
      saveAuth(res.access_token, { userId: res.user_id, username: res.username });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "接続に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <h1>書庫</h1>
        <p className="subtitle">迷いを本に綴じ、時が来たら結果をたずねる。</p>
        {mode === "register" && (
          <input
            className="field"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <input
          className="field"
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field"
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <div className="auth-error">{error}</div>}
        <button className="plain dark" style={{ width: "100%" }} disabled={busy} onClick={submit}>
          {mode === "login" ? "書庫に入る" : "登録して入る"}
        </button>
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              はじめての方は{" "}
              <button type="button" onClick={() => setMode("register")}>
                新規登録
              </button>
            </>
          ) : (
            <>
              アカウントをお持ちの方は{" "}
              <button type="button" onClick={() => setMode("login")}>
                ログイン
              </button>
            </>
          )}
        </div>
        {FLAGS.showDemoCredentials && (
          <div className="demo-hint">
            デモ用: demo@example.com / demopass
            <br />
            (backend/seed.py で投入。ピッチ前に実データへ差し替え)
          </div>
        )}
      </div>
    </div>
  );
}
