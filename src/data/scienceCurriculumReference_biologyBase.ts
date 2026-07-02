/**
 * 高校「生物基礎」 単元・小項目構成
 * 学習指導要領（文部科学省、生物の特徴／遺伝子とその働き／生物の体内環境の維持／
 * 生物の多様性と生態系の4領域構成）、東京書籍（改訂 生物基礎）・実教出版の教科書目次、
 * および Try IT・ベネッセ定期テスト対策サイト・iiドリル問題集の単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 用語の定義や分類の暗記、直感的に理解できる内容（例：単体と化合物の区別に相当する生物用語の整理）
 * 2: 基本的なしくみを1つ理解すれば説明できる、素直な暗記・図の読み取り問題が中心の内容
 * 3(中): 複数の概念やプロセスを組み合わせて理解する必要がある、標準的な計算・図表読解問題（例：グラフからの計算、実験考察）
 * 4: 複数分野の知識を統合する必要がある、または反応の流れ・調節機構が多段階で複雑な内容
 * 5(難): 抽象度が高い、定性的理解と定量的な考察・計算の両方が高度に要求される応用内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceBiologyBase: CurriculumBlockData = {
  block: "生物基礎",
  subject: "理科",
  chapters: [
    {
      name: "生物の特徴",
      subtopics: [
        { name: "生物の多様性と共通性（生物の定義、細胞説の歴史）", difficultyLevel: 1 },
        { name: "原核細胞と真核細胞の構造の違い", difficultyLevel: 2 },
        { name: "細胞小器官のはたらき（核・ミトコンドリア・葉緑体・細胞膜など）", difficultyLevel: 2 },
        { name: "顕微鏡観察と検鏡倍率・ミクロメーターによる長さの計算", difficultyLevel: 3 },
        { name: "代謝の分類（同化・異化）とATPの役割", difficultyLevel: 2 },
        { name: "酵素のはたらきと性質（基質特異性・最適温度・pH）", difficultyLevel: 3 },
        { name: "呼吸のしくみと過程の概要（解糖系・クエン酸回路・電子伝達系）", difficultyLevel: 4 },
        { name: "光合成のしくみと過程の概要（光合成色素、光化学反応と炭酸同化）", difficultyLevel: 4 }
      ]
    },
    {
      name: "遺伝子とその働き",
      subtopics: [
        { name: "DNAの構造（ヌクレオチド、二重らせん構造、塩基の相補性）", difficultyLevel: 2 },
        { name: "DNAの発見史（グリフィス・エイブリー・ハーシーとチェイスの実験）", difficultyLevel: 2 },
        { name: "染色体・遺伝子・ゲノムの関係と体細胞分裂による分配", difficultyLevel: 2 },
        { name: "DNAの複製のしくみ（半保存的複製とメセルソン・スタールの実験）", difficultyLevel: 3 },
        { name: "細胞周期と体細胞分裂の各時期の特徴", difficultyLevel: 2 },
        { name: "遺伝情報の転写と翻訳のしくみ（セントラルドグマ、コドン表）", difficultyLevel: 4 },
        { name: "遺伝子発現の調節と細胞の分化（だ腺染色体のパフなど）", difficultyLevel: 4 },
        { name: "ゲノムの構造とバイオテクノロジーの基礎（DNA型鑑定など）", difficultyLevel: 3 }
      ]
    },
    {
      name: "生物の体内環境の維持",
      subtopics: [
        { name: "体内環境（内部環境）と恒常性（ホメオスタシス）の概念", difficultyLevel: 1 },
        { name: "体液の種類と循環系のしくみ（血液・組織液・リンパ液）", difficultyLevel: 2 },
        { name: "心臓の拍動と血液循環の調節（自律神経による調節）", difficultyLevel: 3 },
        { name: "腎臓のはたらきと尿生成のしくみ（ろ過・再吸収の計算）", difficultyLevel: 4 },
        { name: "肝臓のはたらき（代謝・解毒・血糖調節への関与）", difficultyLevel: 2 },
        { name: "自律神経系による調節（交感神経・副交感神経の対比）", difficultyLevel: 3 },
        { name: "内分泌系とホルモンによる調節、フィードバック調節のしくみ", difficultyLevel: 4 },
        { name: "血糖濃度の調節（インスリン・グルカゴンなどのホルモン連携）", difficultyLevel: 4 },
        { name: "体温調節のしくみ", difficultyLevel: 3 },
        { name: "自然免疫のしくみ（食作用・炎症反応・NK細胞）", difficultyLevel: 3 },
        { name: "獲得免疫のしくみ（体液性免疫・細胞性免疫、抗原抗体反応）", difficultyLevel: 4 },
        { name: "免疫の応用（予防接種・血清療法・アレルギー・自己免疫疾患・エイズ）", difficultyLevel: 3 }
      ]
    },
    {
      name: "生物の多様性と生態系",
      subtopics: [
        { name: "植生の構造と相観、優占種・階層構造", difficultyLevel: 1 },
        { name: "植生の遷移のしくみ（一次遷移・二次遷移の違いと進行過程）", difficultyLevel: 3 },
        { name: "気候とバイオームの対応関係（年平均気温・年降水量との関係）", difficultyLevel: 3 },
        { name: "世界と日本のバイオームの分布（水平分布・垂直分布）", difficultyLevel: 3 },
        { name: "生態系の構成要素（生産者・消費者・分解者と物質循環）", difficultyLevel: 2 },
        { name: "食物連鎖・食物網と生態ピラミッド", difficultyLevel: 2 },
        { name: "生態系のバランスと復元力、攪乱の影響", difficultyLevel: 3 },
        { name: "生物多様性の3つのレベル（遺伝的・種・生態系）", difficultyLevel: 2 },
        { name: "人間活動による生態系への影響と保全（外来生物・地球温暖化・富栄養化など）", difficultyLevel: 3 }
      ]
    }
  ]
}
