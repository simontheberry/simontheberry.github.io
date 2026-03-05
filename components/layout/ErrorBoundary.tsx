'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-gov-grey-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gov-grey-600">
            An unexpected error occurred. Please try again or contact support if the issue persists.
          </p>
          {this.state.error && (
            <p className="mt-2 text-xs text-red-600 font-mono">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="mt-4 btn-primary"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
