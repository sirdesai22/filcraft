import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EpisodeMarket",
  description:
    "Plug memories into agents. Pay once. Run forever. Browse and install curated experience files and agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased bg-background text-foreground font-sans`}
      >
        <Providers>
          <TooltipProvider>
            <Navbar />
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
