"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import FileTree, { TraceTarget } from "./components/FileTree";
import { trackEvent } from "./components/PostHogProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const QUICK_PROMPTS = [
  "Where are the API endpoints defined?",
  "Explain the folder structure layout.",
  "Are there any obvious security or architectural flaws?",
];
const PIPELINE_STEPS = ["Clone", "Chunk", "Embed", "Ask"];

type Citation = { file_path: string; start_line: number; end_line: number };
type Message = { role: "user" | "assistant"; content: string; citations?: Citation[] };

export default function Home() {
  const { getToken } = useAuth();

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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollStatus(id: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/repo/status/${id}`);
        const data = await res.json();
        if (data.status === "ready") {
          setIngestStatus("ready");
          setChunksIndexed(data.chunks_indexed);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setIngestStatus("failed");
          setIngestError(data.error || "Ingestion failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // transient network hiccup while polling — just try again next tick
      }
    }, 2000);
  }

  async function handleIngest() {
    if (!repoUrl.trim()) return;
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
      if (!res.ok) throw new Error(data.detail || "Failed to start indexing");
      setRepoId(data.repo_id);
      trackEvent("repo_ingest_started", { repo_url: repoUrl.trim() });
      pollStatus(data.repo_id);
    } catch (err) {
      setIngestStatus("failed");
      setIngestError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleAsk(overrideQuestion?: string) {
    const q = (overrideQuestion ?? question).trim();
    if (!q || !repoId) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ repo_id: repoId, question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to get an answer");
      trackEvent("question_asked", { repo_id: repoId });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? `Error: ${err.message}` : "Something went wrong",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function traceToFile(path: string) {
    setTraceTarget({ path, key: Date.now() });
  }

  const currentStepIndex =
      ingestStatus === "processing" ? 1 : ingestStatus === "ready" ? 3 : -1;

  return (
      <main style={styles.page}>
        <aside style={styles.sidebar}>
          <p style={styles.tagline}>
            Paste a public GitHub repo. Ask anything about the code. Every answer cites the exact file and lines it came from.
          </p>

          <label style={styles.label}>GitHub repo URL</label>
          <input
              style={styles.input}
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIngest()}
          />
          <button
              className="primaryButton"
              style={{ ...styles.button, ...(ingestStatus === "processing" || !repoUrl.trim() ? styles.buttonDisabled : {}) }}
              onClick={handleIngest}
              disabled={ingestStatus === "processing" || !repoUrl.trim()}
          >
            {ingestStatus === "processing" ? "Indexing..." : "Index repository"}
          </button>

          {ingestStatus === "failed" && ingestError && (
              <p style={styles.errorText}>Couldn't index that repo — {ingestError}</p>
          )}

          {ingestStatus === "ready" && chunksIndexed !== null && (
              <div className="successPop" style={styles.statusCard}>
                <div style={styles.statusDot} />
                <div>
                  <div style={styles.statusTitle}>Indexed</div>
                  <div style={styles.statusSubtitle}>{chunksIndexed} chunks searchable</div>
                </div>
              </div>
          )}

          <div style={styles.pipeline}>
            {PIPELINE_STEPS.map((step, i) => {
              const isDone = currentStepIndex > i || ingestStatus === "ready";
              const isActive = ingestStatus === "processing" && i <= 2;
              return (
                  <div key={step} style={styles.pipelineStep}>
                <span style={{
                  ...styles.pipelineDot,
                  background: isDone ? "var(--color-amber)" : "var(--color-border)",
                  ...(isActive ? { animation: "pulseDot 1s ease-in-out infinite" } : {}),
                }} />
                    <span style={{ color: isDone ? "var(--color-text)" : "var(--color-text-muted)" }}>
                  {i + 1}. {step}
                </span>
                  </div>
              );
            })}
          </div>
        </aside>

        {ingestStatus === "ready" && repoId && (
            <nav style={styles.fileTreePanel}>
              <div style={styles.fileTreeHeader}>Files</div>
              <FileTree
                  repoId={repoId}
                  traceTarget={traceTarget}
                  onFileClick={(path) => handleAsk(`Explain what this file does: ${path}`)}
              />
            </nav>
        )}

        <section style={styles.chatArea}>
          {messages.length === 0 && (
              <div style={styles.emptyState}>
                {ingestStatus === "ready" ? (
                    <div style={styles.quickPrompts}>
                      <p style={styles.emptyText}>Ask your own question below, or try one of these:</p>
                      {QUICK_PROMPTS.map((p) => (
                          <button key={p} className="primaryButton" style={styles.quickPromptButton} onClick={() => handleAsk(p)}>
                            {p}
                          </button>
                      ))}
                    </div>
                ) : (
                    <p style={styles.emptyText}>Index a repo to start asking questions about it.</p>
                )}
              </div>
          )}

          <div style={styles.messages}>
            {messages.map((m, i) => (
                <div key={i} className="fadeIn" style={m.role === "user" ? styles.userRow : styles.assistantRow}>
                  <div style={m.role === "user" ? styles.userBubble : styles.assistantBubble}>
                    {m.content}
                  </div>
                  {m.citations && m.citations.length > 0 && (
                      <div style={styles.citationRow}>
                        {m.citations.map((c, j) => (
                            <button
                                key={j}
                                className="citationPill"
                                style={styles.citationPill}
                                onClick={() => traceToFile(c.file_path)}
                                title="Jump to this file in the tree"
                            >
                              {c.file_path}:{c.start_line}-{c.end_line}
                            </button>
                        ))}
                      </div>
                  )}
                </div>
            ))}
            {asking && (
                <div className="fadeIn" style={styles.assistantRow}>
                  <div style={styles.assistantBubble}>
                    <span className="typingDot">●</span> <span className="typingDot">●</span> <span className="typingDot">●</span>
                  </div>
                </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={styles.inputRow}>
            <input
                style={styles.chatInput}
                placeholder={ingestStatus === "ready" ? "Ask about this codebase..." : "Index a repo first"}
                value={question}
                disabled={ingestStatus !== "ready" || asking}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            />
            <button
                className="primaryButton"
                style={{ ...styles.button, ...((ingestStatus !== "ready" || asking || !question.trim()) ? styles.buttonDisabled : {}) }}
                onClick={() => handleAsk()}
                disabled={ingestStatus !== "ready" || asking || !question.trim()}
            >
              Ask
            </button>
          </div>
        </section>
      </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", height: "calc(100vh - 49px)", fontFamily: "var(--font-sans)" },
  sidebar: {
    width: 320,
    borderRight: "1px solid var(--color-border)",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "var(--color-surface)",
  },
  tagline: { color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.6, marginTop: 0 },
  label: { fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)", marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    fontSize: 14,
    outline: "none",
  },
  button: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "none",
    background: "var(--color-amber)",
    color: "#0b0e14",
    fontWeight: 600,
    fontSize: 14,
  },
  buttonDisabled: { background: "var(--color-border)", color: "var(--color-text-muted)" },
  errorText: { color: "var(--color-error)", fontSize: 13 },
  statusCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--color-amber-soft)",
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--color-amber)", flexShrink: 0 },
  statusTitle: { fontWeight: 600, fontSize: 13 },
  statusSubtitle: { fontSize: 12, color: "var(--color-text-muted)" },
  pipeline: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 },
  pipelineStep: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--font-mono)" },
  pipelineDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0, transition: "background 0.3s ease" },

  chatArea: { flex: 1, display: "flex", flexDirection: "column" },
  fileTreePanel: {
    width: 220,
    borderRight: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--color-bg)",
  },
  fileTreeHeader: {
    padding: "12px 14px",
    fontSize: 11,
    fontWeight: 500,
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptyState: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  emptyText: { color: "var(--color-text-muted)", fontSize: 14 },
  quickPrompts: { display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch", maxWidth: 420 },
  quickPromptButton: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    textAlign: "left",
    color: "var(--color-text)",
    width: "100%",
  },
  messages: { flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  userRow: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  assistantRow: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  userBubble: {
    background: "var(--color-amber)",
    color: "#0b0e14",
    padding: "10px 14px",
    borderRadius: "12px 12px 2px 12px",
    maxWidth: "70%",
    fontSize: 14,
  },
  assistantBubble: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 2px",
    maxWidth: "70%",
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
  citationRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, maxWidth: "70%" },
  citationPill: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    background: "transparent",
    color: "var(--color-cyan)",
    border: "1px solid var(--color-border)",
    padding: "3px 8px",
    borderRadius: 6,
  },
  inputRow: { display: "flex", gap: 10, padding: 16, borderTop: "1px solid var(--color-border)" },
  chatInput: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 6,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    fontSize: 14,
    outline: "none",
  },
};