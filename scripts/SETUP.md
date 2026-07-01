# ローカル夜間会議のセットアップ手順

## 仕組み

Windowsタスクスケジューラが毎晩指定時刻に `nightly-meeting.bat` を実行します。
バッチファイルがローカルの Claude Code CLI を呼び出し、CEO×CTO が議論した結果を
Gmail の下書きフォルダに保存します。翌朝 Gmail を開いて確認してください。

## 事前確認

コマンドプロンプトで以下を実行して claude コマンドが動くか確認する。

    claude --version

エラーが出る場合は Claude Code をインストールしてください。

## タスクスケジューラへの登録

PowerShell を**管理者として**開いて以下を実行する。

```powershell
$action = New-ScheduledTaskAction `
    -Execute "C:\Users\user\OneDrive\デスクトップ\pomodoro-timer\scripts\nightly-meeting.bat"

$triggers = @(
    $(New-ScheduledTaskTrigger -Daily -At "23:00"),
    $(New-ScheduledTaskTrigger -Daily -At "01:00"),
    $(New-ScheduledTaskTrigger -Daily -At "03:00"),
    $(New-ScheduledTaskTrigger -Daily -At "05:00")
)

$settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 60)

Register-ScheduledTask `
    -TaskName "PomodoroNightlyMeeting" `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -RunLevel Highest `
    -Force
```

これで毎晩 23:00 / 01:00 / 03:00 / 05:00 に自動実行されます。

## スリープ対策（省略可）

タスクが実行される時間帯にPCがスリープしていると動きません。
実行前にスリープから復帰するよう `-WakeToRun` を指定していますが、
PC の電源設定で「スリープ解除タイマーを許可する」が有効になっていないと
機能しません。設定 → 電源とスリープ → 電源の追加設定 → スリープから復帰する
タイマーを許可する、をオンにしてください。

## 手動でテスト実行

コマンドプロンプトで以下を実行する。

    "C:\Users\user\OneDrive\デスクトップ\pomodoro-timer\scripts\nightly-meeting.bat"

数分〜十数分後に Gmail の下書きフォルダに結果が届けば成功です。

## 登録を削除する場合

```powershell
Unregister-ScheduledTask -TaskName "PomodoroNightlyMeeting" -Confirm:$false
```

## 実行ログの確認

`scripts/nightly-meeting.log` に開始・終了時刻が記録されます。
