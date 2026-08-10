'use client';

import { useMemo, useState } from 'react';

import '../pro/pro.css';
import { FREE_OPERATIONS, PACKS } from '../pro/billing';
import { formatDate } from '../pro/data';
import './admin.css';
import { COMMISSION_PCT, MEMBERS, MONTHS, ROLE_INFO, TOTALS, formatEuros } from './data';

/**
 * SUPER ADMIN — CDC §17 : « statistiques et gestion des inscrits », côté Farid.
 *
 * Trois questions, trois onglets, dans l'ordre où on se les pose en ouvrant un
 * back-office : est-ce que ça marche (vue d'ensemble), qui est là (inscrits),
 * combien ça rapporte (revenus).
 *
 * Réutilise la coquille de l'espace pro (`pro.css`) : même barre latérale,
 * mêmes tableaux, mêmes pastilles. Un second système de composants pour trois
 * écrans aurait divergé au premier ajustement.
 *
 * Les données sont simulées — voir `data.js`. La suspension d'un compte n'agit
 * donc que sur l'état local ; elle montre le geste, pas encore son effet.
 */
const TABS = [
  { key: 'overview', label: 'Vue d’ensemble', icon: '▦' },
  { key: 'members', label: 'Inscrits', icon: '👤' },
  { key: 'revenue', label: 'Revenus', icon: '€' },
];

const ROLE_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'consommateur', label: 'Consommateurs' },
  { key: 'commercant', label: 'Commerçants' },
  { key: 'grossiste', label: 'Grossistes' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [suspended, setSuspended] = useState(() => new Set());
  const [toast, setToast] = useState(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MEMBERS.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (!q) return true;
      return `${m.name} ${m.city} ${m.siret}`.toLowerCase().includes(q);
    });
  }, [query, roleFilter]);

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
                <h1>Inscrits</h1>
                <p>Qui utilise TK LINK, et à quel titre — CDC §3.</p>
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

            <div className="tkpro-card">
              <div className="tkpro-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Inscrit</th>
                      <th>Rôle</th>
                      <th>SIRET</th>
                      <th>Depuis</th>
                      <th className="num">Activité</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => {
                      const off = suspended.has(m.id);
                      return (
                        <tr key={m.id} className={off ? 'tkadmin-off' : undefined}>
                          <td>
                            <b>{m.name}</b>
                            <div className="tkadmin-sub">{m.city}</div>
                          </td>
                          <td>
                            <span className={`tkpro-tag ${ROLE_INFO[m.role].tone}`}>
                              {ROLE_INFO[m.role].label}
                            </span>
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
                          <td>{formatDate(m.joinedAt)}</td>
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

            <p className="tkpro-note">
              {filtered.length} inscrit{filtered.length > 1 ? 's' : ''} affiché
              {filtered.length > 1 ? 's' : ''}. La suspension coupe la visibilité des offres sans
              supprimer le compte — la suppression définitive relève de la demande de l’utilisateur.
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
