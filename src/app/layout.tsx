import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { MotionPreferencesProvider } from "@/components/motion-preferences";
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
    <html lang="zh-CN">
      <body>
        <AppProvider>
          <MotionPreferencesProvider>
            <AppShell>{children}</AppShell>
          </MotionPreferencesProvider>
        </AppProvider>
      </body>
    </html>
  );
}
