/**
 * ピボット・タイムライン
 *
 * ピボットを時系列で縦に並べ、成功（緑）/後悔（赤）で色分けする。
 * 各ノードをクリックすると詳細（当時の気持ち）が展開する。
 */
import { useState } from "react";
import type { Pivot } from "../lib/api";

interface Props {
  pivots: Pivot[];
}

export function Timeline({ pivots }: Props) {
  // どのノードが展開中かを管理
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="timeline">
      <div className="timeline-line" />
      {pivots.map((p) => {
        const isSuccess = p.flag === "success";
        const isRegret = p.flag === "regret";
        const dotColor = isSuccess ? "#22c55e" : isRegret ? "#ef4444" : "#94a3b8";
        const isOpen = openId === p.id;

        return (
          <div key={p.id} className="node-row">
            <span
              className="node-dot"
              style={{ borderColor: dotColor, background: `${dotColor}22` }}
            />
            <div className="node-card" onClick={() => toggle(p.id)}>
              <div className="node-head">
                <span className="node-date">{p.created_at.slice(0, 7)}</span>
                <span
                  className="node-flag"
                  style={{ color: dotColor }}
                >
                  {isSuccess ? "✓ 成功" : isRegret ? "▼ 後悔" : "・未評価"}
                </span>
              </div>
              <div className="node-title">{p.title}</div>
              <div className="node-tags">
                {p.tags.map((t) => (
                  <span key={t.name} className="tag">
                    {t.name}
                    <span className="tag-cat">{t.category}</span>
                  </span>
                ))}
              </div>

              {isOpen && (
                <div className="node-detail">
                  <div className="detail-label">当時の気持ち</div>
                  <p className="detail-content">{p.content}</p>
                  {p.confidence != null && (
                    <div className="detail-conf">
                      当時の確信度：{"★".repeat(p.confidence)}
                      {"☆".repeat(5 - p.confidence)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
