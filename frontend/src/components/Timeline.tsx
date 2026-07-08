/**
 * ピボット・タイムライン
 *
 * ピボットを時系列で縦に並べ、成功（緑）/後悔（赤）で色分けする。
 * 各ノードをクリックすると詳細（当時の気持ち）が展開する。
 */
import { useState } from "react";
import type { Pivot, Flag } from "../lib/api";
import { updateFlag, checkOutcomeBias } from "../lib/api";

interface Props {
  pivots: Pivot[];
  onUpdate?: () => void;
}

export function Timeline({ pivots, onUpdate }: Props) {
  // どのノードが展開中かを管理
  const [openId, setOpenId] = useState<number | null>(null);

  // アウトカムバイアスチェック用のモーダル状態
  const [modalState, setModalState] = useState<{
    pivotId: number;
    flag: "success" | "regret";
  } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    has_bias: boolean;
    question_to_user: string;
  } | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  const handleOpenModal = (pivotId: number, flag: "success" | "regret") => {
    setModalState({ pivotId, flag });
    setReasonText("");
    setAiResponse(null);
    setChatHistory([]);
  };

  const handleCloseModal = () => {
    setModalState(null);
  };

  const handleCheckBias = async () => {
    if (!modalState || !reasonText.trim()) return;
    setIsChecking(true);
    try {
      const currentHistory = [...chatHistory, { role: "user" as const, text: reasonText }];
      setChatHistory(currentHistory);

      const res = await checkOutcomeBias(modalState.pivotId, modalState.flag, reasonText);
      setAiResponse(res);
      
      if (!res.has_bias) {
        // パスした場合も、AIからの一言（称賛など）があれば履歴に保存する
        const finalHistory = res.question_to_user 
          ? [...currentHistory, { role: "ai" as const, text: res.question_to_user }]
          : currentHistory;
        await handleSaveWithHistory(finalHistory);
      } else {
        setChatHistory([...currentHistory, { role: "ai" as const, text: res.question_to_user }]);
        setReasonText(""); // AIからのツッコミ後は言い直せるようにクリアする
      }
    } catch (e) {
      console.error(e);
      alert("AI判定中にエラーが発生しました");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveWithHistory = async (historyToSave: {role: "user"|"ai", text: string}[]) => {
    if (!modalState) return;
    try {
      const aiQuestion = aiResponse?.has_bias ? aiResponse.question_to_user : undefined;
      const historyJson = JSON.stringify(historyToSave);
      await updateFlag(modalState.pivotId, modalState.flag, reasonText, aiQuestion, historyJson);
      setModalState(null);
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  };

  const handleSave = () => handleSaveWithHistory(chatHistory);

  return (
    <div className="timeline">
      <div className="timeline-line" />
      {pivots.map((p) => {
        const isSuccess = p.flag === "success";
        const isRegret = p.flag === "regret";
        const dotColor = isSuccess ? "#22c55e" : isRegret ? "#ef4444" : "#94a3b8";
        const isOpen = openId === p.id;

        return (
          <div key={p.id} className="node-row">
            <span
              className="node-dot"
              style={{ borderColor: dotColor, background: `${dotColor}22` }}
            />
            <div className="node-card" onClick={() => toggle(p.id)}>
              <div className="node-head">
                <span className="node-date">{p.created_at.slice(0, 10)}</span>
                <span
                  className="node-flag"
                  style={{ color: dotColor }}
                >
                  {isSuccess ? "✓ 成功" : isRegret ? "▼ 後悔" : "・未評価"}
                </span>
              </div>
              <div className="node-title">{p.title}</div>
              <div className="node-tags">
                {p.tags.map((t) => (
                  <span key={t.name} className="tag">
                    {t.name}
                    <span className="tag-cat">{t.category}</span>
                  </span>
                ))}
              </div>

              {isOpen && (
                <div className="node-detail" onClick={(e) => e.stopPropagation()}>
                  <div className="detail-label">当時の気持ち</div>
                  <p className="detail-content">{p.content}</p>
                  {p.confidence != null && (
                    <div className="detail-conf">
                      当時の確信度：{"★".repeat(p.confidence)}
                      {"☆".repeat(5 - p.confidence)}
                    </div>
                  )}

                  {/* 評価済みの場合は最終的な理由（一文）を表示 */}
                  {p.flag && p.reason_judgment && (
                    <>
                      <div className="detail-label" style={{ marginTop: 16 }}>結果の振り返り</div>
                      <p className="detail-content" style={{ fontWeight: "bold" }}>{p.reason_judgment}</p>
                    </>
                  )}

                  {/* パターンA: 振り切って記録した場合 */}
                  {p.is_ai_intervened && p.ai_question && (
                    <div style={{ marginTop: 12, background: "#fff7ed", padding: 12, borderRadius: 6, border: "1px solid #fdba74" }}>
                      <strong style={{ color: "#ea580c", fontSize: "0.85em", display: "block", marginBottom: 4 }}>
                        ⚠️ AIの問いかけを振り切って記録されました
                      </strong>
                      
                      {p.ai_chat_history && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: "0.85em", color: "#9a3412", fontWeight: "bold", outline: "none" }}>
                            💬 AIとの葛藤プロセスを見る
                          </summary>
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            {JSON.parse(p.ai_chat_history).map((msg: any, i: number) => (
                              <div key={i} style={{ 
                                padding: "8px 12px", borderRadius: 6, fontSize: "0.9em",
                                background: msg.role === "ai" ? "#fef08a" : "#ffffff",
                                border: msg.role === "ai" ? "none" : "1px solid #fed7aa",
                                alignSelf: msg.role === "ai" ? "flex-start" : "flex-end",
                                maxWidth: "85%"
                              }}>
                                <strong style={{ display: "block", fontSize: "0.8em", color: "#666", marginBottom: 2 }}>
                                  {msg.role === "ai" ? "🤖 AI" : "👤 あなた"}
                                </strong>
                                {msg.text}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {/* パターンB: 葛藤の末にパスした場合 (ai_question はないが chat_history の長さが2以上) */}
                  {!p.ai_question && p.ai_chat_history && JSON.parse(p.ai_chat_history).length > 1 && (
                    <div style={{ marginTop: 12, background: "#f0fdf4", padding: 12, borderRadius: 6, border: "1px solid #86efac" }}>
                      <strong style={{ color: "#16a34a", fontSize: "0.85em", display: "block", marginBottom: 4 }}>
                        💡 AIとの壁打ちを経て言語化されました
                      </strong>
                      
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: "0.85em", color: "#15803d", fontWeight: "bold", outline: "none" }}>
                          💬 AIとの葛藤プロセスを見る
                        </summary>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {JSON.parse(p.ai_chat_history).map((msg: any, i: number) => (
                            <div key={i} style={{ 
                              padding: "8px 12px", borderRadius: 6, fontSize: "0.9em",
                              background: msg.role === "ai" ? "#fef08a" : "#ffffff",
                              border: msg.role === "ai" ? "none" : "1px solid #bbf7d0",
                              alignSelf: msg.role === "ai" ? "flex-start" : "flex-end",
                              maxWidth: "85%"
                            }}>
                              <strong style={{ display: "block", fontSize: "0.8em", color: "#666", marginBottom: 2 }}>
                                {msg.role === "ai" ? "🤖 AI" : "👤 あなた"}
                              </strong>
                              {msg.text}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* 未評価なら「結果を綴じる」ボタンを表示 */}
                  {!p.flag && (
                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleOpenModal(p.id, "success")}
                        style={{ padding: "6px 12px", background: "#22c55e", color: "white", borderRadius: 4, border: "none", cursor: "pointer" }}
                      >
                        成功として綴じる
                      </button>
                      <button
                        onClick={() => handleOpenModal(p.id, "regret")}
                        style={{ padding: "6px 12px", background: "#ef4444", color: "white", borderRadius: 4, border: "none", cursor: "pointer" }}
                      >
                        後悔として綴じる
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* AI判定用モーダル */}
      {modalState && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 400, maxWidth: "90%" }}>
            <h3 style={{ marginTop: 0 }}>
              {modalState.flag === "success" ? "成功" : "後悔"}として記録する
            </h3>
            <p style={{ fontSize: "0.9em", color: "#666" }}>当時の判断について、なぜそのような結果になったと思いますか？</p>
            {chatHistory.length > 0 && (
              <div style={{ marginBottom: 16, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 8, background: "#f8fafc", borderRadius: 4 }}>
                {chatHistory.map((msg, i) => (
                  <div key={i} style={{
                    padding: 8, borderRadius: 6, fontSize: "0.9em",
                    background: msg.role === "ai" ? "#fef08a" : "#e2e8f0",
                    alignSelf: msg.role === "ai" ? "flex-start" : "flex-end",
                    maxWidth: "85%"
                  }}>
                    <strong style={{ display: "block", fontSize: "0.8em", color: "#666", marginBottom: 2 }}>
                      {msg.role === "ai" ? "🤖 AIからの問いかけ" : "👤 あなた"}
                    </strong>
                    {msg.text}
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={reasonText}
              onChange={(e) => {
                setReasonText(e.target.value);
                setAiResponse(null);
              }}
              style={{ width: "100%", height: 80, marginBottom: 16, padding: 8, boxSizing: "border-box" }}
              placeholder={chatHistory.length > 0 ? "AIの問いかけに対する答えを書いてください..." : "例：当時はAだと思っていたが、実際はBだった..."}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={handleCloseModal} style={{ padding: "8px 16px", cursor: "pointer" }}>キャンセル</button>
              
              {!aiResponse?.has_bias ? (
                <button
                  onClick={handleCheckBias}
                  disabled={isChecking || !reasonText.trim()}
                  style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, cursor: "pointer", opacity: (!reasonText.trim() || isChecking) ? 0.5 : 1 }}
                >
                  {isChecking ? "AI判定中..." : "保存する"}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  style={{ padding: "8px 16px", background: "#f97316", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  このまま保存する
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
