/**
 * 高校「物理」（物理基礎の発展科目） 単元・小項目構成
 * 学習指導要領（文部科学省）、数研出版の教科書目次（総合物理1・2）、
 * および Try IT・代々木ゼミナール単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 定義や用語の理解、直感的なグラフ読み取りなど暗記・直感中心の内容
 * 2: 基本的な公式を1つ適用すれば解ける、素直な計算問題が中心の内容
 * 3(中): 複数の公式・概念を組み合わせる必要がある、標準的な計算・図示問題
 * 4: 状況設定の読み取りが複雑、または複数分野の知識・ベクトル的思考を統合する必要がある内容
 * 5(難): 抽象度が高い、大学初等レベルに近い定量的解析や複数分野の深い統合が要求される応用内容
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const sciencePhysics: CurriculumBlockData = {
  block: "物理",
  subject: "理科",
  chapters: [
    {
      name: "力学（発展）",
      subtopics: [
        { name: "平面運動の速度・加速度（ベクトル的取り扱い）", difficultyLevel: 3 },
        { name: "水平投射・斜方投射", difficultyLevel: 3 },
        { name: "剛体にはたらく力のモーメント", difficultyLevel: 3 },
        { name: "剛体のつり合いと重心", difficultyLevel: 4 },
        { name: "力積と運動量", difficultyLevel: 3 },
        { name: "運動量保存の法則", difficultyLevel: 3 },
        { name: "反発係数と衝突（弾性・非弾性）", difficultyLevel: 4 },
        { name: "分裂・合体を伴う運動量保存の応用", difficultyLevel: 4 },
        { name: "等速円運動の速度・加速度・向心力", difficultyLevel: 4 },
        { name: "非等速円運動（鉛直面内の円運動）", difficultyLevel: 5 },
        { name: "慣性力と遠心力", difficultyLevel: 4 },
        { name: "単振動の変位・速度・加速度と復元力", difficultyLevel: 4 },
        { name: "ばね振り子・単振り子の周期", difficultyLevel: 4 },
        { name: "単振動のエネルギー保存", difficultyLevel: 4 },
        { name: "万有引力の法則", difficultyLevel: 3 },
        { name: "ケプラーの法則と惑星・人工衛星の運動", difficultyLevel: 5 }
      ]
    },
    {
      name: "熱力学",
      subtopics: [
        { name: "熱と温度、熱運動と絶対温度", difficultyLevel: 1 },
        { name: "比熱・熱容量・熱量保存則（発展計算）", difficultyLevel: 3 },
        { name: "ボイルの法則・シャルルの法則", difficultyLevel: 2 },
        { name: "ボイル・シャルルの法則と状態方程式", difficultyLevel: 3 },
        { name: "気体分子運動論（圧力と分子運動の関係）", difficultyLevel: 5 },
        { name: "気体の内部エネルギー", difficultyLevel: 3 },
        { name: "熱力学第一法則", difficultyLevel: 4 },
        { name: "定積変化・定圧変化・等温変化・断熱変化", difficultyLevel: 5 },
        { name: "モル比熱と気体のする仕事（p-Vグラフ）", difficultyLevel: 5 },
        { name: "熱機関と熱効率", difficultyLevel: 4 }
      ]
    },
    {
      name: "波動（発展）",
      subtopics: [
        { name: "波の式・位相の考え方", difficultyLevel: 3 },
        { name: "重ね合わせの原理と定常波（発展）", difficultyLevel: 3 },
        { name: "ホイヘンスの原理と反射・屈折の法則", difficultyLevel: 4 },
        { name: "波の干渉・回折", difficultyLevel: 4 },
        { name: "ドップラー効果（発展：観測者・音源が共に動く場合）", difficultyLevel: 5 },
        { name: "光の屈折・全反射", difficultyLevel: 3 },
        { name: "レンズ・鏡による結像", difficultyLevel: 4 },
        { name: "ヤングの干渉実験", difficultyLevel: 5 },
        { name: "回折格子・薄膜による干渉", difficultyLevel: 5 },
        { name: "反射による干渉（ニュートンリングなど）", difficultyLevel: 5 }
      ]
    },
    {
      name: "電磁気学",
      subtopics: [
        { name: "クーロンの法則", difficultyLevel: 3 },
        { name: "電場（電界）の定義と重ね合わせ", difficultyLevel: 3 },
        { name: "電位・電位差の考え方", difficultyLevel: 4 },
        { name: "電場と電位の関係（等電位線）", difficultyLevel: 4 },
        { name: "静電誘導・誘電分極", difficultyLevel: 3 },
        { name: "コンデンサーの基本（電気容量・蓄えられる電荷）", difficultyLevel: 3 },
        { name: "コンデンサーの直列・並列接続", difficultyLevel: 4 },
        { name: "コンデンサーのエネルギーと極板間引力", difficultyLevel: 4 },
        { name: "直流回路とキルヒホッフの法則", difficultyLevel: 4 },
        { name: "電流計・電圧計・電位差計の回路", difficultyLevel: 3 },
        { name: "磁場と磁力線、磁性体", difficultyLevel: 2 },
        { name: "電流がつくる磁場（直線電流・円形電流・ソレノイド）", difficultyLevel: 3 },
        { name: "電流が磁場から受ける力（フレミング左手則）", difficultyLevel: 3 },
        { name: "ローレンツ力と荷電粒子の運動", difficultyLevel: 5 },
        { name: "電磁誘導の法則（レンツの法則・ファラデーの法則）", difficultyLevel: 4 },
        { name: "自己誘導・相互誘導", difficultyLevel: 4 },
        { name: "交流の発生と実効値", difficultyLevel: 4 },
        { name: "交流回路（抵抗・コイル・コンデンサー）とインピーダンス", difficultyLevel: 5 },
        { name: "共振回路（LC回路）と電磁波", difficultyLevel: 5 }
      ]
    },
    {
      name: "原子",
      subtopics: [
        { name: "光の粒子性（光電効果）", difficultyLevel: 4 },
        { name: "コンプトン効果", difficultyLevel: 5 },
        { name: "粒子の波動性（ド・ブロイ波）", difficultyLevel: 4 },
        { name: "水素原子モデルとエネルギー準位、線スペクトル", difficultyLevel: 5 },
        { name: "X線の発生と性質", difficultyLevel: 4 },
        { name: "原子核の構成と質量数・原子番号", difficultyLevel: 2 },
        { name: "放射性崩壊と放射線（α・β・γ線）", difficultyLevel: 3 },
        { name: "半減期の計算", difficultyLevel: 3 },
        { name: "核反応と質量欠損・結合エネルギー（E=mc^2）", difficultyLevel: 5 },
        { name: "核分裂・核融合とエネルギー利用", difficultyLevel: 4 }
      ]
    }
  ]
}
