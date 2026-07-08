import type { Entry } from "../../lib/api";

export function Badges({ entry }: { entry: Entry }) {
  return (
    <div className="badges">
      <span className="badge">見込み ★{entry.confidence || 3}</span>
      {entry.outcome === "ok" ? (
        <span className="badge ok">うまくいった</span>
      ) : entry.outcome === "ng" ? (
        <span className="badge ng">後悔が残る</span>
      ) : (
        <span className="badge pend">
          結果待ち{entry.resolveDate ? `(予定 ${entry.resolveDate})` : ""}
        </span>
      )}
      {entry.judgment === "sound" && <span className="badge jud">判断は妥当だった</span>}
      {entry.judgment === "flawed" && <span className="badge jud">判断にも悔いがある</span>}
      {entry.sourceEntryId != null && <span className="badge pub">出版された記録</span>}
    </div>
  );
}
