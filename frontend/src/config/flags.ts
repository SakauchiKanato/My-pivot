/**
 * Feature flags — チーム未決事項(A〜D群)との対応表
 *
 * 決定が出たら、ここを書き換える。UIの分岐はすべてこのファイルを参照する。
 * バックエンド側の対応フラグは backend/app/settings.py。
 * 決定内容は DECISIONS.md に日付つきで追記すること。
 */

export const FLAGS = {
  /**
   * A-1: 見開き構造
   *  "tabs"         : 現行(v3)。右ページにタブ(目次/書く/探す/年表)
   *  "past_present" : 左=過去(年表+検索) / 右=現在(書く)。未実装の受け皿。
   *                   BookOverlay 内で LeftPage / RightPage の構成を差し替える。
   */
  spreadLayout: "tabs" as "tabs" | "past_present",

  /**
   * A-2: 召喚の演出
   *  "box"           : 現行。テキストエリア下の別枠ボックスに浮かぶ
   *  "timeline_glow" : 左ページ年表内で該当カードが光って浮かぶ(A-1採用時のみ有効)
   */
  recallStyle: "box" as "box" | "timeline_glow",

  /** A-3: 先達の本の右ページを閲覧ビューにするか(A-1採用が前提) */
  senpaiReaderPane: false,

  /**
   * B-1: 個人→共同の片方向参照(引用リンク)。
   * false の間はUIに出さない(「設計済み」として口頭対応)。
   */
  referenceLinks: false,

  /**
   * B-2: 執筆フォームに公開トグルを置かない(公開は年表からの事後行為)。
   * true が原則。覆った場合のみ false にして WritePanel に導線を足す。
   */
  publishPostHocOnly: true,

  /** 公開機能そのもの(D-1 凍結判断でOFFにできる) */
  publishEnabled: true,

  /** デモ補助: ログインフォームにデモ資格情報を表示する */
  showDemoCredentials: true,

  /** 書架ページネーション（からくり書架） */
  shelfPagination: true,
} as const;

export const flags = FLAGS;

/** サーバー側フラグ(GET /api/library で受け取り、上書き参照する) */
export interface ServerFlags {
  publishEnabled: boolean;
  publishRequireResolved: boolean;
  publishEditMode: "delete_only" | "free";
  publishToSenpai: boolean;
  referenceLinks: boolean;
  fixWindowSeconds: number;
}
