
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Income Academy course",
  description:
    "Your learning portal for digital marketing and affiliate income skills.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
