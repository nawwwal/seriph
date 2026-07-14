import type { Metadata } from "next";
import { League_Spartan } from "next/font/google";
import { InterfaceKit } from "interface-kit/react";
import { Agentation } from "agentation";
import "./globals.css";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import AppFrame from "@/components/layout/AppFrame";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { UploadProvider } from "@/lib/contexts/UploadContext";
import UploadCenterOverlay from "@/components/upload/UploadCenterOverlay";
import FirebasePerformance from "@/components/monitoring/FirebasePerformance";

const leagueSpartan = League_Spartan({
  // Variable wght axis — theme roller interpolates weight continuously.
  weight: 'variable',
  subsets: ['latin'],
  variable: '--font-league-spartan',
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
  const isDevelopment = process.env.NODE_ENV === "development";
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
                const theme = localStorage.getItem('seriph-theme:v1') || localStorage.getItem('theme') || 'ink';
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
        <FirebasePerformance />
        <ThemeProvider>
          <AuthProvider>
            <UploadProvider>
              <AppFrame>
                {children}
              </AppFrame>
              {isDevelopment && <InterfaceKit />}
              {isDevelopment && <Agentation />}
              <UploadCenterOverlay />
            </UploadProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
