$projectDir = "C:\Users\user\OneDrive\デスクトップ\pomodoro-timer"
Set-Location $projectDir

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "scripts\nightly-meeting.log" -Value "[$timestamp] 夜間プロダクト会議を開始します"

$prompt = @'
あなたは pomodoro-timer アプリの夜間プロダクト会議担当です。

まず CLAUDE.md を Read ツールで読んで製品のコンテキストと Known gaps を把握してください。

次に Agent ツールで ceo エージェントと cto エージェントを呼び出し、SendMessage で 8 往復ほど深く議論させてください。CEO はユーザー体験・優先順位、CTO は実装コスト・技術的整合性の視点で率直に議論させること。

議論が終わったら mcp__claude_ai_Gmail__create_draft を使い、ssei59386@gmail.com 宛に下書きを保存してください。
件名: 【夜間会議】(議題名) (今日の日付)
本文: 今回の議題、CEO と CTO の主な主張、到達した結論または未決着の論点、次回への申し送り

コードは変更しないでください。
'@

claude -p $prompt

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "scripts\nightly-meeting.log" -Value "[$timestamp] 完了"
