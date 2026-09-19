import type { Metadata } from "next";
import { Google_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";

const headingFont = Google_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Google_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Drive",
  description: "An editorial personal archive frontend connected to a Go and MinIO backend.",
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
      className={`${headingFont.variable} ${bodyFont.variable} h-full`}
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
