'use client';

import { useEffect, useMemo, useState } from 'react';

import '../pro/pro.css';
import { FREE_OPERATIONS, PACKS } from '../pro/billing';
import { formatDate } from '../pro/data';
import './admin.css';
import {
  APPLICATIONS,
  COMMISSION_PCT,
  DISPUTES,
  DISPUTE_KINDS,
  DISPUTE_OUTCOMES,
  MEMBERS,
  MONTHS,
  REFUSAL_REASONS,
  ROLE_INFO,
  TOTALS,
  formatEuros,
} from './data';

/**
 * SUPER ADMIN — CDC §17 : « statistiques et gestion des inscrits », côté Farid.
 *
 * Cinq questions, cinq onglets, dans l'ordre où on se les pose en ouvrant un
 * back-office : qui attend à la porte (demandes), est-ce que ça marche (vue
 * d'ensemble), qui est là (comptes), qu'est-ce qui coince (litiges), combien ça
 * rapporte (revenus).
 *
 * Les demandes viennent en TÊTE parce qu'elles sont la seule chose qui se périme :
 * un commerçant qui attend trois jours son accès va vendre ailleurs.
 *
 * Réutilise la coquille de l'espace pro (`pro.css`) : même barre latérale,
 * mêmes tableaux, mêmes pastilles. Un second système de composants pour trois
 * écrans aurait divergé au premier ajustement.
 *
 * Les données sont simulées — voir `data.js`. La suspension d'un compte n'agit
 * donc que sur l'état local ; elle montre le geste, pas encore son effet.
 */
const TABS = [
  { key: 'applications', label: 'Demandes', icon: '✉' },
  { key: 'overview', label: 'Vue d’ensemble', icon: '▦' },
  { key: 'members', label: 'Comptes', icon: '👤' },
  { key: 'disputes', label: 'Litiges', icon: '⚖' },
  { key: 'revenue', label: 'Revenus', icon: '€' },
];

/**
 * Les trois rôles du CDC §3, chacun avec son tableau.
 *
 * Un tableau unique trié par rôle obligeait à chercher : « combien ai-je de
 * grossistes ? » demandait de compter des lignes. Trois tableaux titrés
 * répondent d'un regard — c'est la demande de la conduite de projet, et elle
 * a raison, un back-office se lit plus qu'il ne se parcourt.
 */
const ROLE_GROUPS = [
  { role: 'grossiste', title: 'Grossistes', who: 'Fournisseur', metric: 'Lots publiés' },
  { role: 'commercant', title: 'Commerçants', who: 'Enseigne', metric: 'Offres publiées' },
  { role: 'consommateur', title: 'Utilisateurs', who: 'Utilisateur', metric: 'Commandes' },
];

const ROLE_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'consommateur', label: 'Consommateurs' },
  { key: 'commercant', label: 'Commerçants' },
  { key: 'grossiste', label: 'Grossistes' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('applications');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [suspended, setSuspended] = useState(() => new Set());
  const [toast, setToast] = useState(null);

  /**
   * L'issue de chaque dossier : `{ [id]: { decision, reason } }`.
   *
   * Le dossier reste À L'ÉCRAN une fois tranché, avec sa décision et son motif.
   * Le faire disparaître priverait de tout recours en cas de fausse manœuvre —
   * et un refus est plus difficile à rattraper qu'une acceptation.
   */
  const [decisions, setDecisions] = useState({});
  /** Le dossier dont on est en train d'écrire le motif de refus. */
  const [refusing, setRefusing] = useState(null);
  const [reason, setReason] = useState('');
  /** Ce qu'on regarde : ce qui attend, ou ce qui a déjà été tranché. */
  const [appFilter, setAppFilter] = useState('pending');
  /** L'issue de chaque litige : `{ [id]: { outcome, note } }`. */
  const [rulings, setRulings] = useState({});
  const [ruling, setRuling] = useState(null);
  const [note, setNote] = useState('');

  /**
   * L'instant présent, posé APRÈS le montage.
   *
   * L'ancienneté d'un dossier ne peut pas être calculée pendant le rendu : la
   * page est prérendue à la construction, et « il y a 3 h » n'y voudrait plus
   * rien dire au chargement. Calculée côté serveur puis recalculée côté client,
   * elle produirait en prime une divergence d'hydratation.
   */
  const [now, setNow] = useState(null);
  useEffect(() => {
    // Posé par un rappel, jamais dans le corps de l'effet : un `setState`
    // synchrone y déclenche un second rendu en cascade, et le compilateur React
    // le refuse à juste titre.
    //
    // L'intervalle n'est pas une astuce pour contourner la règle, il rend
    // l'écran plus juste : un administrateur laisse ce tableau ouvert, et
    // « en attente depuis 23 h » doit devenir « 1 jour » sans qu'il recharge.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const toggleSuspend = (member) => {
    setSuspended((current) => {
      const next = new Set(current);
      if (next.has(member.id)) next.delete(member.id);
      else next.add(member.id);
      return next;
    });
    notify(
      suspended.has(member.id)
        ? `${member.name} est de nouveau actif.`
        : `${member.name} est suspendu — ses offres ne sont plus visibles.`,
    );
  };

  const accept = (app) => {
    setDecisions((d) => ({ ...d, [app.id]: { decision: 'accepted' } }));
    setRefusing(null);
    notify(`${app.shop} est accepté — son espace professionnel est ouvert.`);
  };

  const confirmRefusal = (app) => {
    // Un refus sans motif est un mur : le demandeur ne saura pas quoi corriger,
    // et rappellera. Le champ est donc obligatoire.
    if (!reason.trim()) return;
    setDecisions((d) => ({ ...d, [app.id]: { decision: 'refused', reason: reason.trim() } }));
    setRefusing(null);
    setReason('');
    notify(`${app.shop} est refusé — le motif lui a été transmis.`);
  };

  /** Revenir sur une décision — la fausse manœuvre doit être rattrapable. */
  const reopen = (app) => {
    setDecisions((d) => {
      const next = { ...d };
      delete next[app.id];
      return next;
    });
    notify(`${app.shop} revient dans les demandes en attente.`);
  };

  const settle = (dispute, outcome) => {
    // Une décision de litige engage de l'argent : elle s'accompagne toujours
    // d'une note, faute de quoi personne ne saura, dans un mois, pourquoi
    // 89 € ont été rendus.
    if (!note.trim()) return;
    setRulings((r) => ({ ...r, [dispute.id]: { outcome, note: note.trim() } }));
    setRuling(null);
    setNote('');
    notify(`Litige ${dispute.order} tranché.`);
  };

  const openDisputes = DISPUTES.filter((d) => !rulings[d.id]);

  const pending = APPLICATIONS.filter((a) => !decisions[a.id]);
  const handled = APPLICATIONS.filter((a) => decisions[a.id]);
  const visibleApps = appFilter === 'pending' ? pending : handled;

  /**
   * Depuis combien de temps ce dossier attend.
   *
   * Au-delà de vingt-quatre heures on le signale : un professionnel qui attend
   * son accès va publier ailleurs, et c'est le seul chiffre de cet écran qui
   * doive faire agir.
   */
  const waiting = (iso) => {
    if (now === null) return null;
    const hours = Math.max(0, Math.round((now - new Date(iso).getTime()) / 3_600_000));
    if (hours < 1) return { label: "moins d'une heure", late: false };
    if (hours < 24) return { label: `${hours} h`, late: false };
    const days = Math.round(hours / 24);
    return { label: `${days} jour${days > 1 ? 's' : ''}`, late: true };
  };

  /**
   * Les inscrits, plus ceux qu'on vient d'accepter.
   *
   * Sans cela, accepter un dossier ne se voyait NULLE PART : le bouton changeait
   * une pastille et rien d'autre. Un commerçant validé doit apparaître parmi les
   * inscrits — c'est ce qui prouve que la décision a un effet.
   */
  const acceptedMembers = useMemo(
    () =>
      APPLICATIONS.filter((a) => decisions[a.id]?.decision === 'accepted').map((a) => ({
        id: a.id,
        name: a.shop,
        role: a.role,
        city: a.address.split(',').pop().trim(),
        daysAgo: 0,
        orders: 0,
        offers: 0,
        spentCents: 0,
        siret: a.siret,
        justAccepted: true,
      })),
    [decisions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...acceptedMembers, ...MEMBERS].filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (!q) return true;
      return `${m.name} ${m.city} ${m.siret}`.toLowerCase().includes(q);
    });
  }, [query, roleFilter, acceptedMembers]);

  /** Les commerçants qui font tourner la plateforme, par volume publié. */
  const topPros = useMemo(
    () =>
      MEMBERS.filter((m) => m.role === 'commercant')
        .slice()
        .sort((a, b) => b.spentCents - a.spentCents)
        .slice(0, 5),
    [],
  );

  const peak = Math.max(...MONTHS.map((m) => m.revenueCents));

  return (
    <div className="tkpro">
      <aside className="tkpro-side">
        <div className="tkpro-logo">
          TK<span>ADMIN</span>
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
          Super Admin
          <br />
          Données de démonstration
        </div>
      </aside>

      <main className="tkpro-main">
        {/* ------------------------------------------------------ demandes */}
        {tab === 'applications' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Demandes d’inscription</h1>
                <p>
                  Aucun professionnel ne publie avant d’avoir été validé ici. Ouvrez le
                  justificatif, puis tranchez.
                </p>
              </div>
              <span
                className={pending.length ? 'tkadmin-count' : 'tkadmin-count tkadmin-count-zero'}
              >
                {pending.length} en attente
              </span>
            </div>

            <div className="tkadmin-filters" role="tablist" aria-label="Filtrer les demandes">
              {[
                { key: 'pending', label: 'En attente', n: pending.length },
                { key: 'handled', label: 'Traitées', n: handled.length },
              ].map((tabItem) => (
                <button
                  key={tabItem.key}
                  type="button"
                  role="tab"
                  aria-selected={appFilter === tabItem.key}
                  className={appFilter === tabItem.key ? 'is-on' : undefined}
                  onClick={() => setAppFilter(tabItem.key)}
                >
                  {tabItem.label} <b>{tabItem.n}</b>
                </button>
              ))}
            </div>

            {visibleApps.length === 0 ? (
              <p className="tkadmin-empty">
                {appFilter === 'pending'
                  ? 'Aucune demande en attente. Tout est traité.'
                  : 'Aucune demande traitée pour le moment.'}
              </p>
            ) : null}

            <div className="tkadmin-apps">
              {visibleApps.map((app) => {
                const verdict = decisions[app.id];
                const missingSiret = !app.siret;
                return (
                  <article key={app.id} className="tkadmin-app">
                    <header>
                      <div>
                        <h2>{app.shop}</h2>
                        <p>
                          {ROLE_INFO[app.role]?.label ?? app.role} · {app.activity}
                        </p>
                      </div>
                      {verdict ? (
                        <span
                          className={
                            verdict.decision === 'accepted'
                              ? 'tkadmin-verdict-pill tkadmin-ok'
                              : 'tkadmin-verdict-pill tkadmin-ko'
                          }
                        >
                          {verdict.decision === 'accepted' ? 'Accepté' : 'Refusé'}
                        </span>
                      ) : (
                        <span
                          className={
                            waiting(app.submittedAt)?.late
                              ? 'tkadmin-verdict-pill tkadmin-late'
                              : 'tkadmin-verdict-pill'
                          }
                          title={`Reçue le ${formatDate(app.submittedAt)}`}
                        >
                          {waiting(app.submittedAt)
                            ? `En attente depuis ${waiting(app.submittedAt).label}`
                            : `Reçue le ${formatDate(app.submittedAt)}`}
                        </span>
                      )}
                    </header>

                    <dl className="tkadmin-fields">
                      <div>
                        <dt>Responsable</dt>
                        <dd>{app.contact}</dd>
                      </div>
                      <div>
                        <dt>E-mail</dt>
                        <dd>{app.email}</dd>
                      </div>
                      <div>
                        <dt>Téléphone</dt>
                        <dd>{app.phone}</dd>
                      </div>
                      <div>
                        <dt>SIRET</dt>
                        <dd className={missingSiret ? 'tkadmin-missing' : undefined}>
                          {app.siret || 'Non renseigné'}
                        </dd>
                      </div>
                      <div className="tkadmin-wide">
                        <dt>Adresse</dt>
                        <dd>{app.address}</dd>
                      </div>
                    </dl>

                    {/* Le justificatif. Sans document à lire, « accepter » ne
                        serait qu’un bouton. */}
                    {app.document ? (
                      <a
                        className="tkadmin-doc"
                        href={app.document.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span aria-hidden="true">📄</span>
                        <span className="tkadmin-doc-label">
                          <b>{app.document.name}</b>
                          <small>PDF · s’ouvre dans un nouvel onglet</small>
                        </span>
                        <span className="tkadmin-doc-go">Ouvrir</span>
                      </a>
                    ) : (
                      <p className="tkadmin-nodoc">
                        Aucun justificatif joint — à réclamer avant toute validation.
                      </p>
                    )}

                    {verdict ? (
                      <div className="tkadmin-outcome">
                        <p>
                          {verdict.decision === 'refused' ? (
                            <>
                              <b>Motif transmis :</b> {verdict.reason}
                            </>
                          ) : (
                            'Espace professionnel ouvert — le commerçant apparaît désormais dans les inscrits.'
                          )}
                        </p>
                        <button
                          type="button"
                          className="tkadmin-btn tkadmin-btn-ghost"
                          onClick={() => reopen(app)}
                        >
                          Revenir sur cette décision
                        </button>
                      </div>
                    ) : refusing === app.id ? (
                      <div className="tkadmin-refuse">
                        <label htmlFor={`reason-${app.id}`}>Motif du refus</label>
                        <div className="tkadmin-reasons">
                          {REFUSAL_REASONS.map((r) => (
                            <button key={r} type="button" onClick={() => setReason(r)}>
                              {r}
                            </button>
                          ))}
                        </div>
                        <textarea
                          id={`reason-${app.id}`}
                          rows={3}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Ce texte sera envoyé au demandeur — dites-lui quoi corriger."
                        />
                        <div className="tkadmin-actions">
                          <button
                            type="button"
                            className="tkadmin-btn tkadmin-btn-danger"
                            disabled={!reason.trim()}
                            onClick={() => confirmRefusal(app)}
                          >
                            Confirmer le refus
                          </button>
                          <button
                            type="button"
                            className="tkadmin-btn tkadmin-btn-ghost"
                            onClick={() => {
                              setRefusing(null);
                              setReason('');
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="tkadmin-actions">
                        <button
                          type="button"
                          className="tkadmin-btn tkadmin-btn-accept"
                          onClick={() => accept(app)}
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          className="tkadmin-btn tkadmin-btn-ghost"
                          onClick={() => {
                            setRefusing(app.id);
                            setReason('');
                          }}
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {/* ------------------------------------------------- vue d'ensemble */}
        {tab === 'overview' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Vue d’ensemble</h1>
                <p>L’état de la plateforme, en un écran.</p>
              </div>
            </div>

            <div className="tkpro-stats">
              <div className="tkpro-stat">
                <div className="k">Inscrits</div>
                <div className="v">{TOTALS.members}</div>
                <div className="d">dont {TOTALS.pros} professionnels</div>
              </div>
              <div className="tkpro-stat">
                <div className="k">Offres publiées</div>
                <div className="v">{TOTALS.offers}</div>
                <div className="d">toutes enseignes confondues</div>
              </div>
              <div className="tkpro-stat">
                <div className="k">Volume vendu</div>
                <div className="v">{formatEuros(TOTALS.gmvCents)}</div>
                <div className="d">sur six mois</div>
              </div>
              <div className="tkpro-stat eco">
                <div className="k">Revenu TK LINK</div>
                <div className="v">{formatEuros(TOTALS.revenueCents)}</div>
                <div className="d">
                  {formatEuros(TOTALS.commissionCents)} de commission ·{' '}
                  {formatEuros(TOTALS.packsCents)} de packs
                </div>
              </div>
            </div>

            {/* Ce qui demande une action passe AVANT les jolis chiffres. */}
            {TOTALS.incomplete > 0 ? (
              <button
                type="button"
                className="tkadmin-alert"
                onClick={() => {
                  setTab('members');
                  setRoleFilter('all');
                }}
              >
                <span aria-hidden="true">⚠</span>
                <span>
                  <b>
                    {TOTALS.incomplete} professionnel{TOTALS.incomplete > 1 ? 's' : ''} sans SIRET
                  </b>
                  <em>
                    Ils publient, mais le CDC §5 leur interdit de commander chez un grossiste.
                  </em>
                </span>
                <span className="go" aria-hidden="true">
                  →
                </span>
              </button>
            ) : null}

            <div className="tkpro-card" style={{ marginBottom: 18 }}>
              <div className="tkpro-card-head">
                <h2>Revenu mensuel</h2>
                <button type="button" className="tkpro-btn" onClick={() => setTab('revenue')}>
                  Le détail
                </button>
              </div>
              <div className="tkadmin-bars">
                {MONTHS.map((m) => (
                  <div className="tkadmin-bar" key={m.label}>
                    <div className="stack" aria-hidden="true">
                      <span
                        className="packs"
                        style={{ height: `${Math.round((m.packsCents / peak) * 100)}%` }}
                      />
                      <span
                        className="commission"
                        style={{ height: `${Math.round((m.commissionCents / peak) * 100)}%` }}
                      />
                    </div>
                    <b>{formatEuros(m.revenueCents)}</b>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="tkadmin-legend">
                <span>
                  <i className="commission" /> Commission {COMMISSION_PCT}&nbsp;%
                </span>
                <span>
                  <i className="packs" /> Packs d’opérations
                </span>
              </div>
            </div>

            <div className="tkpro-card">
              <div className="tkpro-card-head">
                <h2>Commerçants les plus actifs</h2>
              </div>
              <div className="tkpro-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Enseigne</th>
                      <th>Quartier</th>
                      <th className="num">Offres</th>
                      <th className="num">Volume vendu</th>
                      <th className="num">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPros.map((m) => (
                      <tr key={m.id}>
                        <td>{m.name}</td>
                        <td>{m.city}</td>
                        <td className="num">{m.offers}</td>
                        <td className="num">{formatEuros(m.spentCents)}</td>
                        <td className="num">
                          {formatEuros(Math.round((m.spentCents * COMMISSION_PCT) / 100))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* ------------------------------------------------------- inscrits */}
        {tab === 'members' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Comptes</h1>
                <p>Trois rôles, trois tableaux — CDC §3.</p>
              </div>
            </div>

            <div className="tkpro-filters" style={{ marginBottom: 14 }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, quartier, SIRET…"
                aria-label="Rechercher un inscrit"
              />
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={roleFilter === f.key ? 'tkpro-chip on' : 'tkpro-chip'}
                  aria-pressed={roleFilter === f.key}
                  onClick={() => setRoleFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {ROLE_GROUPS.map((group) => {
              const rows = filtered.filter((m) => m.role === group.role);
              if (roleFilter !== 'all' && roleFilter !== group.role) return null;
              return (
                <section key={group.role} className="tkadmin-group">
                  <div className="tkadmin-group-head">
                    <h2>{group.title}</h2>
                    <span>
                      {rows.length} compte{rows.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {rows.length === 0 ? (
                    <p className="tkadmin-empty">Aucun compte dans cette catégorie.</p>
                  ) : (
                    <div className="tkpro-card">
                      <div className="tkpro-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>{group.who}</th>
                              <th>SIRET</th>
                              <th>Depuis</th>
                              <th className="num">{group.metric}</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((m) => {
                              const off = suspended.has(m.id);
                              return (
                                <tr key={m.id} className={off ? 'tkadmin-off' : undefined}>
                                  <td>
                                    <b>{m.name}</b>
                                    <div className="tkadmin-sub">{m.city}</div>
                                  </td>
                                  <td>
                                    {m.role === 'consommateur' ? (
                                      <span className="tkadmin-sub">—</span>
                                    ) : m.siret ? (
                                      <span className="tkadmin-mono">{m.siret}</span>
                                    ) : (
                                      <span className="tkadmin-missing">manquant</span>
                                    )}
                                  </td>
                                  <td>{m.justAccepted ? 'à l’instant' : formatDate(m.joinedAt)}</td>
                                  <td className="num">
                                    {m.role === 'consommateur'
                                      ? `${m.orders} commande${m.orders > 1 ? 's' : ''}`
                                      : `${m.offers} offre${m.offers > 1 ? 's' : ''}`}
                                  </td>
                                  <td className="num">
                                    <button
                                      type="button"
                                      className="tkpro-btn"
                                      onClick={() => toggleSuspend(m)}
                                    >
                                      {off ? 'Réactiver' : 'Suspendre'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            <p className="tkpro-note">
              {filtered.length} compte{filtered.length > 1 ? 's' : ''} affiché
              {filtered.length > 1 ? 's' : ''}. La suspension coupe la visibilité des offres sans
              supprimer le compte — la suppression définitive relève de la demande de l’utilisateur.
            </p>
          </>
        ) : null}

        {/* -------------------------------------------------------- litiges */}
        {tab === 'disputes' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Litiges</h1>
                <p>
                  Les commandes qui ont mal tourné — CDC §22. Le cahier des charges énumère les cas
                  ; il ne dit pas encore qui a raison.
                </p>
              </div>
              <span
                className={
                  openDisputes.length ? 'tkadmin-count tkadmin-count-hot' : 'tkadmin-count'
                }
              >
                {openDisputes.length} ouvert{openDisputes.length > 1 ? 's' : ''}
              </span>
            </div>

            {DISPUTES.length === 0 ? (
              <p className="tkadmin-empty">Aucun litige. C’est le meilleur des tableaux vides.</p>
            ) : null}

            <div className="tkadmin-apps">
              {DISPUTES.map((dispute) => {
                const verdict = rulings[dispute.id];
                return (
                  <article key={dispute.id} className="tkadmin-app">
                    <header>
                      <div>
                        <h2>{DISPUTE_KINDS[dispute.kind]}</h2>
                        <p>
                          {dispute.order} · {dispute.merchant}
                        </p>
                      </div>
                      <span
                        className={
                          verdict
                            ? 'tkadmin-verdict-pill tkadmin-ok'
                            : 'tkadmin-verdict-pill tkadmin-late'
                        }
                      >
                        {verdict ? 'Tranché' : `Ouvert · ${formatEuros(dispute.amountCents)}`}
                      </span>
                    </header>

                    <dl className="tkadmin-fields">
                      <div>
                        <dt>Client</dt>
                        <dd>{dispute.customer}</dd>
                      </div>
                      <div>
                        <dt>Commerçant</dt>
                        <dd>{dispute.merchant}</dd>
                      </div>
                      <div>
                        <dt>Montant en jeu</dt>
                        <dd>{formatEuros(dispute.amountCents)}</dd>
                      </div>
                      <div>
                        <dt>Ouvert le</dt>
                        <dd>{formatDate(dispute.openedAt)}</dd>
                      </div>
                    </dl>

                    <p className="tkadmin-quote">« {dispute.message} »</p>

                    {verdict ? (
                      <div className="tkadmin-outcome">
                        <p>
                          <b>
                            {DISPUTE_OUTCOMES.find((o) => o.key === verdict.outcome)?.label ??
                              verdict.outcome}
                          </b>{' '}
                          — {verdict.note}
                        </p>
                        <button
                          type="button"
                          className="tkadmin-btn tkadmin-btn-ghost"
                          onClick={() =>
                            setRulings((r) => {
                              const next = { ...r };
                              delete next[dispute.id];
                              return next;
                            })
                          }
                        >
                          Rouvrir le litige
                        </button>
                      </div>
                    ) : ruling === dispute.id ? (
                      <div className="tkadmin-refuse">
                        <label htmlFor={`note-${dispute.id}`}>Motif de la décision</label>
                        <textarea
                          id={`note-${dispute.id}`}
                          rows={3}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Ce que vous avez vérifié, et pourquoi vous tranchez ainsi."
                        />
                        <div className="tkadmin-actions">
                          {DISPUTE_OUTCOMES.map((o) => (
                            <button
                              key={o.key}
                              type="button"
                              className={
                                o.tone === 'ko'
                                  ? 'tkadmin-btn tkadmin-btn-danger'
                                  : o.tone === 'ok'
                                    ? 'tkadmin-btn tkadmin-btn-accept'
                                    : 'tkadmin-btn tkadmin-btn-ghost'
                              }
                              disabled={!note.trim()}
                              onClick={() => settle(dispute, o.key)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="tkadmin-actions">
                        <button
                          type="button"
                          className="tkadmin-btn tkadmin-btn-accept"
                          onClick={() => {
                            setRuling(dispute.id);
                            setNote('');
                          }}
                        >
                          Instruire ce litige
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <p className="tkpro-note">
              Le CDC §22 énumère ces situations mais précise qu’elles « devront être précisées avec
              Farid ». Aucun arbitrage automatique n’est appliqué : l’écran trace la décision d’un
              humain, et exige qu’elle soit motivée.
            </p>
          </>
        ) : null}

        {/* -------------------------------------------------------- revenus */}
        {tab === 'revenue' ? (
          <>
            <div className="tkpro-head">
              <div>
                <h1>Revenus</h1>
                <p>D’où vient l’argent de la plateforme — CDC §9 et §21.</p>
              </div>
            </div>

            <div className="tkpro-stats">
              <div className="tkpro-stat">
                <div className="k">Commission</div>
                <div className="v">{formatEuros(TOTALS.commissionCents)}</div>
                <div className="d">{COMMISSION_PCT} % du volume vendu</div>
              </div>
              <div className="tkpro-stat">
                <div className="k">Packs vendus</div>
                <div className="v">{TOTALS.packs}</div>
                <div className="d">{formatEuros(TOTALS.packsCents)} encaissés</div>
              </div>
              <div className="tkpro-stat eco">
                <div className="k">Total</div>
                <div className="v">{formatEuros(TOTALS.revenueCents)}</div>
                <div className="d">sur six mois</div>
              </div>
            </div>

            <div className="tkpro-card" style={{ marginBottom: 18 }}>
              <div className="tkpro-card-head">
                <h2>Mois par mois</h2>
              </div>
              <div className="tkpro-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th className="num">Volume vendu</th>
                      <th className="num">Commission</th>
                      <th className="num">Packs</th>
                      <th className="num">Revenu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.slice()
                      .reverse()
                      .map((m) => (
                        <tr key={m.label}>
                          <td>{m.label}</td>
                          <td className="num">{formatEuros(m.gmvCents)}</td>
                          <td className="num">{formatEuros(m.commissionCents)}</td>
                          <td className="num">
                            {m.packs} · {formatEuros(m.packsCents)}
                          </td>
                          <td className="num">
                            <b>{formatEuros(m.revenueCents)}</b>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Les leviers, affichés là où on décide de les bouger. */}
            <div className="tkpro-card">
              <div className="tkpro-card-head">
                <h2>Réglages en vigueur</h2>
              </div>
              <div className="tkadmin-levers">
                <div>
                  <b>{COMMISSION_PCT} %</b>
                  <span>Commission sur chaque vente — CDC §21</span>
                </div>
                <div>
                  <b>{FREE_OPERATIONS}</b>
                  <span>Opérations offertes avant le premier pack — CDC §9</span>
                </div>
                {PACKS.map((p) => (
                  <div key={p.id}>
                    <b>{formatEuros(p.priceCents)}</b>
                    <span>
                      {p.label} — {p.operations} opérations
                    </span>
                  </div>
                ))}
              </div>
              <p className="tkpro-note" style={{ margin: '0 18px 18px' }}>
                Ces valeurs sont celles proposées par le cahier des charges et marquées « à valider
                » (§23). Elles sont appliquées partout — app et web — depuis un seul endroit ; les
                changer se fera ici quand le back-office existera.
              </p>
            </div>
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
