/**
 * 全体キャリブレーション計器モーダル(v3 の buildCurveSVG / buildInsights を移植)
 * データはサーバー集計(GET /api/stats/calibration)を使う。
 * n数の透明開示(n<3 は白抜き点)という設計判断を維持。
 */
import type { CalibrationStats } from "../lib/api";

interface Props {
  stats: CalibrationStats;
  onClose: () => void;
  onDemoReset?: () => void;
}

const XS: Record<number, number> = { 1: 85, 2: 170, 3: 255, 4: 340, 5: 425 };
const yOf = (rate: number) => 250 - rate * 2.2;

export function CalibrationModal({ stats, onClose, onDemoReset }: Props) {
  const pts: { x: number; y: number; n: number; c: number; rate: number }[] = [];
  for (let c = 1; c <= 5; c++) {
    const b = stats.buckets[String(c)];
    if (b && b.n > 0 && b.rate !== null) {
      pts.push({ x: XS[c], y: yOf(b.rate), n: b.n, c, rate: b.rate });
    }
  }

  // insights: ★別の乖離最大(n>=3)
  let best: { c: number; rate: number; dev: number; n: number } | null = null;
  for (let c = 1; c <= 5; c++) {
    const b = stats.buckets[String(c)];
    if (!b || b.n < 3 || b.rate === null) continue;
    const dev = b.rate - b.mid;
    if (!best || Math.abs(dev) > Math.abs(best.dev)) best = { c, rate: b.rate, dev, n: b.n };
  }
  // タグ別(n>=5)
  let bestTag: { tag: string; rate: number; n: number; dev: number } | null = null;
  if (stats.okRate !== null) {
    for (const t of stats.tags.filter((t) => t.n >= 5)) {
      const dev = t.rate - stats.okRate;
      if (!bestTag || Math.abs(dev) > Math.abs(bestTag.dev)) bestTag = { ...t, dev };
    }
  }

  return (
    <div id="calModal" className="open" aria-hidden="false" onClick={(e) => {
      if ((e.target as HTMLElement).id === "calModal") onClose();
    }}>
      <div className="cal-box">
        <button className="plain cal-close" type="button" onClick={onClose}>
          ✕ 閉じる
        </button>
        <h2>全体の計器 — 見込みと結果</h2>
        <p className="hint">あなたの決定の癖を、記録から。個別の本の年表とは分けています。</p>
        <div className="cal-grid">
          <div className="cal-stat">
            <b>{stats.total}</b>
            <span>記録した決定</span>
          </div>
          <div className="cal-stat">
            <b>{stats.resolvedN}</b>
            <span>結果が出た決断</span>
          </div>
          <div className="cal-stat">
            <b>{stats.avgConf.toFixed(1)}/5</b>
            <span>平均の見込み</span>
          </div>
        </div>
        <div className="chart">
          <svg viewBox="0 0 460 315" width="100%" role="img" aria-label="見込みと成功率のキャリブレーション曲線">
            <g stroke="#ded5c4">
              {[30, 85, 140, 195, 250].map((y) => (
                <line key={y} x1={60} y1={y} x2={440} y2={y} />
              ))}
            </g>
            <g fill="#8a8172" fontSize={11}>
              <text x={20} y={34}>100%</text>
              <text x={27} y={144}>50%</text>
              <text x={34} y={254}>0%</text>
              {[1, 2, 3, 4, 5].map((i) => (
                <text key={i} x={XS[i] - 9} y={272}>
                  ★{i}
                </text>
              ))}
            </g>
            <polyline
              points={[1, 2, 3, 4, 5]
                .map((i) => `${XS[i]},${yOf(stats.buckets[String(i)]?.mid ?? 50)}`)
                .join(" ")}
              fill="none"
              stroke="#bdb4a3"
              strokeWidth={2}
              strokeDasharray="6 6"
            />
            {pts.length >= 2 && (
              <polyline
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#6556b3"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {pts.map((p) =>
              p.n >= 3 ? (
                <circle key={p.c} cx={p.x} cy={p.y} r={5.5} fill="#b88a36" />
              ) : (
                <circle key={p.c} cx={p.x} cy={p.y} r={5.5} fill="#fffaf0" stroke="#b88a36" strokeWidth={2.5} />
              )
            )}
            {pts.map((p) => (
              <text key={`n${p.c}`} x={p.x - 12} y={292} fontSize={10} fill="#8a8172">
                n={p.n}
              </text>
            ))}
            <text x={60} y={310} fontSize={10} fill="#8a8172">
              破線 = 目安(各★の区間中点) / 白抜きの点 = n&lt;3 の参考値
            </text>
          </svg>
        </div>
        {best &&
          (best.dev > 15 ? (
            <div className="insight">
              見込み★{best.c}の決断の成功率は {best.rate}%(n={best.n}
              )。自信のなさは「止まれ」ではなく「丁寧に進め」のサインかもしれません。
            </div>
          ) : best.dev < -15 ? (
            <div className="insight">
              見込み★{best.c}の決断の成功率は {best.rate}%(n={best.n}
              )。自信があるときほど、見積もりを一度疑う価値がありそうです。
            </div>
          ) : (
            <div className="insight">
              見込みと結果のズレは、いまのところ小さめです(★{best.c}: {best.rate}%、n={best.n})。
            </div>
          ))}
        {bestTag && Math.abs(bestTag.dev) >= 8 && stats.okRate !== null && (
          <div className="insight">
            #{bestTag.tag} がついた決断の成功率は {bestTag.rate}%(全体 {stats.okRate}%、n=
            {bestTag.n})。
            {bestTag.dev > 0
              ? "この感情は、思っているほど悪い予兆ではないようです。"
              : "この感情がある決断は、少し慎重に。"}
          </div>
        )}
        <p className="caveat">
          記録が少ないうちは、この計器は「傾向の仮説」です。各点に n を併記し、n&lt;3
          の点は白抜きで示しています。記録が増えるほど、計器はあなた向けになります。
        </p>
        {onDemoReset && (
          <button className="cal-reset" type="button" onClick={onDemoReset}>
            記録を初期状態に戻す(デモ用)
          </button>
        )}
      </div>
    </div>
  );
}
