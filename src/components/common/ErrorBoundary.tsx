import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<any, any> {
  state: any = {
    hasError: false,
    error: null,
  };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    (this as any).setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    const self = this as any;
    if (self.state.hasError) {
      if (self.props.fallback) {
        return self.props.fallback;
      }

      return (
        <div className="min-h-[20rem] max-w-xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 shadow-sm border border-amber-100">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">خطا در بارگذاری صفحه</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            متأسفانه در بارگذاری این بخش از برنامه خطایی رخ داده است. لطفاً دوباره تلاش کنید.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-dark transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تلاش مجدد</span>
          </button>
        </div>
      );
    }

    return self.props.children;
  }
}
