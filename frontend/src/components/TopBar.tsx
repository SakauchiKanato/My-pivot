import { useEffect, useRef, useState } from "react";
import type { Book, Entry, CalibrationStats } from "../lib/api";
import type { AuthUser } from "../lib/auth";

interface Props {
  user: AuthUser;
  stats: CalibrationStats | null;
  due: Entry[];
  books: Book[];
  onOpenMeter: () => void;
  onOpenDue: (entry: Entry) => void;
  onLogout: () => void;
  onOpenTimeline: () => void;
}

export function TopBar({ user, stats, due, books, onOpenMeter, onOpenDue, onLogout, onOpenTimeline }: Props) {
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ミニ計器3枠目: n>=5 のタグから全体との乖離が最大のもの
  let tagText = "—";
  let tagLabel = "タグ別(記録待ち)";
  if (stats && stats.okRate !== null) {
    const eligible = stats.tags.filter((t) => t.n >= 5);
    let best: { tag: string; rate: number; dev: number } | null = null;
    for (const t of eligible) {
      const dev = Math.abs(t.rate - stats.okRate);
      if (!best || dev > best.dev) best = { tag: t.tag, rate: t.rate, dev };
    }
    if (best) {
      tagText = `${best.rate}%`;
      tagLabel = `#${best.tag}の成功率`;
    }
  }

  const bookTitle = (bookId: number) => books.find((b) => b.id === bookId)?.title ?? "";

  // ------------------------------------------------------------------
  // 隠しコマンド機能(追加分)
  // TopBar はどの画面でも常に描画されているので、キー入力をここで
  // グローバルに監視し、"##xxx" の並びが入力されたら対応する
  // 演出(SecretEffectOverlay)を全画面に重ねて表示する。
  // ------------------------------------------------------------------
  const [secretEffect, setSecretEffect] = useState<SecretEffect | null>(null);
  const [secretPhrase, setSecretPhrase] = useState<string>("");
  const keyBufferRef = useRef("");

  useEffect(() => {
    const SECRET_COMMANDS: { pattern: string; effect: SecretEffect }[] = [
      { pattern: "##star", effect: "season" },
      { pattern: "##candle", effect: "candle" },
      { pattern: "##ink", effect: "ink" },
      { pattern: "##paper", effect: "paper" },
      { pattern: "##silence", effect: "silence" },
    ];
    const MAX_BUFFER = 20;

    const onKeyDown = (e: KeyboardEvent) => {
      // input/textarea に入力中でも、隠しコマンドは同時に成立させたいので
      // preventDefault はしない(通常の入力を邪魔しない)。
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-MAX_BUFFER);
      } else if (e.key === "Escape") {
        keyBufferRef.current = "";
      }

      const buf = keyBufferRef.current.toLowerCase();
      const hit = SECRET_COMMANDS.find((c) => buf.endsWith(c.pattern));
      if (hit) {
        keyBufferRef.current = "";
        if (hit.effect === "silence") {
          const saved = window.localStorage.getItem("shoko-secret-phrase");
          if (saved) {
            setSecretPhrase(saved);
          } else {
            const input = window.prompt("画面に浮かべる、あなただけの言葉を決めてください。") ?? "";
            const phrase = input.trim();
            if (!phrase) return; // 何も入力されなければ発動しない
            window.localStorage.setItem("shoko-secret-phrase", phrase);
            setSecretPhrase(phrase);
          }
        }
        setSecretEffect(hit.effect);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>書庫</h1>
          <p className="subtitle">迷いを本に綴じ、時が来たら結果をたずね、判断の癖を計器で見る。</p>
          <p className="user-chip" style={{ marginTop: 8 }}>
            {user.username} さんの書庫
            <button className="plain" type="button" onClick={onOpenTimeline} style={{ marginLeft: 16 }}>
              ⏳ タイムライン
            </button>
            <button className="plain" type="button" onClick={onLogout} style={{ marginLeft: 16 }}>
              ログアウト
            </button>
          </p>
        </div>
        <div className="bell-wrap" ref={bellRef}>
          <button
            className="icon-btn bell"
            type="button"
            aria-label="結果をたずねる通知"
            onClick={(e) => {
              e.stopPropagation();
              setBellOpen((v) => !v);
            }}
          >
            🔔
            {due.length > 0 && <span className="badge-dot">{due.length}</span>}
          </button>
          <div className={`bell-panel${bellOpen ? " open" : ""}`} aria-label="通知一覧">
            <div className="bell-title">結果、そろそろ分かる頃では?</div>
            <div>
              {due.length === 0 ? (
                <div className="bell-empty">
                  いまは、たずねることがありません。結果がわかりそうな日を綴じておくと、その頃にここでおたずねします。
                </div>
              ) : (
                due.map((e) => (
                  <button
                    key={e.id}
                    className="bell-item"
                    type="button"
                    onClick={() => {
                      setBellOpen(false);
                      onOpenDue(e);
                    }}
                  >
                    <b>『{e.title}』— その後、どうなりましたか?</b>
                    <span>
                      {bookTitle(e.bookId)} / 予定日 {e.resolveDate ?? ""} / 決定時の見込み ★
                      {e.confidence}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <button className="mini-meter" type="button" aria-label="全体のキャリブレーション計器を開く" onClick={onOpenMeter}>
          <span className="mini-stat">
            <b>{stats?.total ?? 0}</b>
            <span>記録した決定</span>
          </span>
          <span className="mini-stat">
            <b>{stats ? stats.avgConf.toFixed(1) : "0"}</b>
            <span>平均の見込み</span>
          </span>
          <span className="mini-stat">
            <b>{tagText}</b>
            <span>{tagLabel}</span>
          </span>
          <span className="meter-cta">クリックで計器を開く →</span>
        </button>
      </header>

      {secretEffect && (
        <SecretEffectOverlay
          effect={secretEffect}
          phrase={secretPhrase}
          onDone={() => setSecretEffect(null)}
        />
      )}
    </>
  );
}

// ====================================================================
// 隠しコマンド用の演出コンポーネント(追加分)
// ====================================================================

type SecretEffect = "season" | "candle" | "ink" | "paper" | "silence";
type Season = "spring" | "summer" | "autumn" | "winter";

function getSeason(date: Date = new Date()): Season {
  const m = date.getMonth() + 1; // 1-12
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

const SEASON_PARTICLE: Record<Season, { glyph: string; count: number; duration: [number, number] }> = {
  spring: { glyph: "🌸", count: 24, duration: [6, 10] },
  summer: { glyph: "✦", count: 18, duration: [4, 7] },
  autumn: { glyph: "🍁", count: 20, duration: [6, 10] },
  winter: { glyph: "❄", count: 26, duration: [5, 9] },
};

function SecretEffectOverlay({
  effect,
  phrase,
  onDone,
}: {
  effect: SecretEffect;
  phrase: string;
  onDone: () => void;
}) {
  // silence 以外は数秒で自動的に消える。silence はクリック/Escで閉じる。
  useEffect(() => {
    if (effect === "silence") return;
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
  }, [effect, onDone]);

  useEffect(() => {
    if (effect !== "silence") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effect, onDone]);

  return (
    <div
      className={`secret-overlay secret-${effect}`}
      onClick={() => effect === "silence" && onDone()}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: effect === "silence" ? "auto" : "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes secretFall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
        }
        @keyframes secretFlicker {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.8; }
        }
        @keyframes secretInkGrow {
          0%   { transform: scale(0); opacity: 0.9; }
          100% { transform: scale(1); opacity: 0.35; }
        }
        @keyframes secretFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {effect === "season" &&
        (() => {
          const season = getSeason();
          const { glyph, count, duration } = SEASON_PARTICLE[season];
          return Array.from({ length: count }).map((_, i) => {
            const left = Math.random() * 100;
            const dur = duration[0] + Math.random() * (duration[1] - duration[0]);
            const delay = Math.random() * 3;
            const size = 14 + Math.random() * 14;
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${left}vw`,
                  fontSize: size,
                  animation: `secretFall ${dur}s linear ${delay}s infinite`,
                  filter: season === "summer" ? "drop-shadow(0 0 6px #ffe98a)" : undefined,
                  color: season === "summer" ? "#ffe98a" : undefined,
                }}
              >
                {glyph}
              </span>
            );
          });
        })()}

      {effect === "candle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 45%, rgba(255,180,90,0.28), rgba(20,12,4,0.55) 70%)",
            animation: "secretFlicker 2.4s ease-in-out infinite",
          }}
        />
      )}

      {effect === "ink" && (
        <div
          style={{
            position: "absolute",
            top: "-20vh",
            right: "-20vw",
            width: "80vh",
            height: "80vh",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20,20,30,0.85), rgba(20,20,30,0) 70%)",
            animation: "secretInkGrow 2.6s ease-out forwards",
          }}
        />
      )}

      {effect === "paper" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, rgba(210,180,130,0.35), rgba(120,90,50,0.25)), " +
              "radial-gradient(circle at 20% 30%, rgba(90,60,20,0.15), transparent 40%), " +
              "radial-gradient(circle at 80% 70%, rgba(90,60,20,0.15), transparent 45%)",
            mixBlendMode: "multiply",
            animation: "secretFadeIn 1.4s ease-out",
          }}
        />
      )}

      {effect === "silence" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#f6f2ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            textAlign: "center",
            animation: "secretFadeIn 1.2s ease-out",
          }}
        >
          <p
            style={{
              fontSize: "clamp(18px, 3vw, 32px)",
              letterSpacing: 1.2,
              color: "#2b2620",
              maxWidth: 640,
              lineHeight: 1.8,
            }}
          >
            {phrase}
          </p>
        </div>
      )}
    </div>
  );
}