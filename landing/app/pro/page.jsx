'use client';

import { useMemo, useState } from 'react';

import './pro.css';
import {
  canPublish,
  COMMISSION_PCT,
  formatCents,
  freeLeft,
  FREE_OPERATIONS,
  operationsLeft,
  PACKS,
} from './billing';
import { DOCUMENTS, formatDate, formatMoney, OFFERS, PAPER_G_PER_RECEIPT } from './data';
import OfferForm from './offer-form';
import {
  ACTION_LABEL,
  isActive,
  nextStatuses,
  ORDER_STATUS_LABEL,
  ORDERS,
  sinceLabel,
} from './orders';

/**
 * Espace professionnel TK LINK — la « version web pour les entreprises ».
 *
 * Trois métiers, dans l'ordre où le commerçant s'en sert :
 *  • Tableau de bord — ce que la journée a produit
 *  • Documents — les tickets et factures émis, avec les données extraites et
 *    l'export attendu par le comptable
 *  • Offres — ce qui apparaît dans l'app des clients
 *
 * Les données sont simulées (pas de back-end ni de lecteur branché) mais elles
 * ont exactement la forme du schéma de l'app mobile : le jour où l'API arrive,
 * seule la source change.
 */
const TABS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: '▦' },
  { key: 'orders', label: 'Commandes', icon: '📦' },
  { key: 'documents', label: 'Tickets & factures', icon: '🧾' },
  { key: 'offers', label: 'Offres', icon: '％' },
];

/** Un brouillon d'offre vers la carte affichée dans la liste. */
function toCard(draft) {
  const pct = Math.round((1 - draft.priceCents / draft.oldPriceCents) * 100);
  return {
    id: `o_${Date.now()}`,
    title: draft.title,
    claim: `-${pct} %`,
    audience: `${draft.stock} pièce${draft.stock > 1 ? 's' : ''} · ${
      draft.durationMinutes < 60
        ? `${draft.durationMinutes} min`
        : `${draft.durationMinutes / 60} h`
    }`,
    flash: true,
    live: true,
  };
}

export default function ProPage() {
  const [tab, setTab] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(DOCUMENTS[0].id);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [toast, setToast] = useState(null);

  /* --- Offres et quota (CDC §9). Local à la page : le back-office prendra
     le relais, la forme des données ne changera pas. --- */
  const [offers, setOffers] = useState(OFFERS);
  const [composing, setComposing] = useState(false);
  const [used, setUsed] = useState(OFFERS.length);
  const [purchased, setPurchased] = useState(0);

  /* --- Commandes reçues (CDC §11 et §18). --- */
  const [orders, setOrders] = useState(ORDERS);

  const advance = (orderId, status) =>
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status } : o)));

  const waiting = orders.filter((o) => isActive(o.status)).length;

  const left = operationsLeft(used, purchased);
  const free = freeLeft(used);
  const allowed = canPublish(used, purchased);

  const selected = useMemo(() => DOCUMENTS.find((d) => d.id === selectedId) ?? null, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCUMENTS.filter((d) => {
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false;
      if (!q) return true;
      return `${d.customer} ${d.reference} ${d.lines.map((l) => l.label).join(' ')}`
        .toLowerCase()
        .includes(q);
    });
  }, [query, kindFilter]);

  const totals = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const todays = DOCUMENTS.filter((d) => d.issuedAt >= today);
    return {
      todayCount: todays.length,
      todayCents: todays.reduce((s, d) => s + d.totalCents, 0),
      totalCents: DOCUMENTS.reduce((s, d) => s + d.totalCents, 0),
      vatCents: DOCUMENTS.reduce((s, d) => s + d.vatCents, 0),
      points: DOCUMENTS.reduce((s, d) => s + d.pointsIssued, 0),
      paperG: DOCUMENTS.length * PAPER_G_PER_RECEIPT,
    };
  }, []);

  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  /** Export comptable : on produit un vrai CSV, téléchargé par le navigateur. */
  const exportCsv = () => {
    const header = [
      'Reference',
      'Date',
      'Client',
      'Devise',
      'Montant HT',
      'Montant TVA',
      'Montant TTC',
      'Echeance',
      'Code fournisseur',
      'Certificat',
    ];
    const rows = filtered.map((d) => [
      d.reference,
      formatDate(d.issuedAt),
      d.customer,
      d.currency,
      (d.netCents / 100).toFixed(2),
      (d.vatCents / 100).toFixed(2),
      (d.totalCents / 100).toFixed(2),
      d.dueAt ? formatDate(d.dueAt) : '',
      d.supplierCode,
      d.certificateId,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tklink-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`${filtered.length} document(s) exporté(s) — compatible avec votre logiciel comptable.`);
  };

  return (
    <div className="tkpro">
      {/* ------------------------------------------------------------ nav */}
      <aside className="tkpro-side">
        <div className="tkpro-logo">
          TK<span>LINK</span>
        </div>

        <nav className="tkpro-nav" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="tkpro-side-foot">
          Le Comptoir du Midi
          <br />
          Lecteur TK LINK connecté
        </div>
      </aside>

      {/* ----------------------------------------------------------- corps */}
      <main className="tkpro-main">
        {tab === 'dashboard' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Tableau de bord</h1>
                <p>Ce que votre caisse a produit, sans une seule impression.</p>
              </div>
            </div>

            <div className="tkpro-stats">
              <div className="tkpro-stat">
                <div className="k">Aujourd’hui</div>
                <div className="v">{totals.todayCount}</div>
                <div className="d">{formatMoney(totals.todayCents)} encaissés</div>
              </div>
              <div className="tkpro-stat">
                <div className="k">Total documents</div>
                <div className="v">{DOCUMENTS.length}</div>
                <div className="d">{formatMoney(totals.totalCents)} au total</div>
              </div>
              <div className="tkpro-stat">
                <div className="k">TVA collectée</div>
                <div className="v">{formatMoney(totals.vatCents)}</div>
                <div className="d">Prête pour la déclaration</div>
              </div>
              <div className="tkpro-stat eco">
                <div className="k">Papier évité</div>
                <div className="v">{totals.paperG} g</div>
                <div className="d">
                  {DOCUMENTS.length} tickets non imprimés · {totals.points} points offerts
                </div>
              </div>
            </div>

            <div className="tkpro-card">
              <div className="tkpro-card-head">
                <h2>Derniers documents</h2>
                <button type="button" className="tkpro-btn" onClick={() => setTab('documents')}>
                  Tout voir
                </button>
              </div>
              <div className="tkpro-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Référence</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th className="num">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DOCUMENTS.slice(0, 5).map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => {
                          setSelectedId(d.id);
                          setTab('documents');
                        }}
                      >
                        <td>{d.reference}</td>
                        <td>{d.customer}</td>
                        <td>{formatDate(d.issuedAt)}</td>
                        <td>
                          <span className={`tkpro-tag ${d.kind}`}>{d.kind.toUpperCase()}</span>
                        </td>
                        <td className="num">{formatMoney(d.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="tkpro-note">
              Chaque passage de carte remplace un ticket imprimé. Le document part au client, la
              facture à votre comptable, et les données sont déjà classées.
            </p>
          </>
        ) : null}

        {tab === 'orders' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Commandes</h1>
                <p>
                  {waiting > 0
                    ? `${waiting} commande${waiting > 1 ? 's' : ''} à traiter.`
                    : 'Rien en attente pour l’instant.'}
                </p>
              </div>
            </div>

            <div className="tkpro-orders">
              {orders.map((o) => {
                const options = nextStatuses(o.status, o.fulfilment);
                return (
                  <div
                    className={isActive(o.status) ? 'tkpro-order' : 'tkpro-order done'}
                    key={o.id}
                  >
                    <div className="head">
                      <div>
                        <b>{o.customer}</b>
                        <span>
                          {o.id} · {sinceLabel(o.placedAt)} ·{' '}
                          {o.fulfilment === 'click-collect' ? 'Click & Collect' : 'Livraison'}
                        </span>
                      </div>
                      <span className={`tkpro-tag ${isActive(o.status) ? 'flash' : 'ticket'}`}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </div>

                    <ul className="lines">
                      {o.lines.map((l) => (
                        <li key={l.label}>
                          <span>{l.label}</span>
                          <b>×{l.qty}</b>
                        </li>
                      ))}
                    </ul>

                    <div className="foot">
                      <b>{formatMoney(o.totalCents)}</b>
                      <div className="actions">
                        {options.map((status, i) => (
                          <button
                            key={status}
                            type="button"
                            className={
                              i === 0 && status !== 'annulee' && status !== 'remboursee'
                                ? 'tkpro-btn primary'
                                : 'tkpro-btn'
                            }
                            onClick={() => {
                              advance(o.id, status);
                              notify(`${o.id} — ${ORDER_STATUS_LABEL[status]}.`);
                            }}
                          >
                            {ACTION_LABEL[status] ?? ORDER_STATUS_LABEL[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="tkpro-note">
              Les gestes proposés suivent la machine à états du CDC §11 : une commande en Click
              &amp; Collect ne peut pas être « livrée », et une commande remboursée ne repart pas en
              préparation. Ce sont les mêmes règles que dans l’application du commerçant.
            </p>
          </>
        ) : null}

        {tab === 'documents' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Tickets &amp; factures</h1>
                <p>Sélectionnez un document pour voir les données extraites.</p>
              </div>
              <div className="tkpro-filters">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Client, référence, article…"
                  aria-label="Rechercher un document"
                />
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  aria-label="Filtrer par type"
                >
                  <option value="all">Tous les types</option>
                  <option value="facture">Factures</option>
                  <option value="ticket">Tickets</option>
                </select>
                <button
                  type="button"
                  className="tkpro-btn primary"
                  onClick={exportCsv}
                  disabled={filtered.length === 0}
                >
                  Export comptable
                </button>
              </div>
            </div>

            <div className="tkpro-card" style={{ marginBottom: 18 }}>
              <div className="tkpro-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Référence</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Canal</th>
                      <th className="num">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr
                        key={d.id}
                        aria-selected={d.id === selectedId}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <td>{d.reference}</td>
                        <td>{d.customer}</td>
                        <td>{formatDate(d.issuedAt)}</td>
                        <td>
                          <span className={`tkpro-tag ${d.kind}`}>{d.kind.toUpperCase()}</span>
                        </td>
                        <td>
                          {d.channel === 'online' ? (
                            <span className="tkpro-tag online">EN LIGNE</span>
                          ) : (
                            <span style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
                              En magasin
                            </span>
                          )}
                        </td>
                        <td className="num">{formatMoney(d.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 ? (
                <div className="tkpro-empty">Aucun document ne correspond à cette recherche.</div>
              ) : null}
            </div>

            {/* Détail : le document à gauche, ce que l'IA en a tiré à droite */}
            {selected ? (
              <div className="tkpro-card">
                <div className="tkpro-card-head">
                  <h2>Détail — {selected.reference}</h2>
                  {selected.certificateId ? (
                    <span className="tkpro-tag facture">Certificat {selected.certificateId}</span>
                  ) : (
                    <span className="tkpro-tag ticket">Ticket non converti</span>
                  )}
                </div>

                <div className="tkpro-split">
                  <div className="tkpro-doc">
                    <div className="tkpro-paper">
                      <div style={{ textAlign: 'center', fontWeight: 700 }}>
                        LE COMPTOIR DU MIDI
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {formatDate(selected.issuedAt, true)}
                      </div>
                      <hr />
                      {selected.lines.map((l, i) => (
                        <div className="r" key={`${l.label}-${i}`}>
                          <span>
                            {l.qty} × {l.label}
                          </span>
                          <span>{formatMoney(l.unitCents * l.qty)}</span>
                        </div>
                      ))}
                      <hr />
                      <div className="r">
                        <span>TOTAL HT</span>
                        <span>{formatMoney(selected.netCents)}</span>
                      </div>
                      <div className="r">
                        <span>TVA 20 %</span>
                        <span>{formatMoney(selected.vatCents)}</span>
                      </div>
                      <div className="r" style={{ fontWeight: 700 }}>
                        <span>TOTAL TTC</span>
                        <span>{formatMoney(selected.totalCents)}</span>
                      </div>
                      <hr />
                      <div style={{ textAlign: 'center' }}>{selected.reference}</div>
                    </div>
                  </div>

                  <div className="tkpro-fields">
                    <span className="tkpro-extracted">✓ Données extraites automatiquement</span>

                    <Field k="Nom de l’organisation" v="Le Comptoir du Midi" />
                    <Field k="Client" v={selected.customer} />
                    <Field k="Référence du document" v={selected.reference} />
                    <Field k="Date du document" v={formatDate(selected.issuedAt)} />
                    <Field k="Devise" v={selected.currency} />
                    <Field k="Montant (HT)" v={formatMoney(selected.netCents)} />
                    <Field k="Montant (TVA)" v={formatMoney(selected.vatCents)} />
                    <Field k="Montant (TTC)" v={formatMoney(selected.totalCents)} />
                    <Field
                      k="Date d’échéance"
                      v={selected.dueAt ? formatDate(selected.dueAt) : '—'}
                    />
                    <Field k="Code fournisseur" v={selected.supplierCode || 'Non affecté'} />
                    <Field k="Points crédités au client" v={`${selected.pointsIssued} points`} />

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="tkpro-btn primary"
                        onClick={() => notify('Document transmis à votre comptable.')}
                      >
                        Envoyer au comptable
                      </button>
                      <button
                        type="button"
                        className="tkpro-btn"
                        onClick={() => notify('Copie envoyée au client.')}
                      >
                        Renvoyer au client
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <p className="tkpro-note">
              L’export reprend les documents actuellement filtrés, au format CSV — lisible par tous
              les logiciels comptables du marché.
            </p>
          </>
        ) : null}

        {tab === 'offers' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Offres</h1>
                <p>Ce que vos clients voient dans l’app, sur leur carte TK LINK.</p>
              </div>
              <button
                type="button"
                className="tkpro-btn primary"
                disabled={!allowed}
                onClick={() => (composing ? setComposing(false) : setComposing(true))}
              >
                {composing ? 'Fermer' : 'Nouvelle offre'}
              </button>
            </div>

            {/* Le quota du CDC §9, affiché AVANT d'être subi. */}
            <div className={allowed ? 'tkpro-quota' : 'tkpro-quota empty'}>
              <div>
                <b>
                  {left} opération{left > 1 ? 's' : ''} disponible{left > 1 ? 's' : ''}
                </b>
                <span>
                  {free > 0
                    ? `Dont ${free} offerte${free > 1 ? 's' : ''} — les ${FREE_OPERATIONS} premières sont gratuites.`
                    : 'Vos opérations gratuites sont consommées : prenez un pack pour continuer.'}
                </span>
              </div>
              <div className="tkpro-packs">
                {PACKS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="tkpro-pack"
                    onClick={() => {
                      setPurchased((n) => n + p.operations);
                      notify(`${p.label} crédité — ${p.operations} opérations.`);
                    }}
                  >
                    <b>{p.operations}</b>
                    <span>{formatCents(p.priceCents)}</span>
                  </button>
                ))}
              </div>
            </div>

            {composing ? (
              <OfferForm
                onPublish={(draft) => {
                  setOffers((list) => [toCard(draft), ...list]);
                  setUsed((n) => n + 1);
                  setComposing(false);
                  notify(`« ${draft.title} » est en ligne dans l’app.`);
                }}
                onCancel={() => setComposing(false)}
              />
            ) : null}

            <div className="tkpro-offers">
              {offers.map((o) => (
                <div className="tkpro-offer" key={o.id}>
                  <div className="claim">{o.claim}</div>
                  <div className="body">
                    <b>{o.title}</b>
                    <span>{o.audience}</span>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {o.flash ? <span className="tkpro-tag flash">FLASH</span> : null}
                      <span className={`tkpro-tag ${o.live ? 'facture' : 'ticket'}`}>
                        {o.live ? 'EN LIGNE' : 'HORS LIGNE'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="tkpro-note">
              Une offre publiée ici apparaît immédiatement dans l’app des clients, et la remise
              s’applique au passage de la carte en caisse. TK LINK prélève {COMMISSION_PCT}&nbsp;%
              sur chaque vente (CDC §21).
            </p>
          </>
        ) : null}
      </main>

      {toast ? (
        <div className="tkpro-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Field({ k, v }) {
  return (
    <div className="tkpro-field">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
