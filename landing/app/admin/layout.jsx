export const metadata = {
  title: 'TK LINK — Super Admin',
  description:
    'Le pilotage de la plateforme : inscrits, commerçants actifs, volume, commissions et packs.',
  // Le back-office n'a rien à faire dans un index de moteur de recherche.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return children;
}
