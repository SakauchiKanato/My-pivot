/**
 * KarakuriShelf — からくり書架（書架ページネーション）
 *
 * 仕様:
 * - 棚が「埋まり切る」まで、この機能は一切表に出ない（矢印・ページ表示なし）。
 *   埋まり切った瞬間に ◀ ▶ が書架名の隣に出現し、2枚目の書架が奥に生まれる。
 * - 切替アニメーションは試作の「からくり機構」:
 *   奥へ沈む(0.8s) → 暗闇の中を横滑り(1.4s) → 手前に戻る。3.0sでロック解除。
 * - 本の描画（棚の中身）は renderPage に委譲するため、既存のBookSpine等を
 *   そのまま使える。データモデル・APIには一切触れない。
 * 使い方は INTEGRATION.md を参照。
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import './karakuri.css';

/** 1書架（1ページ）の枠数。「＋新しい本」も1枠を占有する */
export const SHELF_CAPACITY = 24;

/** からくりのタイミング（試作 試し.html と同一） */
const T_PULL = 800;              // 奥へ沈む
const T_SLIDE = 1400;            // 横滑り
const T_RETURN = T_PULL + T_SLIDE; // 2200ms: 手前へ戻し始める
const T_UNLOCK = 3000;           // 操作ロック解除

/** 本のグローバルindexから、その本が載っている書架ページ番号を返す */
export function pageOfIndex(index: number, capacity: number = SHELF_CAPACITY): number {
  return Math.floor(index / capacity);
}

export interface KarakuriShelfHandle {
  /** 検索ジャンプ用: 指定ページへからくり移動し、到着後に onArrived を呼ぶ */
  jumpToPage: (page: number, onArrived?: () => void) => void;
  currentPage: () => number;
}

export interface KarakuriShelfProps<T> {
  books: T[];
  /** 1書架の枠数（既定: SHELF_CAPACITY） */
  capacity?: number;
  /** フィーチャーフラグ。false なら従来通り全冊を1枚に描画 */
  enabled?: boolean;
  /** 「＋新しい本」が1枠を占有する棚か（わたし/共同: true, 先達: false） */
  hasAddSlot?: boolean;
  /** 書架名。◀ ▶ はこの両隣に描画される */
  title: React.ReactNode;
  /** 書架名の下の説明行（非公開。〜 など） */
  note?: React.ReactNode;
  /**
   * 1ページ分の棚の中身を描画する。
   * isLastPage のときだけ「＋新しい本」を末尾に置くこと。
   */
  renderPage: (pageBooks: T[], pageIndex: number, isLastPage: boolean) => React.ReactNode;
  className?: string;
}

function useReducedMotion(): boolean {
  return useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
}

function KarakuriShelfInner<T>(
  {
    books,
    capacity = SHELF_CAPACITY,
    enabled = true,
    hasAddSlot = false,
    title,
    note,
    renderPage,
    className,
  }: KarakuriShelfProps<T>,
  ref: React.Ref<KarakuriShelfHandle>,
) {
  // ページ数: 「＋新しい本」も1枠として数える
  const slotCount = books.length + (hasAddSlot ? 1 : 0);
  const pageCount = enabled ? Math.max(1, Math.ceil(slotCount / capacity)) : 1;
  const paginated = enabled && pageCount > 1; // ← 「埋まり切った」判定

  const [page, setPage] = useState(0);
  const [pullBack, setPullBack] = useState(false);
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const reducedMotion = useReducedMotion();

  // 本が減ってページ数が縮んだら現在ページをクランプ
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  // アンマウント時にタイマー掃除
  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const moveTo = (target: number, onArrived?: () => void) => {
    if (target < 0 || target >= pageCount) return;
    if (target === page) {
      onArrived?.();
      return;
    }
    if (busyRef.current) return;

    if (reducedMotion || !paginated) {
      setPage(target);
      onArrived?.();
      return;
    }

    busyRef.current = true;
    setPullBack(true);          // 【1】奥へ沈む
    setPage(target);            // 【2】横滑り（CSSのtransition-delay 0.8sが待つ）
    later(() => setPullBack(false), T_RETURN);   // 【3】手前へ戻す
    later(() => {
      busyRef.current = false;
      onArrived?.();
    }, T_UNLOCK);
  };

  useImperativeHandle(ref, () => ({
    jumpToPage: (p, onArrived) => moveTo(p, onArrived),
    currentPage: () => page,
  }));

  const pages = useMemo(() => {
    const result: T[][] = [];
    for (let i = 0; i < pageCount; i += 1) {
      result.push(books.slice(i * capacity, (i + 1) * capacity));
    }
    return result;
  }, [books, capacity, pageCount]);

  // ===== 埋まり切っていない棚: 従来と完全に同じ見た目（機能は不可視） =====
  if (!paginated) {
    return (
      <section className={`kk-stack ${className ?? ''}`}>
        <div className="kk-head">
          <h2 className="kk-title">{title}</h2>
        </div>
        {note && <p className="kk-note">{note}</p>}
        <div className="kk-frame kk-frame--static">
          {renderPage(books, 0, true)}
        </div>
      </section>
    );
  }

  // ===== 埋まり切った棚: ◀ ▶ とからくり機構が出現 =====
  return (
    <section className={`kk-stack ${className ?? ''}`}>
      <div className="kk-head">
        <button
          type="button"
          className={`kk-tri ${page === 0 ? 'kk-tri--off' : ''}`}
          aria-label="前の書架へ"
          onClick={() => moveTo(page - 1)}
        >
          ◀
        </button>
        <h2 className="kk-title">{title}</h2>
        <button
          type="button"
          className={`kk-tri ${page === pageCount - 1 ? 'kk-tri--off' : ''}`}
          aria-label="次の書架へ"
          onClick={() => moveTo(page + 1)}
        >
          ▶
        </button>
        <span className="kk-pageno">{page + 1} / {pageCount}</span>
      </div>
      {note && <p className="kk-note">{note}</p>}

      <div className="kk-case">
        <div className="kk-frame">
          <div
            className={`kk-slider ${pullBack ? 'kk-pull-back' : ''}`}
            style={{
              width: `${pageCount * 100}%`,
              transform: `translateX(-${(page * 100) / pageCount}%)`,
            }}
          >
            {pages.map((pageBooks, pi) => (
              <div
                key={pi}
                className="kk-page"
                style={{ width: `${100 / pageCount}%` }}
                aria-hidden={pi !== page}
              >
                {renderPage(pageBooks, pi, pi === pageCount - 1)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export const KarakuriShelf = forwardRef(KarakuriShelfInner) as <T>(
  props: KarakuriShelfProps<T> & { ref?: React.Ref<KarakuriShelfHandle> },
) => React.ReactElement;