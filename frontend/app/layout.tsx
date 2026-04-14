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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gangsterbarber.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Gangster Barber | #1 Barbershop in Gweru, Zimbabwe',
    template: '%s | Gangster Barber Gweru'
  },
  description: 'Gangster Barber — Gweru\'s top barbershop in Senga. Precision fades, tapers, lineups & beard sculpts. Walk-ins welcome. Book online. Serving Gweru, Senga, Nehosho & Midlands Province.',
  keywords: [
    'barber Gweru',
    'barbershop Gweru Zimbabwe',
    'haircut Gweru',
    'fade haircut Gweru',
    'taper fade Gweru',
    'lineup barber Gweru',
    'beard trim Gweru',
    'Senga barber',
    'Senga Gweru barbershop',
    'Nehosho barber',
    'best barber in Gweru',
    'barber near me Gweru',
    'cheap haircut Gweru',
    'Gangster Barber Gweru',
    'Midlands barber Zimbabwe',
    'fades Zimbabwe',
    'barber Zimbabwe',
    'hair salon Gweru',
    'men haircut Gweru',
    'low fade Gweru',
    'skin fade Gweru',
  ],
  authors: [{ name: 'Gangster Barber', url: SITE_URL }],
  category: 'barbershop',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "100x100" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/favicon.png", color: "#dc2626" },
    ],
  },
  manifest: "/site.webmanifest",
  verification: {
    google: 'yoXmmh9Y-y3Lts1Ay8QOPcLNTsV9ZJCQKMSXnTP84IM',
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'Gangster Barber | #1 Barbershop in Gweru, Zimbabwe',
    description: 'Precision fades, tapers, lineups & beard sculpts in Senga, Gweru. Walk-ins welcome. Book your session online.',
    url: SITE_URL,
    siteName: 'Gangster Barber',
    locale: 'en_ZW',
    type: 'website',
    images: [{ url: '/logo.png', width: 500, height: 500, alt: 'Gangster Barber — Gweru\'s Top Barbershop' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gangster Barber | Gweru\'s #1 Barbershop',
    description: 'Precision fades, tapers & grooming in Senga, Gweru, Zimbabwe. Book online.',
    images: ['/logo.png'],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { LocalBusinessSchema } from "@/components/seo/Schema";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://adapted-tahr-3.clerk.accounts.dev" />
        <link rel="dns-prefetch" href="https://gangster-barber-backend.vercel.app" />
      </head>
      <body className="text-white selection:bg-red-600 selection:text-white" suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TJFP77LS" height="0" width="0" style={{display:'none',visibility:'hidden'}}></iframe></noscript>
        {/* End Google Tag Manager (noscript) */}

        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TJFP77LS');`}</Script>

        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
          afterSignUpUrl="/onboarding"
          afterSignInUrl="/book"
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
          <LocalBusinessSchema />
          {children}
        </ClerkProvider>

      </body>
    </html>
  );
}

