import './globals.css';

export const metadata = {
  title: 'Freedoo — Les bons plans de votre quartier, livrés avant qu’ils ne s’envolent',
  description:
    'Freedoo transforme les coups de cœur de vos commerçants de proximité en ventes flash livrées vite, bien et gratuitement. Lancement à Toulouse.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
