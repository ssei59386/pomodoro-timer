/**
 * 高校「地学」（地学基礎の発展科目） 単元・小項目構成
 * 学習指導要領（文部科学省、大項目「地球の概観／地球の活動と歴史／地球の大気と海洋／
 * 地球の周辺／地球の探究」の構成。新課程で「地層の形成」「太陽表面の現象」
 * 「太陽の内部構造」「宇宙の構造」など、地学基礎よりも定量的・専門的な内容が
 * 地学基礎から地学へ移行・高度化されたことを反映）、講談社『新しい高校地学の教科書』
 * （地球の姿と構造／地球を構成する岩石・鉱物／地震・火山とプレートテクトニクス／
 * 変動する地表／地球と生命の進化／大気と水がつくる気象／海洋がもたらす豊かな環境／
 * 太陽系を構成する天体／恒星・銀河と宇宙の9章構成）、実教出版・数研出版の教科書目次を
 * cross-check した結果。地学基礎で扱った内容の延長として、より定量的な計算・
 * データ解析・専門用語を扱う点が特徴
 *
 * 難易度の判定基準：
 * 1(易): 地学基礎で既習の内容の名称整理や、直感的に理解できる分類（例：岩石の外見的分類）
 * 2: 地学基礎の内容を一歩深めた、素直な暗記・図表読解が中心の内容
 * 3(中): 複数の概念やデータを組み合わせて考察する必要がある、標準的な計算・グラフ解析問題
 * 4: 複数分野の知識を統合する必要がある、または現象のしくみ・計算過程が多段階で複雑な内容
 * 5(難): 抽象度が高い定量的推定・大学レベルに近い数式の運用や、複数分野を統合した高度な考察を要する内容（大学入試最難関レベル）
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceEarthScience: CurriculumBlockData = {
  block: "地学",
  subject: "理科",
  chapters: [
    {
      name: "地球の姿と内部構造",
      subtopics: [
        { name: "地球の形状の測定史（エラトステネス、地球楕円体、重力と地球の形）", difficultyLevel: 3 },
        { name: "地震波（P波・S波・表面波）の伝播と地球内部の速度不連続面", difficultyLevel: 4 },
        { name: "走時曲線とP波・S波速度の算出、震源決定（PS時間法）", difficultyLevel: 5 },
        { name: "地球内部の層構造（地殻・マントル・外核・内核）と地震波トモグラフィー", difficultyLevel: 4 },
        { name: "地殻熱流量と地球内部の温度構造、地磁気とその変動（地磁気逆転）", difficultyLevel: 4 },
        { name: "アイソスタシーと地殻均衡", difficultyLevel: 4 }
      ]
    },
    {
      name: "地球を構成する岩石・鉱物",
      subtopics: [
        { name: "鉱物の分類と結晶構造（造岩鉱物、へき開・硬度などの物理的性質）", difficultyLevel: 2 },
        { name: "偏光顕微鏡による鉱物・岩石の観察", difficultyLevel: 3 },
        { name: "火成岩の分類とマグマの分化（ボーエンの反応系列、SiO2量による区分）", difficultyLevel: 4 },
        { name: "堆積岩の分類（砕屑岩・化学岩・生物岩）と続成作用", difficultyLevel: 2 },
        { name: "変成岩の分類（広域変成・接触変成）と変成鉱物による温度圧力条件の推定", difficultyLevel: 4 }
      ]
    },
    {
      name: "地震・火山とプレートテクトニクス",
      subtopics: [
        { name: "プレート境界の3タイプ（発散・収束・すれ違い）と地形の対応", difficultyLevel: 3 },
        { name: "海洋底拡大説と古地磁気による証拠（縞状磁気異常）", difficultyLevel: 4 },
        { name: "断層の種類（正断層・逆断層・横ずれ断層）と応力場の関係", difficultyLevel: 3 },
        { name: "地震の発生メカニズム（弾性反発説）とプレート境界型・内陸型地震の違い", difficultyLevel: 3 },
        { name: "マグマの発生と火山の分布（沈み込み帯・ホットスポット・海嶺）", difficultyLevel: 3 },
        { name: "GNSS観測による地殻変動の検出とプレート運動速度の推定", difficultyLevel: 4 }
      ]
    },
    {
      name: "変動する地表と地質構造",
      subtopics: [
        { name: "地層の形成と堆積構造（級化構造・斜交葉理・生痕化石）から推定する堆積環境", difficultyLevel: 3 },
        { name: "褶曲・断層などの地質構造の成り立ちと応力の推定", difficultyLevel: 4 },
        { name: "柱状図・地質図の読図と地層の対比、地質断面図の作成", difficultyLevel: 5 },
        { name: "風化・侵食作用と河川・海岸地形の形成", difficultyLevel: 2 },
        { name: "氷河地形と海水準変動（氷期・間氷期のサイクル）", difficultyLevel: 3 }
      ]
    },
    {
      name: "地球と生命の進化",
      subtopics: [
        { name: "地質年代の区分と放射年代測定法（半減期を用いた年代計算）", difficultyLevel: 4 },
        { name: "先カンブリア時代の環境変動（縞状鉄鉱層、全球凍結、大気中の酸素増加）", difficultyLevel: 4 },
        { name: "古生代の生物進化と大量絶滅事変（カンブリア爆発、P-T境界）", difficultyLevel: 3 },
        { name: "中生代・新生代の生物進化と大量絶滅（K-Pg境界、哺乳類の多様化）", difficultyLevel: 3 },
        { name: "日本列島の形成史（大陸縁での付加体形成、日本海の形成）", difficultyLevel: 4 }
      ]
    },
    {
      name: "大気と水がつくる気象",
      subtopics: [
        { name: "大気の鉛直構造と気温減率、断熱変化の定量計算（乾燥断熱減率・湿潤断熱減率）", difficultyLevel: 4 },
        { name: "放射平衡と温室効果の定量的理解（地球のエネルギー収支）", difficultyLevel: 4 },
        { name: "大気の大循環（三細胞循環モデル）とジェット気流、偏西風波動", difficultyLevel: 4 },
        { name: "総観規模の気象現象（温帯低気圧・前線の構造、台風の発達）", difficultyLevel: 3 },
        { name: "天気図・高層天気図・気象衛星画像を用いた総合的な気象解析", difficultyLevel: 5 }
      ]
    },
    {
      name: "海洋がもたらす豊かな環境",
      subtopics: [
        { name: "海水の物理・化学的性質（水温・塩分・密度の関係と水塊の判別）", difficultyLevel: 3 },
        { name: "海洋の層構造（表層混合層・水温躍層・深層）の形成要因", difficultyLevel: 3 },
        { name: "表層海流の駆動（風成循環、地衡流、エクマン輸送）", difficultyLevel: 5 },
        { name: "深層循環（熱塩循環）と気候への影響", difficultyLevel: 4 },
        { name: "エルニーニョ・ラニーニャ現象のしくみと世界の気候への影響", difficultyLevel: 4 }
      ]
    },
    {
      name: "太陽系を構成する天体",
      subtopics: [
        { name: "太陽の内部構造（核・放射層・対流層）とエネルギー輸送", difficultyLevel: 4 },
        { name: "太陽表面の現象（黒点・彩層・コロナ・プロミネンス・フレア）と太陽活動周期", difficultyLevel: 3 },
        { name: "惑星の運動法則（ケプラーの法則の定量的運用）と軌道要素", difficultyLevel: 4 },
        { name: "地球型惑星・木星型惑星の内部構造と大気の比較", difficultyLevel: 3 },
        { name: "太陽系の起源（原始太陽系円盤説）と小天体（小惑星・彗星・太陽系外縁天体）", difficultyLevel: 3 }
      ]
    },
    {
      name: "恒星・銀河と宇宙の構造",
      subtopics: [
        { name: "恒星の見かけの等級・絶対等級と距離指数の計算", difficultyLevel: 4 },
        { name: "スペクトル型と表面温度の関係、恒星の色指数", difficultyLevel: 3 },
        { name: "HR図の構造（主系列星・巨星・白色矮星）と恒星進化の読み取り", difficultyLevel: 5 },
        { name: "恒星の質量・光度・寿命の関係と進化の最終段階（超新星爆発、中性子星・ブラックホール）", difficultyLevel: 5 },
        { name: "銀河系の構造（円盤部・バルジ・ハロー）と太陽系の位置", difficultyLevel: 3 },
        { name: "銀河の分類と宇宙の階層構造（銀河群・銀河団・大規模構造）", difficultyLevel: 3 },
        { name: "宇宙膨張とハッブルの法則、ビッグバン宇宙論の証拠", difficultyLevel: 4 }
      ]
    }
  ]
}
