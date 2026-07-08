import { useState } from "react";

interface Props {
  onClose: () => void;
  onCreate: (title: string, passcode: string) => Promise<void>;
  onJoin: (passcode: string) => Promise<void>;
}

type Mode = "choose" | "create" | "join";

export function SharedAccessModal({ onClose, onCreate, onJoin }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [title, setTitle] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCreate = async () => {
    setError("");
    if (!title.trim()) return setError("本のタイトルを入力してください");
    if (passcode.trim().length < 4) return setError("合言葉は4文字以上にしてください");
    setBusy(true);
    try {
      await onCreate(title.trim(), passcode.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = async () => {
    setError("");
    if (!passcode.trim()) return setError("合言葉を入力してください");
    setBusy(true);
    try {
      await onJoin(passcode.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "参加に失敗しました");
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

        {mode === "choose" && (
          <>
            <h2>共同の書架</h2>
            <p className="hint">
              新しく本を作るか、仲間から聞いた合言葉で既存の本に参加できます。
            </p>
            <div className="shared-choice-row">
              <button className="plain dark" type="button" onClick={() => setMode("create")}>
                新しく作る
              </button>
              <button className="plain" type="button" onClick={() => setMode("join")}>
                合言葉で参加する
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <>
            <h2>共同の本を新しく作る</h2>
            <p className="hint">
              この本専用の合言葉を決めてください。仲間はその合言葉で参加できます。
            </p>
            <div className="label">本のタイトル</div>
            <input
              className="field"
              placeholder="例: 共同開発メモ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="label">合言葉(4文字以上)</div>
            <input
              className="field"
              placeholder="例: kaihatsu2026"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            {error && <div className="auth-error">{error}</div>}
            <div className="shared-choice-row">
              <button className="plain" type="button" onClick={() => setMode("choose")} disabled={busy}>
                戻る
              </button>
              <button className="plain dark" type="button" onClick={submitCreate} disabled={busy}>
                この合言葉で作る
              </button>
            </div>
          </>
        )}

        {mode === "join" && (
          <>
            <h2>共同著書に参加する</h2>
            <p className="hint">仲間から聞いた合言葉を入力してください。</p>
            <div className="label">合言葉</div>
            <input
              className="field"
              placeholder="合言葉"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            {error && <div className="auth-error">{error}</div>}
            <div className="shared-choice-row">
              <button className="plain" type="button" onClick={() => setMode("choose")} disabled={busy}>
                戻る
              </button>
              <button className="plain dark" type="button" onClick={submitJoin} disabled={busy}>
                参加する
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
