import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";

export const metadata: Metadata = {
  title: "Drive",
  description: "Your personal cloud drive.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full"
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-[var(--color-surface)] text-[var(--color-text)] antialiased">
        {children}
      </body>
    </html>
  );
}
