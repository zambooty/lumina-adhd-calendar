import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

/** Prevent blank white screens — show a dark recovery panel instead. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LUMINA render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-screen" role="alert">
        <h1 className="brand-mark">LUMINA</h1>
        <p className="error-screen-title">Something glitched</p>
        <p className="error-screen-body">
          {this.state.error.message || 'Unexpected render error.'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            this.setState({ error: null })
            window.location.assign('/')
          }}
        >
          Reload app
        </button>
      </div>
    )
  }
}
