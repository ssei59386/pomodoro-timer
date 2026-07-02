/**
 * 高校「化学基礎」 単元・小項目構成
 * 学習指導要領（文部科学省）、実教出版「高校化学基礎 新訂版」目次、
 * 数研出版・東京書籍の教科書構成、および Try IT・ベネッセ定期テスト対策サイト・
 * iiドリル問題集の単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 用語の定義や分類の暗記、直感的に理解できる内容（例：物質の三態、単体と化合物の区別）
 * 2: 基本的な公式・ルールを1つ適用すれば解ける、素直な計算・判定問題が中心の内容
 * 3(中): 複数の概念を組み合わせる必要がある、標準的な計算・構造判断問題（例：モル計算の複合、中和滴定）
 * 4: 複数分野の知識を統合する必要がある、または計算過程が長い・条件設定が複雑な内容
 * 5(難): 抽象度が高い、定性的理解と定量的計算の両方が高度に要求される応用内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceChemistryBase: CurriculumBlockData = {
  block: "化学基礎",
  subject: "理科",
  chapters: [
    {
      name: "化学と人間生活",
      subtopics: [
        { name: "化学の特徴と身の回りの化学製品", difficultyLevel: 1 },
        { name: "物質の分離・精製（ろ過・蒸留・再結晶・クロマトグラフィーなど）", difficultyLevel: 2 },
        { name: "単体と化合物、混合物の区別", difficultyLevel: 1 },
        { name: "元素の確認（炎色反応、沈殿反応）", difficultyLevel: 2 },
        { name: "物質の三態と熱運動、状態変化と熱エネルギー", difficultyLevel: 2 }
      ]
    },
    {
      name: "物質の構成",
      subtopics: [
        { name: "原子の構造（陽子・中性子・電子、原子番号・質量数）", difficultyLevel: 1 },
        { name: "同位体と放射性同位体", difficultyLevel: 2 },
        { name: "電子配置と価電子", difficultyLevel: 2 },
        { name: "周期表としくみ（族・周期、周期的性質）", difficultyLevel: 2 },
        { name: "イオンの生成とイオン化エネルギー・電子親和力", difficultyLevel: 3 },
        { name: "イオン結合とイオン結晶の性質", difficultyLevel: 2 },
        { name: "共有結合と分子の構造（電子式・構造式）", difficultyLevel: 3 },
        { name: "分子の極性と分子間力（水素結合・ファンデルワールス力）", difficultyLevel: 3 },
        { name: "金属結合と金属の性質", difficultyLevel: 1 },
        { name: "化学結合と結晶の分類（イオン結晶・共有結合結晶・分子結晶・金属結晶の比較）", difficultyLevel: 3 }
      ]
    },
    {
      name: "物質量と化学反応式",
      subtopics: [
        { name: "原子量・分子量・式量", difficultyLevel: 2 },
        { name: "物質量（mol）とアボガドロ数", difficultyLevel: 2 },
        { name: "モル質量・気体のモル体積の計算", difficultyLevel: 3 },
        { name: "溶液の濃度（質量パーセント濃度・モル濃度）", difficultyLevel: 3 },
        { name: "化学反応式の作成と量的関係の計算", difficultyLevel: 3 },
        { name: "化学反応式を用いた複合計算（過不足・収率など）", difficultyLevel: 4 }
      ]
    },
    {
      name: "酸と塩基の反応",
      subtopics: [
        { name: "酸・塩基の定義（アレニウス・ブレンステッド）と価数", difficultyLevel: 2 },
        { name: "酸・塩基の強弱と電離度", difficultyLevel: 2 },
        { name: "水素イオン濃度とpHの計算", difficultyLevel: 3 },
        { name: "中和反応と塩の生成・分類（正塩・酸性塩・塩基性塩）", difficultyLevel: 2 },
        { name: "中和滴定の計算と滴定曲線の読み取り", difficultyLevel: 4 },
        { name: "中和滴定の実験操作（器具の使い方・指示薬の選択）", difficultyLevel: 3 }
      ]
    },
    {
      name: "酸化還元反応",
      subtopics: [
        { name: "酸化・還元の定義（酸素・水素・電子の授受）", difficultyLevel: 2 },
        { name: "酸化数の決定と変化の追跡", difficultyLevel: 3 },
        { name: "酸化剤・還元剤の反応式とはたらき", difficultyLevel: 3 },
        { name: "酸化還元滴定の量的計算", difficultyLevel: 4 },
        { name: "金属のイオン化傾向と反応性の予測", difficultyLevel: 2 },
        { name: "電池のしくみ（ダニエル電池・鉛蓄電池など）", difficultyLevel: 3 },
        { name: "電気分解の原理と量的計算（電気量・析出量）", difficultyLevel: 4 }
      ]
    }
  ]
}
