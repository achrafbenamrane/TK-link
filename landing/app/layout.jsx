import './globals.css';

// Le titre et la description sont ce qu'on lit dans un résultat de recherche
// ou dans un aperçu de lien partagé — souvent avant la page elle-même. Ils
// décrivaient le matériel abandonné ; ils disent maintenant ce que l'app fait.
export const metadata = {
  title: 'TK LINK — Les ventes flash de votre quartier',
  description:
    'Les commerçants près de chez vous bradent ce qui doit partir aujourd’hui : −30, −50, −70 %. Chaque offre a un compte à rebours et un stock qui fond. Application gratuite, sans engagement, à Toulouse pour commencer.',
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
