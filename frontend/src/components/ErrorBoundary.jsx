import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PawCircle ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-surface flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant/40 shadow-xl text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">error</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Something went wrong</h2>
              <p className="text-xs text-on-surface-variant mt-1">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 rounded-full bg-primary-container text-on-surface font-bold text-xs sm:text-sm hover:bg-primary-fixed-dim transition-colors cursor-pointer"
            >
              Reload HawPulse
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
