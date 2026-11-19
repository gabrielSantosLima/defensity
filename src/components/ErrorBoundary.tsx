import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a render failure inside one view. Without it, a single component error
 * unmounts the whole React tree and leaves the window blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("View render failed", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="page">
        <div className="alert">
          This view failed to render.
          <br />
          {this.state.error.message}
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
