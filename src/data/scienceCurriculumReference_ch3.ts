/**
 * 中学3年理科 単元・小項目構成
 * 学習指導要領、東京書籍・啓林館・教育出版の教科書を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 身近な現象の観察や基本用語の暗記など直感的に理解しやすい内容
 * 2: 基本的な概念や法則で理解が必要だが難度は低い
 * 3(中): 複数の概念の統合、計算や数式が必要な標準的内容
 * 4: 抽象度が高い、複雑な理論や定量的計算が必要な内容
 * 5(難): 高度な物理・化学理論、複数分野の深い統合が必要な応用内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceCh3: CurriculumBlockData = {
  block: "中3",
  subject: "理科",
  chapters: [
    {
      name: "化学変化とイオン",
      subtopics: [
        { name: "原子の成り立ち（陽子・中性子・電子）", difficultyLevel: 2 },
        { name: "イオンの形成（電子の授受）", difficultyLevel: 2 },
        { name: "イオンのなかま分け（陽イオン・陰イオン）", difficultyLevel: 2 },
        { name: "イオン式の表記", difficultyLevel: 2 },
        { name: "水溶液の電気伝導性", difficultyLevel: 2 },
        { name: "酸・塩基の性質（pH・中性度）", difficultyLevel: 2 },
        { name: "酸と塩基の中和反応", difficultyLevel: 3 },
        { name: "中和反応の化学式", difficultyLevel: 3 },
        { name: "電気分解（水・塩化銅・食塩水）", difficultyLevel: 3 },
        { name: "電気分解における化学変化", difficultyLevel: 3 },
        { name: "化学電池の仕組み", difficultyLevel: 3 },
        { name: "ボルタ電池・ダニエル電池", difficultyLevel: 3 },
        { name: "電池の正極・負極・起電力", difficultyLevel: 3 },
        { name: "燃料電池", difficultyLevel: 4 }
      ]
    },
    {
      name: "生命の連続性",
      subtopics: [
        { name: "有性生殖と無性生殖", difficultyLevel: 2 },
        { name: "減数分裂と受精", difficultyLevel: 3 },
        { name: "体細胞分裂と減数分裂の違い", difficultyLevel: 3 },
        { name: "形質と遺伝子", difficultyLevel: 2 },
        { name: "対立形質", difficultyLevel: 2 },
        { name: "DNAと遺伝子", difficultyLevel: 2 },
        { name: "メンデルの法則（分離の法則）", difficultyLevel: 3 },
        { name: "優性形質と劣性形質", difficultyLevel: 2 },
        { name: "遺伝子の組み合わせ（純系・雑種）", difficultyLevel: 3 },
        { name: "遺伝の規則性と予測", difficultyLevel: 3 },
        { name: "染色体と遺伝", difficultyLevel: 3 },
        { name: "遺伝的多様性と進化", difficultyLevel: 3 },
        { name: "進化の証拠（化石・相同器官）", difficultyLevel: 3 },
        { name: "自然選択説（ダーウィン）", difficultyLevel: 4 }
      ]
    },
    {
      name: "運動とエネルギー",
      subtopics: [
        { name: "力の合成と分解", difficultyLevel: 3 },
        { name: "平衡状態と釣り合い", difficultyLevel: 2 },
        { name: "速さと速度", difficultyLevel: 2 },
        { name: "平均の速さ・瞬間の速さ", difficultyLevel: 2 },
        { name: "加速度（a = v/t）", difficultyLevel: 3 },
        { name: "力と加速度の関係（運動方程式F=ma）", difficultyLevel: 4 },
        { name: "等加速度直線運動", difficultyLevel: 3 },
        { name: "圧力と浮力", difficultyLevel: 2 },
        { name: "落体運動と重力加速度", difficultyLevel: 4 },
        { name: "仕事（J = F × d）", difficultyLevel: 3 },
        { name: "仕事率（W = J/t）", difficultyLevel: 3 },
        { name: "エネルギーの種類（位置・運動・熱・光など）", difficultyLevel: 2 },
        { name: "位置エネルギーと運動エネルギー", difficultyLevel: 3 },
        { name: "力学的エネルギーの保存", difficultyLevel: 4 },
        { name: "エネルギーの変換と保存", difficultyLevel: 3 },
        { name: "滑車とてこの仕組み", difficultyLevel: 2 },
        { name: "仕事の原理（道具による仕事）", difficultyLevel: 3 }
      ]
    },
    {
      name: "地球と宇宙",
      subtopics: [
        { name: "天体の観察", difficultyLevel: 1 },
        { name: "星の日周運動", difficultyLevel: 2 },
        { name: "天球と方位", difficultyLevel: 2 },
        { name: "星の年周運動", difficultyLevel: 2 },
        { name: "黄道と黄道十二星座", difficultyLevel: 2 },
        { name: "太陽の日周運動（南中高度）", difficultyLevel: 2 },
        { name: "季節変化と太陽の南中高度の変化", difficultyLevel: 2 },
        { name: "月の満ち欠け", difficultyLevel: 2 },
        { name: "月の公転周期と月相の関係", difficultyLevel: 2 },
        { name: "月食と日食", difficultyLevel: 2 },
        { name: "月の表面（クレーター・海）", difficultyLevel: 1 },
        { name: "地球の自転と公転", difficultyLevel: 2 },
        { name: "太陽系の構成（惑星・衛星）", difficultyLevel: 1 },
        { name: "金星と火星の観測", difficultyLevel: 2 },
        { name: "太陽の構造（光球・彩層・コロナ）", difficultyLevel: 2 },
        { name: "太陽の活動（黒点・太陽風）", difficultyLevel: 2 },
        { name: "恒星の性質（色・温度・明るさ）", difficultyLevel: 2 },
        { name: "銀河系と他の銀河", difficultyLevel: 2 }
      ]
    }
  ]
}
