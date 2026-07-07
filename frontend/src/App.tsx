/**
 * My Pivot メイン画面
 *
 * 未ログイン → <LoginPage> を表示
 * ログイン済 → 左に五里霧中モード（入力）、右にタイムライン（参照）を並べる。
 */
import { useEffect, useState } from "react";
import { fetchPivots, type Pivot } from "./lib/api";
import { getAuthUser, logout, type AuthUser } from "./lib/auth";
import { Timeline } from "./components/Timeline";
import { FogMode } from "./components/FogMode";
import { LoginPage } from "./components/LoginPage";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser());
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const data = await fetchPivots();
      setPivots(data);
    } catch (e) {
      setError("バックエンドに接続できません。localhost:8000 が起動しているか確認してください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const handleLogin = () => {
    setUser(getAuthUser());
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setPivots([]);
  };

  // 未ログイン時はログイン画面を表示
  if (!user) {
    return <LoginPage onSuccess={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>My Pivot</h1>
          <p className="tagline">迷った数だけ、私は進んだ。</p>
        </div>
        <div className="header-right">
          <span className="header-username">👤 {user.username}</span>
          <button className="logout-btn" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>

      <div className="app-body">
        <section className="input-col">
          <FogMode onCreated={load} />
        </section>

        <section className="timeline-col">
          <h2 className="col-title">ピボット・タイムライン</h2>
          {loading && <p className="status">読み込み中…</p>}
          {error && <p className="status error">{error}</p>}
          {!loading && !error && pivots.length === 0 && (
            <p className="status">まだ記録がありません。左から最初の迷いを記録しよう。</p>
          )}
          {!loading && !error && <Timeline pivots={pivots} />}
        </section>
      </div>
    </div>
  );
}
