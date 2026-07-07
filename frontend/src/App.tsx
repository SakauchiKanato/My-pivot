/**
 * My Pivot メイン画面
 *
 * 左に五里霧中モード（入力）、右にタイムライン（参照）を並べる。
 * これが「入力 → 整理 → タイムライン」の1ループを1画面で見せる構成。
 */
import { useEffect, useState } from "react";
import { fetchPivots, type Pivot } from "./lib/api";
import { Timeline } from "./components/Timeline";
import { FogMode } from "./components/FogMode";
import "./App.css";

export default function App() {
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
    load();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>My Pivot</h1>
        <p className="tagline">迷った数だけ、私は進んだ。</p>
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
