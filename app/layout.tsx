import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TruthFence AI — Reliability & Adversarial Testing Workbench',
  description:
    "Don't trust the response. Test the evidence. Open-source AI reliability and adversarial testing workbench for Gemma 4 via Gemini API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-fence-darkest text-slate-100 antialiased min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
