import { useState } from "react";
import type { Shelf } from "../lib/api";

interface Props {
  shelf: Shelf;
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
}

export function CreateBookModal({ shelf, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const shelfName = shelf === "mine" ? "わたしの書架" : "先達の書架";

  const submitCreate = async () => {
    setError("");
    if (!title.trim()) return setError("本のタイトルを入力してください");
    setBusy(true);
    try {
      await onCreate(title.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id="sharedAccessModal"
      className="open"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === "sharedAccessModal") onClose();
      }}
    >
      <div className="cal-box shared-access-box">
        <button className="plain cal-close" type="button" onClick={onClose}>
          ✕ 閉じる
        </button>

        <h2>新しい本を作る</h2>
        <p className="hint">
          「{shelfName}」に新しい本を作成します。
        </p>
        <div className="label">本のタイトル</div>
        <input
          className="field"
          placeholder="例: 就活の記録"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitCreate();
            }
          }}
        />
        {error && <div className="auth-error">{error}</div>}
        <div className="shared-choice-row" style={{ marginTop: "24px" }}>
          <button className="plain dark" type="button" onClick={submitCreate} disabled={busy}>
            {busy ? "作成中..." : "作成する"}
          </button>
        </div>
      </div>
    </div>
  );
}
