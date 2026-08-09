import './globals.css';

export const metadata = {
  title: 'TK LINK — La dématérialisation du ticket de caisse',
  description:
    'En caisse, le lecteur TK LINK remplace l’imprimante papier. Le ticket arrive dans l’application, devient une facture certifiée, et ses données partent classées vers votre comptable. Particuliers et professionnels, partout en France.',
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
