import { useState } from "react";
import { apiGoogleLogin, apiLogin } from "../lib/api";
import { saveAuth } from "../lib/auth";
import { signInWithGoogle } from "../lib/firebase";
import { FLAGS } from "../config/flags";

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiLogin(email, password);
      saveAuth(res.access_token, { userId: res.user_id, username: res.username });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "接続に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const res = await apiGoogleLogin(idToken);
      saveAuth(res.access_token, { userId: res.user_id, username: res.username });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Googleログインに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <h1>書庫</h1>
        <p className="subtitle">迷いを本に綴じ、時が来たら結果をたずねる。</p>
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
          書庫に入る
        </button>
        <div className="auth-switch">はじめての方はGoogleアカウントで登録してください</div>
        <button className="plain" style={{ width: "100%" }} disabled={busy} onClick={submitGoogle}>
          Googleで登録・ログイン
        </button>
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
