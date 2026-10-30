import type { Metadata } from "next";
import "./globals.css";
import { APP_THEME_BOOTSTRAP } from "@/lib/appTheme";
import { LocaleProvider } from "@/components/Localization";

export const metadata: Metadata = {
  title: "Scketch3Dweb 3D editor",
  description: "Browser-based Scketch3Dweb editor workspace",
  icons: {
    icon: "/assets/scketch3dweb/favicon.png",
    apple: "/assets/scketch3dweb/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: APP_THEME_BOOTSTRAP }} /></head>
      <body suppressHydrationWarning><LocaleProvider>{children}</LocaleProvider></body>
    </html>
  );
}
