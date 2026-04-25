import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { getThemeFromCookies } from "@/lib/theme";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: '바이럴 쇼츠',
    template: '%s | 바이럴 쇼츠',
  },
  description:
    '유튜브 쇼츠·틱톡·인스타 릴스에서 매일 자동 수집·AI 분류된 바이럴 영상으로, 잘 팔릴 상품을 먼저 발견하세요.',
  openGraph: {
    title: '바이럴 쇼츠',
    description: '3대 쇼츠 플랫폼 트렌드를 한눈에. 28일 100,000원.',
    locale: 'ko_KR',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeFromCookies();
  const htmlClass = theme === 'dark' ? 'dark' : '';

  return (
    <html lang="ko" className={htmlClass} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className={`${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
