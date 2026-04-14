import React from 'react';
export default class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, color: '#e54d4d', backgroundColor: '#12101a', position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
                    <h1 style={{ marginBottom: 16 }}>Something went wrong</h1>
                    <pre style={{ fontSize: 13, maxWidth: '80vw', overflow: 'auto', color: '#aaa' }}>{this.state.error?.toString()}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}