import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout";
import { ToastProvider } from "@/components/ui";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Clusters Platform",
  description: "Modern Multi-Cloud Cluster Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ToastProvider>
          <OrganizationProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-16 sm:ml-64 p-6 lg:p-8 transition-all duration-300">
                <div className="max-w-7xl mx-auto">{children}</div>
              </main>
            </div>
          </OrganizationProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
