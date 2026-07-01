import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderNav, UserMenu } from "@/components/header-nav";
import { getSession } from "@/lib/session";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siegfried — Informes Concur",
  description: "Escaneo y validación de informes impresos vía webcam + OCR",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 border-b bg-background">
              <div className="container flex h-16 items-center justify-between gap-4">
                <Link
                  href="/"
                  className="flex items-center gap-2 font-semibold"
                >
                  <Image
                    src="/siegfried.png"
                    alt="Siegfried"
                    width={514}
                    height={158}
                    priority
                    className="h-16 w-auto dark:brightness-110"
                  />
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    Informes Concur
                  </span>
                </Link>
                {session && (
                  <div className="flex flex-1 justify-center">
                    <HeaderNav isMaster={session.isMaster} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {session && <UserMenu username={session.username} />}
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="container flex flex-1 flex-col py-6">
              {children}
            </main>
          </div>
          <Toaster richColors closeButton position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
