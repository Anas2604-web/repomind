import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import PostHogProvider from "./components/PostHogProvider";
import AuthButtons from "./components/AuthButtons";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jb-mono",
});

export const metadata: Metadata = {
  title: "RepoMind — AI codebase assistant",
  description: "Paste a GitHub repo, ask questions about the code, get cited answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <body>
          <PostHogProvider>
            <header style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 20px",
              height: 52,
              borderBottom: "1px solid var(--border)",
              background: "rgba(8,11,18,0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              position: "sticky",
              top: 0,
              zIndex: 100,
            }}>
              {/* Logo */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "var(--amber-soft)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--amber)", fontSize: 14,
                }}>⬡</div>
                <span className="gold-shimmer" style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  RepoMind
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "var(--text-dim)",
                  background: "var(--surface-raised)", border: "1px solid var(--border)",
                  padding: "2px 7px", borderRadius: 20, letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>Beta</span>
              </div>

              {/* Right side */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <a
                  href="https://github.com/aryanbarde80/repomind"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gh-link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </a>
                <div style={{ width: 1, height: 18, background: "var(--border)" }} />
                <AuthButtons />
              </div>
            </header>
            {children}
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
