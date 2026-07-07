/**
 * 五里霧中モード（新規入力フォーム）
 *
 * 「綺麗に書かなくていい」という設計思想を体現する入力画面。
 * タイトル・悩み・感情タグ・当時の確信度を入力する。
 */
import { useState } from "react";
import { createPivot } from "../lib/api";

interface Props {
  onCreated: () => void; // 作成後にタイムラインを再取得するためのコールバック
}

export function FogMode({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // スペースまたは読点でタグを分割
      const tag_names = tagInput
        .split(/[\s、,]+/)
        .filter((t) => t.length > 0);
      await createPivot({ title, content, confidence, tag_names });
      // 入力をリセット
      setTitle("");
      setContent("");
      setTagInput("");
      setConfidence(3);
      onCreated();
    } catch (e) {
      alert("保存に失敗しました。バックエンドが起動しているか確認してください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fog-mode">
      <div className="fog-label">五里霧中モード</div>
      <p className="fog-hint">綺麗に書かなくていい。迷いをそのまま吐き出そう。</p>

      <input
        className="fog-title"
        placeholder="この迷いに名前をつけるなら？"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className="fog-content"
        placeholder="今の気持ちを殴り書き…"
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <input
        className="fog-tags"
        placeholder="感情タグ（例：#絶望 #どうしよう #研究）"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
      />

      <div className="fog-conf">
        <span>今の確信度</span>
        <input
          type="range"
          min={1}
          max={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
        />
        <span className="conf-stars">
          {"★".repeat(confidence)}{"☆".repeat(5 - confidence)}
        </span>
      </div>

      <button
        className="fog-submit"
        onClick={handleSubmit}
        disabled={saving || !title.trim()}
      >
        {saving ? "保存中…" : "この迷いを記録する"}
      </button>
    </div>
  );
}
