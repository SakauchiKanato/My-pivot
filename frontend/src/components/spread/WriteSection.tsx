/**
 * 「この本に書く」セクション
 *
 * 設計原則の実装箇所:
 * - confidence は決定時に固定(後知恵バイアス対策)
 * - B-2: 公開トグルは置かない(FLAGS.publishPostHocOnly)。公開は年表から。
 * - A-2: 召喚は現行 "box" 方式。FLAGS.recallStyle で差し替え予定の受け皿。
 *
 * v4での変更点:
 * 状態と保存ロジックを useWriteForm フックに集約し、
 * 表示だけを WriteSectionLeft(本文・recall)/ WriteSectionRight
 * (タイトル・タグ・確信度・日付・保存)に分割。
 * BookOverlay 側で見開きの左右ページにそれぞれ差し込む想定。
 */
<<<<<<< HEAD


import { useEffect, useMemo, useState } from "react";

=======
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
>>>>>>> origin/main
import type { Book, Entry } from "../../lib/api";
import { useSemanticRecall } from "../../lib/recall";
import { addMonthsISO, todayISO } from "../../lib/dates";
import { Badges } from "./Badges";

const SHELF_SHORT: Record<string, string> = { mine: "わたし", shared: "共同", senpai: "先達" };

export interface WriteDraft {
  title: string;
  body: string;
  tags: string;
  confidence: number;
}

interface UseWriteFormArgs {
  allEntries: Entry[];
  books: Book[];
  initialDraft?: WriteDraft | null;
  onSave: (data: {
    title: string;
    body: string;
    tags: string[];
    confidence: number;
    resolveDate: string | null;
  }) => Promise<void>;
}

export function useWriteForm({ allEntries, books, initialDraft, onSave }: UseWriteFormArgs) {
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [tags, setTags] = useState(initialDraft?.tags ?? "");
  const [confidence, setConfidence] = useState(initialDraft?.confidence ?? 3);
  const [dateUnknown, setDateUnknown] = useState(true);
  const [resolveDate, setResolveDate] = useState("");
  const [status, setStatus] = useState("");


  // initialDraft が(onFix経由などで)新しく渡されたら、フォームに反映する。
  // 以前は key={} での再マウントで実現していたが、hook を左右ページで
  // 共有する都合上、明示的な同期に変更。
  useEffect(() => {
    if (initialDraft) {
      setBody(initialDraft.body);
      setTitle(initialDraft.title);
      setTags(initialDraft.tags);
      setConfidence(initialDraft.confidence);
    }
  }, [initialDraft]);

<<<<<<< HEAD
  const recall = useMemo(() => {
    const text = body.trim();
    if (text.length < 12) return null;
    return bestRecall(text, allEntries);
  }, [body, allEntries]);


=======
  // 召喚: サーバーの意味検索(embedding)。使えないときは bigram に自動フォールバック
  const recall = useSemanticRecall(body, allEntries);
>>>>>>> origin/main
  const recallBook = recall ? books.find((b) => b.id === recall.bookId) : null;

  const save = async () => {
    if (!body.trim()) {
      setStatus("本文を書いてから綴じられます。");
      return;
    }
    const tagList = tags
      .trim()
      .split(/[\s,、]+/)
      .map((t) => t.replace(/^#/, ""))
      .filter(Boolean);
    await onSave({
      title: title.trim(),
      body: body.trim(),
      tags: tagList,
      confidence,
      resolveDate: !dateUnknown && resolveDate ? resolveDate : null,
    });
    setStatus("綴じました(2分以内は修正できます)。");
    setBody("");
    setTitle("");
    setTags("");
  };

  return {
    body,
    setBody,
    title,
    setTitle,
    tags,
    setTags,
    confidence,
    setConfidence,
    dateUnknown,
    setDateUnknown,
    resolveDate,
    setResolveDate,
    status,
    recall,
    recallBook,
    save,
  };
}

export type WriteForm = ReturnType<typeof useWriteForm>;

/** 左ページ:導入文 + 本文 + recall(似た過去の記録) */
export function WriteSectionLeft({ form }: { form: WriteForm }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ position: "relative" }}
    >
      <h2>この本に書く</h2>
      <p className="hint">
        綺麗に書かなくていい。ここに書いた「決定時のあなた」は、綴じた後は書き換えられません(追記はできます)—
        当時のあなたを、未来のあなたから守るためです。
      </p>
      <textarea
        className="note"
        placeholder="今の気持ちを、ここに。"
        value={form.body}
        onChange={(e) => form.setBody(e.target.value)}
      />
      <div className={`recall${form.recall ? " show" : ""}`}>
        {form.recall && (
          <>
            <div className="who">
              ― 似た迷いの記録(
              {form.recallBook ? `${SHELF_SHORT[form.recallBook.shelf]} / ${form.recallBook.title}` : ""})
            </div>
            <b>{form.recall.title}</b>
            <p className="hint" style={{ margin: 0 }}>
              {(form.recall.body || "").slice(0, 60)}
            </p>
            <Badges entry={form.recall} />
          </>
        )}
      </div>
<<<<<<< HEAD
    </>
=======
    </motion.div>
>>>>>>> origin/main
  );
}

/** 右ページ:タイトル・感情タグ・確信度・結果予定日・保存ボタン */
export function WriteSectionRight({ form }: { form: WriteForm }) {
  return (
    <>
      <div className="label">この迷いに名前をつけるなら?</div>
      <input
        className="field"
        placeholder="例: 院進か就職か"
        value={form.title}
        onChange={(e) => form.setTitle(e.target.value)}
      />
      <div className="label">感情タグ</div>
      <input
        className="field"
        placeholder="#不安 #進路 #挑戦"
        value={form.tags}
        onChange={(e) => form.setTags(e.target.value)}
      />
      <div className="q-label">この選択がうまくいくと、今どのくらい思える?</div>
      <div className="stars-row">
        <span className="endcap">
          全く
          <br />
          思えない
        </span>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className={`star${i <= form.confidence ? " on" : ""}`}
              aria-label={`${i} / 5`}
              onClick={() => form.setConfidence(i)}
            >
              ★
            </button>
          ))}
        </div>
        <span className="endcap right">
          かなり
          <br />
          思える
        </span>
      </div>
      <div className="label">結果がわかりそうな日</div>
      <div className="date-row">
        <input
          type="date"
          disabled={form.dateUnknown}
          value={form.resolveDate}
          onChange={(e) => form.setResolveDate(e.target.value)}
        />
        <label className="checkline">
          <input
            type="checkbox"
            checked={form.dateUnknown}
            onChange={(e) => {
              form.setDateUnknown(e.target.checked);
              if (!e.target.checked && !form.resolveDate) {
                form.setResolveDate(addMonthsISO(todayISO(), 1));
              }
            }}
          />{" "}
          日付は未定(6ヶ月後にたずねます)
        </label>
      </div>
      <div className="lock-note">
        🔒 綴じた記録は編集できません。誤字などは<b>2分以内</b>
        なら修正できます。その後は「追記」で重ねてください。
      </div>
      <div className="save-row">
        <button type="button" className="plain dark" onClick={form.save}>
          この迷いを綴じる
        </button>
        <span className="save-status">{form.status}</span>
      </div>
    </>
  );
}