import { Inter } from "next/font/google";
import "../globals.css";
import { getMessages } from 'next-intl/server';
import Providers from "@/components/Providers";
import NavbarWrapper from "@/components/NavbarWrapper";

const inter = Inter({ subsets: ["latin"] });

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <Providers messages={messages} locale={locale}>
          <NavbarWrapper />
          {children}
        </Providers>
      </body>
    </html>
  );
}
