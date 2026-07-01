@echo off
chcp 65001 > nul
cd /d "C:\Users\user\OneDrive\デスクトップ\pomodoro-timer"

echo [%date% %time%] 夜間プロダクト会議を開始します >> scripts\nightly-meeting.log

claude -p "あなたは pomodoro-timer アプリの夜間プロダクト会議担当です。.claude/agents/ceo.md と .claude/agents/cto.md にCEO・CTOの人格定義があります。CLAUDE.md を読んで製品のコンテキストを把握してください。CLAUDE.md の Known gaps と .claude/nightly-meeting-log.md（あれば）を確認し、未決着の議題があれば引き継ぎ、なければ新しいテーマを1つ選んでください。Agent ツールで ceo と cto エージェントを呼び出し SendMessage で8往復ほど深く議論させてください。終わったら mcp__claude_ai_Gmail__create_draft で ssei59386@gmail.com 宛に件名【夜間会議】(議題名)(日付)、本文に議題・双方の主張・結論・次回への申し送りを書いて下書き保存してください。コードは変更しないでください。"

echo [%date% %time%] 完了 >> scripts\nightly-meeting.log
