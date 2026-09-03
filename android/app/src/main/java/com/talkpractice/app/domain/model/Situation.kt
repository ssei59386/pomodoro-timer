package com.talkpractice.app.domain.model

/**
 * The three fixed practice scenarios offered on the situation-select screen (PRD §3①).
 * Each ships its own cast of AI [Character]s plus the system instruction that will
 * seed the Gemini Live session in step 3.
 */
enum class Situation(
    val id: String,
    val title: String,
    val description: String,
    val characters: List<Character>,
) {
    WELCOME_LUNCH(
        id = "welcome_lunch",
        title = "新しい部署での歓迎ランチ",
        description = "異動先の同僚2人とのランチ。まずは打ち解けることが目標。",
        characters = listOf(
            Character(id = "yamada", name = "山田さん", role = "同僚（先輩）", voiceProfile = VoiceProfile.CALM_MALE),
            Character(id = "sato", name = "佐藤さん", role = "同僚（同期）", voiceProfile = VoiceProfile.BRIGHT_FEMALE),
        ),
    ),
    FIRST_MEETING_PARTY(
        id = "first_meeting_party",
        title = "友達に紹介された初対面の人たちとの飲み会",
        description = "友人1人と、その場で初めて会う人1人との3人での飲み会。",
        characters = listOf(
            Character(id = "kenta", name = "健太", role = "友人", voiceProfile = VoiceProfile.BRIGHT_MALE),
            Character(id = "misaki", name = "美咲さん", role = "初対面", voiceProfile = VoiceProfile.CALM_FEMALE),
        ),
    ),
    HOBBY_OFFLINE_MEETUP(
        id = "hobby_offline_meetup",
        title = "趣味のオンラインコミュニティのオフ会",
        description = "オンラインでしか話したことのない3人と初めて対面するオフ会。",
        characters = listOf(
            Character(id = "ren", name = "レンさん", role = "初対面", voiceProfile = VoiceProfile.BRIGHT_MALE),
            Character(id = "aoi", name = "アオイさん", role = "初対面", voiceProfile = VoiceProfile.CALM_FEMALE),
            Character(id = "taku", name = "タクさん", role = "初対面", voiceProfile = VoiceProfile.CALM_MALE),
        ),
    ),
}
