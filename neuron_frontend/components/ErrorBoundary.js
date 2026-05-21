import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof window !== 'undefined' && window.__NEURON_SENTRY__) {
      try {
        window.__NEURON_SENTRY__.captureException(error, { extra: info });
      } catch {
        /* ignore */
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel" style={{ margin: '2rem auto', maxWidth: 480 }}>
          <h1>Something went wrong</h1>
          <p className="muted">Try refreshing the page. If the problem persists, contact support.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
