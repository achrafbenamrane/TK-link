'use client';

import { useEffect, useMemo, useState } from 'react';

import './pro.css';
import { COMMISSION_PCT, formatCents, freeLeft } from './billing';
import {
  conversionPct,
  discountPct,
  DOCUMENTS,
  FLASH_STATS,
  formatDate,
  MERCHANT,
  formatMoney,
  formatSoldOut,
  OFFERS,
  PAPER_G_PER_RECEIPT,
  remaining,
  remainingLabel,
} from './data';
import OfferForm from './offer-form';
import {
  ACTION_LABEL,
  merchantActions,
  pathTo,
  isActive,
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
 * Les données sont simulées (aucun back-end) mais elles
 * ont exactement la forme du schéma de l'app mobile : le jour où l'API arrive,
 * seule la source change.
 */
const TABS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: '▦' },
  { key: 'orders', label: 'Commandes', icon: '📦' },
  { key: 'documents', label: 'Tickets & factures', icon: '🧾' },
  { key: 'offers', label: 'Offres', icon: '％' },
  { key: 'profile', label: 'Mon commerce', icon: '🏪' },
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

  /* --- Commandes reçues (CDC §11 et §18). --- */
  const [orders, setOrders] = useState(ORDERS);

  const advance = (orderId, status) =>
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status } : o)));

  const waiting = orders.filter((o) => isActive(o.status)).length;

  // Plus de packs achetés : seules les opérations offertes comptent, tant que
  // la tarification n'est pas arbitrée par le client (CDC §14).
  const [editing, setEditing] = useState(null);
  const editingOffer = offers.find((o) => o.id === editing) ?? null;

  /**
   * Une SEULE horloge pour toutes les cartes.
   *
   * Un minuteur par carte ferait battre quatre rendus par seconde là où un
   * suffit — et les comptes à rebours se décaleraient les uns des autres, ce
   * qui se voit immédiatement sur une grille.
   */
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = freeLeft(used);
  const allowed = left > 0;

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
          Espace professionnel
        </div>
      </aside>

      {/* ----------------------------------------------------------- corps */}
      <main className="tkpro-main">
        {tab === 'dashboard' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Tableau de bord</h1>
                <p>Ce que vos ventes flash ont produit, sans une seule impression.</p>
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

            {/* CDC V1.0 §11.3 — ce que chaque Flash a réellement produit.
                Le document en donne la raison : « le commerçant doit pouvoir
                répondre objectivement à — qu'est-ce que TKLINK m'a rapporté ? ».
                Sans ces chiffres, la conversion vers les offres payantes repose
                sur une impression. */}
            <div className="tkpro-card">
              <div className="tkpro-card-head">
                <h2>Performance de vos Flash</h2>
                <span className="tkpro-note-inline">Données de démonstration</span>
              </div>
              <div className="tkpro-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Opération</th>
                      <th className="num">Vues</th>
                      <th className="num">Vendu / initial</th>
                      <th className="num">Reste</th>
                      <th className="num">Conversion</th>
                      <th className="num">Épuisé en</th>
                      <th className="num">Chiffre d’affaires</th>
                      <th>Retrait / livraison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FLASH_STATS.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <b>{f.title}</b>
                        </td>
                        <td className="num">{f.views}</td>
                        <td className="num">
                          {f.sold} / {f.initial}
                        </td>
                        <td className="num">{remaining(f)}</td>
                        <td className="num">{conversionPct(f)}&nbsp;%</td>
                        <td className="num">{formatSoldOut(f.soldOutInMin)}</td>
                        <td className="num">{formatMoney(f.revenueCents)}</td>
                        <td>
                          {f.touchCollect} Touch &amp; Collect · {f.delivery} livraison
                          {f.delivery > 1 ? 's' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="tkpro-note">
                « Épuisé en » compte le temps entre la publication et la dernière unité vendue —
                c’est lui qui dit si le prix était juste ou si la quantité était trop large.
              </p>
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
              Chaque vente honorée remplace un ticket imprimé. Le document part au client, la
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
                const gestes = merchantActions(o.status, o.fulfilment);
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
                          {o.fulfilment === 'touch-collect' ? 'Touch & Collect' : 'Livraison'}
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
                        {gestes.map((geste) => (
                          <button
                            key={geste.target}
                            type="button"
                            disabled={!geste.enabled}
                            className={geste.tone === 'primary' ? 'tkpro-btn primary' : 'tkpro-btn'}
                            onClick={() => {
                              // Un seul geste peut valoir deux transitions —
                              // « mettre en préparation » accepte au passage.
                              const chemin = pathTo(o.status, geste.target, o.fulfilment);
                              for (const etape of chemin) advance(o.id, etape);
                              const dernier = chemin[chemin.length - 1] ?? geste.target;
                              notify(`${o.id} — ${ORDER_STATUS_LABEL[dernier]}.`);
                            }}
                          >
                            {ACTION_LABEL[geste.target] ?? ORDER_STATUS_LABEL[geste.target]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="tkpro-note">
              Les mêmes gestes sur toutes les commandes, dans le même ordre : seuls ceux que la
              commande autorise sont actifs. Une commande en Touch &amp; Collect se remet en main
              propre et ne peut pas être « livrée » ; refuser une commande payée déclenche le
              remboursement, ce n’est pas un geste séparé. Ce sont les règles du CDC §5.2, et les
              mêmes que dans l’application du commerçant.
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
                <p>Ce que vos clients voient dans l’app.</p>
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

            {/* Ce qu'il reste à publier, et rien d'autre.
                Ce bandeau vendait des packs — « 191 opérations disponibles, dont
                1 offerte », avec trois boutons à 9,90 / 24,90 / 69,00 €. Deux
                défauts. Il était illisible : personne ne comprend un solde qui
                mélange des crédits offerts et des crédits achetés. Et surtout
                ces prix étaient INVENTÉS : le §14 du CDC classe « la tarification
                des packs » parmi les points volontairement non tranchés, et
                interdit de leur donner une valeur. Montrer un tarif au client
                sur son propre espace pro, c'est décider à sa place. */}
            <div className={allowed ? 'tkpro-quota' : 'tkpro-quota empty'}>
              <div>
                <b>
                  {left} offre{left > 1 ? 's' : ''} flash disponible{left > 1 ? 's' : ''}
                </b>
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

            {/* Les cartes montrent ce que le CLIENT voit — photo, les deux
                prix, le temps restant, le stock. Un commerçant ne peut pas
                piloter une offre dont il ne voit que l'accroche : c'est le prix
                et le stock qui décident s'il faut la prolonger, la réapprovisionner
                ou la retirer. Un clic ouvre la même carte en modification. */}
            <div className="tkpro-offers">
              {offers.map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  now={clock}
                  onEdit={() => {
                    setEditing(o.id);
                    setComposing(false);
                  }}
                  onToggleLive={() => {
                    setOffers((list) =>
                      list.map((x) => (x.id === o.id ? { ...x, live: !x.live } : x)),
                    );
                    notify(`« ${o.title} » ${o.live ? 'retirée de l’app' : 'remise en ligne'}.`);
                  }}
                />
              ))}
            </div>

            {/* La modification réutilise le formulaire de publication : deux
                écrans pour les mêmes champs finiraient par diverger. */}
            {editingOffer ? (
              <OfferForm
                key={editingOffer.id}
                initial={editingOffer}
                onPublish={(draft) => {
                  setOffers((list) =>
                    list.map((x) =>
                      x.id === editingOffer.id
                        ? {
                            ...x,
                            title: draft.title,
                            category: draft.category,
                            priceCents: draft.priceCents,
                            oldPriceCents: draft.oldPriceCents,
                            stockTotal: draft.stock,
                            // On ne « rend » pas des unités déjà vendues : le
                            // restant suit la nouvelle quantité sans la dépasser.
                            stockLeft: Math.min(x.stockLeft, draft.stock),
                            endsAt: Date.now() + draft.durationMinutes * 60 * 1000,
                          }
                        : x,
                    ),
                  );
                  setEditing(null);
                  notify(`« ${draft.title} » mise à jour.`);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : null}

            <p className="tkpro-note">
              Une offre publiée ici apparaît immédiatement dans l’app des clients, et la remise
              s’applique à chaque vente conclue. TK LINK prélève {COMMISSION_PCT}&nbsp;% sur chaque
              vente (CDC §21).
            </p>
          </>
        ) : null}
        {tab === 'profile' ? <MerchantProfile onSave={notify} /> : null}
      </main>

      {toast ? (
        <div className="tkpro-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/**
 * UNE OFFRE, telle que le client la voit — et telle que le commerçant la pilote.
 *
 * Photo, remise, temps restant, stock, les deux prix : ce sont les informations
 * du §3.1 du CDC, celles de la carte de l'app. Le commerçant qui ne voit que
 * son accroche ne peut décider de rien ; celui qui voit qu'il reste 4 pièces
 * sur 25 à trente-huit minutes de la fin sait s'il prolonge ou s'il réapprovisionne.
 */
function OfferCard({ offer, now, onEdit, onToggleLive }) {
  const pct = discountPct(offer);
  const fini = offer.endsAt <= now;
  const partis = offer.stockTotal > 0 ? (offer.stockLeft / offer.stockTotal) * 100 : 0;
  const bas = offer.stockLeft <= offer.stockTotal * 0.25;

  return (
    <article className={offer.live ? 'tkpro-offer' : 'tkpro-offer off'}>
      <button
        type="button"
        className="tkpro-offer-open"
        onClick={onEdit}
        aria-label={`Modifier « ${offer.title} »`}
      >
        <div className="tkpro-offer-photo">
          <img src={offer.photo} alt="" />
          {pct > 0 ? <span className="tkpro-offer-remise">-{pct} %</span> : null}
          <span className={bas ? 'tkpro-offer-stock bas' : 'tkpro-offer-stock'}>
            {offer.stockLeft} / {offer.stockTotal}
          </span>
        </div>

        <div className="tkpro-offer-body">
          <h4>{offer.title}</h4>

          <div className="tkpro-offer-prix">
            <b>{formatCents(offer.priceCents)}</b>
            <s>{formatCents(offer.oldPriceCents)}</s>
          </div>

          <div className="tkpro-offer-jauge">
            <span style={{ width: `${Math.max(4, Math.round(partis))}%` }} />
          </div>

          <div className="tkpro-offer-meta">
            {/* Une offre expirée le DIT. Laisser tourner « 00:00:00 » ferait
                croire à une offre encore vivante, et le commerçant attendrait
                des ventes qui ne viendront pas. */}
            <span className={fini ? 'chrono fini' : 'chrono'}>
              {fini ? 'Terminée' : remainingLabel(offer.endsAt, now)}
            </span>
            <span className={`tkpro-tag ${offer.live ? 'facture' : 'ticket'}`}>
              {offer.live ? 'EN LIGNE' : 'HORS LIGNE'}
            </span>
          </div>
        </div>
      </button>

      <div className="tkpro-offer-actions">
        <button type="button" className="tkpro-btn" onClick={onEdit}>
          Modifier
        </button>
        <button type="button" className="tkpro-btn" onClick={onToggleLive}>
          {offer.live ? 'Retirer' : 'Remettre en ligne'}
        </button>
      </div>
    </article>
  );
}

/**
 * MON COMMERCE — tout ce qui identifie la boutique, au même endroit.
 *
 * Les informations étaient éparpillées : le nom dans l'en-tête, l'adresse nulle
 * part, le KBIS uniquement dans le dossier du Super Admin. Un commerçant qui
 * déménage ou change de numéro n'avait aucun endroit où le dire.
 *
 * Trois blocs, dans l'ordre où on les cherche : l'identité de la boutique, le
 * contact et la banque, puis les pièces légales. Le KBIS se CONSULTE et ne se
 * réécrit pas — remplacer un justificatif d'immatriculation n'est pas une
 * modification de profil, c'est une nouvelle demande de validation.
 */
function MerchantProfile({ onSave }) {
  const [form, setForm] = useState(MERCHANT);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  return (
    <>
      <div className="tkpro-card-head">
        <h2>Mon commerce</h2>
        <span className="tkpro-note-inline">Données de démonstration</span>
      </div>

      <form
        className="tkpro-profile"
        onSubmit={(e) => {
          e.preventDefault();
          onSave('Informations du commerce enregistrées.');
        }}
      >
        <section className="tkpro-card">
          <div className="tkpro-card-head">
            <h2>La boutique</h2>
          </div>

          <div className="tkpro-identite">
            <div className="tkpro-logo">
              <img src={form.logo} alt={`Logo de ${form.shopName}`} />
            </div>
            <div>
              <b>{form.shopName}</b>
              <span>
                {form.area} · {form.city}
              </span>
              <button type="button" className="tkpro-btn">
                Changer le logo
              </button>
            </div>
          </div>

          <div className="tkpro-form-grid">
            <Input label="Nom du magasin" value={form.shopName} onChange={set('shopName')} wide />
            <Input label="Raison sociale" value={form.legalName} onChange={set('legalName')} wide />
            <Input label="Adresse" value={form.address} onChange={set('address')} wide />
            <Input label="Code postal" value={form.zip} onChange={set('zip')} />
            <Input label="Ville" value={form.city} onChange={set('city')} />
            <Input label="Quartier" value={form.area} onChange={set('area')} />
            <Input label="Horaires" value={form.hours} onChange={set('hours')} wide />
          </div>
        </section>

        <section className="tkpro-card">
          <div className="tkpro-card-head">
            <h2>Contact et paiement</h2>
          </div>
          <div className="tkpro-form-grid">
            <Input
              label="Responsable"
              value={form.contactName}
              onChange={set('contactName')}
              wide
            />
            <Input label="E-mail" value={form.email} onChange={set('email')} wide />
            <Input label="Téléphone" value={form.phone} onChange={set('phone')} />
            {/* L'IBAN est MASQUÉ et non modifiable ici : changer un compte de
                versement est l'opération que fraude toute plateforme de
                paiement. Elle passe par une vérification, pas par un champ. */}
            <Input label="IBAN de versement" value={form.iban} readOnly />
          </div>
        </section>

        <section className="tkpro-card">
          <div className="tkpro-card-head">
            <h2>Pièces légales</h2>
          </div>
          <div className="tkpro-form-grid">
            <Input label="SIRET" value={form.siret} readOnly />
            <Input label="N° de TVA" value={form.tva} readOnly />
          </div>

          <div className="tkpro-kbis">
            <div>
              <b>{MERCHANT.kbis.filename}</b>
              <span>
                Déposé le {MERCHANT.kbis.uploadedAt} · {MERCHANT.kbis.status}
              </span>
            </div>
            <button type="button" className="tkpro-btn">
              Consulter
            </button>
          </div>

          <p className="tkpro-note">
            SIRET, TVA et KBIS ont été vérifiés à la validation du compte. Les modifier suppose une
            nouvelle vérification : écrivez-nous plutôt que de les corriger ici.
          </p>
        </section>

        <div className="tkpro-profile-foot">
          <button type="submit" className="tkpro-btn primary">
            Enregistrer
          </button>
          <span className="tkpro-note-inline">
            Démonstration : rien n’est encore transmis à un serveur.
          </span>
        </div>
      </form>
    </>
  );
}

/** Un champ de formulaire, libellé au-dessus — comme dans le reste du portail. */
function Input({ label, value, onChange, wide = false, readOnly = false }) {
  return (
    <label className={wide ? 'tkpro-input wide' : 'tkpro-input'}>
      <span>{label}</span>
      <input value={value} onChange={onChange} readOnly={readOnly} disabled={readOnly} />
    </label>
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
