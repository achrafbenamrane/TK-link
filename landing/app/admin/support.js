/**
 * La messagerie du support, côté back-office : mise en forme des demandes lues dans Supabase
 * (migration 0014_support) pour la boîte de réception de `/admin`. Pur, testé par
 * `landing/__tests__/support-inbox.test.ts`.
 */

export const STATUS_LABEL = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

export const CATEGORY_LABEL = {
  commande: 'Commande',
  paiement: 'Paiement',
  livraison: 'Livraison',
  compte: 'Compte',
  commerce: 'Commerce',
  autre: 'Autre',
};

const ROLE = {
  consommateur: 'Client',
  commercant: 'Commerçant',
  grossiste: 'Grossiste',
};

/** « à l’instant », « il y a 5 min », « il y a 3 h », puis la date. */
export function relativeTime(iso, nowMs) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.round((nowMs - t) / 60000);
  if (min < 1) return 'À l’instant';
  if (min < 60) return `Il y a ${min} min`;
  if (min < 24 * 60) return `Il y a ${Math.round(min / 60)} h`;
  return new Date(t).toLocaleDateString('fr-FR');
}

/**
 * Les demandes, prêtes à afficher. Une demande « attend une réponse » quand son dernier message
 * vient de l'utilisateur et qu'elle n'est ni résolue ni fermée : celles-là passent DEVANT, la plus
 * ancienne d'abord (on ne laisse pas pourrir la première arrivée).
 */
export function toThreads(tickets, profiles, nowMs) {
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const threads = (tickets ?? []).map((t) => {
    const messages = [...(t.support_messages ?? [])].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
    const last = messages[messages.length - 1];
    const who = byId.get(t.author_id);
    const name = [who?.first_name, who?.last_name].filter(Boolean).join(' ') || 'Utilisateur';
    return {
      id: t.id,
      party: name,
      role: ROLE[who?.account_type] ?? 'Utilisateur',
      subject: t.subject,
      category: CATEGORY_LABEL[t.category] ?? t.category,
      status: t.status,
      orderId: t.order_id ?? null,
      lastAt: t.last_message_at,
      unread: Boolean(last) && !last.from_staff && !['resolu', 'ferme'].includes(t.status),
      messages: messages.map((m) => ({
        id: m.id,
        from: m.from_staff ? 'admin' : 'user',
        at: relativeTime(m.created_at, nowMs),
        body: m.body,
      })),
    };
  });
  return threads.sort((a, b) =>
    a.unread !== b.unread
      ? Number(b.unread) - Number(a.unread)
      : a.unread
        ? Date.parse(a.lastAt) - Date.parse(b.lastAt)
        : Date.parse(b.lastAt) - Date.parse(a.lastAt),
  );
}

/** Une réponse du back-office : 1 à 2 000 caractères, comme la base l'exige. */
export function validReply(body) {
  const text = typeof body === 'string' ? body.trim() : '';
  return text.length >= 1 && text.length <= 2000 ? text : null;
}
