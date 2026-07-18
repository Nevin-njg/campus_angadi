import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Campus Angadi interface error", error, info);
  }

  override render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" id="main-content" tabIndex={-1}>
          <div className="admin-card">
            <span className="section-kicker">Something went wrong</span>
            <h1>The page could not be displayed.</h1>
            <p>
              Reload the page. Your saved marketplace data has not been removed.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              Reload Campus Angadi
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
