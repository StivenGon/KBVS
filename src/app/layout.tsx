import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KBVS | Duelo de mecanografía",
  description:
    "Minijuego de mecanografía en tiempo real para competir en red local, registrar resultados y observar partidas en vivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col text-foreground" suppressHydrationWarning>
        <div className="relative min-h-screen overflow-hidden poster-grid">
          <div className="pointer-events-none absolute inset-0">
            <div className="poster-diagonal absolute inset-0" />
            <div className="absolute -left-24 top-6 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(17,79,183,0.18),transparent_68%)] blur-3xl" />
            <div className="absolute -right-24 top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,138,31,0.2),transparent_68%)] blur-3xl" />
            <div className="absolute -bottom-40 left-1/2 h-96 w-136 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle,rgba(15,34,64,0.08),transparent_72%)] blur-3xl" />
          </div>
          <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
