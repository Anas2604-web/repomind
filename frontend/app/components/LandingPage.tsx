"use client";

import { useClerk } from "@clerk/nextjs";

export default function LandingPage() {
  const { openSignIn } = useClerk();

  return (
    <div style={{ overflowX: "hidden" }}>

      {/* ── Hero ── */}
      <section style={{
        minHeight: "calc(100vh - 52px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px",
        position: "relative",
        textAlign: "center",
      }}>
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black, transparent)",
        }} />

        {/* Glow orbs */}
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "absolute", bottom: "10%", right: "5%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
          {/* Badge */}
          <div className="fadeUp" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 100, padding: "6px 16px",
            marginBottom: 32,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", animation: "pulseDot 2s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", letterSpacing: "0.05em" }}>
              AI-powered code understanding
            </span>
          </div>

          {/* Headline */}
          <h1 className="fadeUp" style={{
            fontSize: "clamp(36px, 6vw, 68px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            marginBottom: 24,
            animationDelay: "0.05s",
          }}>
            Understand any codebase
            <br />
            <span className="gold-shimmer">in minutes.</span>
          </h1>

          {/* Subheading */}
          <p className="fadeUp" style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            color: "var(--text-muted)",
            lineHeight: 1.75,
            maxWidth: 560,
            margin: "0 auto 48px",
            animationDelay: "0.1s",
          }}>
            Paste a GitHub URL. RepoMind reads every file, builds a semantic index,
            and answers your questions with <strong style={{ color: "var(--text)", fontWeight: 600 }}>exact file and line citations</strong> — like a senior dev who knows the whole repo.
          </p>

          {/* CTA buttons */}
          <div className="fadeUp" style={{
            display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap",
            animationDelay: "0.15s",
          }}>
            <button
              className="btn btn-primary"
              style={{ padding: "14px 32px", fontSize: 15, borderRadius: 12 }}
              onClick={() => openSignIn()}
            >
              Get started free →
            </button>
            <a
              href="https://github.com/aryanbarde80/repomind"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px", fontSize: 15, borderRadius: 12,
                background: "transparent",
                border: "1.5px solid var(--border)",
                color: "var(--text-muted)",
                textDecoration: "none",
                fontWeight: 600,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </div>

          {/* Social proof */}
          <div className="fadeUp" style={{
            marginTop: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            color: "var(--text-dim)", fontSize: 12,
            animationDelay: "0.2s",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
            Free to use · Open source · No credit card required
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="fadeUp" style={{ textAlign: "center", marginBottom: 56 }}>
          <div className="badge badge-amber" style={{ margin: "0 auto 16px" }}>How it works</div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 14 }}>
            From URL to insight in seconds
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 480, margin: "0 auto" }}>
            Three steps. No setup. No config files. Just paste and ask.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[
            {
              step: "01",
              icon: "⬡",
              title: "Paste a GitHub URL",
              desc: "Any public repository. RepoMind clones it, reads every file, and chunks the code into semantic segments optimized for retrieval.",
              color: "var(--amber)",
            },
            {
              step: "02",
              icon: "◈",
              title: "Ask in plain English",
              desc: "No query syntax. Ask anything — architecture questions, bug hunting, onboarding questions, security reviews — just like talking to a teammate.",
              color: "var(--cyan)",
            },
            {
              step: "03",
              icon: "◎",
              title: "Get cited answers",
              desc: "Every response traces back to exact files and line numbers. Click any citation to jump straight to the source. Verify everything.",
              color: "var(--violet)",
            },
          ].map((f, i) => (
            <div
              key={f.step}
              className="fadeUp feature-card card"
              style={{ padding: "32px 28px", animationDelay: `${i * 0.08}s`, position: "relative", overflow: "hidden" }}
            >
              {/* Step number watermark */}
              <div style={{
                position: "absolute", top: 16, right: 20,
                fontSize: 48, fontWeight: 800, color: "var(--surface-high)",
                fontFamily: "var(--font-mono)", lineHeight: 1, userSelect: "none",
              }}>
                {f.step}
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${f.color}15`,
                border: `1px solid ${f.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, color: f.color, marginBottom: 20,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.01em" }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature highlights ── */}
      <section style={{ padding: "60px 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {[
            { icon: "⚡", label: "30s indexing", desc: "Fast clone, chunk, embed pipeline" },
            { icon: "◈", label: "Line-level citations", desc: "Trace every answer to its source" },
            { icon: "⬡", label: "Visual file tree", desc: "Browse the full repo structure" },
            { icon: "◎", label: "Any public repo", desc: "Works with GitHub URLs instantly" },
            { icon: "✦", label: "Semantic search", desc: "Vector-powered deep retrieval" },
            { icon: "⬟", label: "Open source", desc: "MIT licensed, self-hostable" },
          ].map((item, i) => (
            <div
              key={item.label}
              className="fadeUp card"
              style={{
                padding: "20px 20px",
                display: "flex", alignItems: "flex-start", gap: 14,
                animationDelay: `${i * 0.05}s`,
                transition: "border-color 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--amber)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
            >
              <span style={{ fontSize: 20, color: "var(--amber)", flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section style={{ padding: "0 24px 100px", maxWidth: 800, margin: "0 auto" }}>
        <div className="fadeUp" style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(34,211,238,0.04) 100%)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 24, padding: "56px 48px",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)",
            width: 400, height: 200,
            background: "radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <h2 style={{ fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 700, marginBottom: 14, letterSpacing: "-0.02em" }}>
            Ready to explore a codebase?
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 36, lineHeight: 1.6 }}>
            Sign in and paste any GitHub URL to get started. Free, no credit card needed.
          </p>
          <button
            className="btn btn-primary"
            style={{ padding: "14px 36px", fontSize: 15, borderRadius: 12 }}
            onClick={() => openSignIn()}
          >
            Start exploring →
          </button>
        </div>
      </section>

      {/* ── Footer with developers ── */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "48px 24px 36px",
        maxWidth: 1100, margin: "0 auto",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 48,
          alignItems: "start",
          marginBottom: 40,
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "var(--amber-soft)", border: "1px solid rgba(245,158,11,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--amber)", fontSize: 14,
              }}>⬡</div>
              <span className="gold-shimmer" style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>RepoMind</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.65, maxWidth: 320 }}>
              AI-powered codebase assistant. Understand any GitHub repository through natural language questions with cited answers.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 40 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                Project
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "GitHub", href: "https://github.com/aryanbarde80/repomind" },
                  { label: "Original Repo", href: "https://github.com/Anas2604-web/repomind" },
                ].map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >{l.label}</a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Developers */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
            Built by
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              {
                name: "Anas Khan",
                role: "Original Creator",
                github: "https://github.com/Anas2604-web",
                linkedin: "https://www.linkedin.com/in/anas2604/",
                initials: "AK",
                color: "var(--cyan)",
              },
              {
                name: "Aryan Barde",
                role: "UI & Frontend",
                github: "https://github.com/aryanbarde80",
                linkedin: "https://www.linkedin.com/in/aryanbarde80/",
                initials: "AB",
                color: "var(--amber)",
              },
            ].map((dev) => (
              <div key={dev.name} style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14, padding: "16px 20px",
                minWidth: 260,
                transition: "border-color 0.2s, transform 0.2s",
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = dev.color; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${dev.color}15`,
                  border: `1.5px solid ${dev.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: dev.color,
                  fontFamily: "var(--font-mono)",
                }}>
                  {dev.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{dev.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>{dev.role}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <a href={dev.github} target="_blank" rel="noopener noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
                      fontWeight: 500, transition: "color 0.15s",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
                      GitHub
                    </a>
                    <a href={dev.linkedin} target="_blank" rel="noopener noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
                      fontWeight: 500, transition: "color 0.15s",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = dev.color)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                      LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          paddingTop: 24, borderTop: "1px solid var(--border)",
          flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            © 2025 RepoMind. Open source under MIT License.
          </span>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Built with ⬡ Next.js · FastAPI · Qdrant
          </span>
        </div>
      </footer>
    </div>
  );
}
