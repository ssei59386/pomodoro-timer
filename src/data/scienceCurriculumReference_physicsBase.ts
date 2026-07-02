/**
 * 高校「物理基礎」 単元・小項目構成
 * 学習指導要領（文部科学省）、東京書籍・数研出版の教科書目次、
 * および Try IT・ベネッセ定期テスト対策サイト・代々木ゼミナール単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 定義や用語の理解、直感的なグラフ読み取りなど暗記・直感中心の内容
 * 2: 基本的な公式を1つ適用すれば解ける、素直な計算問題が中心の内容
 * 3(中): 複数の公式・概念を組み合わせる必要がある、標準的な計算・図示問題
 * 4: 状況設定の読み取りが複雑、または複数分野の知識を統合する必要がある内容
 * 5(難): 抽象度が高い、定性的理解と定量的計算の両方が高度に要求される内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const sciencePhysicsBase: CurriculumBlockData = {
  block: "物理基礎",
  subject: "理科",
  chapters: [
    {
      name: "運動の表し方と力",
      subtopics: [
        { name: "速さと速度、変位", difficultyLevel: 1 },
        { name: "合成速度・相対速度", difficultyLevel: 3 },
        { name: "加速度の意味と計算", difficultyLevel: 2 },
        { name: "v-tグラフ・x-tグラフの読み取り", difficultyLevel: 2 },
        { name: "等加速度直線運動の公式", difficultyLevel: 3 },
        { name: "自由落下・鉛直投げ上げ", difficultyLevel: 3 },
        { name: "力の種類（重力・張力・弾性力・垂直抗力）", difficultyLevel: 1 },
        { name: "摩擦力（静止摩擦・動摩擦）", difficultyLevel: 2 },
        { name: "浮力", difficultyLevel: 2 },
        { name: "力のつり合い（作図・成分分解）", difficultyLevel: 3 },
        { name: "力の合成と分解", difficultyLevel: 2 },
        { name: "慣性の法則（運動の第一法則）", difficultyLevel: 1 },
        { name: "運動方程式（F=ma）の意味と適用", difficultyLevel: 3 },
        { name: "作用・反作用の法則", difficultyLevel: 2 },
        { name: "複数物体の運動方程式（連結・接触）", difficultyLevel: 4 }
      ]
    },
    {
      name: "仕事とエネルギー",
      subtopics: [
        { name: "仕事の定義（W=Fx）と単位", difficultyLevel: 2 },
        { name: "仕事率", difficultyLevel: 2 },
        { name: "運動エネルギーと仕事の関係（仕事とエネルギーの定理）", difficultyLevel: 3 },
        { name: "重力による位置エネルギー", difficultyLevel: 2 },
        { name: "弾性力による位置エネルギー", difficultyLevel: 3 },
        { name: "力学的エネルギー保存の法則", difficultyLevel: 3 },
        { name: "摩擦がある場合のエネルギー収支", difficultyLevel: 4 },
        { name: "熱と温度（熱運動、絶対温度）", difficultyLevel: 1 },
        { name: "比熱と熱容量", difficultyLevel: 2 },
        { name: "熱量保存の法則（熱量計の計算）", difficultyLevel: 3 },
        { name: "融解熱・蒸発熱と状態変化", difficultyLevel: 2 },
        { name: "熱と仕事の関係（熱力学第一法則の初歩）", difficultyLevel: 3 },
        { name: "エネルギーの変換と保存則（力学的・電気的・熱的エネルギー間）", difficultyLevel: 3 }
      ]
    },
    {
      name: "波・音",
      subtopics: [
        { name: "波の発生と伝わり方、横波と縦波", difficultyLevel: 2 },
        { name: "波の要素（振幅・周期・振動数・波長・速さ）", difficultyLevel: 2 },
        { name: "y-x図とy-t図の関係", difficultyLevel: 3 },
        { name: "波の重ね合わせの原理", difficultyLevel: 3 },
        { name: "反射波の作図（自由端・固定端）", difficultyLevel: 3 },
        { name: "定常波の形成", difficultyLevel: 3 },
        { name: "音の速さと伝わり方", difficultyLevel: 1 },
        { name: "音の3要素（高さ・大きさ・音色）", difficultyLevel: 1 },
        { name: "うなり", difficultyLevel: 3 },
        { name: "弦の固有振動", difficultyLevel: 3 },
        { name: "気柱の固有振動（閉管・開管）", difficultyLevel: 3 },
        { name: "ドップラー効果の基礎", difficultyLevel: 4 }
      ]
    },
    {
      name: "電気",
      subtopics: [
        { name: "静電気と電荷、帯電のしくみ", difficultyLevel: 1 },
        { name: "電流の正体と向き", difficultyLevel: 1 },
        { name: "オームの法則", difficultyLevel: 2 },
        { name: "抵抗の直列・並列接続", difficultyLevel: 3 },
        { name: "電力と電力量、ジュール熱", difficultyLevel: 2 },
        { name: "電気エネルギーと家庭の消費電力", difficultyLevel: 2 },
        { name: "磁石と磁場、磁力線", difficultyLevel: 1 },
        { name: "電流がつくる磁場", difficultyLevel: 2 },
        { name: "電磁誘導の基礎（レンツの法則）", difficultyLevel: 3 },
        { name: "交流の発生としくみ（発電機の原理）", difficultyLevel: 3 }
      ]
    },
    {
      name: "物理学と社会",
      subtopics: [
        { name: "エネルギーの利用と変換（発電のしくみ）", difficultyLevel: 2 },
        { name: "熱機関とエネルギー変換効率", difficultyLevel: 3 },
        { name: "放射線の基礎と身の回りの物理", difficultyLevel: 2 },
        { name: "科学技術と物理学の関わり（探究活動）", difficultyLevel: 1 }
      ]
    }
  ]
}
