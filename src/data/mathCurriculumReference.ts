/**
 * 数学カリキュラム参考データ（開発時に一度だけ生成した静的データ）
 *
 * 中学1〜3年・高校数学（数I・数A・数II・数B・数III・数C）の単元構成を、
 * 学習指導要領および主要教科書会社（東京書籍・啓林館・数研出版・実教出版 等）の
 * 目次・年間指導計画を突き合わせて調査し、章 → 小項目（サブトピック）→ 難易度の
 * 形にまとめたもの。アプリ実行時にAIを呼び出す機能ではなく、ビルドに同梱される
 * 静的な参考データ。
 *
 * 想定用途（未実装・別タスク）：Onboarding/Settings で章・小項目名を入力した際に、
 * この参考データとあいまい一致させて難易度・演習量の初期値候補を提示する。
 * 生徒の自由記述入力を置き換えるものではなく、あくまで補助的な提案に使う。
 *
 * 注意：difficultyLevel はこの調査で新たに使う5段階評価であり、
 * 既存の Chapter.metadata.difficultyLevel（3段階）とは尺度が異なる。
 * 実装時にどちらかへ寄せるかは未決定（3→5段階への拡張 or 5→3段階への変換）。
 * 難易度ラベル自体はどの単元構成にも権威ある情報源が存在しないため、
 * 各ブロックを調査したセッションのベストエフォートの判断に基づく
 * （単元・小項目の構成自体は複数の情報源で裏どり済み）。
 */

import type { CurriculumBlockData } from "./curriculumTypes";

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes";

export const mathCurriculumReference: CurriculumBlockData[] = [
  {
    block: "中1",
    subject: "数学",
    chapters: [
      {
        name: "正の数・負の数",
        subtopics: [
          { name: "正負の数の意味・数直線・絶対値", difficultyLevel: 1 },
          { name: "正負の数の大小・不等号", difficultyLevel: 1 },
          { name: "加法・減法（同符号・異符号の計算）", difficultyLevel: 2 },
          { name: "加法と減法の混じった計算（項の考え方）", difficultyLevel: 2 },
          { name: "乗法・除法（符号のきまり・逆数）", difficultyLevel: 2 },
          { name: "累乗・指数", difficultyLevel: 2 },
          { name: "四則混合計算・分配法則", difficultyLevel: 3 },
          { name: "素数と素因数分解", difficultyLevel: 3 },
          { name: "正負の数の利用（平均の工夫など文章題）", difficultyLevel: 3 },
        ],
      },
      {
        name: "文字と式",
        subtopics: [
          { name: "文字を使った式の表し方・きまり（積・商の表記）", difficultyLevel: 1 },
          { name: "数量の文字式表現（代金・単位・割合・速さなど）", difficultyLevel: 2 },
          { name: "式の値（代入）", difficultyLevel: 2 },
          { name: "項と係数、1次式の加法・減法", difficultyLevel: 2 },
          { name: "1次式と数の乗法・除法、かっこを含む計算", difficultyLevel: 3 },
          { name: "等式・不等式による数量関係の表現", difficultyLevel: 3 },
          { name: "文字式の利用（規則性の説明・文章題への応用）", difficultyLevel: 4 },
        ],
      },
      {
        name: "方程式",
        subtopics: [
          { name: "方程式とその解の意味", difficultyLevel: 1 },
          { name: "等式の性質と移項による解き方（基本形）", difficultyLevel: 2 },
          { name: "かっこ・小数・分数を含む1次方程式", difficultyLevel: 3 },
          { name: "比と比例式", difficultyLevel: 3 },
          { name: "方程式の利用（文章題：代金・過不足・速さ・割合など）", difficultyLevel: 4 },
          { name: "比例式の利用（文章題）", difficultyLevel: 4 },
        ],
      },
      {
        name: "比例と反比例",
        subtopics: [
          { name: "関数の意味・変数と変域", difficultyLevel: 2 },
          { name: "比例の意味・式（y=ax）の決定", difficultyLevel: 2 },
          { name: "座標と点の表し方", difficultyLevel: 2 },
          { name: "比例のグラフ", difficultyLevel: 3 },
          { name: "反比例の意味・式（y=a/x）の決定", difficultyLevel: 3 },
          { name: "反比例のグラフ", difficultyLevel: 3 },
          { name: "比例・反比例の利用（文章題・図形との融合）", difficultyLevel: 4 },
        ],
      },
      {
        name: "平面図形",
        subtopics: [
          { name: "図形の基礎（点・直線・角・距離の表し方）", difficultyLevel: 1 },
          { name: "図形の移動（平行移動・回転移動・対称移動）", difficultyLevel: 2 },
          { name: "基本の作図（垂直二等分線・角の二等分線・垂線）", difficultyLevel: 3 },
          { name: "作図の応用（複合条件を満たす作図）", difficultyLevel: 4 },
          { name: "円とおうぎ形の基礎（弧・弦・中心角・接線）", difficultyLevel: 2 },
          { name: "おうぎ形の弧の長さ・面積の計量", difficultyLevel: 3 },
        ],
      },
      {
        name: "空間図形",
        subtopics: [
          { name: "いろいろな立体・正多面体の分類", difficultyLevel: 1 },
          { name: "空間内の直線・平面の位置関係（平行・垂直・ねじれの位置）", difficultyLevel: 3 },
          { name: "面や線の移動でできる立体・回転体", difficultyLevel: 3 },
          { name: "投影図・展開図の読み取りと作成", difficultyLevel: 3 },
          { name: "角柱・円柱の表面積と体積", difficultyLevel: 2 },
          { name: "角錐・円錐の表面積と体積", difficultyLevel: 4 },
          { name: "球の表面積と体積", difficultyLevel: 4 },
        ],
      },
      {
        name: "データの活用",
        subtopics: [
          { name: "度数分布表・階級・階級値", difficultyLevel: 1 },
          { name: "ヒストグラム・度数折れ線", difficultyLevel: 2 },
          { name: "相対度数・累積度数・累積相対度数", difficultyLevel: 3 },
          { name: "代表値（平均値・中央値・最頻値）と範囲", difficultyLevel: 2 },
          { name: "データに基づく批判的な考察（複数データの比較・PPDACサイクル）", difficultyLevel: 3 },
          { name: "多数回の試行による確率（統計的確率）", difficultyLevel: 3 },
        ],
      },
    ],
  },
  {
    block: "中2",
    subject: "数学",
    chapters: [
      {
        name: "式の計算",
        subtopics: [
          { name: "単項式・多項式の加法と減法（同類項の整理を含む）", difficultyLevel: 1 },
          { name: "式の値（多項式と数の乗除、式を簡単にしてから代入）", difficultyLevel: 2 },
          { name: "単項式どうしの乗法・除法（乗除混合の計算）", difficultyLevel: 2 },
          { name: "文字式を利用した数量関係の説明・証明（整数の性質の説明など）", difficultyLevel: 4 },
          { name: "等式の変形（目的の文字について解く）", difficultyLevel: 3 },
        ],
      },
      {
        name: "連立方程式",
        subtopics: [
          { name: "連立方程式の意味と解の確認", difficultyLevel: 1 },
          { name: "加減法による解き方", difficultyLevel: 2 },
          { name: "代入法による解き方", difficultyLevel: 2 },
          { name: "かっこ・分数・小数を含むいろいろな連立方程式", difficultyLevel: 3 },
          { name: "連立方程式の利用（文章題：割合・速さ・個数など）", difficultyLevel: 4 },
        ],
      },
      {
        name: "一次関数",
        subtopics: [
          { name: "一次関数の意味と値の変化・変化の割合", difficultyLevel: 2 },
          { name: "一次関数のグラフ（傾き・切片、グラフのかき方）", difficultyLevel: 2 },
          { name: "一次関数の式を求める（傾きと1点、2点の座標から）", difficultyLevel: 3 },
          { name: "二元一次方程式のグラフ（ax+by=c、x=h・y=kのグラフ）", difficultyLevel: 3 },
          { name: "連立方程式とグラフの交点の関係", difficultyLevel: 3 },
          { name: "一次関数の利用（水温変化・動点・料金プランなどの文章題）", difficultyLevel: 4 },
        ],
      },
      {
        name: "平行と合同（図形の調べ方）",
        subtopics: [
          { name: "対頂角・同位角・錯角と平行線の性質", difficultyLevel: 1 },
          { name: "三角形の内角・外角、多角形の内角の和・外角の和", difficultyLevel: 2 },
          { name: "三角形の合同条件と合同の表し方", difficultyLevel: 2 },
          { name: "証明の意味としくみ（仮定・結論、証明の書き方）", difficultyLevel: 4 },
          { name: "合同条件を使った証明の記述", difficultyLevel: 4 },
        ],
      },
      {
        name: "三角形と四角形（図形の性質と証明）",
        subtopics: [
          { name: "二等辺三角形の性質とその証明（定義・定理・逆・反例を含む）", difficultyLevel: 3 },
          { name: "直角三角形の合同条件とそれを使った証明", difficultyLevel: 3 },
          { name: "平行四辺形の定義・性質とその証明", difficultyLevel: 3 },
          { name: "平行四辺形になるための条件とその証明", difficultyLevel: 4 },
          { name: "長方形・ひし形・正方形の定義と平行四辺形との関係", difficultyLevel: 3 },
          { name: "平行線と面積（等積変形）", difficultyLevel: 4 },
        ],
      },
      {
        name: "確率",
        subtopics: [
          { name: "確率の意味（同様に確からしい、確率の定義）", difficultyLevel: 1 },
          { name: "樹形図・表を使った場合の数の整理と確率の計算", difficultyLevel: 2 },
          { name: "余事象を利用した確率の求め方", difficultyLevel: 3 },
          { name: "確率を使った説明・判断（くじ引きの公平性など応用）", difficultyLevel: 4 },
        ],
      },
      {
        name: "データの比較（箱ひげ図と四分位範囲）",
        subtopics: [
          { name: "四分位数・四分位範囲の求め方", difficultyLevel: 2 },
          { name: "箱ひげ図のかき方と読み取り", difficultyLevel: 2 },
          { name: "箱ひげ図を用いた複数データの比較・批判的な判断", difficultyLevel: 3 },
        ],
      },
    ],
  },
  {
    block: "中3",
    subject: "数学",
    chapters: [
      {
        name: "多項式（式の展開と因数分解）",
        subtopics: [
          { name: "単項式・多項式の乗法と除法", difficultyLevel: 1 },
          { name: "乗法公式による展開", difficultyLevel: 2 },
          { name: "素因数分解", difficultyLevel: 1 },
          { name: "公式による因数分解", difficultyLevel: 3 },
          { name: "置き換え・共通因数を用いる因数分解", difficultyLevel: 4 },
          { name: "式の展開・因数分解の利用（数量・図形の証明）", difficultyLevel: 4 },
        ],
      },
      {
        name: "平方根",
        subtopics: [
          { name: "平方根の意味と大小", difficultyLevel: 1 },
          { name: "有理数と無理数", difficultyLevel: 2 },
          { name: "根号を含む式の乗除・分母の有理化", difficultyLevel: 2 },
          { name: "根号を含む式の加法・減法", difficultyLevel: 3 },
          { name: "根号を含む式の展開・利用", difficultyLevel: 3 },
          { name: "平方根の利用（文章題・大小判断）", difficultyLevel: 4 },
        ],
      },
      {
        name: "二次方程式",
        subtopics: [
          { name: "平方根の考えを使った解き方（ax²=b, (x+m)²=n）", difficultyLevel: 2 },
          { name: "解の公式", difficultyLevel: 3 },
          { name: "因数分解による解き方", difficultyLevel: 3 },
          { name: "二次方程式の利用（文章題）", difficultyLevel: 5 },
        ],
      },
      {
        name: "関数 y=ax²",
        subtopics: [
          { name: "関数 y=ax² の式・表", difficultyLevel: 2 },
          { name: "y=ax² のグラフの特徴", difficultyLevel: 2 },
          { name: "変域", difficultyLevel: 3 },
          { name: "変化の割合・平均の速さ", difficultyLevel: 3 },
          { name: "いろいろな事象と関数（利用・グラフ読み取り）", difficultyLevel: 4 },
        ],
      },
      {
        name: "図形と相似",
        subtopics: [
          { name: "相似の意味と相似比", difficultyLevel: 1 },
          { name: "三角形の相似条件", difficultyLevel: 2 },
          { name: "相似条件を使った証明", difficultyLevel: 4 },
          { name: "平行線と線分の比", difficultyLevel: 3 },
          { name: "三角形の中点連結定理", difficultyLevel: 3 },
          { name: "相似な図形の面積比・体積比", difficultyLevel: 3 },
          { name: "相似の利用（縮図・測量）", difficultyLevel: 4 },
        ],
      },
      {
        name: "円の性質",
        subtopics: [
          { name: "円周角の定理", difficultyLevel: 2 },
          { name: "円周角の定理の逆", difficultyLevel: 3 },
          { name: "円の性質を利用した証明・作図", difficultyLevel: 5 },
        ],
      },
      {
        name: "三平方の定理",
        subtopics: [
          { name: "三平方の定理の基本と逆", difficultyLevel: 2 },
          { name: "平面図形への利用（特別な直角三角形・座標平面上の距離）", difficultyLevel: 3 },
          { name: "空間図形への利用（対角線・高さ・体積）", difficultyLevel: 5 },
        ],
      },
      {
        name: "標本調査",
        subtopics: [
          { name: "母集団と標本・標本調査の方法", difficultyLevel: 1 },
          { name: "標本調査の活用（母集団の傾向の推測）", difficultyLevel: 2 },
        ],
      },
    ],
  },
  {
    block: "数I",
    subject: "数学",
    chapters: [
      {
        name: "数と式",
        subtopics: [
          { name: "整式の加法・減法・乗法（展開）", difficultyLevel: 1 },
          { name: "因数分解", difficultyLevel: 2 },
          { name: "実数・平方根の計算（絶対値、根号、分母の有理化、二重根号）", difficultyLevel: 2 },
          { name: "1次不等式・連立不等式", difficultyLevel: 2 },
          { name: "絶対値を含む方程式・不等式", difficultyLevel: 3 },
        ],
      },
      {
        name: "集合と命題",
        subtopics: [
          { name: "集合の基本（要素、部分集合、共通部分・和集合、補集合）", difficultyLevel: 1 },
          { name: "ド・モルガンの法則", difficultyLevel: 2 },
          { name: "命題と条件・必要条件と十分条件", difficultyLevel: 2 },
          { name: "命題の逆・裏・対偶", difficultyLevel: 3 },
          { name: "背理法による証明", difficultyLevel: 4 },
        ],
      },
      {
        name: "2次関数",
        subtopics: [
          { name: "関数とグラフの基本（座標平面、平行移動）", difficultyLevel: 1 },
          { name: "2次関数のグラフ（頂点・軸、平方完成）", difficultyLevel: 2 },
          { name: "2次関数の最大・最小（定義域固定）", difficultyLevel: 2 },
          { name: "2次関数の最大・最小（定義域が動く・場合分け）", difficultyLevel: 4 },
          { name: "2次関数の決定（条件から式を求める）", difficultyLevel: 3 },
          { name: "2次方程式（判別式、解の公式）", difficultyLevel: 2 },
          { name: "2次関数のグラフとx軸の位置関係・共有点", difficultyLevel: 3 },
          { name: "2次不等式", difficultyLevel: 3 },
          { name: "2次不等式の応用（文字係数・場合分けを含む問題）", difficultyLevel: 4 },
        ],
      },
      {
        name: "図形と計量（三角比）",
        subtopics: [
          { name: "三角比の定義（sin, cos, tan、鋭角）", difficultyLevel: 1 },
          { name: "三角比の相互関係・余角の公式", difficultyLevel: 2 },
          { name: "三角比の拡張（鈍角、0°〜180°）", difficultyLevel: 2 },
          { name: "三角比を含む方程式・不等式", difficultyLevel: 3 },
          { name: "正弦定理・余弦定理", difficultyLevel: 3 },
          { name: "三角形の面積・内接円の半径", difficultyLevel: 3 },
          { name: "図形の計量の総合問題（円に内接する四角形など）", difficultyLevel: 4 },
          { name: "空間図形への応用（正四面体・直方体などの計量）", difficultyLevel: 5 },
        ],
      },
      {
        name: "データの分析",
        subtopics: [
          { name: "データの整理（度数分布表、代表値：平均値・中央値・最頻値）", difficultyLevel: 1 },
          { name: "四分位数・箱ひげ図・外れ値", difficultyLevel: 2 },
          { name: "分散・標準偏差", difficultyLevel: 2 },
          { name: "散布図・共分散・相関係数", difficultyLevel: 3 },
          { name: "仮説検定の考え方", difficultyLevel: 4 },
        ],
      },
    ],
  },
  {
    block: "数A",
    subject: "数学",
    chapters: [
      {
        name: "場合の数",
        subtopics: [
          { name: "集合の要素の個数（和集合・補集合の個数）", difficultyLevel: 2 },
          { name: "樹形図・辞書式配列と数え上げの基本", difficultyLevel: 1 },
          { name: "積の法則・和の法則", difficultyLevel: 2 },
          { name: "順列（nPr）", difficultyLevel: 2 },
          { name: "円順列・じゅず順列", difficultyLevel: 3 },
          { name: "重複順列", difficultyLevel: 3 },
          { name: "組合せ（nCr）", difficultyLevel: 2 },
          { name: "同じものを含む順列", difficultyLevel: 3 },
          { name: "組分け問題（部屋割り・グループ分け）", difficultyLevel: 4 },
          { name: "二項定理", difficultyLevel: 3 },
        ],
      },
      {
        name: "確率",
        subtopics: [
          { name: "事象と確率の基本（確率の定義・基本性質）", difficultyLevel: 1 },
          { name: "余事象の確率", difficultyLevel: 2 },
          { name: "確率の加法定理（和事象の確率）", difficultyLevel: 2 },
          { name: "独立な試行の確率", difficultyLevel: 3 },
          { name: "反復試行の確率", difficultyLevel: 3 },
          { name: "条件付き確率・乗法定理", difficultyLevel: 4 },
          { name: "期待値", difficultyLevel: 3 },
        ],
      },
      {
        name: "図形の性質（三角形・平面図形の基本性質）",
        subtopics: [
          { name: "三角形の辺と角の大小関係・三角形の成立条件", difficultyLevel: 1 },
          { name: "角の二等分線と線分比（内分・外分）", difficultyLevel: 2 },
          { name: "平行線と線分の比", difficultyLevel: 2 },
          { name: "三角形の五心（外心・内心・重心・垂心・傍心）", difficultyLevel: 3 },
          { name: "メネラウスの定理・チェバの定理", difficultyLevel: 4 },
          { name: "三角形の面積比", difficultyLevel: 3 },
        ],
      },
      {
        name: "円の性質",
        subtopics: [
          { name: "円周角の定理とその逆", difficultyLevel: 2 },
          { name: "円に内接する四角形の性質", difficultyLevel: 3 },
          { name: "接線と弦のなす角（接弦定理）", difficultyLevel: 3 },
          { name: "方べきの定理", difficultyLevel: 3 },
          { name: "2つの円の位置関係・共通接線", difficultyLevel: 4 },
        ],
      },
      {
        name: "作図と空間図形",
        subtopics: [
          { name: "基本の作図（垂直二等分線・角の二等分線・垂線）", difficultyLevel: 1 },
          { name: "発展的な作図（線分の比の作図・平方根の作図）", difficultyLevel: 3 },
          { name: "空間における直線と平面の位置関係", difficultyLevel: 2 },
          { name: "多面体の性質（正多面体・オイラーの多面体定理）", difficultyLevel: 3 },
        ],
      },
      {
        name: "整数の性質",
        subtopics: [
          { name: "約数と倍数・素因数分解", difficultyLevel: 1 },
          { name: "最大公約数・最小公倍数", difficultyLevel: 2 },
          { name: "整数の割り算と余りによる分類", difficultyLevel: 2 },
          { name: "ユークリッドの互除法", difficultyLevel: 3 },
          { name: "一次不定方程式の整数解", difficultyLevel: 4 },
          { name: "n進法（記数法）", difficultyLevel: 3 },
          { name: "分数と小数（有限小数・循環小数、発展的な合同式）", difficultyLevel: 4 },
        ],
      },
      {
        name: "数学と人間の活動（図形の活用・数学と文化）",
        subtopics: [
          { name: "座標の考え方（平面・空間での位置の表し方）", difficultyLevel: 2 },
          { name: "測量への応用（三角測量など）", difficultyLevel: 3 },
          { name: "数学の歴史（数・図形の概念の発展）", difficultyLevel: 1 },
          { name: "パズル・ゲームの中の数学（魔方陣・ハノイの塔・油分け算など）", difficultyLevel: 2 },
        ],
      },
    ],
  },
  {
    block: "数II",
    subject: "数学",
    chapters: [
      {
        name: "式と証明",
        subtopics: [
          { name: "整式の乗法・展開（3次式の展開と因数分解）", difficultyLevel: 2 },
          { name: "二項定理・多項定理", difficultyLevel: 3 },
          { name: "整式の割り算", difficultyLevel: 2 },
          { name: "分数式とその計算", difficultyLevel: 3 },
          { name: "恒等式", difficultyLevel: 2 },
          { name: "等式の証明", difficultyLevel: 3 },
          { name: "不等式の証明（相加平均・相乗平均を含む）", difficultyLevel: 4 },
        ],
      },
      {
        name: "複素数と方程式",
        subtopics: [
          { name: "複素数とその計算", difficultyLevel: 2 },
          { name: "2次方程式の解（判別式・複素数解）", difficultyLevel: 2 },
          { name: "解と係数の関係", difficultyLevel: 3 },
          { name: "剰余の定理・因数定理", difficultyLevel: 3 },
          { name: "高次方程式（組立除法・因数分解による求解）", difficultyLevel: 4 },
        ],
      },
      {
        name: "図形と方程式",
        subtopics: [
          { name: "直線上・平面上の点（内分・外分・距離）", difficultyLevel: 1 },
          { name: "直線の方程式・2直線の関係（平行・垂直）", difficultyLevel: 2 },
          { name: "円の方程式", difficultyLevel: 2 },
          { name: "円と直線の関係（接する・交わる）", difficultyLevel: 3 },
          { name: "2つの円の関係", difficultyLevel: 3 },
          { name: "軌跡と方程式", difficultyLevel: 4 },
          { name: "不等式の表す領域", difficultyLevel: 4 },
        ],
      },
      {
        name: "三角関数",
        subtopics: [
          { name: "一般角と弧度法", difficultyLevel: 1 },
          { name: "三角関数の定義と相互関係", difficultyLevel: 2 },
          { name: "三角関数のグラフ（周期・平行移動・拡大縮小）", difficultyLevel: 3 },
          { name: "三角方程式・不等式", difficultyLevel: 3 },
          { name: "加法定理とその応用（2倍角・半角）", difficultyLevel: 4 },
          { name: "三角関数の合成", difficultyLevel: 4 },
        ],
      },
      {
        name: "指数関数と対数関数",
        subtopics: [
          { name: "指数の拡張（0・負の整数・有理数指数）", difficultyLevel: 2 },
          { name: "指数関数とそのグラフ", difficultyLevel: 2 },
          { name: "対数の定義と性質", difficultyLevel: 2 },
          { name: "対数関数とそのグラフ", difficultyLevel: 3 },
          { name: "常用対数（桁数・小数点位置の判定）", difficultyLevel: 4 },
        ],
      },
      {
        name: "微分法と積分法",
        subtopics: [
          { name: "平均変化率・極限値・微分係数", difficultyLevel: 2 },
          { name: "導関数の計算（多項式の微分）", difficultyLevel: 2 },
          { name: "接線の方程式", difficultyLevel: 3 },
          { name: "関数の増減と極大・極小（3次関数のグラフ）", difficultyLevel: 3 },
          { name: "最大・最小、方程式・不等式への応用", difficultyLevel: 4 },
          { name: "不定積分・定積分の計算", difficultyLevel: 3 },
          { name: "定積分と面積", difficultyLevel: 4 },
        ],
      },
    ],
  },
  {
    block: "数B",
    subject: "数学",
    chapters: [
      {
        name: "数列",
        subtopics: [
          { name: "等差数列（一般項・和）", difficultyLevel: 1 },
          { name: "等比数列（一般項・和）", difficultyLevel: 2 },
          { name: "シグマ記号と和の計算", difficultyLevel: 2 },
          { name: "階差数列・群数列", difficultyLevel: 3 },
          { name: "いろいろな数列の和（部分分数分解・階差利用など）", difficultyLevel: 3 },
          { name: "漸化式（等差型・等比型・基本形）", difficultyLevel: 3 },
          { name: "漸化式（特性方程式・応用形）", difficultyLevel: 4 },
          { name: "数学的帰納法", difficultyLevel: 4 },
        ],
      },
      {
        name: "統計的な推測",
        subtopics: [
          { name: "確率変数と確率分布", difficultyLevel: 2 },
          { name: "確率変数の期待値・分散・標準偏差", difficultyLevel: 3 },
          { name: "確率変数の変換（aX+b）・和と積", difficultyLevel: 3 },
          { name: "二項分布", difficultyLevel: 3 },
          { name: "正規分布・標準化", difficultyLevel: 4 },
          { name: "母集団と標本・標本平均の分布", difficultyLevel: 3 },
          { name: "推定（区間推定）", difficultyLevel: 4 },
          { name: "仮説検定", difficultyLevel: 4 },
        ],
      },
      {
        name: "数学と社会生活",
        subtopics: [
          { name: "数学的な問題解決の手順（数理モデル化）", difficultyLevel: 2 },
          { name: "社会の中の数学（議席配分方式・偏差値・3σ法・調整平均・移動平均・鳩ノ巣原理・音律など）", difficultyLevel: 2 },
          { name: "回帰分析（散布図・回帰直線・最小二乗法）", difficultyLevel: 3 },
        ],
      },
    ],
  },
  {
    block: "数III",
    subject: "数学",
    chapters: [
      {
        name: "関数",
        subtopics: [
          { name: "分数関数", difficultyLevel: 2 },
          { name: "無理関数", difficultyLevel: 2 },
          { name: "逆関数・合成関数", difficultyLevel: 3 },
        ],
      },
      {
        name: "極限",
        subtopics: [
          { name: "数列の極限（基本・極限の性質）", difficultyLevel: 2 },
          { name: "無限等比数列", difficultyLevel: 2 },
          { name: "漸化式と極限・はさみうちの原理", difficultyLevel: 4 },
          { name: "無限級数・無限等比級数", difficultyLevel: 3 },
          { name: "関数の極限（基本・片側極限）", difficultyLevel: 2 },
          { name: "三角関数の極限（sin x / x の極限）", difficultyLevel: 3 },
          { name: "関数の連続性・中間値の定理", difficultyLevel: 3 },
        ],
      },
      {
        name: "微分法",
        subtopics: [
          { name: "微分係数と導関数の定義", difficultyLevel: 2 },
          { name: "積・商の導関数", difficultyLevel: 2 },
          { name: "合成関数の導関数", difficultyLevel: 3 },
          { name: "三角関数の導関数", difficultyLevel: 3 },
          { name: "指数関数・対数関数の導関数（対数微分法を含む）", difficultyLevel: 3 },
          { name: "逆関数の微分法", difficultyLevel: 4 },
          { name: "媒介変数表示・陰関数の微分法", difficultyLevel: 4 },
          { name: "第n次導関数", difficultyLevel: 3 },
        ],
      },
      {
        name: "微分法の応用",
        subtopics: [
          { name: "接線・法線の方程式", difficultyLevel: 3 },
          { name: "平均値の定理", difficultyLevel: 4 },
          { name: "関数の増減・極値", difficultyLevel: 3 },
          { name: "グラフの凹凸・変曲点とグラフの概形", difficultyLevel: 4 },
          { name: "最大・最小の応用（図形量の最大最小など）", difficultyLevel: 4 },
          { name: "方程式・不等式への応用（実数解の個数、不等式の証明）", difficultyLevel: 5 },
          { name: "速度・加速度（直線運動・平面運動）", difficultyLevel: 4 },
          { name: "近似式", difficultyLevel: 3 },
        ],
      },
      {
        name: "積分法とその応用",
        subtopics: [
          { name: "基本関数の不定積分（べき関数・三角関数・指数関数）", difficultyLevel: 2 },
          { name: "置換積分法", difficultyLevel: 3 },
          { name: "部分積分法", difficultyLevel: 3 },
          { name: "いろいろな関数の積分（分数関数・三角関数の積・べき乗など）", difficultyLevel: 4 },
          { name: "定積分の基本計算・定積分と面積", difficultyLevel: 2 },
          { name: "定積分の置換積分法・部分積分法", difficultyLevel: 3 },
          { name: "偶関数・奇関数の定積分、周期性を用いた定積分", difficultyLevel: 3 },
          { name: "定積分で表された関数（微分方程式的な扱いを含む）", difficultyLevel: 4 },
          { name: "区分求積法・定積分と不等式・極限との融合", difficultyLevel: 5 },
          { name: "面積の計算（曲線・パラメータ表示・極方程式を含む場合）", difficultyLevel: 4 },
          { name: "体積の計算（回転体・非回転体の断面積利用）", difficultyLevel: 5 },
          { name: "曲線の長さ・速度と道のり", difficultyLevel: 4 },
        ],
      },
    ],
  },
  {
    block: "数C",
    subject: "数学",
    chapters: [
      {
        name: "平面上のベクトル",
        subtopics: [
          { name: "ベクトルの意味・和差・実数倍", difficultyLevel: 1 },
          { name: "ベクトルの成分表示・分解", difficultyLevel: 2 },
          { name: "ベクトルの内積（定義・成分計算・なす角）", difficultyLevel: 2 },
          { name: "内積の性質・平行と垂直の判定・三角形の面積", difficultyLevel: 3 },
          { name: "位置ベクトル（分点・重心・共線条件）", difficultyLevel: 3 },
          { name: "ベクトル方程式（直線・円）と点の存在範囲", difficultyLevel: 4 },
        ],
      },
      {
        name: "空間のベクトル",
        subtopics: [
          { name: "空間座標の基本（対称点・2点間の距離）", difficultyLevel: 1 },
          { name: "空間ベクトルの成分・演算・内積", difficultyLevel: 2 },
          { name: "空間における位置ベクトル（分点・重心・共線条件）", difficultyLevel: 3 },
          { name: "空間ベクトルの図形への応用（共面条件・交点・体積比）", difficultyLevel: 4 },
          { name: "座標空間における直線・平面・球面の方程式", difficultyLevel: 5 },
        ],
      },
      {
        name: "複素数平面",
        subtopics: [
          { name: "複素数の図示・絶対値・共役複素数の性質", difficultyLevel: 1 },
          { name: "複素数の和差・実数倍と図形的な意味", difficultyLevel: 2 },
          { name: "複素数の極形式・積と商（絶対値と偏角）", difficultyLevel: 3 },
          { name: "原点・点を中心とする回転と図形への応用", difficultyLevel: 3 },
          { name: "ド・モアブルの定理", difficultyLevel: 4 },
          { name: "1のn乗根・複素数のn乗根", difficultyLevel: 5 },
          { name: "複素数平面と図形（軌跡・角の関係など発展）", difficultyLevel: 5 },
        ],
      },
      {
        name: "式と曲線",
        subtopics: [
          { name: "放物線・楕円の定義と方程式・基本性質", difficultyLevel: 2 },
          { name: "双曲線の定義と方程式・基本性質", difficultyLevel: 3 },
          { name: "2次曲線の平行移動・離心率と準線", difficultyLevel: 4 },
          { name: "2次曲線と直線の共有点・接線", difficultyLevel: 4 },
          { name: "曲線の媒介変数表示", difficultyLevel: 3 },
          { name: "極座標と極方程式（直線・円）", difficultyLevel: 4 },
          { name: "2次曲線の極方程式", difficultyLevel: 5 },
        ],
      },
    ],
  },
];
