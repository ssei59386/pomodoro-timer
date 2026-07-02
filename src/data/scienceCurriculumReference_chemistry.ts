/**
 * 高校「化学」（化学基礎の発展科目） 単元・小項目構成
 * 学習指導要領（文部科学省、物質の状態と平衡／物質の変化と平衡／無機物質の性質／
 * 有機化合物の性質／化学が果たす役割の5領域構成）、数研出版・東京書籍の教科書目次、
 * および Try IT・iiドリル問題集・化学のグルメなど定期テスト対策サイトの単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 用語の定義や分類の暗記、直感的に理解できる内容
 * 2: 基本的な公式・ルールを1つ適用すれば解ける、素直な計算・判定問題が中心の内容
 * 3(中): 複数の概念を組み合わせる必要がある、標準的な計算・構造決定・図示問題
 * 4: 複数分野の知識を統合する必要がある、または計算過程が長い・条件設定が複雑な内容
 * 5(難): 抽象度が高い、定性的理解と定量的計算の両方が高度に要求される応用内容（大学入試最難関レベル）
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceChemistry: CurriculumBlockData = {
  block: "化学",
  subject: "理科",
  chapters: [
    {
      name: "物質の状態と平衡",
      subtopics: [
        { name: "粒子間の結合と結晶格子（結晶格子の種類と単位格子の計算）", difficultyLevel: 4 },
        { name: "気体の分子運動と圧力・絶対温度の関係", difficultyLevel: 2 },
        { name: "ボイル・シャルルの法則と気体の状態方程式", difficultyLevel: 3 },
        { name: "混合気体の分圧計算（分圧の法則）", difficultyLevel: 4 },
        { name: "実在気体と理想気体のずれ", difficultyLevel: 4 },
        { name: "蒸気圧と気液平衡", difficultyLevel: 4 },
        { name: "溶解とそのしくみ、固体・気体の溶解度", difficultyLevel: 2 },
        { name: "希薄溶液の性質（蒸気圧降下・沸点上昇・凝固点降下）の計算", difficultyLevel: 4 },
        { name: "浸透圧の計算", difficultyLevel: 4 },
        { name: "コロイド溶液の性質（チンダル現象・ブラウン運動・透析・電気泳動）", difficultyLevel: 2 }
      ]
    },
    {
      name: "物質の変化と平衡",
      subtopics: [
        { name: "反応熱の種類（生成熱・燃焼熱・中和熱・溶解熱）", difficultyLevel: 2 },
        { name: "熱化学方程式とヘスの法則による計算", difficultyLevel: 3 },
        { name: "結合エネルギーと反応熱の関係", difficultyLevel: 4 },
        { name: "化学反応と光（光化学反応の基礎）", difficultyLevel: 2 },
        { name: "反応速度の定義と濃度・温度・触媒による変化", difficultyLevel: 3 },
        { name: "反応速度式とアレニウスの式の考え方", difficultyLevel: 5 },
        { name: "可逆反応と化学平衡の状態", difficultyLevel: 3 },
        { name: "平衡定数の計算（濃度平衡定数）", difficultyLevel: 4 },
        { name: "ルシャトリエの原理（平衡移動の予測）", difficultyLevel: 4 },
        { name: "電離平衡と電離定数、緩衝液のpH計算", difficultyLevel: 5 },
        { name: "溶解度積と沈殿生成の判定", difficultyLevel: 5 }
      ]
    },
    {
      name: "無機物質の性質",
      subtopics: [
        { name: "周期表と元素の分類（典型元素・遷移元素の性質の違い）", difficultyLevel: 2 },
        { name: "非金属元素（水素・希ガス）の性質", difficultyLevel: 1 },
        { name: "ハロゲンの性質と化合物の反応", difficultyLevel: 3 },
        { name: "酸素・硫黄とその化合物（硫酸の製法など）", difficultyLevel: 3 },
        { name: "窒素・リンとその化合物（アンモニア・硝酸の製法）", difficultyLevel: 3 },
        { name: "炭素・ケイ素とその化合物", difficultyLevel: 2 },
        { name: "気体の発生方法と捕集法・性質の整理", difficultyLevel: 3 },
        { name: "アルカリ金属・アルカリ土類金属の性質と化合物", difficultyLevel: 2 },
        { name: "アルミニウム・亜鉛・スズ・鉛など両性金属の性質", difficultyLevel: 3 },
        { name: "遷移元素の特徴（複数の酸化数・錯イオン・触媒作用）", difficultyLevel: 3 },
        { name: "鉄・銅・銀とその化合物の性質・製錬", difficultyLevel: 3 },
        { name: "金属イオンの分離・系統分析（沈殿反応による分属）", difficultyLevel: 5 },
        { name: "無機物質の工業的製法（アンモニアソーダ法・接触法など）", difficultyLevel: 4 }
      ]
    },
    {
      name: "有機化合物の性質（脂肪族・芳香族）",
      subtopics: [
        { name: "有機化合物の分類と特徴、元素分析による組成式決定", difficultyLevel: 3 },
        { name: "異性体の種類（構造異性体・立体異性体）の判定", difficultyLevel: 4 },
        { name: "アルカン・アルケン・アルキンの構造と反応（置換・付加反応）", difficultyLevel: 3 },
        { name: "アルコール・エーテルの性質と反応", difficultyLevel: 3 },
        { name: "アルデヒド・ケトンの性質と検出反応（銀鏡反応など）", difficultyLevel: 3 },
        { name: "カルボン酸・エステルの性質と反応（けん化・エステル化）", difficultyLevel: 3 },
        { name: "油脂とセッケン・合成洗剤の性質", difficultyLevel: 2 },
        { name: "芳香族炭化水素（ベンゼンの構造と置換反応）", difficultyLevel: 3 },
        { name: "フェノール類の性質と反応", difficultyLevel: 3 },
        { name: "芳香族カルボン酸・芳香族アミンの性質と反応", difficultyLevel: 4 },
        { name: "有機化合物の分離（酸・塩基の強さを利用した抽出操作）", difficultyLevel: 5 },
        { name: "構造決定問題（複数の実験事実からの分子構造の推定）", difficultyLevel: 5 }
      ]
    },
    {
      name: "高分子化合物",
      subtopics: [
        { name: "高分子化合物の分類と重合の種類（付加重合・縮合重合・開環重合）", difficultyLevel: 3 },
        { name: "糖類（単糖・二糖・多糖）の構造と性質", difficultyLevel: 3 },
        { name: "アミノ酸とタンパク質の構造・性質（等電点、呈色反応）", difficultyLevel: 4 },
        { name: "酵素のはたらきと核酸（DNA・RNA）の構造", difficultyLevel: 3 },
        { name: "合成繊維（ナイロン・ポリエステルなど）の構造と製法", difficultyLevel: 3 },
        { name: "合成樹脂（熱可塑性・熱硬化性樹脂）の構造と用途", difficultyLevel: 3 },
        { name: "ゴム（天然ゴム・合成ゴム）の構造と性質", difficultyLevel: 3 },
        { name: "高分子化合物の平均分子量・重合度の計算", difficultyLevel: 4 }
      ]
    }
  ]
}
