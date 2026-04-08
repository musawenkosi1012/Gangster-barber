import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "GANGSTER | The Syndicate Elite",
  description: "The Syndicate Pro Series. Surgical grade grooming for the untouchable.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
};

import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="text-white selection:bg-red-600 selection:text-white" suppressHydrationWarning>

        <ClerkProvider>
          <div className="grain"></div>
          {children}
        </ClerkProvider>

      </body>
    </html>
  );
}

