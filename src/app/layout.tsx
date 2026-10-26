import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { MotionPreferencesProvider } from "@/components/motion-preferences";
import { LanguageProvider } from "@/components/language-provider";
import { WebVitalsMonitor } from "@/components/web-vitals-monitor";
export const metadata: Metadata = {
  title: "MoonClean OS · 月明净智能经营",
  description: "月明净智能电商运营管理系统",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-app-font="oppo" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var theme=localStorage.getItem("moonclean-theme-v1");document.documentElement.dataset.theme=theme==="night"||theme!=="day"&&matchMedia("(prefers-color-scheme: dark)").matches?"night":"day";document.documentElement.dataset.appFont=localStorage.getItem("moonclean-font-preference-v1")==="system"?"system":"oppo"}catch{document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"night":"day";document.documentElement.dataset.appFont="oppo"}` }} />
      </head>
      <body>
        <WebVitalsMonitor />
        <AppProvider>
          <LanguageProvider>
            <MotionPreferencesProvider>
              <AppShell>{children}</AppShell>
            </MotionPreferencesProvider>
          </LanguageProvider>
        </AppProvider>
      </body>
    </html>
  );
}
