/**
 * 高校「生物」（生物基礎の発展科目） 単元・小項目構成
 * 学習指導要領（文部科学省、生命現象と物質／生殖と発生／生物の環境応答／
 * 生態と環境／生物の進化と系統の5領域構成）、東京書籍・数研出版（チャート式 新生物）の
 * 教科書目次、および Try IT・Wikibooks高等学校生物・定期テスト対策サイトの単元一覧を cross-check した結果
 *
 * 難易度の判定基準：
 * 1(易): 用語の定義や分類の暗記、直感的に理解できる内容
 * 2: 基本的なしくみを1つ理解すれば説明できる、素直な暗記・図表読解問題が中心の内容
 * 3(中): 複数の概念やプロセスを組み合わせて理解する必要がある、標準的な計算・図表読解・考察問題
 * 4: 複数分野の知識を統合する必要がある、または反応・調節の流れが多段階で複雑な内容
 * 5(難): 抽象度が高い、実験考察・定量計算・複数分野の統合的理解が高度に要求される応用内容（大学入試最難関レベル）
 */

import type { CurriculumBlockData } from "./curriculumTypes"

export type {
  CurriculumBlock,
  CurriculumSubtopic,
  CurriculumChapter,
  CurriculumBlockData,
} from "./curriculumTypes"

export const scienceBiology: CurriculumBlockData = {
  block: "生物",
  subject: "理科",
  chapters: [
    {
      name: "生命現象と物質",
      subtopics: [
        { name: "細胞を構成する物質（タンパク質・脂質・糖・核酸の構造）", difficultyLevel: 2 },
        { name: "タンパク質の立体構造と性質（一次〜四次構造、変性）", difficultyLevel: 3 },
        { name: "酵素反応の詳細（活性化エネルギー、競争的・非競争的阻害、反応速度のグラフ読解）", difficultyLevel: 4 },
        { name: "細胞骨格と細胞内輸送（アクチンフィラメント・微小管・モータータンパク質）", difficultyLevel: 3 },
        { name: "細胞膜のしくみと物質輸送（能動輸送・受動輸送、輸送体・チャネル）", difficultyLevel: 3 },
        { name: "呼吸のしくみの詳細（解糖系・クエン酸回路・電子伝達系の物質収支計算）", difficultyLevel: 5 },
        { name: "発酵とそのしくみ（アルコール発酵・乳酸発酵）", difficultyLevel: 2 },
        { name: "光合成のしくみの詳細（カルビン・ベンソン回路、C4・CAM植物）", difficultyLevel: 5 },
        { name: "窒素同化と窒素固定のしくみ", difficultyLevel: 3 },
        { name: "遺伝情報の複製・修復のしくみの詳細（DNAポリメラーゼ、修復機構）", difficultyLevel: 4 },
        { name: "転写・翻訳の詳細としくみ（RNAポリメラーゼ、スプライシング、リボソーム）", difficultyLevel: 4 },
        { name: "遺伝子発現の調節（オペロン説、転写調節因子、エピジェネティクス）", difficultyLevel: 5 },
        { name: "バイオテクノロジーの技術（PCR法・電気泳動・遺伝子組換え・遺伝子導入）", difficultyLevel: 4 }
      ]
    },
    {
      name: "生殖と発生",
      subtopics: [
        { name: "無性生殖と有性生殖の比較、生殖細胞の形成", difficultyLevel: 1 },
        { name: "減数分裂のしくみ（第一分裂・第二分裂、染色体数の変化）", difficultyLevel: 3 },
        { name: "遺伝の法則（分離の法則・独立の法則、遺伝子型と表現型の計算）", difficultyLevel: 3 },
        { name: "連鎖と組換え（組換え価の計算、染色体地図の作成）", difficultyLevel: 5 },
        { name: "性染色体と伴性遺伝の計算問題", difficultyLevel: 4 },
        { name: "配偶子形成（精子形成・卵形成の過程）", difficultyLevel: 2 },
        { name: "受精のしくみ（先体反応、受精膜の形成、多精拒否）", difficultyLevel: 3 },
        { name: "ウニ・カエルの卵割と胚発生の過程（卵割の様式、原腸胚形成）", difficultyLevel: 4 },
        { name: "誘導と形成体（シュペーマンの実験、原基分布図）", difficultyLevel: 5 },
        { name: "器官形成としくみ（眼の形成における誘導の連鎖）", difficultyLevel: 4 },
        { name: "植物の配偶子形成と重複受精、種子・果実の形成", difficultyLevel: 3 },
        { name: "植物の発生（発芽、体細胞分裂による器官形成、幹細胞）", difficultyLevel: 2 }
      ]
    },
    {
      name: "生物の環境応答",
      subtopics: [
        { name: "ニューロンの構造と興奮の伝導のしくみ（静止電位・活動電位）", difficultyLevel: 3 },
        { name: "興奮の伝達（シナプスにおける神経伝達物質のはたらき）", difficultyLevel: 3 },
        { name: "受容器のしくみ（眼・耳の構造と視覚・聴覚が生じるしくみ）", difficultyLevel: 3 },
        { name: "効果器のしくみ（筋収縮の分子機構、滑り説）", difficultyLevel: 4 },
        { name: "神経系の種類と中枢神経系のはたらき（脳・脊髄の構造と機能）", difficultyLevel: 2 },
        { name: "動物の行動（生得的行動・学習行動、走性・かぎ刺激）", difficultyLevel: 2 },
        { name: "植物ホルモンのはたらき（オーキシン・ジベレリンなど）と成長運動", difficultyLevel: 3 },
        { name: "オーキシンによる屈性のしくみ（光屈性・重力屈性の実験考察）", difficultyLevel: 4 },
        { name: "花芽形成の調節（光周性、フロリゲン、春化）", difficultyLevel: 4 },
        { name: "環境ストレスへの応答（気孔開閉のしくみ、種子の休眠と発芽の調節）", difficultyLevel: 3 }
      ]
    },
    {
      name: "生態と環境",
      subtopics: [
        { name: "個体群の構造（個体群密度、標識再捕法による推定計算）", difficultyLevel: 3 },
        { name: "個体群の成長（成長曲線、環境収容力、密度効果）", difficultyLevel: 3 },
        { name: "生命表と生存曲線の型の比較", difficultyLevel: 2 },
        { name: "個体群内の相互作用（群れ・縄張り、順位制）", difficultyLevel: 2 },
        { name: "異種個体群間の相互作用（種間競争、ガウゼの実験、共生・寄生）", difficultyLevel: 3 },
        { name: "被食者と捕食者の個体数変動のモデル", difficultyLevel: 4 },
        { name: "生態的地位（ニッチ）とすみわけ・食い分け", difficultyLevel: 3 },
        { name: "生態系における物質循環（炭素循環・窒素循環）の詳細としくみ", difficultyLevel: 3 },
        { name: "生態系におけるエネルギーの流れと生産力ピラミッドの計算", difficultyLevel: 4 },
        { name: "生態系の物質生産（総生産量・純生産量・成長量の計算）", difficultyLevel: 5 },
        { name: "生態系の安定性とかく乱、キーストーン種", difficultyLevel: 3 },
        { name: "人間活動による生態系への影響（生物濃縮、外来生物、絶滅と保全）", difficultyLevel: 3 }
      ]
    },
    {
      name: "生物の進化と系統",
      subtopics: [
        { name: "生命の起源と化学進化（原始生命の誕生に関する仮説）", difficultyLevel: 2 },
        { name: "生物進化の証拠（相同器官・痕跡器官・中間型化石・分子時計）", difficultyLevel: 3 },
        { name: "進化のしくみ（突然変異、自然選択、遺伝的浮動、隔離）", difficultyLevel: 3 },
        { name: "ハーディ・ワインベルグの法則と遺伝子頻度の計算", difficultyLevel: 5 },
        { name: "種分化のしくみ（地理的隔離・生殖的隔離）", difficultyLevel: 3 },
        { name: "分子進化と分子系統樹の作成・読み取り", difficultyLevel: 4 },
        { name: "生物の分類階級と学名のルール（二名法）", difficultyLevel: 1 },
        { name: "五界説・3ドメイン説など生物界の分類体系の変遷", difficultyLevel: 3 },
        { name: "植物の系統と進化（藻類からコケ・シダ・種子植物への変遷）", difficultyLevel: 3 },
        { name: "動物の系統と進化（無脊椎動物・脊椎動物の類縁関係）", difficultyLevel: 3 },
        { name: "人類の進化（霊長類の特徴、人類の系統関係）", difficultyLevel: 2 }
      ]
    }
  ]
}
