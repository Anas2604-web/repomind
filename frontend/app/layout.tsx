import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import PostHogProvider from "./components/PostHogProvider";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "RepoMind — AI codebase assistant",
  description: "Paste a GitHub repo, ask questions about the code, get cited answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <ClerkProvider>
        <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
        <body>
        <PostHogProvider>
          <header style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 20px", borderBottom: "1px solid var(--color-border)",
            minHeight: 48, background: "var(--color-bg)",
          }}>
              <span style={{
                fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
                color: "var(--color-text-muted)", fontWeight: 500,
              }}>
                RepoMind
              </span>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="primaryButton" style={{
                  background: "var(--color-amber)", color: "#0b0e14", border: "none",
                  borderRadius: 6, padding: "7px 16px", fontWeight: 600,
                  fontSize: 13, cursor: "pointer",
                }}>
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </header>
          {children}
        </PostHogProvider>
        </body>
        </html>
      </ClerkProvider>
  );
}