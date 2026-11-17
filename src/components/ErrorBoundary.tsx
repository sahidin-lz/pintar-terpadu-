import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let parsedError: Record<string, unknown> | null = null;
      try {
        parsedError = JSON.parse(this.state.errorMessage);
      } catch {
        parsedError = null;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-rose-200 bg-white p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Terjadi Gangguan Akses Data / Sistem
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Operasi dibatalkan untuk menjaga integritas data SIM PINTAR.
                </p>
              </div>
            </div>

            {parsedError ? (
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] font-mono-num text-rose-300">
                {JSON.stringify(parsedError, null, 2)}
              </pre>
            ) : (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                {this.state.errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
