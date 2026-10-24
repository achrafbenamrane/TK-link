'use client';

import { commissionCents, formatCents } from './billing';

/**
 * LE TABLEAU DE BORD DU GROSSISTE — CDC V1.1 (Grossiste > Process) : « statistiques B2B séparées
 * des statistiques B2C ».
 *
 * Un grossiste ne vend ni des tickets de caisse ni des points de fidélité : il vend des LOTS à des
 * commerçants, avec une quantité minimale, parfois en republication automatique. Lui montrer les
 * chiffres d'un commerçant (« papier évité », « points crédités à vos clients ») serait lui montrer
 * un tableau de bord qui n'est pas le sien.
 *
 * Données de démonstration, de la forme de ce que le serveur renverra.
 */
const LOTS = [
  {
    id: 'lot_tomates',
    title: 'Cagettes de tomates 5 kg',
    orders: 18,
    lotsSold: 142,
    minQty: 5,
    recurrence: 'Chaque semaine',
    grossCents: 127_800,
  },
  {
    id: 'lot_agrumes',
    title: 'Agrumes — carton 10 kg',
    orders: 9,
    lotsSold: 61,
    minQty: 3,
    recurrence: 'Ponctuelle',
    grossCents: 73_200,
  },
  {
    id: 'lot_herbes',
    title: 'Herbes fraîches — lot de 20',
    orders: 14,
    lotsSold: 96,
    minQty: 4,
    recurrence: 'Chaque jour',
    grossCents: 48_000,
  },
];

const BUYERS = [
  ['Le Comptoir du Midi', 12, 94_500],
  ['Primeur des Carmes', 9, 71_200],
  ['Boulangerie Saint-Cyprien', 6, 38_900],
];

/** La synthèse B2B — pure, donc testable sans écran. */
export function b2bTotals(lots, pct) {
  const grossCents = lots.reduce((s, l) => s + l.grossCents, 0);
  const commission = commissionCents(grossCents, pct);
  return {
    orders: lots.reduce((s, l) => s + l.orders, 0),
    lotsSold: lots.reduce((s, l) => s + l.lotsSold, 0),
    grossCents,
    commissionCents: commission,
    netCents: grossCents - commission,
  };
}

export default function B2bDashboard({ commissionPct }) {
  const t = b2bTotals(LOTS, commissionPct);
  return (
    <div data-testid="b2b-dashboard">
      <div className="tkpro-head">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vos ventes de lots aux commerçants — séparées de la vente aux particuliers.</p>
        </div>
        <span className="tkpro-note-inline">Données de démonstration</span>
      </div>

      <div className="tkpro-stats">
        <div className="tkpro-stat">
          <div className="k">Commandes B2B</div>
          <div className="v">{t.orders}</div>
          <div className="d">{t.lotsSold} lots vendus</div>
        </div>
        <div className="tkpro-stat">
          <div className="k">Chiffre d’affaires</div>
          <div className="v">{formatCents(t.grossCents)}</div>
          <div className="d">payé dans l’app, instantanément</div>
        </div>
        <div className="tkpro-stat">
          <div className="k">Commission {commissionPct} %</div>
          <div className="v">{formatCents(t.commissionCents)}</div>
          <div className="d">facturée par TK LINK</div>
        </div>
        <div className="tkpro-stat eco">
          <div className="k">Net pour vous</div>
          <div className="v">{formatCents(t.netCents)}</div>
          <div className="d">avant TVA et charges</div>
        </div>
      </div>

      <div className="tkpro-card" style={{ marginBottom: 18 }}>
        <div className="tkpro-card-head">
          <h2>Vos lots</h2>
        </div>
        <div className="tkpro-scroll">
          <table>
            <thead>
              <tr>
                <th>Lot</th>
                <th className="num">Commandes</th>
                <th className="num">Lots vendus</th>
                <th className="num">Minimum</th>
                <th>Rythme</th>
                <th className="num">Chiffre d’affaires</th>
              </tr>
            </thead>
            <tbody>
              {LOTS.map((l) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.title}</b>
                  </td>
                  <td className="num">{l.orders}</td>
                  <td className="num">{l.lotsSold}</td>
                  <td className="num">{l.minQty} lots</td>
                  <td>{l.recurrence}</td>
                  <td className="num">{formatCents(l.grossCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tkpro-card">
        <div className="tkpro-card-head">
          <h2>Vos meilleurs acheteurs</h2>
        </div>
        <div className="tkpro-scroll">
          <table>
            <thead>
              <tr>
                <th>Commerçant</th>
                <th className="num">Commandes</th>
                <th className="num">Achats</th>
              </tr>
            </thead>
            <tbody>
              {BUYERS.map(([name, orders, cents]) => (
                <tr key={name}>
                  <td>
                    <b>{name}</b>
                  </td>
                  <td className="num">{orders}</td>
                  <td className="num">{formatCents(cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="tkpro-note">
        Vous restez le vendeur légal ; TK LINK vous facture sa commission. Une commande payée
        imprime automatiquement son ticket de préparation à étiquette QR, sans étape d’acceptation.
      </p>
    </div>
  );
}
