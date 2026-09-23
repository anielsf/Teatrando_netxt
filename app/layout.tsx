import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/ThemeProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Teatrando',
    default: 'Teatrando — Vive la Escena',
  },
  description: 'Plataforma SaaS de boletería y gestión teatral. Explora carteleras, selecciona butacas y compra tickets en línea.',
  keywords: ['teatro', 'boletos', 'cartelera', 'Venezuela', 'teatro caracas'],
  openGraph: {
    siteName: 'Teatrando',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
