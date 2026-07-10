/**
 * InkBadge — インクが紙に染み込むアニメーション付きバッジ
 * instruction3.md: "インクの染み込みと手書きマーカー" コンセプト実装
 */
import { useState } from "react";
import { motion } from "framer-motion";
import type { Entry } from "../../lib/api";

/** SVGの手書きマーカーライン */
function MarkerLine({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: -2,
        left: 0,
        width: "100%",
        height: 8,
        pointerEvents: "none",
        overflow: "visible",
      }}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
    >
      <motion.path
        d="M2,5 Q25,2 50,5 Q75,8 98,4"
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.28}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
    </svg>
  );
}

interface InkBadgeProps {
  label: string;
  variant: "ok" | "ng" | "pend" | "jud" | "pub" | "conf";
  children?: React.ReactNode;
}

const VARIANT_CONFIG = {
  ok:   { base: "badge ok",   markerColor: "var(--green)",  inkColor: "var(--green)" },
  ng:   { base: "badge ng",   markerColor: "var(--red)",    inkColor: "var(--red)"   },
  pend: { base: "badge pend", markerColor: "var(--gold)",   inkColor: "var(--gold)"  },
  jud:  { base: "badge jud",  markerColor: "var(--violet)", inkColor: "var(--violet)"},
  pub:  { base: "badge pub",  markerColor: "var(--blue)",   inkColor: "var(--blue)"  },
  conf: { base: "badge",      markerColor: "#888",           inkColor: "#888"         },
};

function InkBadge({ label, variant }: InkBadgeProps) {
  const cfg = VARIANT_CONFIG[variant];
  const [hovered, setHovered] = useState(false);
  const [inkKey, setInkKey] = useState(0);

  const handleHover = () => {
    setHovered(true);
    setInkKey((k) => k + 1); // re-trigger animation
  };

  return (
    <motion.span
      className={cfg.base}
      style={{ position: "relative", display: "inline-block", cursor: "default" }}
      onHoverStart={handleHover}
      onHoverEnd={() => setHovered(false)}
      // インクが染み込むような初期出現 (blur→sharp)
      initial={{ filter: "blur(3px)", opacity: 0.4 }}
      animate={{ filter: "blur(0px)", opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {label}
      {/* ホバー時に手書きマーカーがスッと引かれる */}
      {hovered && <MarkerLine key={inkKey} color={cfg.markerColor} />}
    </motion.span>
  );
}

/** 呼吸するカード内のバッジ群 */
export function Badges({ entry }: { entry: Entry }) {
  const isNg = entry.outcome === "ng";
  const isOk = entry.outcome === "ok";

  // NGカードの不規則な呼吸（心拍が乱れる微細な揺らぎ）
  const breathingVariants = isNg
    ? {
        animate: {
          x: [0, 0.6, -0.5, 0.3, 0, -0.3, 0],
          transition: {
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut" as const,
            repeatType: "mirror" as const,
          },
        },
      }
    : isOk
    ? {
        animate: {
          scale: [1, 1.002, 1],
          opacity: [1, 0.96, 1],
          transition: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut" as const,
            repeatType: "mirror" as const,
          },
        },
      }
    : {};

  return (
    <motion.div
      className="badges"
      {...breathingVariants}
    >
      <InkBadge label={`見込み ★${entry.confidence || 3}`} variant="conf" />
      {entry.outcome === "ok" && <InkBadge label="うまくいった" variant="ok" />}
      {entry.outcome === "ng" && <InkBadge label="後悔が残る" variant="ng" />}
      {entry.outcome === "pending" && (
        <InkBadge
          label={`結果待ち${entry.resolveDate ? `(予定 ${entry.resolveDate})` : ""}`}
          variant="pend"
        />
      )}
      {entry.judgment === "sound" && <InkBadge label="判断は妥当だった" variant="jud" />}
      {entry.judgment === "flawed" && <InkBadge label="判断にも悔いがある" variant="jud" />}
      {entry.sourceEntryId != null && <InkBadge label="出版された記録" variant="pub" />}
    </motion.div>
  );
}
