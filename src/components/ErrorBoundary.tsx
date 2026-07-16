import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearData } from "../storage";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * アプリ全体の最終防衛線。バックアップ復元（parseImportedData の検証をすり抜けた
 * 壊れたデータ等）で描画中に例外が起きると白画面になり、設定画面にも戻れず
 * 生徒自身では復旧できない（devtools で localStorage を消せる前提を置けない）。
 * componentDidCatch で捕捉し、「データをリセットして最初からやり直す」の一本道だけを提供する。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 実機での原因追跡用のログ出力のみ。生の技術情報を生徒向け画面には出さない。
    console.error("ErrorBoundary caught an error", error, info);
  }

  handleReset = (): void => {
    clearData();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-screen">
          <p className="error-boundary-title">アプリの読み込みに失敗しました。</p>
          <p className="muted">保存されているデータに問題がある可能性があります。</p>
          <button type="button" className="danger" onClick={this.handleReset}>
            データをリセットして最初からやり直す
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
