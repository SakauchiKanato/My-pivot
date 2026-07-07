import React, { useState, useEffect, useRef } from "react";
import "./EarthArchive.css";

// --- 型定義 ---
interface Book {
  id: string;
  shelf: "mine" | "shared" | "senpai";
  title: string;
  fill: string;
  h: number;
}

interface EntryAppend {
  date: string;
  text: string;
}

interface Entry {
  id: string;
  bookId: string;
  date: string;
  title: string;
  body: string;
  tags: string[];
  confidence: number;
  outcome: "ok" | "ng" | "pending";
  judgment: "sound" | "flawed" | null;
  reasonOutcome?: string;
  reasonJudgment?: string;
  resolveDate?: string;
  resolvedOn?: string;
  savedAt?: number;
}

// --- 定数とシードデータ ---
const MS_DAY = 86400000;
const SHELF_LABEL = { mine: "わたしの本棚", shared: "共同の本棚", senpai: "先達の本棚" };
const SHELF_SHORT = { mine: "わたし", shared: "共同", senpai: "先達" };
const CASE_NOTES = {
  mine: "非公開。ここに綴じた記録は、あなたにしか読めません。",
  shared: "共同。選んだ仲間とだけ、迷いを共有します。",
  senpai: "先達の記録。読み専用。決定当時の生データが綴じられています。"
};

const SEED_BOOKS: Book[] = [
  { id: "b1", shelf: "mine", title: "進路の迷い", fill: "#1c3540", h: 146 },
  { id: "b2", shelf: "mine", title: "研究室のこと", fill: "#4b3f78", h: 153 },
  { id: "b3", shelf: "mine", title: "技育祭の判断", fill: "#5a1730", h: 140 },
  { id: "b4", shelf: "mine", title: "ハッカソン初参加", fill: "#2f6f58", h: 151 },
  { id: "b5", shelf: "mine", title: "休む選択", fill: "#6a4a2a", h: 137 },
  { id: "b6", shelf: "mine", title: "応募しなかった日", fill: "#672f36", h: 149 },
  { id: "b7", shelf: "shared", title: "共同開発メモ", fill: "#305f8f", h: 144 },
  { id: "b8", shelf: "shared", title: "締切前の焦り", fill: "#383838", h: 148 },
  { id: "b9", shelf: "shared", title: "発表の前夜", fill: "#422a54", h: 142 },
  { id: "b10", shelf: "senpai", title: "院進をやめた記録", fill: "#25413c", h: 155 },
  { id: "b11", shelf: "senpai", title: "研究室を変えた話", fill: "#1f4f68", h: 143 },
  { id: "b12", shelf: "senpai", title: "休学の一年", fill: "#54432b", h: 136 }
];

const SEED_ENTRIES: Entry[] = [
  {
    id: "e01", bookId: "b1", date: "2024-07-02", title: "院進か就職か", tags: ["進路", "不安"], confidence: 2,
    body: "研究は好きだが、経済的な不安が消えない。周りが動き出していて焦る。まだどちらとも言えない。",
    outcome: "pending", judgment: null, resolveDate: "2026-07-01"
  },
  {
    id: "e02", bookId: "b1", date: "2025-10-11", title: "インターン先を選ぶ", tags: ["進路", "決定"], confidence: 3,
    body: "知名度より、現場が近い方を選ぶ。合っているかは分からない。",
    outcome: "ok", judgment: "sound", resolvedOn: "2026-02-10",
    reasonOutcome: "現場を見て、進路の解像度が一段上がった。",
    reasonJudgment: "情報を集め切ってから決めたプロセスは妥当だった。"
  },
  {
    id: "e03", bookId: "b2", date: "2024-04-05", title: "第一希望の研究室に出す", tags: ["研究", "不安"], confidence: 2,
    body: "怖い。落ちたら立ち直れない気がする。でも直感はここだと言っている。",
    outcome: "ok", judgment: "sound", resolvedOn: "2024-10-01",
    reasonOutcome: "環境もテーマも合っていた。直感を信じてよかった。",
    reasonJudgment: "怖さと相性は別物だと切り分けられていた。"
  },
  {
    id: "e04", bookId: "b2", date: "2025-12-01", title: "研究テーマを変える相談", tags: ["研究", "挑戦"], confidence: 4,
    body: "今のテーマでは自分が持たない。先生に切り出す。",
    outcome: "ok", judgment: "sound", resolvedOn: "2026-03-20",
    reasonOutcome: "相談したら想像より早く道が開けた。",
    reasonJudgment: "抱え込まずに早く動いた判断は正しかった。"
  },
  {
    id: "e05", bookId: "b3", date: "2024-07-20", title: "技育祭に行くか", tags: ["挑戦", "後悔", "不安"], confidence: 1,
    body: "行っても意味があるのか分からず、もう3ヶ月迷っている。",
    outcome: "ng", judgment: "flawed", resolvedOn: "2024-11-05",
    reasonOutcome: "結局行かず、あとから登壇内容を知って後悔した。",
    reasonJudgment: "迷い続けること自体がコストだと気づけていなかった。"
  },
  {
    id: "e06", bookId: "b4", date: "2025-04-18", title: "ハッカソンに出るか", tags: ["挑戦", "不安", "仲間"], confidence: 2,
    body: "実力不足で迷惑をかけそうで怖い。でも出ない後悔は技育祭で知っている。",
    outcome: "ok", judgment: "sound", resolvedOn: "2025-05-30",
    reasonOutcome: "実装より、同じ熱量の人に会えたことが大きかった。",
    reasonJudgment: "過去の後悔を判断材料にできた。"
  },
  {
    id: "e20", bookId: "b4", date: "2025-05-10", title: "チーム編成を妥協する", tags: ["仲間", "後悔"], confidence: 3,
    body: "誘いにくくて、声をかけずに手近な編成で済ませた。",
    outcome: "ng", judgment: "flawed", resolvedOn: "2025-07-15",
    reasonOutcome: "役割が偏って、後半に負荷が集中した。",
    reasonJudgment: "気まずさを避けたのは判断ではなく回避だった。"
  },
  {
    id: "e07", bookId: "b5", date: "2025-02-09", title: "今夜は寝る", tags: ["生活", "不安"], confidence: 1,
    body: "止まったら負けだと思っている。でも限界かもしれない。",
    outcome: "ok", judgment: "sound", resolvedOn: "2025-02-10",
    reasonOutcome: "一晩寝たら判断の質が戻った。",
    reasonJudgment: "「止まる」も選択肢だと認められた。"
  },
  {
    id: "e08", bookId: "b5", date: "2026-03-02", title: "バイトを減らす", tags: ["生活", "決定"], confidence: 3,
    body: "研究時間を確保したい。収入は減るが、今はそちらが優先のはず。",
    outcome: "ng", judgment: "sound", resolvedOn: "2026-06-15",
    reasonOutcome: "収入が減って想定より生活が苦しい。結果だけ見れば後悔。",
    reasonJudgment: "当時の情報では研究時間の確保が最優先で、判断そのものは妥当だった。"
  },
  {
    id: "e09", bookId: "b6", date: "2025-03-14", title: "応募をやめた", tags: ["後悔", "挑戦"], confidence: 2,
    body: "まだ早い気がする。来年でいいはず。",
    outcome: "ng", judgment: "flawed", resolvedOn: "2025-06-01",
    reasonOutcome: "後で募集要項を見返したら、十分いけた。",
    reasonJudgment: "「まだ早い」は根拠のない先送りだった。"
  },
  {
    id: "e10", bookId: "b6", date: "2026-06-20", title: "リベンジ応募", tags: ["挑戦", "不安"], confidence: 3,
    body: "去年は「まだ早い」で逃げた。今年は出す。",
    outcome: "pending", judgment: null, resolveDate: "2026-08-01"
  },
  {
    id: "e11", bookId: "b7", date: "2025-09-05", title: "役割分担を先に決める", tags: ["仲間", "決定"], confidence: 4,
    body: "曖昧さを残すと衝突が増える。最初に役割を切る。",
    outcome: "ok", judgment: "sound", resolvedOn: "2025-11-20",
    reasonOutcome: "役割を明確にしたら一気に進み始めた。",
    reasonJudgment: "過去の共同作業の失敗から学べていた。"
  },
  {
    id: "e12", bookId: "b7", date: "2026-02-14", title: "枯れたライブラリを選ぶ", tags: ["研究", "決定"], confidence: 4,
    body: "新しい方が速いらしいが、情報の多さを優先する。",
    outcome: "ok", judgment: "sound", resolvedOn: "2026-05-01",
    reasonOutcome: "詰まったとき、事例の多さに何度も救われた。",
    reasonJudgment: "チームの練度に合わせた選定は妥当だった。"
  },
  {
    id: "e13", bookId: "b8", date: "2025-06-25", title: "追加タスクを引き受ける", tags: ["生活", "後悔"], confidence: 4,
    body: "勢いで引き受けた。いける気がしている。",
    outcome: "ng", judgment: "flawed", resolvedOn: "2025-07-30",
    reasonOutcome: "締切前に体力が尽きて、品質を落とした。",
    reasonJudgment: "見込み★4でも、体力の見積もりが抜けていた。"
  },
  {
    id: "e14", bookId: "b9", date: "2025-11-21", title: "完璧じゃないまま発表する", tags: ["研究", "不安", "挑戦"], confidence: 2,
    body: "穴だらけの気がする。攻めてみないと前に進まない。",
    outcome: "ok", judgment: "sound", resolvedOn: "2025-11-22",
    reasonOutcome: "質問で、むしろ研究の輪郭が見えた。",
    reasonJudgment: "完成度より速度を取ったのは正しかった。"
  },
  {
    id: "e15", bookId: "b9", date: "2026-05-30", title: "デモは実データで行く", tags: ["挑戦", "決定"], confidence: 5,
    body: "作り物のデータでは響かない。自分たちの記録で見せる。",
    outcome: "ok", judgment: "sound", resolvedOn: "2026-06-10",
    reasonOutcome: "聞き手の反応が明らかに違った。",
    reasonJudgment: "リスクはあったが、狙いに沿った判断だった。"
  },
  {
    id: "e16", bookId: "b10", date: "2023-12-10", title: "院進をやめる", tags: ["進路", "不安"], confidence: 3,
    body: "怖さを全部書き出してから決めた。逃げではなく選択にしたい。",
    outcome: "ok", judgment: "sound", resolvedOn: "2024-06-01",
    reasonOutcome: "納得感が残った。後悔はしていない。",
    reasonJudgment: "怖さを言語化してから選んだのが効いた。"
  },
  {
    id: "e17", bookId: "b10", date: "2023-08-02", title: "教授に相談せず決める", tags: ["進路", "不安"], confidence: 1,
    body: "怒られる気がして、相談を飛ばして自分だけで決めようとしている。",
    outcome: "ng", judgment: "flawed", resolvedOn: "2023-10-15",
    reasonOutcome: "あとで話したら、知らなかった選択肢が二つもあった。",
    reasonJudgment: "「怖いから聞かない」は判断材料を自分で減らす行為だった。"
  },
  {
    id: "e18", bookId: "b11", date: "2022-10-15", title: "研究室を移る", tags: ["研究", "挑戦"], confidence: 3,
    body: "環境を変えるのは怖いが、このまま消耗する方が怖い。",
    outcome: "ng", judgment: "sound", resolvedOn: "2023-09-01",
    reasonOutcome: "結果的に卒業は半年遅れた。",
    reasonJudgment: "それでも、あの環境に残る選択肢はなかった。判断は間違っていない。"
  },
  {
    id: "e19", bookId: "b12", date: "2021-04-01", title: "休学届を出す", tags: ["生活", "進路"], confidence: 5,
    body: "一度止まる。戻ってくるための休学にする。",
    outcome: "ok", judgment: "sound", resolvedOn: "2022-04-01",
    reasonOutcome: "一年かけて、進みたい方向が言葉になった。",
    reasonJudgment: "目的を先に決めた休学だったのが良かった。"
  }
];

// --- ユーティリティ ---
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsISO(baseISO: string, months: number) {
  const d = baseISO ? new Date(baseISO) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const MID: Record<number, number> = { 1: 10, 2: 30, 3: 50, 4: 70, 5: 90 };

export function EarthArchive() {
  // --- 状態管理 (State) ---
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem("pivotBooksV3");
      return saved ? JSON.parse(saved) : SEED_BOOKS;
    } catch {
      return SEED_BOOKS;
    }
  });

  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const saved = localStorage.getItem("pivotEntriesV3");
      return saved ? JSON.parse(saved) : SEED_ENTRIES;
    } catch {
      return SEED_ENTRIES;
    }
  });

  const [overrides, setOverrides] = useState<Record<string, Partial<Entry>>>(() => {
    try {
      const saved = localStorage.getItem("pivotOverridesV3");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [appendsMap, setAppendsMap] = useState<Record<string, EntryAppend[]>>(() => {
    try {
      const saved = localStorage.getItem("pivotAppendsV3");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // UI上の状態
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [openBookData, setOpenBookData] = useState<Book | null>(null);
  const [openBookMode, setOpenBookMode] = useState<"toc" | "write" | "search" | "timeline">("toc");
  const [innerSearchText, setInnerSearchText] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 本を開くアニメーション用フェーズ
  const [overlayActive, setOverlayActive] = useState(false);
  const [coverShow, setCoverShow] = useState(false);
  const [coverOpening, setCoverOpening] = useState(false);
  const [spreadShow, setSpreadShow] = useState(false);
  const [pagesFlipped, setPagesFlipped] = useState([false, false, false, false]);
  const [contentReady, setContentReady] = useState(false);
  const [closeBtnShow, setCloseBtnShow] = useState(false);

  // 入力フォーム用
  const [noteBody, setNoteBody] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [dateUnknown, setDateUnknown] = useState(true);
  const [resolveDateVal, setResolveDateVal] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  // 結果フラグ入力用
  const [activeFlagFormId, setActiveFlagFormId] = useState<string | null>(null);
  const [flagOutcome, setFlagOutcome] = useState<"ok" | "ng" | null>(null);
  const [flagJudgment, setFlagJudgment] = useState<"sound" | "flawed" | null>(null);
  const [reasonOutcome, setReasonOutcome] = useState("");
  const [reasonJudgment, setReasonJudgment] = useState("");

  // 追記フォーム用
  const [activeAppendFormId, setActiveAppendFormId] = useState<string | null>(null);
  const [appendText, setAppendText] = useState("");

  // 召喚(Recall)用
  const [recallEntry, setRecallEntry] = useState<Entry | null>(null);

  // スクロール先のフォーカス
  const [focusEntryId, setFocusEntryId] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  // --- ローカルストレージ保存 ---
  useEffect(() => {
    localStorage.setItem("pivotBooksV3", JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem("pivotEntriesV3", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("pivotOverridesV3", JSON.stringify(overrides));
  }, [overrides]);

  useEffect(() => {
    localStorage.setItem("pivotAppendsV3", JSON.stringify(appendsMap));
  }, [appendsMap]);

  // --- トースト関数 ---
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  // --- データ変換ヘルパー ---
  const getMergedEntry = (entry: Entry): Entry => {
    const ov = overrides[entry.id];
    if (!ov) return entry;
    return { ...entry, ...ov };
  };

  const getEntriesOfBook = (bookId: string): Entry[] => {
    const list: Entry[] = [];
    // SEEDから取得して上書き適用
    SEED_ENTRIES.forEach(e => {
      if (e.bookId === bookId) list.push(getMergedEntry(e));
    });
    // ユーザー追加分
    entries.forEach(e => {
      if (e.bookId === bookId && !SEED_ENTRIES.some(se => se.id === e.id)) {
        list.push(getMergedEntry(e));
      }
    });
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    return list;
  };

  const getAllEntriesMerged = (): Entry[] => {
    const list: Entry[] = [];
    books.forEach(b => {
      getEntriesOfBook(b.id).forEach(e => list.push(e));
    });
    return list;
  };

  const getOwnEntries = (): Entry[] => {
    return getAllEntriesMerged().filter(e => {
      const b = books.find(book => book.id === e.bookId);
      return b && b.shelf !== "senpai";
    });
  };

  const getDueNotifications = (): Entry[] => {
    const t = todayISO();
    return getOwnEntries().filter(e => {
      return e.outcome === "pending" && e.resolveDate && e.resolveDate <= t;
    });
  };

  // --- タグ一覧抽出 ---
  const allUniqueTags = Array.from(
    new Set(getAllEntriesMerged().flatMap(e => e.tags || []))
  ).sort();

  // --- 検索・フィルタリング ---
  const getBookText = (book: Book): string => {
    let txt = book.title;
    getEntriesOfBook(book.id).forEach(e => {
      txt += " " + e.title + " " + (e.tags || []).join(" ") + " " + (e.body || "");
    });
    return txt.toLowerCase();
  };

  const getBookTags = (book: Book): string[] => {
    const tags: string[] = [];
    getEntriesOfBook(book.id).forEach(e => {
      (e.tags || []).forEach(t => {
        if (!tags.includes(t)) tags.push(t);
      });
    });
    return tags;
  };

  const bookMatchesFilter = (book: Book): boolean => {
    const q = searchText.trim().toLowerCase();
    const tags = getBookTags(book);
    const tagOk = selectedTags.every(t => tags.includes(t));
    const wordOk = !q || getBookText(book).includes(q);
    return tagOk && wordOk;
  };

  const hasActiveFilter = selectedTags.length > 0 || searchText.trim().length > 0;

  // --- 召喚 (Recall) ロジック ---
  const bigrams = (str: string) => {
    const s = String(str || "").replace(/\s+/g, "");
    const set: Record<string, number> = {};
    for (let i = 0; i < s.length - 1; i++) {
      set[s.substring(i, i + 2)] = 1;
    }
    return set;
  };

  const computeSimilarity = (text: string, entry: Entry): number => {
    const a = bigrams(text);
    const b = bigrams(entry.title + (entry.body || "") + (entry.tags || []).join(""));
    let score = 0;
    for (const g in a) {
      if (b[g]) score++;
    }
    (entry.tags || []).forEach(t => {
      if (text.includes(t)) score += 3;
    });
    return score;
  };

  useEffect(() => {
    const text = noteBody.trim();
    if (text.length < 12) {
      setRecallEntry(null);
      return;
    }
    let best: Entry | null = null;
    let bestScore = 0;
    getAllEntriesMerged().forEach(e => {
      // 現在開いている本の書きかけの悩み自身は召喚対象外にする
      if (openBookData && e.bookId === openBookData.id && e.body === text) return;
      const s = computeSimilarity(text, e);
      if (s > bestScore) {
        bestScore = s;
        best = e;
      }
    });
    if (bestScore >= 3 && best) {
      setRecallEntry(best);
    } else {
      setRecallEntry(null);
    }
  }, [noteBody]);

  // --- 計器計算用ヘルパー ---
  const getBucketStats = () => {
    const res: Record<number, { n: number; ok: number }> = {};
    for (let i = 1; i <= 5; i++) res[i] = { n: 0, ok: 0 };
    getOwnEntries().forEach(e => {
      if (e.outcome === "pending") return;
      const c = Number(e.confidence) || 3;
      res[c].n++;
      if (e.outcome === "ok") res[c].ok++;
    });
    return res;
  };

  const getOverallStats = () => {
    const own = getOwnEntries();
    const resolved = own.filter(e => e.outcome !== "pending");
    const ok = resolved.filter(e => e.outcome === "ok").length;
    let sum = 0;
    own.forEach(e => {
      sum += Number(e.confidence) || 3;
    });
    return {
      total: own.length,
      resolvedN: resolved.length,
      okRate: resolved.length ? Math.round((ok / resolved.length) * 100) : null,
      avgConf: own.length ? sum / own.length : 0
    };
  };

  const getTagStats = (minN: number) => {
    const map: Record<string, { n: number; ok: number }> = {};
    getOwnEntries().forEach(e => {
      if (e.outcome === "pending") return;
      (e.tags || []).forEach(t => {
        map[t] = map[t] || { n: 0, ok: 0 };
        map[t].n++;
        if (e.outcome === "ok") map[t].ok++;
      });
    });
    const list: { tag: string; n: number; rate: number }[] = [];
    for (const t in map) {
      if (map[t].n >= minN) {
        list.push({ tag: t, n: map[t].n, rate: Math.round((map[t].ok / map[t].n) * 100) });
      }
    }
    return list;
  };

  // --- 本を開閉するアクション ---
  const handleOpenBook = (book: Book, startMode: "toc" | "write" | "search" | "timeline" = "toc") => {
    setOpenBookData(book);
    setOpenBookMode(startMode);
    setConfidence(3);
    setNoteBody("");
    setNoteTitle("");
    setNoteTags("");
    setDateUnknown(true);
    setResolveDateVal("");
    setSaveStatus("");

    // アニメーションステップ
    setOverlayActive(true);
    setTimeout(() => {
      setCoverShow(true);
    }, 50);
    setTimeout(() => {
      setCoverOpening(true);
      setSpreadShow(true);
    }, 650);
    setTimeout(() => {
      setPagesFlipped([true, false, false, false]);
      setTimeout(() => setPagesFlipped([true, true, false, false]), 100);
      setTimeout(() => setPagesFlipped([true, true, true, false]), 200);
      setTimeout(() => setPagesFlipped([true, true, true, true]), 300);
      setTimeout(() => {
        setContentReady(true);
      }, 900);
    }, 1300);
    setTimeout(() => {
      setCloseBtnShow(true);
    }, 2000);
  };

  const handleCloseBook = () => {
    setCloseBtnShow(false);
    setFocusEntryId(null);
    setActiveFlagFormId(null);
    setActiveAppendFormId(null);
    setContentReady(false);

    // 逆向きのアニメーション
    setPagesFlipped([true, true, true, false]);
    setTimeout(() => setPagesFlipped([true, true, false, false]), 100);
    setTimeout(() => setPagesFlipped([true, false, false, false]), 200);
    setTimeout(() => setPagesFlipped([false, false, false, false]), 300);

    setTimeout(() => {
      setSpreadShow(false);
      setCoverOpening(false);
      setTimeout(() => {
        setCoverShow(false);
        setOverlayActive(false);
        setOpenBookData(null);
      }, 340);
    }, 750);
  };

  // --- 新しい本を追加 ---
  const handleAddNewBook = (shelfKey: "mine" | "shared") => {
    const title = prompt("新しい本のタイトル(例: 就活の記録)");
    if (!title || !title.trim()) return;
    const palette = ["#1f4f68", "#54432b", "#422a54", "#25413c", "#5a1730"];
    const currentBooks = books.filter(b => b.shelf === shelfKey);
    const newBook: Book = {
      id: "ub" + Date.now(),
      shelf: shelfKey,
      title: title.trim().slice(0, 12),
      fill: palette[currentBooks.length % palette.length],
      h: 145
    };
    setBooks(prev => [...prev, newBook]);
    showToast(`『${newBook.title}』を棚に置きました`);
  };

  // --- 悩みを綴じる保存処理 ---
  const handleSaveNote = () => {
    if (!openBookData) return;
    const body = noteBody.trim();
    if (!body) {
      setSaveStatus("本文を書いてから綴じられます。");
      return;
    }
    const title = noteTitle.trim() || `${openBookData.title}への記録`;
    const tags = noteTags
      .trim()
      .split(/[\s,、]+/)
      .map(t => t.replace(/^#/, ""))
      .filter(Boolean);
    const resolveDate = !dateUnknown && resolveDateVal ? resolveDateVal : addMonthsISO(todayISO(), 6);

    const newEntry: Entry = {
      id: "u" + Date.now(),
      bookId: openBookData.id,
      date: todayISO(),
      title,
      body,
      tags,
      confidence,
      outcome: "pending",
      judgment: null,
      resolveDate,
      savedAt: Date.now()
    };

    setEntries(prev => [...prev, newEntry]);
    setSaveStatus("綴じました(2分以内は修正できます)。");
    setNoteBody("");
    setNoteTitle("");
    setNoteTags("");
    setRecallEntry(null);
    showToast(dateUnknown ? `6ヶ月後(${resolveDate})に、結果をたずねます。` : `${resolveDate}に、結果をたずねます。`);

    // 保存後、自動的に年表モードに切り替え
    setTimeout(() => {
      setOpenBookMode("timeline");
    }, 1000);
  };

  // 2分以内修正
  const handleFixNote = (e: Entry) => {
    const idx = entries.findIndex(item => item.id === e.id);
    if (idx === -1) return;
    const item = entries[idx];
    setEntries(prev => prev.filter(x => x.id !== e.id));

    setOpenBookMode("write");
    setNoteBody(item.body || "");
    setNoteTitle(item.title || "");
    setNoteTags((item.tags || []).map(t => "#" + t).join(" "));
    setConfidence(item.confidence || 3);
    showToast("フォームに戻しました。書き直して、もう一度綴じてください。");
  };

  // 結果を綴じる
  const handleSaveFlag = (entryId: string) => {
    if (!flagOutcome) {
      showToast("結果を選んでください。");
      return;
    }
    if (!flagJudgment) {
      showToast("「当時の判断」も選んでください。結果と判断は別のものです。");
      return;
    }

    const patch: Partial<Entry> = {
      outcome: flagOutcome,
      judgment: flagJudgment,
      reasonOutcome: reasonOutcome || "",
      reasonJudgment: reasonJudgment || "",
      resolvedOn: todayISO()
    };

    // シードデータの上書きか、ユーザーデータの上書きかを判定
    const isUser = entries.some(x => x.id === entryId);
    if (isUser) {
      setEntries(prev =>
        prev.map(x => (x.id === entryId ? { ...x, ...patch } as Entry : x))
      );
    } else {
      setOverrides(prev => ({
        ...prev,
        [entryId]: { ...prev[entryId], ...patch }
      }));
    }

    setActiveFlagFormId(null);
    setFlagOutcome(null);
    setFlagJudgment(null);
    setReasonOutcome("");
    setReasonJudgment("");
    showToast("結果を綴じました。計器に反映されています。");
  };

  // 追記を残す
  const handleSaveAppend = (entryId: string) => {
    if (!appendText.trim()) {
      showToast("追記の本文を書いてください。");
      return;
    }
    const curAppends = appendsMap[entryId] || [];
    const newAppend: EntryAppend = {
      date: todayISO(),
      text: appendText.trim()
    };
    setAppendsMap(prev => ({
      ...prev,
      [entryId]: [...curAppends, newAppend]
    }));
    setActiveAppendFormId(null);
    setAppendText("");
    showToast("追記を残しました。決定時の記録はそのままです。");
  };

  // --- SVG キャリブレーション曲線描画 ---
  const renderCurveSVG = () => {
    const buckets = getBucketStats();
    const xs: Record<number, number> = { 1: 85, 2: 170, 3: 255, 4: 340, 5: 425 };
    const yVal = (rate: number) => 250 - rate * 2.2;

    const points: { x: number; y: number; n: number; c: number }[] = [];
    for (let c = 1; c <= 5; c++) {
      if (buckets[c].n > 0) {
        const rate = (buckets[c].ok / buckets[c].n) * 100;
        points.push({ x: xs[c], y: yVal(rate), n: buckets[c].n, c });
      }
    }

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");
    const guidelinePoints = [1, 2, 3, 4, 5].map(i => `${xs[i]},${yVal(MID[i])}`).join(" ");

    return (
      <svg viewBox="0 0 460 315" width="100%" role="img" aria-label="見込みと成功率のキャリブレーション曲線">
        <g stroke="#ded5c4">
          <line x1="60" y1="30" x2="440" y2="30" />
          <line x1="60" y1="85" x2="440" y2="85" />
          <line x1="60" y1="140" x2="440" y2="140" />
          <line x1="60" y1="195" x2="440" y2="195" />
          <line x1="60" y1="250" x2="440" y2="250" />
        </g>
        <g fill="#8a8172" fontSize="11">
          <text x="20" y="34">100%</text>
          <text x="27" y="144">50%</text>
          <text x="34" y="254">0%</text>
          {[1, 2, 3, 4, 5].map(i => (
            <text key={i} x={xs[i] - 9} y="272">★{i}</text>
          ))}
        </g>
        {/* 目安破線 */}
        <polyline points={guidelinePoints} fill="none" stroke="#bdb4a3" strokeWidth="2" strokeDasharray="6 6" />
        {/* 実測 */}
        {points.length >= 2 && (
          <polyline points={polylinePoints} fill="none" stroke="#6556b3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {points.map(p => {
          const isReliable = p.n >= 3;
          return (
            <g key={p.c}>
              <circle
                cx={p.x}
                cy={p.y}
                r="5.5"
                fill={isReliable ? "#b88a36" : "#fffaf0"}
                stroke="#b88a36"
                strokeWidth={isReliable ? "0" : "2.5"}
              />
              <text x={p.x - 12} y="292" fontSize="10" fill="#8a8172">n={p.n}</text>
            </g>
          );
        })}
        <text x="60" y="310" fontSize="10" fill="#8a8172">破線 = 目安(各★の区間中点) / 白抜きの点 = n&lt;3 の参考値</text>
      </svg>
    );
  };

  // --- インサイトの生成 ---
  const renderInsights = () => {
    const buckets = getBucketStats();
    const overall = getOverallStats();
    const insights: string[] = [];

    // ★別: 目安との乖離が最大(n>=3)のもの
    let maxDevNode: { c: number; rate: number; dev: number; n: number } | null = null;
    for (let c = 1; c <= 5; c++) {
      if (buckets[c].n < 3) continue;
      const rate = Math.round((buckets[c].ok / buckets[c].n) * 100);
      const dev = rate - MID[c];
      if (!maxDevNode || Math.abs(dev) > Math.abs(maxDevNode.dev)) {
        maxDevNode = { c, rate, dev, n: buckets[c].n };
      }
    }

    if (maxDevNode) {
      if (maxDevNode.dev > 15) {
        insights.push(`見込み★${maxDevNode.c}の決断の成功率は ${maxDevNode.rate}%(n=${maxDevNode.n})。自信のなさは「止まれ」ではなく「丁寧に進め」のサインかもしれません。`);
      } else if (maxDevNode.dev < -15) {
        insights.push(`見込み★${maxDevNode.c}の決断の成功率は ${maxDevNode.rate}%(n=${maxDevNode.n})。自信があるときほど、見積もりを一度疑う価値がありそうです。`);
      } else {
        insights.push(`見込みと結果のズレは、いまのところ小さめです(★${maxDevNode.c}: ${maxDevNode.rate}%、n=${maxDevNode.n})。`);
      }
    }

    // タグ別(n>=5)
    if (overall.okRate !== null) {
      const tags = getTagStats(5);
      let bestTag: { tag: string; rate: number; n: number; dev: number } | null = null;
      for (const t of tags) {
        const dev = t.rate - overall.okRate!;
        if (!bestTag || Math.abs(dev) > Math.abs(bestTag.dev)) {
          bestTag = { tag: t.tag, rate: t.rate, n: t.n, dev };
        }
      }
      if (bestTag && Math.abs(bestTag.dev) >= 8) {
        insights.push(`#${bestTag.tag} がついた決断の成功率は ${bestTag.rate}%(全体 ${overall.okRate}%、n=${bestTag.n})。${bestTag.dev > 0 ? "この感情は、思っているほど悪い予兆ではないようです。" : "この感情がある決断は、少し慎重に。"}`);
      }
    }

    return (
      <>
        {insights.map((insight, idx) => (
          <div key={idx} className="insight">{insight}</div>
        ))}
        <p className="caveat">記録が少ないうちは、この計器は「傾向の仮説」です。各点に n を併記し、n&lt;3 の点は白抜きで示しています。記録が増えるほど、計器はあなた向けになります。</p>
      </>
    );
  };

  // --- ミニ計器3枠目データ ---
  const getHeaderTagStat = () => {
    const s = getOverallStats();
    const tags = getTagStats(5);
    if (tags.length && s.okRate !== null) {
      let bestTag: { tag: string; rate: number; dev: number } | null = null;
      for (const t of tags) {
        const dev = Math.abs(t.rate - s.okRate!);
        if (!bestTag || dev > bestTag.dev) {
          bestTag = { tag: t.tag, rate: t.rate, dev };
        }
      }
      return bestTag ? { rate: bestTag.rate, label: `#${bestTag.tag}の成功率` } : null;
    }
    return null;
  };

  const headerTagInfo = getHeaderTagStat();
  const overall = getOverallStats();
  const dueAlerts = getDueNotifications();

  // --- デモデータのリセット ---
  const handleDemoReset = () => {
    if (!confirm("書き込み・結果フラグ・追記をすべて初期状態に戻します。よろしいですか?(デモ練習用)")) return;
    localStorage.removeItem("pivotBooksV3");
    localStorage.removeItem("pivotEntriesV3");
    localStorage.removeItem("pivotOverridesV3");
    localStorage.removeItem("pivotAppendsV3");
    setBooks(SEED_BOOKS);
    setEntries(SEED_ENTRIES);
    setOverrides({});
    setAppendsMap({});
    showToast("初期状態にリセットしました。");
  };

  return (
    <div className="earth-archive-root">
      {/* 🔔 トーストメッセージ */}
      {toastMessage && <div id="toast" className="show">{toastMessage}</div>}

      {/* --- ヘッダー --- */}
      <header className="topbar">
        <div>
          <h1>地球の書庫</h1>
          <p className="subtitle">迷いを本に綴じ、時が来たら結果をたずね、判断の癖を計器で見る。</p>
        </div>
        <div className="bell-wrap">
          <button
            className="icon-btn bell"
            onClick={(e) => {
              e.stopPropagation();
              setBellOpen(!bellOpen);
            }}
            type="button"
            aria-label="結果をたずねる通知"
          >
            🔔
            {dueAlerts.length > 0 && (
              <span className="badge-dot">{dueAlerts.length}</span>
            )}
          </button>
          <div className={`bell-panel ${bellOpen ? "open" : ""}`}>
            <div className="bell-title">結果、そろそろ分かる頃では?</div>
            {dueAlerts.length === 0 ? (
              <div className="bell-empty">いまは、たずねることがありません。結果がわかりそうな日を綴じておくと、その頃にここでおたずねします。</div>
            ) : (
              <div>
                {dueAlerts.map(e => {
                  const b = books.find(book => book.id === e.bookId);
                  return (
                    <button
                      key={e.id}
                      className="bell-item"
                      onClick={() => {
                        setBellOpen(false);
                        if (b) {
                          setFocusEntryId(e.id);
                          setFlagOutcome(null);
                          setFlagJudgment(null);
                          setReasonOutcome("");
                          setReasonJudgment("");
                          setActiveFlagFormId(e.id);
                          handleOpenBook(b, "timeline");
                        }
                      }}
                    >
                      <b>『{e.title}』— その後、どうなりましたか?</b>
                      <span>{b ? b.title : ""} / 予定日 {e.resolveDate || ""} / 決定時の見込み ★{e.confidence}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <button
          className="mini-meter"
          onClick={() => setCalOpen(true)}
          type="button"
          aria-label="全体のキャリブレーション計器を開く"
        >
          <span className="mini-stat">
            <b>{overall.total}</b>
            <span>記録した決定</span>
          </span>
          <span className="mini-stat">
            <b>{overall.avgConf.toFixed(1)}</b>
            <span>平均の見込み</span>
          </span>
          <span className="mini-stat">
            {headerTagInfo ? (
              <>
                <b>{headerTagInfo.rate}%</b>
                <span>{headerTagInfo.label}</span>
              </>
            ) : (
              <>
                <b>—</b>
                <span>タグ別(記録待ち)</span>
              </>
            )}
          </span>
          <span className="meter-cta">▶ 押すと全体の計器がひらきます</span>
        </button>
      </header>

      {/* --- 検索パネル --- */}
      <section className={`search-panel ${openBookData ? "hidden" : ""}`}>
        <label className="searchbox" aria-label="フリーワード検索">
          <span>⌕</span>
          <input
            type="search"
            placeholder="フリーワード検索: タイトル・タグ・本文から探す(3つの棚を横断)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </label>
        <div>
          <div className="chips">
            {allUniqueTags.map(tag => (
              <button
                key={tag}
                className={`chip ${selectedTags.includes(tag) ? "active" : ""}`}
                onClick={() => {
                  if (selectedTags.includes(tag)) {
                    setSelectedTags(prev => prev.filter(t => t !== tag));
                  } else {
                    setSelectedTags(prev => [...prev, tag]);
                  }
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
          <button
            className="plain"
            onClick={() => {
              setSelectedTags([]);
              setSearchText("");
            }}
            style={{ marginTop: "8px" }}
          >
            リセット
          </button>
        </div>
      </section>

      {/* --- 本棚 --- */}
      <section id="bookcaseWrap" className={openBookData ? "hidden" : ""}>
        {!hasActiveFilter ? (
          // 通常表示（3つの棚に分けて配置）
          <div className="normal-shelf-view">
            <p className="shelf-title">ーー 三つの棚は、構造ごと分かれています ーー</p>
            <div className="bookcase-container">
              {(["mine", "shared", "senpai"] as const).map(shelfKey => {
                const booksHere = books.filter(b => b.shelf === shelfKey);
                return (
                  <div key={shelfKey} className="bookcase-col">
                    <div className="case-caption">
                      <b>{SHELF_LABEL[shelfKey]}</b>
                      <p className={`case-note ${shelfKey}`} dangerouslySetInnerHTML={{ __html: CASE_NOTES[shelfKey] }} />
                    </div>
                    <div className="bookcase">
                      {[0, 1, 2].map(rowIdx => {
                        const booksInRow = booksHere.filter((_, idx) => idx % 3 === rowIdx);
                        return (
                          <div key={rowIdx}>
                            <div className="shelf">
                              {booksInRow.map(book => (
                                <button
                                  key={book.id}
                                  className="book-spine"
                                  style={{ height: `${book.h}px`, background: book.fill }}
                                  onClick={() => handleOpenBook(book)}
                                >
                                  {book.title}
                                  <span className={`ribbon ${shelfKey}`} />
                                </button>
                              ))}
                              {shelfKey !== "senpai" && (booksHere.length % 3 === rowIdx) && (
                                <button
                                  className="book-spine newbook"
                                  style={{ height: "150px" }}
                                  onClick={() => handleAddNewBook(shelfKey)}
                                >
                                  ＋ 新しい本
                                </button>
                              )}
                            </div>
                            <div className="shelf-board" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // 検索・フィルタリングヒット表示（横断配置）
          <div className="hit-shelf-container active">
            <p className="shelf-title">ーー ヒットした本 ーー</p>
            <div className="legend">
              <span className="l-mine"><i></i>わたし</span>
              <span className="l-shared"><i></i>共同</span>
              <span className="l-senpai"><i></i>先達</span>
            </div>
            <div className="bookcase">
              {[0, 1, 2].map(rowIdx => {
                const hitBooks = books.filter(bookMatchesFilter);
                const booksInRow = hitBooks.filter((_, idx) => idx % 3 === rowIdx);
                return (
                  <div key={rowIdx}>
                    <div className="shelf">
                      {booksInRow.map(book => (
                        <button
                          key={book.id}
                          className="book-spine"
                          style={{ height: `${book.h}px`, background: book.fill }}
                          onClick={() => handleOpenBook(book)}
                        >
                          {book.title}
                          <span className={`ribbon ${book.shelf}`} />
                        </button>
                      ))}
                    </div>
                    <div className="shelf-board" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* --- 本の見開きオーバーレイ --- */}
      {openBookData && (
        <section className={`fullscreen-overlay ${overlayActive ? "active" : ""}`}>
          <div className="stage">
            {/* カバー */}
            <div
              className={`book-cover ${coverShow ? "show" : ""} ${coverOpening ? "opening" : ""}`}
              style={{ background: openBookData.fill }}
            >
              <div className="cover-frame">
                <div className="cover-title">{openBookData.title}</div>
                <div className="cover-tags">
                  {getBookTags(openBookData).map(t => `#${t}`).join(" ") || "(まだ記録がありません)"}
                </div>
              </div>
            </div>

            {/* 見開きページ */}
            <div className={`pages-spread ${spreadShow ? "show" : ""} ${contentReady ? "content-ready" : ""}`}>
              {/* 左ページ */}
              <div className="page left">
                <span className={`shelf-badge ${openBookData.shelf}`}>
                  {SHELF_LABEL[openBookData.shelf]}
                  {openBookData.shelf === "senpai"
                    ? " / 読み専用"
                    : openBookData.shelf === "mine"
                    ? " / 非公開"
                    : " / 仲間と共有"}
                </span>
                <h2>{openBookData.title}</h2>
                <p className="hint">1ページ目。目次、本内検索、{openBookData.shelf === "senpai" ? "年表" : "書き込み"}の入口をまとめたホームです。</p>
                <label className="book-search">
                  <span>⌕</span>
                  <input
                    type="search"
                    placeholder="この本の中をフリーワード検索"
                    value={innerSearchText}
                    onChange={(e) => {
                      setInnerSearchText(e.target.value);
                      if (openBookMode !== "search") setOpenBookMode("search");
                    }}
                  />
                </label>
                <div className="toc">
                  {openBookData.shelf !== "senpai" && (
                    <button onClick={() => setOpenBookMode("write")} type="button">
                      <span>01</span>
                      <b>この本に書く<small>迷いを殴り書きして、決定時の見込みごと綴じる</small></b>
                      <em>書込</em>
                    </button>
                  )}
                  <button onClick={() => setOpenBookMode("search")} type="button">
                    <span>{openBookData.shelf === "senpai" ? "01" : "02"}</span>
                    <b>過去の記録を探す<small>タグと本文から、似た迷いを引き出す</small></b>
                    <em>検索</em>
                  </button>
                  <button onClick={() => setOpenBookMode("timeline")} type="button">
                    <span>{openBookData.shelf === "senpai" ? "02" : "03"}</span>
                    <b>年表を見る<small>決定時の見込みと、その後を時系列でたどる</small></b>
                    <em>年表</em>
                  </button>
                </div>
                {/* 簡易内検索結果 */}
                <div className="results">
                  {getEntriesOfBook(openBookData.id)
                    .filter(e => {
                      const q = innerSearchText.trim().toLowerCase();
                      const hay = (e.title + " " + (e.body || "") + " " + (e.tags || []).join(" ")).toLowerCase();
                      return !q || hay.includes(q);
                    })
                    .map(e => (
                      <article key={e.id} className="result-card">
                        <div className="date">{e.date}</div>
                        <b>{e.title}</b>
                        <p className="hint" style={{ margin: 0 }}>{(e.body || "").slice(0, 72)}…</p>
                        <div className="badges">
                          <span className="badge">見込み ★{e.confidence}</span>
                          {e.outcome === "ok" && <span className="badge ok">うまくいった</span>}
                          {e.outcome === "ng" && <span className="badge ng">後悔が残る</span>}
                          {e.outcome === "pending" && <span className="badge pend">結果待ち</span>}
                        </div>
                      </article>
                    ))}
                </div>
              </div>

              {/* 右ページ */}
              <div className="page right">
                <div className="mode-tabs">
                  <button
                    className={openBookMode === "toc" ? "active" : ""}
                    onClick={() => setOpenBookMode("toc")}
                  >
                    目次
                  </button>
                  {openBookData.shelf !== "senpai" && (
                    <button
                      className={openBookMode === "write" ? "active" : ""}
                      onClick={() => setOpenBookMode("write")}
                    >
                      書く
                    </button>
                  )}
                  <button
                    className={openBookMode === "search" ? "active" : ""}
                    onClick={() => setOpenBookMode("search")}
                  >
                    探す
                  </button>
                  <button
                    className={openBookMode === "timeline" ? "active" : ""}
                    onClick={() => setOpenBookMode("timeline")}
                  >
                    年表
                  </button>
                </div>

                {/* --- 目次セクション --- */}
                {openBookMode === "toc" && (
                  <section className="section active">
                    <h2>本の現在地</h2>
                    <p className="hint">いちばん新しい記録です。タブか左の目次からページを切り替えます。</p>
                    {getEntriesOfBook(openBookData.id).length > 0 ? (
                      (() => {
                        const latest = getEntriesOfBook(openBookData.id).slice(-1)[0];
                        return (
                          <div className="result-card">
                            <div className="date">{latest.date}</div>
                            <b>{latest.title}</b>
                            <p className="hint" style={{ margin: 0 }}>{latest.body || ""}</p>
                            <div className="badges">
                              <span className="badge">見込み ★{latest.confidence}</span>
                              {latest.outcome === "ok" && <span className="badge ok">うまくいった</span>}
                              {latest.outcome === "ng" && <span className="badge ng">後悔が残る</span>}
                              {latest.outcome === "pending" && <span className="badge pend">結果待ち</span>}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="empty">まだ記録がありません。最初の迷いを綴じてみましょう。</div>
                    )}
                  </section>
                )}

                {/* --- 書くセクション --- */}
                {openBookMode === "write" && openBookData.shelf !== "senpai" && (
                  <section className="section active">
                    <h2>この本に書く</h2>
                    <p className="hint">綺麗に書かなくていい。当時のあなたを、未来のあなたから守るため、綴じた後は書き換えられません（追記はできます）。</p>
                    <textarea
                      className="note"
                      placeholder="今の気持ちを、ここに。"
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                    />

                    {/* 召喚(Recall)領域 */}
                    {recallEntry && (
                      <div className="recall show">
                        <div className="who">― 似た迷いの記録({books.find(b => b.id === recallEntry.bookId)?.title})</div>
                        <b>{recallEntry.title}</b>
                        <p className="hint" style={{ margin: 0 }}>{(recallEntry.body || "").slice(0, 60)}…</p>
                        <div className="badges">
                          <span className="badge">見込み ★{recallEntry.confidence}</span>
                          {recallEntry.outcome === "ok" && <span className="badge ok">うまくいった</span>}
                          {recallEntry.outcome === "ng" && <span className="badge ng">後悔が残る</span>}
                        </div>
                      </div>
                    )}

                    <div className="label">この迷いに名前をつけるなら?</div>
                    <input
                      className="field"
                      placeholder="例: 院進か就職か"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                    />

                    <div className="label">感情タグ</div>
                    <input
                      className="field"
                      placeholder="#不安 #進路 #挑戦"
                      value={noteTags}
                      onChange={(e) => setNoteTags(e.target.value)}
                    />

                    <div className="q-label">この選択がうまくいくと、今どのくらい思える?</div>
                    <div className="stars-row">
                      <span className="endcap">全く<br />思えない</span>
                      <div className="stars">
                        {[1, 2, 3, 4, 5].map(i => (
                          <button
                            key={i}
                            type="button"
                            className={`star ${i <= confidence ? "on" : ""}`}
                            onClick={() => setConfidence(i)}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <span className="endcap right">かなり<br />思える</span>
                    </div>

                    <div className="label">結果がわかりそうな日</div>
                    <div className="date-row">
                      <input
                        type="date"
                        value={resolveDateVal}
                        disabled={dateUnknown}
                        onChange={(e) => setResolveDateVal(e.target.value)}
                      />
                      <label className="checkline">
                        <input
                          type="checkbox"
                          checked={dateUnknown}
                          onChange={(e) => {
                            setDateUnknown(e.target.checked);
                            if (!e.target.checked && !resolveDateVal) {
                              setResolveDateVal(addMonthsISO(todayISO(), 1));
                            }
                          }}
                        />
                        日付は未定(6ヶ月後にたずねます)
                      </label>
                    </div>

                    <div className="lock-note">🔒 綴じた記録は編集できません。誤字などは<b>2分以内</b>なら修正できます。その後は「追記」で重ねてください。</div>
                    <div className="save-row">
                      <button className="plain dark" onClick={handleSaveNote} type="button">
                        この迷いを綴じる
                      </button>
                      <span className="save-status">{saveStatus}</span>
                    </div>
                  </section>
                )}

                {/* --- 探すセクション --- */}
                {openBookMode === "search" && (
                  <section className="section active">
                    <h2>この本から探す</h2>
                    <p className="hint">左ページの検索欄に入力すると、この本の記録から探せます。</p>
                    <div className="chips">
                      {["不安", "後悔", "挑戦", "決定"].map(word => (
                        <button
                          key={word}
                          className="chip"
                          onClick={() => setInnerSearchText(word)}
                        >
                          #{word}
                        </button>
                      ))}
                    </div>
                    <div className="results">
                      {getEntriesOfBook(openBookData.id)
                        .filter(e => {
                          const q = innerSearchText.trim().toLowerCase();
                          const hay = (e.title + " " + (e.body || "") + " " + (e.tags || []).join(" ")).toLowerCase();
                          return !q || hay.includes(q);
                        })
                        .map(e => (
                          <article key={e.id} className="result-card">
                            <div className="date">{e.date}</div>
                            <b>{e.title}</b>
                            <p className="hint" style={{ margin: 0 }}>{(e.body || "").slice(0, 72)}…</p>
                            <div className="badges">
                              <span className="badge">見込み ★{e.confidence}</span>
                              {e.outcome === "ok" && <span className="badge ok">うまくいった</span>}
                              {e.outcome === "ng" && <span className="badge ng">後悔が残る</span>}
                              {e.outcome === "pending" && <span className="badge pend">結果待ち</span>}
                            </div>
                          </article>
                        ))}
                    </div>
                  </section>
                )}

                {/* --- 年表セクション --- */}
                {openBookMode === "timeline" && (
                  <section className="section active">
                    <h2>この本の年表</h2>
                    <p className="hint">決定時の見込みと、その後の結果を時系列で。全体の傾向は書棚上部の計器へ。</p>
                    <div id="timelineList" className="results">
                      {getEntriesOfBook(openBookData.id).map(e => {
                        const isFocused = e.id === focusEntryId;
                        const isResolvable = e.outcome === "pending";
                        const readOnly = openBookData.shelf === "senpai";

                        return (
                          <article
                            key={e.id}
                            className={`tl-card ${isFocused ? "focus" : ""}`}
                            data-entry={e.id}
                          >
                            <div className="tl-head">
                              <span className="date">{e.date}</span>
                              <b>{e.title}</b>
                            </div>
                            <div className="badges">
                              <span className="badge">見込み ★{e.confidence}</span>
                              {e.outcome === "ok" && <span className="badge ok">うまくいった</span>}
                              {e.outcome === "ng" && <span className="badge ng">後悔が残る</span>}
                              {e.outcome === "pending" && (
                                <span className="badge pend">
                                  結果待ち{e.resolveDate ? `(予定 ${e.resolveDate})` : ""}
                                </span>
                              )}
                              {e.judgment === "sound" && <span className="badge jud">判断は妥当だった</span>}
                              {e.judgment === "flawed" && <span className="badge jud">判断にも悔いがある</span>}
                            </div>
                            <div className="tl-body">{e.body || ""}</div>
                            <div className="locktag">🔒 決定時の記録(書き換え不可)</div>

                            {/* 評価の振り返り内容を表示 */}
                            {!isResolvable && (e.reasonOutcome || e.reasonJudgment) && (
                              <div className="reason-block">
                                {e.reasonOutcome && (
                                  <>
                                    <div className="r-label">結果について</div>
                                    <div>{e.reasonOutcome}</div>
                                  </>
                                )}
                                {e.reasonJudgment && (
                                  <>
                                    <div className="r-label" style={{ marginTop: "6px" }}>当時の判断について</div>
                                    <div>{e.reasonJudgment}</div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* 追記一覧の表示 */}
                            {(appendsMap[e.id] || []).map((a, idx) => (
                              <div key={idx} className="append">
                                <div className="a-date">追記 / {a.date}</div>
                                <div>{a.text}</div>
                              </div>
                            ))}

                            {/* アクションボタン */}
                            {!readOnly && (
                              <div className="mini-actions">
                                {isResolvable && (
                                  <button
                                    className="plain"
                                    onClick={() => {
                                      setActiveFlagFormId(e.id);
                                      setFlagOutcome(null);
                                      setFlagJudgment(null);
                                      setReasonOutcome("");
                                      setReasonJudgment("");
                                    }}
                                  >
                                    その後、どうなった?
                                  </button>
                                )}
                                <button
                                  className="plain"
                                  onClick={() => {
                                    setActiveAppendFormId(e.id);
                                    setAppendText("");
                                  }}
                                >
                                  追記する
                                </button>
                                {e.savedAt && Date.now() - e.savedAt < 120000 && (
                                  <button className="plain" onClick={() => handleFixNote(e)}>
                                    修正する(保存後2分以内)
                                  </button>
                                )}
                              </div>
                            )}

                            {/* 結果フラグ入力フォーム */}
                            {activeFlagFormId === e.id && isResolvable && (
                              <div className="flag-form">
                                <div className="fq">その後、どうなった?</div>
                                <div className="choice-row">
                                  <button
                                    className={`choice ${flagOutcome === "ok" ? "sel" : ""}`}
                                    onClick={() => setFlagOutcome("ok")}
                                  >
                                    うまくいった
                                  </button>
                                  <button
                                    className={`choice ${flagOutcome === "ng" ? "sel" : ""}`}
                                    onClick={() => setFlagOutcome("ng")}
                                  >
                                    後悔が残る
                                  </button>
                                  <button
                                    className="choice"
                                    onClick={() => {
                                      // 1ヶ月延期
                                      const newDate = addMonthsISO(todayISO(), 1);
                                      setOverrides(prev => ({
                                        ...prev,
                                        [e.id]: { ...prev[e.id], resolveDate: newDate }
                                      }));
                                      setActiveFlagFormId(null);
                                      showToast(`わかりました。1ヶ月後(${newDate})に、もう一度たずねます。`);
                                    }}
                                  >
                                    まだ分からない
                                  </button>
                                </div>

                                {(flagOutcome === "ok" || flagOutcome === "ng") && (
                                  <>
                                    <div className="fq">当時の判断は、どうだった?</div>
                                    <div className="fnote">結果と判断は、別のものです。良い判断が悪い結果になることも、その逆もあります。</div>
                                    <div className="choice-row">
                                      <button
                                        className={`choice ${flagJudgment === "sound" ? "sel" : ""}`}
                                        onClick={() => setFlagJudgment("sound")}
                                      >
                                        判断は妥当だった
                                      </button>
                                      <button
                                        className={`choice ${flagJudgment === "flawed" ? "sel" : ""}`}
                                        onClick={() => setFlagJudgment("flawed")}
                                      >
                                        判断にも悔いがある
                                      </button>
                                    </div>
                                    <div className="label">結果について、ひとこと</div>
                                    <textarea
                                      className="small"
                                      placeholder="何が起きた?"
                                      value={reasonOutcome}
                                      onChange={(e) => setReasonOutcome(e.target.value)}
                                    />
                                    <div className="label">当時の判断について、ひとこと</div>
                                    <textarea
                                      className="small"
                                      placeholder="あの時の自分の決め方は、どうだった?"
                                      value={reasonJudgment}
                                      onChange={(e) => setReasonJudgment(e.target.value)}
                                    />
                                    <button
                                      className="plain dark"
                                      onClick={() => handleSaveFlag(e.id)}
                                    >
                                      結果を綴じる
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* 追記入力フォーム */}
                            {activeAppendFormId === e.id && (
                              <div className="flag-form">
                                <div className="fq">追記(決定時の記録の下に、日付つきで重なります)</div>
                                <textarea
                                  className="small"
                                  placeholder="いまの視点から、ひとこと。"
                                  value={appendText}
                                  onChange={(e) => setAppendText(e.target.value)}
                                />
                                <button
                                  className="plain dark"
                                  onClick={() => handleSaveAppend(e.id)}
                                >
                                  追記を残す
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* めくるページ装飾 */}
              {[0, 1, 2, 3].map(idx => {
                const isFlipped = pagesFlipped[idx];
                const entriesList = getEntriesOfBook(openBookData.id);
                let fragContent = null;
                if (entriesList.length > 0) {
                  const e1 = entriesList[idx % entriesList.length];
                  const e2 = entriesList[(idx + 1) % entriesList.length];
                  fragContent = (
                    <>
                      <div className="flip-frag">
                        <span className="f-date">{e1.date}</span>　{(e1.body || e1.title).slice(0, 34)}…
                      </div>
                      {entriesList.length > 1 && e1.id !== e2.id && (
                        <div className="flip-frag" style={{ marginTop: "64px" }}>
                          {(e2.body || e2.title).slice(0, 30)}…
                        </div>
                      )}
                    </>
                  );
                }
                return (
                  <div
                    key={idx}
                    className={`flip-page ${isFlipped ? "flipped" : ""}`}
                    style={{ zIndex: 14 - idx }}
                    aria-hidden="true"
                  >
                    {fragContent}
                  </div>
                );
              })}
            </div>
          </div>
          {closeBtnShow && (
            <button className="plain close-btn" onClick={handleCloseBook} type="button">
              ↩ 本棚に戻す
            </button>
          )}
        </section>
      )}

      {/* --- キャリブレーション計器モーダル --- */}
      <div className={`cal-modal ${calOpen ? "open" : ""}`} aria-hidden={!calOpen}>
        <div className="cal-box">
          <button className="plain cal-close" onClick={() => setCalOpen(false)} type="button">
            ✕ 閉じる
          </button>
          <h2>判断キャリブレーション(全体)</h2>
          <p className="hint">わたしの本棚と共同の本棚に綴じられた、結果の出た決断から描いています。先達の記録は含みません。</p>
          <div className="cal-grid">
            <div className="cal-stat">
              <b>{overall.total}</b>
              <span>記録した決定</span>
            </div>
            <div className="cal-stat">
              <b>{overall.resolvedN}</b>
              <span>結果が出た決断</span>
            </div>
            <div className="cal-stat">
              <b>{overall.avgConf.toFixed(1)}/5</b>
              <span>平均の見込み</span>
            </div>
          </div>
          <div className="chart">
            {renderCurveSVG()}
          </div>
          {renderInsights()}
          <button className="cal-reset" onClick={handleDemoReset} type="button">
            記録を初期状態に戻す(デモ用)
          </button>
        </div>
      </div>
    </div>
  );
}
