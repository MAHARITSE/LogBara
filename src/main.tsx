import { StrictMode, Component, ReactNode, ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; info: string }> {
  state = { error: null as Error | null, info: "" };

  static getDerivedStateFromError(error: Error) {
    return { error, info: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BarPOS] Uncaught React error:", error, info);
    this.setState({ info: info.componentStack || "" });
    // @ts-ignore global handler from index.html
    if (typeof (window as any).__BARPOS_SHOW_ERROR__ === "function") {
      (window as any).__BARPOS_SHOW_ERROR__(error.message, error.stack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", padding: 24, fontFamily: "ui-sans-serif,system-ui" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>⚠️ Erreur applicative</h1>
          <p style={{ marginTop: 12, opacity: 0.9 }}>{this.state.error.message}</p>
          <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", background: "rgba(255,255,255,0.08)", padding: 16, borderRadius: 12, fontSize: 12 }}>
            {this.state.error.stack}
            {"\n"}
            {this.state.info}
          </pre>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              onClick={() => location.reload()}
              style={{ background: "#0D47A1", color: "white", padding: "10px 16px", borderRadius: 10, border: 0, fontWeight: 700, cursor: "pointer" }}
            >
              Recharger
            </button>
            <button
              onClick={() => this.setState({ error: null, info: "" })}
              style={{ background: "white", color: "#0f172a", padding: "10px 16px", borderRadius: 10, border: 0, fontWeight: 700, cursor: "pointer" }}
            >
              Réessayer
            </button>
          </div>
          <p style={{ marginTop: 20, fontSize: 12, opacity: 0.6, lineHeight: 1.5 }}>
            Causes fréquentes d'écran blanc :<br />
            • API MySQL indisponible → l'app bascule en mode démo offline automatiquement<br />
            • Fichier ouvert via file:// → lancez `npm run dev` ou ouvrez `dist/index.html` compilé<br />
            • Extension bloquante → désactivez AdBlock / testez en navigation privée
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function mount() {
  const el = document.getElementById("root");
  if (!el) {
    console.error("[BarPOS] #root introuvable. DOM:", document.body?.innerHTML?.slice(0, 500));
    // Tente recréation si vraiment absent
    const fallback = document.createElement("div");
    fallback.id = "root";
    document.body.appendChild(fallback);
    const root = createRoot(fallback);
    root.render(
      <StrictMode>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </StrictMode>
    );
    return;
  }
  // Nettoie le loader initial s'il existe
  createRoot(el).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>
  );
}

// Module scripts sont defer par défaut, mais on sécurise
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
