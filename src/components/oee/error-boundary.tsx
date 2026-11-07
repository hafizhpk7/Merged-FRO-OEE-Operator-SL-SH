import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary caught error]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.state.error, () =>
            this.setState({ hasError: false, error: null }),
          );
        }
        return this.props.fallback;
      }
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-card border border-border rounded-lg text-foreground min-h-[300px]">
          <h3 className="text-sm font-bold text-tier-bad mb-1">3D Scene Error Recovered</h3>
          <p className="text-xs text-muted-foreground font-mono mb-3 max-w-md text-center">
            {this.state.error.message || "Unknown WebGL or rendering error"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            Retry 3D View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
