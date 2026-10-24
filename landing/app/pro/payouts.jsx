'use client';

import { useState } from 'react';

import { commissionCents, formatCents } from './billing';

const DAY = 24 * 3600 * 1000;

/**
 * LES VERSEMENTS — CDC V1.1 (Commerçant > Flux finance) : « un onglet Versements affiche le
 * calendrier et les montants issus de Stripe Connect. TK Link ne construit pas de moteur de
 * trésorerie. »
 *
 * Donc cet écran LIT, il ne calcule pas de règle de versement : chaque ligne est un virement que
 * Stripe exécute. Le montant versé est la vente moins la commission de TK LINK (le split est fait
 * par Stripe : le commerçant reçoit le prix diminué de la commission). Les lignes ci-dessous sont
 * de démonstration — le rythme réel des versements est celui du compte Stripe Connect du
 * commerçant, pas un choix de TK LINK.
 *
 * ⚠️ « Direct charges » (le commerçant reste vendeur de référence) est encore à vérifier côté
 * Stripe (CDC, points ouverts) : tant qu'il ne l'est pas, ce tableau décrit l'intention.
 */
function demoPayouts(now) {
  // [semaine terminée il y a N jours, ventes de la semaine en centimes, état]
  const rows = [
    [0, 143_200, 'avenir'],
    [7, 128_600, 'encours'],
    [14, 171_900, 'verse'],
    [21, 96_400, 'verse'],
    [28, 154_300, 'verse'],
  ];
  return rows.map(([ago, grossCents, state]) => ({
    id: `vers_${ago}`,
    // Stripe verse quelques jours après la fin de la période : on n'invente pas de délai, on
    // montre la période et l'état.
    periodEnd: now - ago * DAY,
    grossCents,
    state,
  }));
}

const STATE = {
  verse: { label: 'Versé', cls: 'ticket' },
  encours: { label: 'En cours', cls: 'flash' },
  avenir: { label: 'À venir', cls: 'online' },
};

function day(ms) {
  return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function PayoutsPanel({ commissionPct, iban, role }) {
  // Posé une fois au montage : un rendu doit rester pur (pas de `Date.now()` à chaque passage).
  const [now] = useState(() => Date.now());
  const rows = demoPayouts(now).map((r) => {
    const fee = commissionCents(r.grossCents, commissionPct);
    return { ...r, feeCents: fee, netCents: r.grossCents - fee };
  });
  const paid = rows.filter((r) => r.state === 'verse').reduce((s, r) => s + r.netCents, 0);
  const upcoming = rows.filter((r) => r.state !== 'verse').reduce((s, r) => s + r.netCents, 0);

  return (
    <>
      <div className="tkpro-head">
        <div>
          <h1>Versements</h1>
          <p>
            Le calendrier et les montants de vos virements, issus de Stripe Connect. TK LINK ne
            détient pas votre argent : le paiement est réparti à la vente.
          </p>
        </div>
        <span className="tkpro-note-inline">Données de démonstration</span>
      </div>

      <div className="tkpro-stats">
        <div className="tkpro-stat eco">
          <div className="k">Déjà versé</div>
          <div className="v">{formatCents(paid)}</div>
          <div className="d">sur les 3 dernières semaines versées</div>
        </div>
        <div className="tkpro-stat">
          <div className="k">À recevoir</div>
          <div className="v">{formatCents(upcoming)}</div>
          <div className="d">versements en cours ou à venir</div>
        </div>
        <div className="tkpro-stat">
          <div className="k">Compte de versement</div>
          <div className="v" style={{ fontSize: 15 }}>
            {iban}
          </div>
          <div className="d">modifiable sur demande vérifiée</div>
        </div>
      </div>

      <div className="tkpro-card">
        <div className="tkpro-card-head">
          <h2>Calendrier</h2>
        </div>
        <div className="tkpro-scroll">
          <table>
            <thead>
              <tr>
                <th>Période se terminant le</th>
                <th className="num">Ventes</th>
                <th className="num">Commission {commissionPct} %</th>
                <th className="num">Versé</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{day(r.periodEnd)}</td>
                  <td className="num">{formatCents(r.grossCents)}</td>
                  <td className="num">− {formatCents(r.feeCents)}</td>
                  <td className="num">
                    <b>{formatCents(r.netCents)}</b>
                  </td>
                  <td>
                    <span className={`tkpro-tag ${STATE[r.state].cls}`}>
                      {STATE[r.state].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="tkpro-note">
        {role === 'grossiste'
          ? 'Les commandes B2B sont payées instantanément dans l’app : vous êtes le vendeur légal, TK LINK vous facture sa commission.'
          : 'Vous restez le vendeur légal (produit, TVA) : TK LINK facture uniquement sa commission.'}{' '}
        Le rythme des virements est celui de votre compte Stripe Connect.
      </p>
    </>
  );
}
