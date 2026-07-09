import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import confetti from 'canvas-confetti';
import { fetchMyTimeline } from '../lib/api';

interface TimelineEntry {
  id: number;
  bookId: number;
  bookTitle?: string;
  title: string;
  date: string;
  outcome: 'ok' | 'ng' | 'pending';
  judgment: 'sound' | 'flawed' | null;
  confidence: number | null;
  shelf: 'mine' | 'shared' | 'senpai';
}

// ==============================
// SVGの「蔓（幹）」コンポーネント
// ==============================
const OrganicTrunk: React.FC<{ height: number }> = ({ height }) => {
  const pathD = `M 24 0 C 22 ${height * 0.25} 26 ${height * 0.5} 24 ${height}`;
  return (
    <svg
      className="timeline-trunk-svg"
      style={{
        position: 'absolute',
        left: 14,
        top: 0,
        width: 20,
        height: height,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <motion.path
        d={pathD}
        stroke="#5c4033"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        style={{
          filter: 'drop-shadow(0 0 4px rgba(92, 64, 51, 0.4))',
        }}
      />
    </svg>
  );
};

// ==============================
// 書庫バッジ
// ==============================
const ShelfBadge: React.FC<{ shelf: TimelineEntry['shelf'] }> = ({ shelf }) => {
  const config: Record<TimelineEntry['shelf'], { label: string; emoji: string; style: React.CSSProperties }> = {
    mine: {
      label: '私の書庫',
      emoji: '🏛️',
      style: {
        background: 'linear-gradient(135deg, rgba(30,58,138,0.9), rgba(37,99,235,0.7))',
        color: '#bfdbfe',
        border: '1px solid rgba(59,130,246,0.4)',
      },
    },
    shared: {
      label: '共同の書架',
      emoji: '🌿',
      style: {
        background: 'linear-gradient(135deg, rgba(6,78,59,0.9), rgba(16,185,129,0.7))',
        color: '#a7f3d0',
        border: '1px solid rgba(16,185,129,0.4)',
      },
    },
    senpai: {
      label: '先達の書架',
      emoji: '📜',
      style: {
        background: 'linear-gradient(135deg, rgba(113,63,18,0.9), rgba(217,119,6,0.7))',
        color: '#fde68a',
        border: '1px solid rgba(245,158,11,0.4)',
      },
    },
  };
  const c = config[shelf];
  return (
    <span
      style={{
        ...c.style,
        padding: '3px 10px',
        borderRadius: '0 12px 0 12px',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        letterSpacing: '0.05em',
        display: 'inline-block',
        backdropFilter: 'blur(4px)',
      }}
    >
      {c.emoji} {c.label}
    </span>
  );
};

// ==============================
// 蕾ノード
// ==============================
const BudNode: React.FC<{ outcome: TimelineEntry['outcome']; inView: boolean }> = ({ outcome, inView }) => {
  const colorMap = {
    ok: {
      bud: 'radial-gradient(circle, #4ade80, #166534)',
      glow: 'rgba(74,222,128,0.6)',
      text: '✓',
    },
    ng: {
      bud: 'radial-gradient(circle, #f87171, #991b1b)',
      glow: 'rgba(248,113,113,0.5)',
      text: '✕',
    },
    pending: {
      bud: 'radial-gradient(circle, #a8a29e, #44403c)',
      glow: 'rgba(168,162,158,0.4)',
      text: '…',
    },
  };
  const c = colorMap[outcome];
  return (
    <motion.div
      initial={{ scale: 0, rotate: -30 }}
      animate={inView ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -30 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
      style={{
        position: 'relative',
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: '4px 44px 4px 44px',
        background: c.bud,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        color: 'white',
        fontWeight: 700,
        boxShadow: `0 0 12px ${c.glow}, 0 2px 8px rgba(0,0,0,0.5)`,
        flexShrink: 0,
        transform: 'rotate(-45deg)',
      }}
    >
      <span style={{ transform: 'rotate(45deg)', fontSize: 14 }}>{c.text}</span>
    </motion.div>
  );
};

// ==============================
// タイムラインアイテム（葉カード）
// ==============================
const TimelineItem: React.FC<{
  entry: TimelineEntry;
  index: number;
  onAchievement: () => void;
  onOpenEntry: (bookId: number, entryId: number) => void;
}> = ({ entry, index, onAchievement, onOpenEntry }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });

  useEffect(() => {
    if (inView && index > 0 && index % 10 === 0) {
      onAchievement();
    }
  }, [inView, index, onAchievement]);

  const isNg = entry.outcome === 'ng';

  const handleClick = () => {
    setIsSelected(true);
    // 少し待ってからジャンプ（ページめくり的な演出のため）
    setTimeout(() => {
      onOpenEntry(entry.bookId, entry.id);
    }, 420);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -40, rotate: 3 }}
      animate={inView ? { opacity: 1, x: 0, rotate: 0 } : { opacity: 0, x: -40, rotate: 3 }}
      transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1], delay: index * 0.04 }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: '32px 0',
      }}
    >
      {/* 枝（幹からカードへの横線） */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ delay: 0.35 + index * 0.04, duration: 0.3, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: 44,
          top: '50%',
          width: 28,
          height: 3,
          background: 'linear-gradient(to right, #5c4033, #8b5a2b)',
          borderRadius: 2,
          transformOrigin: 'left center',
          zIndex: 5,
        }}
      />

      {/* 蕾ノード */}
      <BudNode outcome={entry.outcome} inView={inView} />

      {/* 葉カード */}
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        animate={
          isSelected
            ? { scale: 1.08, filter: 'brightness(1.2)', zIndex: 100 }
            : isHovered
            ? { y: -6, rotate: 0.4, scale: 1.02 }
            : { y: 0, rotate: 0, scale: 1 }
        }
        transition={
          isSelected
            ? { duration: 0.25, ease: 'easeOut' }
            : { duration: 0.4, ease: 'easeOut' }
        }
        onClick={handleClick}
        style={{
          flex: 1,
          background: isNg
            ? 'linear-gradient(135deg, #2d1515, #2a1f1b)'
            : 'linear-gradient(135deg, #2a221b, #1e1a16)',
          borderLeft: isNg
            ? '6px solid #991b1b'
            : '6px solid #8b5a2b',
          borderRadius: '8px 20px 20px 8px',
          padding: '24px 28px 20px',
          cursor: 'pointer',
          position: 'relative',
          boxShadow: isHovered
            ? isNg
              ? '0 12px 32px -8px rgba(153,27,27,0.5), inset 1px 1px 0 rgba(255,255,255,0.05)'
              : '0 12px 32px -8px rgba(139,90,43,0.4), inset 1px 1px 0 rgba(255,255,255,0.08)'
            : '0 4px 16px -4px rgba(0,0,0,0.5), inset 1px 1px 0 rgba(255,255,255,0.03)',
          transition: 'box-shadow 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* グラデーションシャイン（ホバー時） */}
        <motion.div
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            top: 0,
            left: '-60%',
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
            transform: 'skewX(-15deg)',
            pointerEvents: 'none',
          }}
        />

        {/* パルスリング（ホバー時の発光） */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: [0, 0.15, 0], scale: [0.95, 1.02, 0.95] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '8px 20px 20px 8px',
              border: `2px solid ${isNg ? '#ef4444' : '#d97706'}`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* 書庫バッジ */}
        <div style={{ marginBottom: 12 }}>
          <ShelfBadge shelf={entry.shelf} />
        </div>

        {/* 日付 */}
        <div style={{ fontSize: 12, color: '#78716c', fontFamily: 'monospace', marginBottom: 8 }}>
          {entry.date}
        </div>

        {/* 書籍タイトル */}
        {entry.bookTitle && (
          <div style={{ fontSize: 13, color: '#d6d3d1', marginBottom: 8, fontStyle: 'italic' }}>
            📖 {entry.bookTitle}
          </div>
        )}

        {/* タイトル */}
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: 20,
          fontWeight: 400,
          color: isNg ? '#fca5a5' : '#e5d5c5',
          lineHeight: 1.5,
          fontFamily: "'Georgia', serif",
        }}>
          {entry.title}
        </h3>

        {/* 最小限のステータス */}
        <div style={{ marginBottom: 16 }}>
          {entry.outcome === 'ok' && (
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #4ade80', color: '#4ade80' }}>うまくいった</span>
          )}
          {entry.outcome === 'ng' && (
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #f87171', color: '#f87171' }}>後悔が残る</span>
          )}
          {entry.outcome === 'pending' && (
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #fbbf24', color: '#fbbf24' }}>結果待ち</span>
          )}
        </div>

        {/* アクション */}
        <motion.div
          animate={isHovered ? { x: [0, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.6, repeat: isHovered ? Infinity : 0, ease: 'easeInOut' }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: isNg ? '#f87171' : '#86efac',
            fontFamily: 'sans-serif',
            opacity: isHovered ? 1 : 0.6,
            transition: 'opacity 0.3s',
          }}
        >
          <span style={{ fontSize: 16 }}>{isNg ? '🍂' : '📖'}</span>
          <span>この本を開く</span>
          <motion.span
            animate={isHovered ? { x: [0, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.5, repeat: isHovered ? Infinity : 0, delay: 0.1, ease: 'easeInOut' }}
          >
            →
          </motion.span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// ==============================
// メインタイムラインコンポーネント
// ==============================
export const EmotionalTimeline: React.FC<{
  onClose: () => void;
  onOpenEntry: (bookId: number, entryId: number) => void;
}> = ({ onClose, onOpenEntry }) => {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);

  // Filters
  const [filterShelves, setFilterShelves] = useState<string[]>([]);
  const [filterOutcomes, setFilterOutcomes] = useState<string[]>([]);
  const [filterJudgments, setFilterJudgments] = useState<string[]>([]);
  const [filterConfidences, setFilterConfidences] = useState<string[]>([]);
  const [filterTime, setFilterTime] = useState<string>('all'); // 'all', '3m', '1y', 'older'

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const data = await fetchMyTimeline(50);
        if (Array.isArray(data)) {
          setEntries(data);
        }
      } catch (error) {
        console.error('Failed to fetch timeline', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, []);

  const filteredEntries = entries.filter(e => {
    // Shelf filter
    if (filterShelves.length > 0 && !filterShelves.includes(e.shelf)) return false;

    // Outcome filter
    if (filterOutcomes.length > 0 && !filterOutcomes.includes(e.outcome || "pending")) return false;

    // Judgment filter
    if (filterJudgments.length > 0 && !filterJudgments.includes(e.judgment || "none")) return false;

    // Confidence filter
    if (filterConfidences.length > 0) {
      const conf = e.confidence || 3;
      let ok = false;
      if (filterConfidences.includes("high") && conf >= 4) ok = true;
      if (filterConfidences.includes("mid") && conf === 3) ok = true;
      if (filterConfidences.includes("low") && conf <= 2) ok = true;
      if (!ok) return false;
    }

    // Time filter
    if (filterTime !== 'all' && e.date) {
      const d = new Date(e.date);
      const now = new Date();
      const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      
      if (filterTime === '3m' && diffMonths > 3) return false;
      if (filterTime === '1y' && diffMonths > 12) return false;
      if (filterTime === 'older' && diffMonths <= 12) return false;
    }

    return true;
  });

  useEffect(() => {
    if (listRef.current) {
      setListHeight(listRef.current.scrollHeight);
    }
  }, [filteredEntries]);

  const triggerAchievement = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#d97706', '#10b981', '#3b82f6', '#8b5e3c'],
    });
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          backgroundColor: 'rgba(12, 9, 7, 0.9)',
          backdropFilter: 'blur(10px)',
          overflowY: 'auto',
          color: '#e5e5e5',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: '64px 24px',
            position: 'relative',
          }}
        >
          {/* 閉じるボタン */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(62,51,40,0.8)',
              color: '#a39587',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(90,75,60,0.5)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            ✕
          </motion.button>

          {/* タイトル */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ fontSize: 13, letterSpacing: '0.2em', color: '#78716c', marginBottom: 12, fontFamily: 'monospace' }}
            >
              🌿 THE BOTANICAL ARCHIVE
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: '#d4c2aa',
                fontFamily: "'Georgia', serif",
                margin: '0 0 12px',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              The Journey of Decisions
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{
                color: '#8a7f72',
                fontSize: 16,
                fontStyle: 'italic',
                margin: 0,
              }}
            >
              あなたが育ててきた、知の樹脈。
            </motion.p>
          </div>

          {/* フィルターUI */}
          <div style={{ marginBottom: 40, background: 'rgba(25, 20, 15, 0.4)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(139,90,43,0.2)' }}>
            <div className="filter-scroll" style={{ marginBottom: 0 }}>
              <div className="filter-group">
                <span className="filter-label" style={{ color: '#a39587' }}>書庫</span>
                <div className="filter-chips">
                  {(["mine", "shared", "senpai"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      style={{ background: filterShelves.includes(s) ? '#d4c2aa' : 'transparent', color: filterShelves.includes(s) ? '#1a1510' : '#d4c2aa', borderColor: filterShelves.includes(s) ? '#d4c2aa' : 'rgba(212,194,170,0.3)' }}
                      className="chip"
                      onClick={() => setFilterShelves(cur => cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s])}
                    >
                      {s === 'mine' ? 'わたし' : s === 'shared' ? '共同' : '先達'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label" style={{ color: '#a39587' }}>期間</span>
                <div className="filter-chips">
                  {['all', '3m', '1y', 'older'].map(t => (
                    <button
                      key={t}
                      type="button"
                      style={{ background: filterTime === t ? '#d4c2aa' : 'transparent', color: filterTime === t ? '#1a1510' : '#d4c2aa', borderColor: filterTime === t ? '#d4c2aa' : 'rgba(212,194,170,0.3)' }}
                      className="chip"
                      onClick={() => setFilterTime(t)}
                    >
                      {t === 'all' ? 'すべて' : t === '3m' ? '過去3ヶ月' : t === '1y' ? '過去1年' : '1年以上前'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label" style={{ color: '#a39587' }}>決断の結果</span>
                <div className="filter-chips">
                  {['ok', 'ng', 'pending'].map(o => (
                    <button
                      key={o}
                      type="button"
                      style={{ background: filterOutcomes.includes(o) ? '#d4c2aa' : 'transparent', color: filterOutcomes.includes(o) ? '#1a1510' : '#d4c2aa', borderColor: filterOutcomes.includes(o) ? '#d4c2aa' : 'rgba(212,194,170,0.3)' }}
                      className="chip"
                      onClick={() => setFilterOutcomes(cur => cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o])}
                    >
                      {o === 'ok' ? 'うまくいった' : o === 'ng' ? '後悔が残る' : '結果待ち'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label" style={{ color: '#a39587' }}>当時の自信</span>
                <div className="filter-chips">
                  <button
                    type="button"
                    style={{ background: filterConfidences.includes('high') ? '#d4c2aa' : 'transparent', color: filterConfidences.includes('high') ? '#1a1510' : '#d4c2aa', borderColor: filterConfidences.includes('high') ? '#d4c2aa' : 'rgba(212,194,170,0.3)' }}
                    className="chip"
                    onClick={() => setFilterConfidences(cur => cur.includes("high") ? cur.filter(x => x !== "high") : [...cur, "high"])}
                  >自信あり</button>
                  <button
                    type="button"
                    style={{ background: filterConfidences.includes('low') ? '#d4c2aa' : 'transparent', color: filterConfidences.includes('low') ? '#1a1510' : '#d4c2aa', borderColor: filterConfidences.includes('low') ? '#d4c2aa' : 'rgba(212,194,170,0.3)' }}
                    className="chip"
                    onClick={() => setFilterConfidences(cur => cur.includes("low") ? cur.filter(x => x !== "low") : [...cur, "low"])}
                  >自信なし</button>
                </div>
              </div>
            </div>
          </div>

          {/* タイムラインリスト */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#78716c', padding: '48px 0' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', fontSize: 24 }}
              >
                🌱
              </motion.div>
              <p style={{ marginTop: 12 }}>記憶の樹脈を読み込み中...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#78716c', padding: '48px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
              <p>表示できる記録がありません。</p>
            </div>
          ) : (
            <div ref={listRef} style={{ position: 'relative', paddingLeft: 28 }}>
              {/* SVG有機的な幹 */}
              {listHeight > 0 && <OrganicTrunk height={listHeight} />}
              {filteredEntries.map((entry, idx) => (
                <TimelineItem
                  key={entry.id}
                  entry={entry}
                  index={idx}
                  onAchievement={triggerAchievement}
                  onOpenEntry={onOpenEntry}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
