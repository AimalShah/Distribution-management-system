import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@dms/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep details in the developer console; the screen shows safe, actionable copy.
    console.error("Uncaught application render error", error, info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-[70svh] items-center justify-center p-6">
        <section role="alert" className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              This page hit an unexpected problem. You can try again or return to the dashboard.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button type="button" variant="outline" onClick={this.retry}>Try again</Button>
            <Button asChild><Link to="/">Back to dashboard</Link></Button>
          </div>
        </section>
      </main>
    );
  }
}
