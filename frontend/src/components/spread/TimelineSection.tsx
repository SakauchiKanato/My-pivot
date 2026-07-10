/**
 * 年表セクション
 *
 * 個別記録は「率や曲線を出さず、文脈で読む」(v3の設計判断を維持。
 * per-book計器は却下済み)。全体傾向は計器モーダルへ。
 *
 * 公開(B群)の実装箇所:
 * - B-2: 公開ボタンは年表カード(事後行為)にのみ置く
 * - B-3: delete_only のとき行チェックボックスで削除のみ許可
 * - B-4: 先達棚は serverFlags.publishToSenpai が true のときだけ選択肢に出す
 */
import { useState } from "react";
import type { Book, Entry } from "../../lib/api";
import { apiBiasCheck } from "../../lib/api";
import type { ServerFlags } from "../../config/flags";
import { Badges } from "./Badges";

interface Props {
  book: Book;
  entries: Entry[];
  readOnly: boolean;
  focusEntryId: number | null;
  openFlagFor: number | null;
  sharedBooks: Book[];
  serverFlags: ServerFlags | null;
  publishEnabled: boolean;
  onResolve: (
    entryId: number,
    data: { outcome: "ok" | "ng"; judgment: "sound" | "flawed"; reasonOutcome: string; reasonJudgment: string }
  ) => Promise<void>;
  onPostpone: (entryId: number) => Promise<void>;
  onAppend: (entryId: number, text: string) => Promise<void>;
  onFix: (entry: Entry) => Promise<void>;
  onPublish: (
    entryId: number,
    data: { targetShelf: "shared" | "senpai"; targetBookId?: number; newBookTitle?: string; body?: string }
  ) => Promise<void>;
}

const isResolved = (e: Entry) => e.outcome === "ok" || e.outcome === "ng";

export function TimelineSection(props: Props) {
  const { book, entries, readOnly, focusEntryId } = props;
  const [flagEntryId, setFlagEntryId] = useState<number | null>(props.openFlagFor);
  const [appendId, setAppendId] = useState<number | null>(null);
  const [publishId, setPublishId] = useState<number | null>(null);

  if (!entries.length) {
    return (
      <>
        <h2>この本の年表</h2>
        <div className="empty">まだ記録がありません。</div>
      </>
    );
  }

  return (
    <>
      <h2>この本の年表</h2>
      <p className="hint">
        決定時の見込みと、その後の結果を時系列で。率や曲線は出しません —
        個別の記録は、数字ではなく文脈で読むための場所です。全体の傾向は書棚上部の計器へ。
      </p>
      <div className="results">
        {entries.map((e) => (
          <TimelineCard
            key={e.id}
            entry={e}
            {...props}
            focused={e.id === focusEntryId}
            flagOpen={flagEntryId === e.id}
            appendOpen={appendId === e.id}
            publishOpen={publishId === e.id}
            openFlag={() => {
              setFlagEntryId(e.id);
              setAppendId(null);
              setPublishId(null);
            }}
            openAppend={() => {
              setAppendId(e.id);
              setFlagEntryId(null);
              setPublishId(null);
            }}
            openPublish={() => {
              setPublishId(e.id);
              setFlagEntryId(null);
              setAppendId(null);
            }}
            closeForms={() => {
              setFlagEntryId(null);
              setAppendId(null);
              setPublishId(null);
            }}
          />
        ))}
      </div>
    </>
  );
}

function TimelineCard(
  props: Props & {
    entry: Entry;
    focused: boolean;
    flagOpen: boolean;
    appendOpen: boolean;
    publishOpen: boolean;
    openFlag: () => void;
    openAppend: () => void;
    openPublish: () => void;
    closeForms: () => void;
  }
) {
  const { entry: e, readOnly, book, focused } = props;
  const [outcome, setOutcome] = useState<"ok" | "ng" | null>(null);
  const [judgment, setJudgment] = useState<"sound" | "flawed" | null>(null);
  const [reasonOutcome, setReasonOutcome] = useState("");
  const [reasonJudgment, setReasonJudgment] = useState("");
  const [appendText, setAppendText] = useState("");
  // 候補B: アウトカムバイアス検出。問いが返ったら綴じる前に一度だけ立ち止まる
  const [biasQuestion, setBiasQuestion] = useState<string | null>(null);
  const [biasChecking, setBiasChecking] = useState(false);

  const canPublish =
    props.publishEnabled &&
    book.shelf === "mine" &&
    e.sourceEntryId == null &&
    (!props.serverFlags?.publishRequireResolved || isResolved(e));

  const saveFlag = async (skipBiasCheck = false) => {
    if (!outcome) return;
    if (!judgment) {
      alert("「当時の判断」も選んでください。結果と判断は別のものです。");
      return;
    }
    // 候補B: 綴じる前にアウトカムバイアスの検出を試みる。
    // AIは断定せず問いを1つ返すだけで、綴じるのを妨げない。
    // API未設定・障害時(available=false)や判定エラー時は素通しで綴じる。
    if (!skipBiasCheck && reasonJudgment.trim()) {
      setBiasChecking(true);
      try {
        const res = await apiBiasCheck(e.id, { outcome, judgment, reasonOutcome, reasonJudgment });
        if (res.available && res.biasSuspected && res.question) {
          setBiasQuestion(res.question);
          setBiasChecking(false);
          return; // まだ綴じない。問いに答えるかどうかはユーザーが決める
        }
      } catch {
        /* 検出は綴じる動作を巻き添えにしない */
      }
      setBiasChecking(false);
    }
    await props.onResolve(e.id, { outcome, judgment, reasonOutcome, reasonJudgment });
    setBiasQuestion(null);
    props.closeForms();
  };

  return (
    <article className={`tl-card${focused ? " focus" : ""} ${e.outcome}`}>
      <div className="tl-head">
        <span className="date">{e.date}</span>
        <b>{e.title}</b>
      </div>
      <Badges entry={e} />
      <div className="tl-body">{e.body || ""}</div>
      <div className="locktag">🔒 決定時の記録(書き換え不可)</div>
      {isResolved(e) && (e.reasonOutcome || e.reasonJudgment) && (
        <div className="reason-block">
          {e.reasonOutcome && (
            <>
              <div className="r-label">結果について</div>
              <div>{e.reasonOutcome}</div>
            </>
          )}
          {e.reasonJudgment && (
            <>
              <div className="r-label" style={{ marginTop: 6 }}>
                当時の判断について
              </div>
              <div>{e.reasonJudgment}</div>
            </>
          )}
        </div>
      )}
      {e.appends.map((a) => (
        <div className="append" key={a.id}>
          <div className="a-date">追記 / {a.date}</div>
          {a.text}
        </div>
      ))}

      {!readOnly && (
        <div className="mini-actions">
          {!isResolved(e) && (
            <button className="plain" type="button" onClick={props.openFlag}>
              その後、どうなった?
            </button>
          )}
          <button className="plain" type="button" onClick={props.openAppend}>
            追記する
          </button>
          {e.fixable && (
            <button className="plain" type="button" onClick={() => props.onFix(e)}>
              修正する(保存後2分以内)
            </button>
          )}
          {canPublish && (
            <button className="plain" type="button" onClick={props.openPublish}>
              仲間の書架へ出版する
            </button>
          )}
        </div>
      )}

      {!readOnly && props.flagOpen && !isResolved(e) && (
        <div className="flag-form">
          <div className="fq">その後、どうなった?</div>
          <div className="choice-row">
            <button
              className={`choice${outcome === "ok" ? " sel" : ""}`}
              type="button"
              onClick={() => setOutcome("ok")}
            >
              うまくいった
            </button>
            <button
              className={`choice${outcome === "ng" ? " sel" : ""}`}
              type="button"
              onClick={() => setOutcome("ng")}
            >
              後悔が残る
            </button>
            <button
              className="choice"
              type="button"
              onClick={async () => {
                await props.onPostpone(e.id);
                props.closeForms();
              }}
            >
              まだ分からない
            </button>
          </div>
          {(outcome === "ok" || outcome === "ng") && (
            <>
              <div className="fq">当時の判断は、どうだった?</div>
              <div className="fnote">
                結果と判断は、別のものです。良い判断が悪い結果になることも、その逆もあります。
              </div>
              <div className="choice-row">
                <button
                  className={`choice${judgment === "sound" ? " sel" : ""}`}
                  type="button"
                  onClick={() => setJudgment("sound")}
                >
                  判断は妥当だった
                </button>
                <button
                  className={`choice${judgment === "flawed" ? " sel" : ""}`}
                  type="button"
                  onClick={() => setJudgment("flawed")}
                >
                  判断にも悔いがある
                </button>
              </div>
              <div className="label">結果について、ひとこと</div>
              <textarea
                className="small"
                placeholder="何が起きた?"
                value={reasonOutcome}
                onChange={(ev) => setReasonOutcome(ev.target.value)}
              />
              <div className="label">当時の判断について、ひとこと</div>
              <textarea
                className="small"
                placeholder="あの時の自分の決め方は、どうだった?"
                value={reasonJudgment}
                onChange={(ev) => {
                  setReasonJudgment(ev.target.value);
                  setBiasQuestion(null); // 書き直したら、もう一度検出を通す
                }}
              />
              {biasQuestion ? (
                <div className="bias-ask">
                  <div className="who">― 綴じる前に、ひとつだけ</div>
                  <p>{biasQuestion}</p>
                  <div className="mini-actions">
                    <button className="plain" type="button" onClick={() => setBiasQuestion(null)}>
                      書き直す
                    </button>
                    <button className="plain dark" type="button" onClick={() => saveFlag(true)}>
                      このまま綴じる
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="plain dark"
                  type="button"
                  disabled={biasChecking}
                  onClick={() => saveFlag()}
                >
                  {biasChecking ? "確認しています…" : "結果を綴じる"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!readOnly && props.appendOpen && (
        <div className="flag-form">
          <div className="fq">追記(決定時の記録の下に、日付つきで重なります)</div>
          <textarea
            className="small"
            placeholder="いまの視点から、ひとこと。"
            value={appendText}
            onChange={(ev) => setAppendText(ev.target.value)}
          />
          <button
            className="plain dark"
            type="button"
            onClick={async () => {
              if (!appendText.trim()) return;
              await props.onAppend(e.id, appendText.trim());
              setAppendText("");
              props.closeForms();
            }}
          >
            追記を残す
          </button>
        </div>
      )}

      {!readOnly && props.publishOpen && canPublish && (
        <PublishForm
          entry={e}
          sharedBooks={props.sharedBooks}
          serverFlags={props.serverFlags}
          onPublish={async (data) => {
            await props.onPublish(e.id, data);
            props.closeForms();
          }}
          onCancel={props.closeForms}
        />
      )}
    </article>
  );
}

function PublishForm({
  entry,
  sharedBooks,
  serverFlags,
  onPublish,
  onCancel,
}: {
  entry: Entry;
  sharedBooks: Book[];
  serverFlags: ServerFlags | null;
  onPublish: (data: {
    targetShelf: "shared" | "senpai";
    targetBookId?: number;
    newBookTitle?: string;
    passcode?: string;
    body?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const deleteOnly = (serverFlags?.publishEditMode ?? "delete_only") === "delete_only";
  const lines = entry.body.split("\n");
  const [removed, setRemoved] = useState<boolean[]>(lines.map(() => false));
  const [freeBody, setFreeBody] = useState(entry.body);
  const [targetShelf, setTargetShelf] = useState<"shared" | "senpai">("shared");
  const [targetBookId, setTargetBookId] = useState<number | "new">(
    sharedBooks.length ? sharedBooks[0].id : "new"
  );
  const [newTitle, setNewTitle] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [error, setError] = useState("");

  const isNewSharedBook = targetBookId === "new" && targetShelf === "shared";

  const submit = async () => {
    setError("");
    if (isNewSharedBook && newPasscode.trim().length < 4) {
      setError("共同の書架には4文字以上の合言葉が必要です");
      return;
    }
    const body = deleteOnly
      ? lines.filter((_, i) => !removed[i]).join("\n")
      : freeBody;
    try {
      await onPublish({
        targetShelf,
        targetBookId: targetBookId === "new" ? undefined : targetBookId,
        newBookTitle: targetBookId === "new" ? newTitle : undefined,
        passcode: isNewSharedBook ? newPasscode.trim() : undefined,
        body,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "公開に失敗しました");
    }
  };

  return (
    <div className="publish-form">
      <div className="fq">仲間の書架へ出版する</div>
      <div className="fnote">
        原本はこの棚から動きません。コピーが共同の書架に置かれます。
        {deleteOnly
          ? " 出版前に、見せたくない行を外せます(削除のみ・加筆はできません)。"
          : " 出版前に本文を自由に編集できます。"}
      </div>
      {serverFlags?.publishToSenpai && (
        <select
          value={targetShelf}
          onChange={(e) => setTargetShelf(e.target.value as "shared" | "senpai")}
        >
          <option value="shared">共同の書架へ</option>
          <option value="senpai">先達の書架へ(後輩へ)</option>
        </select>
      )}
      <select
        value={targetBookId}
        onChange={(e) =>
          setTargetBookId(e.target.value === "new" ? "new" : Number(e.target.value))
        }
      >
        {sharedBooks.map((b) => (
          <option key={b.id} value={b.id}>
            『{b.title}』に綴じる
          </option>
        ))}
        <option value="new">＋ 新しい本を作って綴じる</option>
      </select>
      {targetBookId === "new" && (
        <input
          type="text"
          placeholder="新しい本のタイトル"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
      )}
      {isNewSharedBook && (
        <input
          type="text"
          placeholder="合言葉(4文字以上・仲間に伝えてください)"
          value={newPasscode}
          onChange={(e) => setNewPasscode(e.target.value)}
        />
      )}
      {deleteOnly ? (
        <div className="pub-lines">
          {lines.map((line, i) => (
            <label className={`pub-line${removed[i] ? " removed" : ""}`} key={i}>
              <input
                type="checkbox"
                checked={!removed[i]}
                onChange={() =>
                  setRemoved((cur) => cur.map((v, j) => (j === i ? !v : v)))
                }
              />
              <span>{line || "(空行)"}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea
          className="small"
          style={{ minHeight: 100 }}
          value={freeBody}
          onChange={(e) => setFreeBody(e.target.value)}
        />
      )}
      {error && <div className="auth-error">{error}</div>}
      <div className="mini-actions">
        <button className="plain dark" type="button" onClick={submit}>
          この形で出版する
        </button>
        <button className="plain" type="button" onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  );
}
