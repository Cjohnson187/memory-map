import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script"; // <-- 1. Import the Script component
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
  title: "Memory Map Application", // Updated title
  description: "A collaborative map to share memories.", // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        {/* 2. Load Leaflet JavaScript using the Next.js Script component */}
        <Script 
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          // We use lazyOnload as the map is not critical for initial render
          strategy="lazyOnload" 
        />
      </body>
    </html>
  );
}
