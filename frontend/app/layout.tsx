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
  initialScale: 1,
};

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="text-white selection:bg-red-600 selection:text-white" suppressHydrationWarning>

        <ClerkProvider 
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#ff0000",
              colorBackground: "#000000",
              colorText: "#ffffff",
              colorTextSecondary: "rgba(255,255,255,0.4)",
              borderRadius: "16px",
            },
            elements: {
              card: "bg-black border border-white/5 shadow-2xl rounded-3xl p-8 backdrop-blur-2xl",
              headerTitle: "text-white text-2xl font-black tracking-tighter uppercase",
              headerSubtitle: "text-white/40 text-[10px] font-bold tracking-[0.3em] uppercase",
              formButtonPrimary: "bg-white hover:bg-white/90 text-black text-xs font-black uppercase tracking-widest py-4 rounded-full transition-all duration-300",
              socialButtonsBlockButton: "bg-black border border-white/10 hover:bg-white/5 p-3 rounded-2xl transition-all duration-300",
              socialButtonsBlockButtonText: "text-white/70 font-bold tracking-tight text-xs",
              formFieldLabel: "text-white/40 uppercase text-[9px] font-black tracking-widest mb-2 ml-1",
              formFieldInput: "bg-black border border-white/5 text-white rounded-2xl px-5 py-4 focus:border-white/20 focus:bg-[#0a0a0a] transition-all text-sm font-medium",
              dividerLine: "bg-white/5",
              dividerText: "text-white/20 uppercase text-[9px] font-black tracking-widest",
              footerActionLink: "text-white hover:text-white/80 font-black",
              footerActionText: "text-white/40 font-bold",
              identityPreviewText: "text-white",
              identityPreviewEditButtonIcon: "text-white/60",
              formFieldErrorText: "text-red-500 font-bold text-[10px] uppercase tracking-widest mt-2 ml-1",
            }
          }}
          unsafe_disableDevelopmentModeConsoleWarning
        >
          <div className="grain"></div>
          {children}
        </ClerkProvider>

      </body>
    </html>
  );
}

