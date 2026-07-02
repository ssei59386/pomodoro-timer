/**
 * 中学1年理科 単元・小項目構成
 * 学習指導要領、東京書籍・啓林館・実教出版の教科書を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 身近な現象の観察・分類など、直感的に理解しやすい内容
 * 2: 基本的な概念（例：光の屈折、力の定義）で理解が必要だが難度は低い
 * 3(中): 小学校内容からの拡張、計算や実験が必要な標準的内容
 * 4: 抽象度が高い、深い理解が必要な内容（高学年向け予習など）
 * 5(難): 定量的な扱い、複数の概念の統合が必要な応用内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceCh1: CurriculumBlockData = {
  block: "中1",
  subject: "理科",
  chapters: [
    {
      name: "植物の生活と種類",
      subtopics: [
        { name: "身近な植物の観察", difficultyLevel: 1 },
        { name: "種子植物と非種子植物", difficultyLevel: 2 },
        { name: "花のつくりとはたらき", difficultyLevel: 2 },
        { name: "花の色・香り・受粉", difficultyLevel: 2 },
        { name: "実と種子", difficultyLevel: 1 },
        { name: "葉・茎・根のつくりとはたらき", difficultyLevel: 2 },
        { name: "光合成", difficultyLevel: 3 },
        { name: "光合成と酸素・でんぷんの生成", difficultyLevel: 3 },
        { name: "植物の呼吸と蒸散", difficultyLevel: 3 },
        { name: "野菜・果物の生育", difficultyLevel: 2 },
        { name: "被子植物（双子葉・単子葉）の分類", difficultyLevel: 2 },
        { name: "裸子植物の特徴", difficultyLevel: 2 },
        { name: "シダ植物・コケ植物", difficultyLevel: 2 }
      ]
    },
    {
      name: "身のまわりの物質",
      subtopics: [
        { name: "物質の性質", difficultyLevel: 1 },
        { name: "密度（質量と体積の関係）", difficultyLevel: 2 },
        { name: "溶解と溶解度", difficultyLevel: 2 },
        { name: "水溶液の濃度", difficultyLevel: 2 },
        { name: "気体の体積・圧力・温度", difficultyLevel: 2 },
        { name: "酸素・二酸化炭素・窒素の性質と収集", difficultyLevel: 2 },
        { name: "物質の状態変化（融解・凝固・蒸発・凝縮）", difficultyLevel: 2 },
        { name: "温度と状態変化の関係", difficultyLevel: 2 },
        { name: "混合物と純粋物質", difficultyLevel: 2 },
        { name: "蒸留・分別蒸留による物質の分離", difficultyLevel: 3 },
        { name: "再結晶化による物質の分離", difficultyLevel: 3 }
      ]
    },
    {
      name: "身近な物理現象",
      subtopics: [
        { name: "光の直進", difficultyLevel: 1 },
        { name: "光の反射の法則", difficultyLevel: 2 },
        { name: "光の屈折", difficultyLevel: 2 },
        { name: "鏡による像（平面鏡・曲面鏡）", difficultyLevel: 2 },
        { name: "凸レンズ・凹レンズの性質", difficultyLevel: 2 },
        { name: "凸レンズによる像の形成", difficultyLevel: 3 },
        { name: "眼球と視覚の仕組み", difficultyLevel: 2 },
        { name: "音の振動と波", difficultyLevel: 2 },
        { name: "音の速さと周波数", difficultyLevel: 2 },
        { name: "音の大きさ・高さ・音色", difficultyLevel: 2 },
        { name: "音の反射（エコー）", difficultyLevel: 2 },
        { name: "力とその種類（重力・張力・摩擦力）", difficultyLevel: 2 },
        { name: "力の合成・分解", difficultyLevel: 3 },
        { name: "圧力（圧力 = 力 ÷ 面積）", difficultyLevel: 2 },
        { name: "液体・気体の圧力", difficultyLevel: 2 }
      ]
    },
    {
      name: "大地の変化",
      subtopics: [
        { name: "岩石と鉱物の観察", difficultyLevel: 1 },
        { name: "火成岩の分類（火山岩・深成岩）", difficultyLevel: 2 },
        { name: "火山噴火と火成岩の生成", difficultyLevel: 2 },
        { name: "火山の形と噴出物", difficultyLevel: 2 },
        { name: "地震の原因と震源・震央", difficultyLevel: 2 },
        { name: "地震波（P波・S波）と震度", difficultyLevel: 2 },
        { name: "地震計と地震の記録", difficultyLevel: 2 },
        { name: "大陸と海洋プレートの関係", difficultyLevel: 3 },
        { name: "地層の観察と堆積作用", difficultyLevel: 1 },
        { name: "地層の層理と斜交層理", difficultyLevel: 2 },
        { name: "化石と地層の年代決定", difficultyLevel: 2 },
        { name: "相対年代と絶対年代", difficultyLevel: 3 },
        { name: "示準化石と示相化石", difficultyLevel: 2 },
        { name: "地盤沈下と地下水の関係", difficultyLevel: 2 }
      ]
    }
  ]
}
