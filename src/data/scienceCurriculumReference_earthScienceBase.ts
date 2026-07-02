/**
 * 高校「地学基礎」 単元・小項目構成
 * 学習指導要領（文部科学省、大項目「(1)地球のすがた／(2)変動する地球」の2領域構成。
 * 「地層の形成」「太陽表面の現象」「太陽の内部構造」「宇宙の構造」の一部が「地学」へ移行した
 * 新課程の再編を反映）、実教出版（地基307 地学基礎 新訂版：第1章 地球の構成と運動／
 * 第2章 地球の変遷／第3章 大気と海洋／第4章 太陽系と宇宙／第5章 地球の環境）、
 * 啓林館準拠 Wikibooks高等学校地学基礎（固体地球とその活動／大気と海洋／移り変わる地球／
 * 自然との共生の4部構成）、東京書籍・数研出版の教科書目次、およびベネッセ定期テスト対策サイトの
 * 単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 用語の定義や分類の暗記、日常経験と結びつけて直感的に理解できる内容（例：季節による天気の違い）
 * 2: 基本的なしくみを1つ理解すれば説明できる、図の読み取りや素直な暗記が中心の内容
 * 3(中): 複数の概念を組み合わせて理解する必要がある、標準的な計算・グラフ読解・観察データの考察問題
 * 4: 複数分野の知識を統合する必要がある、または現象の仕組みが多段階で複雑な内容（例：フェーン現象の気温計算、地震波からの震源決定）
 * 5(難): 抽象度が高い空間・時間スケールの把握や、定性的理解と定量的計算の両方が高度に要求される応用内容（例：地球楕円体・緯度からの距離計算、HR図を用いた恒星進化の考察）
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceEarthScienceBase: CurriculumBlockData = {
  block: "地学基礎",
  subject: "理科",
  chapters: [
    {
      name: "地球の構成と運動",
      subtopics: [
        { name: "地球の形と大きさ（エラトステネスの測定法、地球楕円体）", difficultyLevel: 3 },
        { name: "地球の内部構造（地殻・マントル・核の層構造）", difficultyLevel: 2 },
        { name: "地震波（P波・S波）の性質と地球内部構造の推定", difficultyLevel: 4 },
        { name: "震源・震央の決定と初期微動継続時間、大森公式", difficultyLevel: 4 },
        { name: "地震の規模（マグニチュード）と震度、地震災害", difficultyLevel: 2 },
        { name: "プレートテクトニクスの基本（プレートの種類と境界、プレート運動の証拠）", difficultyLevel: 3 },
        { name: "日本列島周辺のプレート配置と地震・火山活動の関係", difficultyLevel: 3 },
        { name: "火山の噴火様式とマグマの性質、火山地形", difficultyLevel: 2 },
        { name: "火成岩の分類（火山岩・深成岩、SiO2量による区分と鉱物組成）", difficultyLevel: 3 }
      ]
    },
    {
      name: "地球の変遷",
      subtopics: [
        { name: "地層の形成としくみ（堆積・地層累重の法則・整合と不整合）", difficultyLevel: 2 },
        { name: "示相化石・示準化石と地質年代の区分", difficultyLevel: 2 },
        { name: "地層の対比とかぎ層、柱状図の読み取り", difficultyLevel: 3 },
        { name: "先カンブリア時代の地球と生命の誕生（縞状鉄鉱層、全球凍結）", difficultyLevel: 3 },
        { name: "古生代の生物progression（カンブリア爆発、脊椎動物・陸上進出）", difficultyLevel: 2 },
        { name: "中生代の生物と大量絶滅（恐竜の繁栄と絶滅、隕石衝突説）", difficultyLevel: 2 },
        { name: "新生代の生物と人類の進化、第四紀の気候変動", difficultyLevel: 3 }
      ]
    },
    {
      name: "大気と海洋",
      subtopics: [
        { name: "大気の構造（対流圏・成層圏・中間圏・熱圏と気温分布）", difficultyLevel: 2 },
        { name: "大気の組成と気圧、高度による気圧・密度の変化", difficultyLevel: 2 },
        { name: "断熱変化と雲の発生（乾燥断熱減率・湿潤断熱減率、フェーン現象の気温計算）", difficultyLevel: 4 },
        { name: "地球のエネルギー収支と温室効果", difficultyLevel: 3 },
        { name: "大気大循環（ハドレー循環・偏西風・貿易風）と気圧帯の形成", difficultyLevel: 3 },
        { name: "海洋の構造（水温・塩分の鉛直分布、水塊）", difficultyLevel: 2 },
        { name: "海水の運動（表層海流・深層循環、エルニーニョ現象）", difficultyLevel: 4 },
        { name: "日本付近の気団と前線、天気図の読み取り", difficultyLevel: 3 },
        { name: "日本の四季の天気（冬型・夏型の気圧配置、台風・梅雨）", difficultyLevel: 2 }
      ]
    },
    {
      name: "太陽系と宇宙",
      subtopics: [
        { name: "太陽系の構成天体（惑星・衛星・小天体の分類）", difficultyLevel: 1 },
        { name: "地球型惑星と木星型惑星の違い、ケプラーの法則", difficultyLevel: 3 },
        { name: "太陽の基本的性質（自転・大きさ・表面温度）と黒点の観察", difficultyLevel: 2 },
        { name: "太陽のエネルギー源（核融合反応）と活動（プロミネンス・フレア概要）", difficultyLevel: 3 },
        { name: "恒星の見かけの等級と絶対等級、恒星までの距離（年周視差）", difficultyLevel: 4 },
        { name: "宇宙の階層構造（太陽系・銀河系・銀河群）と膨張する宇宙、ビッグバン", difficultyLevel: 3 }
      ]
    },
    {
      name: "地球の環境",
      subtopics: [
        { name: "日本の自然環境と恵み（水資源・土地利用）", difficultyLevel: 1 },
        { name: "地震・火山災害とハザードマップ、防災の考え方", difficultyLevel: 2 },
        { name: "気象災害（豪雨・台風・竜巻）と気候変動の影響", difficultyLevel: 2 },
        { name: "地球温暖化のしくみと将来予測、人間活動と環境の関わり", difficultyLevel: 3 }
      ]
    }
  ]
}
