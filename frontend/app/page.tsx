"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import FileTree, { TraceTarget } from "./components/FileTree";
import OnboardingTour, { shouldShowTour } from "./components/OnboardingTour";
import LandingPage from "./components/LandingPage";
import { trackEvent } from "./components/PostHogProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const QUICK_PROMPTS = [
  "Where are the API endpoints defined?",
  "Explain the folder structure and architecture.",
  "Are there any obvious security or architectural issues?",
  "What is the data flow from request to response?",
];

const PIPELINE_STEPS = [
  { id: "clone", label: "Clone", desc: "Fetching repository" },
  { id: "chunk", label: "Chunk", desc: "Splitting into segments" },
  { id: "embed", label: "Embed", desc: "Building vector index" },
  { id: "ready", label: "Ready", desc: "Index complete" },
];

type Citation = { file_path: string; start_line: number; end_line: number };
type Message = { role: "user" | "assistant"; content: string; citations?: Citation[] };

export default function Home() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { openSignIn } = useClerk();

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const [repoUrl, setRepoUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [chunksIndexed, setChunksIndexed] = useState<number | null>(null);
  const [ingestStatus, setIngestStatus] = useState<"idle" | "processing" | "ready" | "failed">("idle");
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [traceTarget, setTraceTarget] = useState<TraceTarget>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Show tour for first-time signed-in users only
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const timer = setTimeout(() => {
      if (shouldShowTour()) setShowTour(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [isSignedIn, isLoaded]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function pollStatus(id: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/repo/status/${id}`);
        const data = await res.json();
        if (data.status === "ready") {
          setIngestStatus("ready");
          setChunksIndexed(data.chunks_indexed);
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => chatInputRef.current?.focus(), 300);
        } else if (data.status === "failed") {
          setIngestStatus("failed");
          setIngestError(data.error || "Ingestion failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* transient */ }
    }, 2000);
  }

  async function handleIngest() {
    if (!repoUrl.trim()) return;
    if (!isSignedIn) { openSignIn(); return; }
    setIngestStatus("processing");
    setIngestError(null);
    setRepoId(null);
    setChunksIndexed(null);
    setMessages([]);
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const res = await fetch(`${API_URL}/repo/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setIngestStatus("failed");
        setIngestError("Session expired — please refresh the page and try again.");
        return;
      }
      if (res.status === 429) {
        setIngestStatus("failed");
        setIngestError("Too many requests — wait a minute and try again.");
        return;
      }
      if (!res.ok) throw new Error(data.detail || "Failed to start indexing");
      setRepoId(data.repo_id);
      trackEvent("repo_ingest_started", { repo_url: repoUrl.trim() });
      pollStatus(data.repo_id);
    } catch (err) {
      setIngestStatus("failed");
      setIngestError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const handleAsk = useCallback(async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? question).trim();
    if (!q || !repoId) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setAsking(true);

    // Add empty assistant message we'll fill in as tokens arrive
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const token = await getToken().catch(() => null);
      const params = new URLSearchParams({ repo_id: repoId, question: q });
      if (token) params.set("token", token);

      const res = await fetch(`${API_URL}/chat/stream?${params.toString()}`);

      if (res.status === 401) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "⚠️ Session expired — please refresh the page to continue." },
        ]);
        return;
      }
      if (res.status === 429) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "⚠️ You've hit the rate limit. Wait a minute and try again." },
        ]);
        return;
      }
      if (!res.ok || !res.body) throw new Error("Stream failed to start");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? ""; // keep incomplete chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6); // strip "data: "

          if (payload === "__DONE__") break;

          if (payload.startsWith("__ERROR__")) {
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: "assistant", content: `Error: ${payload.slice(9).trim()}` },
            ]);
            break;
          }

          if (payload.startsWith("__CITATIONS__")) {
            // Parse citations and attach to the last message
            try {
              const citations = JSON.parse(payload.slice(13));
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  citations,
                };
                return updated;
              });
            } catch { /* malformed citations — skip */ }
            continue;
          }

          // Regular text token — append to last message
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + payload,
            };
            return updated;
          });
        }
      }

      trackEvent("question_asked", { repo_id: repoId });
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: err instanceof Error ? `Error: ${err.message}` : "Something went wrong.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }, [question, repoId]);

  function traceToFile(path: string) {
    setTraceTarget({ path, key: Date.now() });
  }

  // Show loading state briefly while Clerk loads
  if (!isLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 52px)" }}>
        <div className="spin-ring" style={{ width: 24, height: 24, borderWidth: 2 }} />
      </div>
    );
  }

  // Non-signed-in users see the landing page
  if (!isSignedIn) {
    return <LandingPage />;
  }

  // ── Signed-in: full app ──
  const currentStepIndex =
    ingestStatus === "processing" ? 1 :
    ingestStatus === "ready"     ? 3 : -1;

  const repoName = repoUrl.trim().replace(/\/$/, "").split("/").slice(-2).join("/");

  return (
    <>
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}

      <div style={{ display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: sidebarOpen ? 300 : 0,
          minWidth: sidebarOpen ? 300 : 0,
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          background: "var(--surface)",
          overflow: "hidden",
          transition: "width 0.25s cubic-bezier(.22,1,.36,1), min-width 0.25s cubic-bezier(.22,1,.36,1)",
          flexShrink: 0,
        }}>
          <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 14, height: "100%", overflow: "hidden" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Repository URL
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 14, pointerEvents: "none" }}>⬡</span>
                <input
                  className={`input-base ${ingestStatus === "processing" ? "input-processing" : ""}`}
                  style={{ paddingLeft: 34 }}
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleIngest()}
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%", fontSize: 14, padding: "11px 16px", borderRadius: 10, justifyContent: "center", gap: 8 }}
              onClick={handleIngest}
              disabled={ingestStatus === "processing" || !repoUrl.trim()}
            >
              {ingestStatus === "processing" ? (
                <><span className="spin-ring" />Indexing…</>
              ) : (
                <><span>⬡</span> Index repository</>
              )}
            </button>

            {ingestStatus === "failed" && ingestError && (
              <div className="fadeUp" style={{
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 10, padding: "11px 14px", color: "var(--error)", fontSize: 12, lineHeight: 1.5,
              }}>
                <strong>Indexing failed</strong><br />{ingestError}
              </div>
            )}

            {ingestStatus === "ready" && chunksIndexed !== null && (
              <div className="success-pop" style={{
                background: "var(--amber-soft)", border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 10, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(245,158,11,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--amber)", fontSize: 16, flexShrink: 0,
                }}>◎</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber)" }}>Index ready</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{chunksIndexed.toLocaleString()} chunks indexed</div>
                </div>
              </div>
            )}

            <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pipeline</div>
              {PIPELINE_STEPS.map((s, i) => {
                const isDone = ingestStatus === "ready" || (ingestStatus === "processing" && i < currentStepIndex);
                const isActive = ingestStatus === "processing" && i === Math.min(currentStepIndex, 2);
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className={`pipeline-dot ${isActive ? "pipeline-dot-active" : ""}`} style={{ background: isDone ? "var(--amber)" : isActive ? "var(--amber)" : "var(--border)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: isDone || isActive ? "var(--text)" : "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {i + 1}. {s.label}
                      </div>
                      {isActive && <div className="fadeIn" style={{ fontSize: 10, color: "var(--amber)", marginTop: 1 }}>{s.desc}…</div>}
                    </div>
                    {isDone && <span style={{ color: "var(--amber)", fontSize: 12 }}>✓</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "auto" }}>
              <button
                onClick={() => setShowTour(true)}
                style={{
                  background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "8px 14px", color: "var(--text-muted)", fontSize: 12, fontWeight: 500,
                  width: "100%", fontFamily: "inherit", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                ◎ Show tour
              </button>
            </div>
          </div>
        </aside>

        {/* ── File tree ── */}
        {ingestStatus === "ready" && repoId && (
          <nav className="fadeIn" style={{
            width: 220, flexShrink: 0, borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)",
          }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--amber)", fontSize: 12 }}>⬡</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {repoName || "Files"}
              </span>
            </div>
            <FileTree repoId={repoId} traceTarget={traceTarget} onFileClick={(path) => handleAsk(`Explain what this file does: ${path}`)} />
          </nav>
        )}

        {/* ── Chat ── */}
        <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              position: "absolute", top: 12, left: 12, zIndex: 10,
              width: 28, height: 28, borderRadius: 7,
              background: "var(--surface-raised)", border: "1px solid var(--border)",
              color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            {sidebarOpen ? "◁" : "▷"}
          </button>

          {messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
              {ingestStatus === "ready" ? (
                <QuickPromptsPanel onSelect={handleAsk} repoName={repoName} />
              ) : (
                <HeroPanel />
              )}
            </div>
          )}

          {messages.length > 0 && (
            <div className="messages-scroll" style={{ flex: 1, overflowY: "auto", padding: "24px 24px 8px", display: "flex", flexDirection: "column", gap: 20 }}>
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} onCitationClick={traceToFile} />
              ))}
              {asking && <ThinkingBubble />}
              <div ref={chatEndRef} />
            </div>
          )}

          <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
            <div
              style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "6px 6px 6px 16px", transition: "border-color 0.15s, box-shadow 0.15s" }}
              onFocusCapture={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "var(--amber)"; el.style.boxShadow = "0 0 0 3px var(--amber-soft)"; }}
              onBlurCapture={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "var(--border)"; el.style.boxShadow = "none"; }}
            >
              <input
                ref={chatInputRef}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, fontFamily: "inherit", padding: "6px 0" }}
                placeholder={ingestStatus === "ready" ? "Ask about this codebase…" : "Index a repository first"}
                value={question}
                disabled={ingestStatus !== "ready" || asking}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              />
              <button
                className="btn btn-primary"
                style={{ borderRadius: 10, padding: "8px 18px", fontSize: 13 }}
                onClick={() => handleAsk()}
                disabled={ingestStatus !== "ready" || asking || !question.trim()}
              >
                {asking ? <span className="spin-ring" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> : "Ask →"}
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 8, color: "var(--text-dim)", fontSize: 11 }}>
              Every answer cites exact file and line references.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function HeroPanel() {
  return (
    <div className="fadeUp" style={{ maxWidth: 600, textAlign: "center" }}>
      <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", border: "1.5px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", border: "1.5px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--amber-soft)", border: "1px solid var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", fontSize: 16 }}>⬡</div>
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, animation: "spinRing 8s linear infinite" }}>
          <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", boxShadow: "0 0 8px rgba(245,158,11,0.8)" }} />
        </div>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 12, letterSpacing: "-0.03em" }}>
        Understand any codebase<br /><span className="gold-shimmer">in minutes.</span>
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, marginBottom: 36 }}>
        Paste a public GitHub URL in the sidebar to get started.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "left" }}>
        {[
          { icon: "⬡", label: "Visual file tree", desc: "Browse the full repo structure at a glance." },
          { icon: "◈", label: "Cited answers", desc: "Every response traces to exact files and lines." },
          { icon: "◎", label: "Instant indexing", desc: "Clone, chunk, and embed in under a minute." },
        ].map((f, i) => (
          <div key={f.label} className="fadeUp feature-card" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)", animationDelay: `${0.1 + i * 0.07}s` }}>
            <div style={{ fontSize: 20, color: "var(--amber)", marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickPromptsPanel({ onSelect, repoName }: { onSelect: (q: string) => void; repoName: string }) {
  return (
    <div className="fadeUp" style={{ width: "100%", maxWidth: 520 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div className="badge badge-cyan" style={{ margin: "0 auto 12px" }}>Index ready</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
          {repoName ? `Exploring ${repoName}` : "Repository indexed"}
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Ask anything, or start with one of these:</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {QUICK_PROMPTS.map((p) => (
          <button key={p} onClick={() => onSelect(p)} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "13px 18px",
            fontSize: 13, textAlign: "left", color: "var(--text)", fontFamily: "inherit", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
            transition: "border-color 0.15s, background 0.15s, transform 0.12s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.background = "var(--surface-raised)"; e.currentTarget.style.transform = "translateX(3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.transform = "translateX(0)"; }}
          >
            <span style={{ color: "var(--amber)", fontSize: 16, flexShrink: 0 }}>◈</span>
            <span>{p}</span>
            <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 14 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, onCitationClick }: { message: { role: "user" | "assistant"; content: string; citations?: Citation[] }; onCitationClick: (path: string) => void }) {
  const isUser = message.role === "user";
  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", padding: "0 4px" }}>
        {isUser ? "You" : "RepoMind"}
      </div>
      <div style={{
        maxWidth: "72%", background: isUser ? "var(--amber)" : "var(--surface-raised)",
        border: isUser ? "none" : "1px solid var(--border)",
        color: isUser ? "#080b12" : "var(--text)", padding: "12px 16px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
        boxShadow: isUser ? "0 4px 16px rgba(245,158,11,0.2)" : "var(--shadow-sm)",
        fontWeight: isUser ? 500 : 400,
      }}>
        {message.content}
      </div>
      {message.citations && message.citations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "72%" }}>
          {message.citations.map((c, j) => (
            <button key={j} className="citation-pill" onClick={() => onCitationClick(c.file_path)} title={`Jump to ${c.file_path}`}>
              <span style={{ opacity: 0.6, marginRight: 3 }}>◈</span>
              {c.file_path}:{c.start_line}–{c.end_line}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="fadeIn" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>RepoMind</div>
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", padding: "12px 18px", borderRadius: "4px 16px 16px 16px", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="typing-dot">●</span>
        <span className="typing-dot">●</span>
        <span className="typing-dot">●</span>
      </div>
    </div>
  );
}
