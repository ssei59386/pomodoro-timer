/**
 * 中学2年理科 単元・小項目構成
 * 学習指導要領、東京書籍・啓林館・教育出版の教科書を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 身近な現象の観察、基本用語の暗記など直感的に理解しやすい内容
 * 2: 基本的な概念や法則で理解が必要だが難度は低い
 * 3(中): 化学反応式・計算・複数の概念の統合が必要な標準的内容
 * 4: 抽象度が高い、定量的な計算や複雑な法則が必要な内容
 * 5(難): 高度な理論的理解・複数分野の統合が必要な応用内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceCh2: CurriculumBlockData = {
  block: "中2",
  subject: "理科",
  chapters: [
    {
      name: "化学変化と原子・分子",
      subtopics: [
        { name: "物質の成り立ち（原子・分子・元素）", difficultyLevel: 2 },
        { name: "元素と化合物", difficultyLevel: 2 },
        { name: "化学式の表し方", difficultyLevel: 2 },
        { name: "化学反応式", difficultyLevel: 3 },
        { name: "化学変化の種類（化合・分解）", difficultyLevel: 2 },
        { name: "燃焼（酸化）", difficultyLevel: 2 },
        { name: "酸化と還元", difficultyLevel: 3 },
        { name: "化学変化と質量の関係（質量保存則）", difficultyLevel: 3 },
        { name: "化学変化と熱の出入り（発熱・吸熱反応）", difficultyLevel: 2 },
        { name: "化学反応式のバランシング", difficultyLevel: 3 }
      ]
    },
    {
      name: "動物の生活と生物の進化",
      subtopics: [
        { name: "細胞のつくりと働き（核・ミトコンドリア）", difficultyLevel: 2 },
        { name: "動物細胞と植物細胞の違い", difficultyLevel: 2 },
        { name: "顕微鏡による細胞観察", difficultyLevel: 2 },
        { name: "消化と消化酵素（炭水化物・タンパク質・脂肪）", difficultyLevel: 2 },
        { name: "消化の過程（口・胃・小腸・大腸）", difficultyLevel: 2 },
        { name: "栄養素の吸収と利用", difficultyLevel: 2 },
        { name: "呼吸（有気呼吸・無気呼吸）", difficultyLevel: 2 },
        { name: "肺と呼吸の仕組み", difficultyLevel: 2 },
        { name: "血液循環（心臓・動脈・静脈）", difficultyLevel: 2 },
        { name: "肺循環と体循環", difficultyLevel: 2 },
        { name: "血液の成分と役割", difficultyLevel: 2 },
        { name: "排出（汗・尿・呼吸）", difficultyLevel: 2 },
        { name: "腎臓と泌尿器系", difficultyLevel: 2 },
        { name: "神経と刺激への反応", difficultyLevel: 2 },
        { name: "脳・脊髄・末梢神経", difficultyLevel: 2 },
        { name: "感覚器官と刺激受容（眼・耳・鼻・舌・皮膚）", difficultyLevel: 2 },
        { name: "脊髄反射とホルモン調節", difficultyLevel: 3 },
        { name: "骨格と筋肉", difficultyLevel: 2 },
        { name: "動物のなかま分け（哺乳類・鳥類・爬虫類・両生類・魚類）", difficultyLevel: 2 },
        { name: "進化の概要と証拠（化石・相同器官）", difficultyLevel: 3 }
      ]
    },
    {
      name: "電流とその利用",
      subtopics: [
        { name: "静電気（帯電・電荷）", difficultyLevel: 1 },
        { name: "電子と電流の方向", difficultyLevel: 2 },
        { name: "電圧と電流の関係", difficultyLevel: 2 },
        { name: "回路図の読み書き（直列・並列）", difficultyLevel: 2 },
        { name: "直列回路と並列回路の電流・電圧", difficultyLevel: 2 },
        { name: "抵抗と電気抵抗", difficultyLevel: 2 },
        { name: "オームの法則（V = IR）", difficultyLevel: 3 },
        { name: "電力と電力量", difficultyLevel: 3 },
        { name: "電熱（ジュール熱）", difficultyLevel: 3 },
        { name: "磁石と磁界", difficultyLevel: 1 },
        { name: "磁力線と磁界の表現", difficultyLevel: 2 },
        { name: "直線電流がつくる磁界（右ねじの法則）", difficultyLevel: 3 },
        { name: "コイルがつくる磁界", difficultyLevel: 3 },
        { name: "電流計・電圧計の使い方", difficultyLevel: 2 },
        { name: "電子の流れと回路の性質", difficultyLevel: 2 }
      ]
    },
    {
      name: "気象とその変化",
      subtopics: [
        { name: "大気の成分と性質", difficultyLevel: 1 },
        { name: "気温測定と気温の変化", difficultyLevel: 1 },
        { name: "気圧と気圧計（水銀気圧計）", difficultyLevel: 2 },
        { name: "気圧と天気の関係", difficultyLevel: 2 },
        { name: "風の発生（気圧差と風）", difficultyLevel: 2 },
        { name: "水蒸気と飽和水蒸気量", difficultyLevel: 2 },
        { name: "湿度（相対湿度の計算）", difficultyLevel: 2 },
        { name: "露点と凝結", difficultyLevel: 2 },
        { name: "雲の生成メカニズム", difficultyLevel: 2 },
        { name: "雲の種類（積雲・層雲・高積雲など）", difficultyLevel: 2 },
        { name: "降水（雨・雪）の生成", difficultyLevel: 2 },
        { name: "気象観測器の使用法", difficultyLevel: 2 },
        { name: "前線（寒冷前線・温暖前線・停滞前線）", difficultyLevel: 3 },
        { name: "前線通過と天気の変化", difficultyLevel: 2 },
        { name: "低気圧と高気圧", difficultyLevel: 2 },
        { name: "日本の気象（季節風・梅雨・台風）", difficultyLevel: 2 },
        { name: "天気図の読み方", difficultyLevel: 3 }
      ]
    }
  ]
}
