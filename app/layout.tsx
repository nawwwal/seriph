import type { Metadata } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/lib/contexts/AuthContext";

const leagueSpartan = League_Spartan({
  weight: ['400', '700', '900'],
  subsets: ["latin"],
  variable: "--font-league-spartan",
});

export const metadata: Metadata = {
  title: "Seriph",
  description: "A no-fuss library to browse, test, and tidy your type.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableReactGrab =
    process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB === '1';
  return (
    <html lang="en" data-theme="ink" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'ink';
                document.documentElement.setAttribute('data-theme', theme);
              } catch {}
            `,
          }}
        />
        {enableReactGrab && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-enabled="true"
          />
        )}
      </head>
      <body
        className={`${leagueSpartan.variable} antialiased bg-[var(--paper)] text-[var(--ink)]`}
        style={{ fontFamily: 'var(--font-league-spartan), system-ui, -apple-system, sans-serif' }}
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
