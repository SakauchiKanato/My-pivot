/**
 * 「この本に書く」セクション
 *
 * 設計原則の実装箇所:
 * - confidence は決定時に固定(後知恵バイアス対策)
 * - B-2: 公開トグルは置かない(FLAGS.publishPostHocOnly)。公開は年表から。
 * - A-2: 召喚は現行 "box" 方式。FLAGS.recallStyle で差し替え予定の受け皿。
 */
import { useMemo, useState } from "react";
import type { Book, Entry } from "../../lib/api";
import { bestRecall } from "../../lib/recall";
import { addMonthsISO, todayISO } from "../../lib/dates";
import { Badges } from "./Badges";

const SHELF_SHORT: Record<string, string> = { mine: "わたし", shared: "共同", senpai: "先達" };

export interface WriteDraft {
  title: string;
  body: string;
  tags: string;
  confidence: number;
}

interface Props {
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

export function WriteSection({ allEntries, books, initialDraft, onSave }: Props) {
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [tags, setTags] = useState(initialDraft?.tags ?? "");
  const [confidence, setConfidence] = useState(initialDraft?.confidence ?? 3);
  const [dateUnknown, setDateUnknown] = useState(true);
  const [resolveDate, setResolveDate] = useState("");
  const [status, setStatus] = useState("");

  const recall = useMemo(() => {
    const text = body.trim();
    if (text.length < 12) return null;
    return bestRecall(text, allEntries);
  }, [body, allEntries]);

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

  return (
    <>
      <h2>この本に書く</h2>
      <p className="hint">
        綺麗に書かなくていい。ここに書いた「決定時のあなた」は、綴じた後は書き換えられません(追記はできます)—
        当時のあなたを、未来のあなたから守るためです。
      </p>
      <textarea
        className="note"
        placeholder="今の気持ちを、ここに。"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className={`recall${recall ? " show" : ""}`}>
        {recall && (
          <>
            <div className="who">
              ― 似た迷いの記録(
              {recallBook ? `${SHELF_SHORT[recallBook.shelf]} / ${recallBook.title}` : ""})
            </div>
            <b>{recall.title}</b>
            <p className="hint" style={{ margin: 0 }}>
              {(recall.body || "").slice(0, 60)}
            </p>
            <Badges entry={recall} />
          </>
        )}
      </div>
      <div className="label">この迷いに名前をつけるなら?</div>
      <input
        className="field"
        placeholder="例: 院進か就職か"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="label">感情タグ</div>
      <input
        className="field"
        placeholder="#不安 #進路 #挑戦"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
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
              className={`star${i <= confidence ? " on" : ""}`}
              aria-label={`${i} / 5`}
              onClick={() => setConfidence(i)}
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
          disabled={dateUnknown}
          value={resolveDate}
          onChange={(e) => setResolveDate(e.target.value)}
        />
        <label className="checkline">
          <input
            type="checkbox"
            checked={dateUnknown}
            onChange={(e) => {
              setDateUnknown(e.target.checked);
              if (!e.target.checked && !resolveDate) setResolveDate(addMonthsISO(todayISO(), 1));
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
        <button type="button" className="plain dark" onClick={save}>
          この迷いを綴じる
        </button>
        <span className="save-status">{status}</span>
      </div>
    </>
  );
}
