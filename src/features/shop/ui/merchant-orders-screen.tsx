import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, PrepTicket, QrScanner, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  FULFILMENT_LABEL,
  isActive,
  merchantActions,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from '../lib/order-status';
import {
  advanceOrder,
  confirmPickup,
  dispatchCourier,
  type OrdersError,
  type ServerOrder,
} from '../lib/orders-api';
import { parsePickupQr } from '../lib/pickup';
import type { Order } from '../model/schema';
import { selectShopServerOrders, useServerOrdersStore } from '../model/server-orders';
import { selectOrders, useShopStore } from '../model/store';

type Props = {
  /**
   * Les offres de ce commerçant. Une commande le concerne dès qu'une de ses
   * lignes porte l'une d'elles. Fourni par la ROUTE : la boutique ignore
   * l'espace commerçant, où les publications sont conservées.
   */
  dealIds?: string[];
  onBack?: () => void;
  /** Ouvre la remise au coursier partenaire (commande prête en livraison). */
  onHandover?: (orderId: string) => void;
  /**
   * Les commandes viennent du SERVEUR (rapport d'avancement du 13/11/2026) : celles, payées, du
   * commerce connecté ; chaque geste passe par le serveur (préparation, code de retrait, course
   * Uber Direct). Sans serveur, l'écran garde les commandes locales de la démonstration.
   */
  server?: boolean;
};

/**
 * Ce que le commerçant doit faire ensuite, dit avec ses mots à lui.
 *
 * Le remboursement n'y figure PAS, et c'est délibéré : ce n'est pas un geste,
 * c'est une conséquence. Refuser une commande déjà payée déclenche le
 * remboursement — `refusee` ne mène d'ailleurs nulle part ailleurs. Un bouton
 * séparé laisserait croire qu'on peut refuser sans rendre l'argent.
 *
 * Après une remise, ce qui arrive n'est pas un remboursement spontané mais une
 * réclamation : d'où « Ouvrir un litige », qui décide ensuite du remboursement.
 * Mêmes libellés que l'espace pro web — un commerçant qui passe de son comptoir
 * à son ordinateur doit retrouver les mêmes mots.
 *
 * Une livraison part avec un coursier partenaire (Uber Direct) depuis le
 * 13/11/2026 : TK LINK n'a plus de livreurs à lui.
 */
const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  preparation: 'En préparation',
  prete: 'C’est prêt',
  recuperee: 'Remise au client',
  en_livraison: 'Remise au coursier',
  livree: 'Livrée',
  refusee: 'Refuser',
  annulee: 'Annuler',
  litige: 'Ouvrir un litige',
};

/** Couleur de la pastille de statut : ce qui attend une action doit ressortir. */
function toneOf(status: OrderStatus): string {
  const eteints: OrderStatus[] = ['refusee', 'annulee', 'remboursee', 'remboursement_en_cours'];
  if (eteints.includes(status)) return 'bg-surface-sunken text-ink-faint';
  if (status === 'litige') return 'bg-danger/10 text-danger';
  if (status === 'recuperee' || status === 'livree') return 'bg-brand-50 text-brand-700';
  return 'bg-surface-inverse text-ink-inverse';
}

function money(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

/**
 * LES COMMANDES REÇUES — CDC §11 et §18.
 *
 * Le commerçant publiait ses invendus sans jamais savoir qui les avait pris :
 * la boucle s'arrêtait au paiement. Cet écran la referme, et il est fait pour
 * être utilisé DEBOUT, derrière un comptoir — une commande, un bouton, le
 * geste suivant.
 *
 * Les transitions passent par la machine à états du §11 : impossible de
 * proposer « livrée » sur un Touch & Collect, ni de ressusciter une commande
 * remboursée. C'est la même règle que côté client, testée une seule fois.
 */
export function MerchantOrdersScreen({ dealIds, onBack, onHandover, server = false }: Props) {
  const colors = useColors();
  const allOrders = useShopStore(selectOrders);
  const setOrderStatus = useShopStore((s) => s.setOrderStatus);
  const [done, setDone] = useState(false);
  const serverOrders = useServerOrdersStore(selectShopServerOrders);
  const refreshShop = useServerOrdersStore((s) => s.refreshShop);

  // Les commandes du serveur : relues à l'ouverture, puis toutes les 10 s tant que l'écran est là
  // (un client vient de payer, un coursier Uber vient de partir…).
  useFocusEffect(
    useCallback(() => {
      if (!server) return;
      void refreshShop();
      const t = setInterval(() => void refreshShop(), 10_000);
      return () => clearInterval(t);
    }, [server, refreshShop]),
  );

  const mine = useMemo(() => {
    if (server) return serverOrders;
    const wanted = new Set(dealIds ?? []);
    if (wanted.size === 0) return [];
    return allOrders.filter((o) => o.items.some((line) => wanted.has(line.dealId)));
  }, [server, serverOrders, allOrders, dealIds]);

  const shown = useMemo(
    () => mine.filter((o) => (done ? !isActive(o.status) : isActive(o.status))),
    [mine, done],
  );

  const waiting = useMemo(() => mine.filter((o) => isActive(o.status)).length, [mine]);
  const revenue = useMemo(
    () => mine.filter((o) => !isActive(o.status)).reduce((sum, o) => sum + o.total, 0),
    [mine],
  );

  return (
    <Screen testID="merchant-orders" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          {onBack ? (
            <Pressable
              testID="merchant-orders-back"
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={10}
              onPress={onBack}
            >
              <Feather name="chevron-left" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Commandes reçues
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {waiting > 0
                ? `${waiting} commande${waiting > 1 ? 's' : ''} à traiter.`
                : 'Rien en attente pour l’instant.'}
            </AppText>
          </View>
        </View>

        {/* Les deux seuls chiffres qui comptent derrière un comptoir. */}
        <View className="mx-5 flex-row gap-3">
          <View className="flex-1 rounded-card bg-surface-inverse p-4">
            <AppText className="font-display text-accent" style={{ fontSize: 22 }}>
              {waiting}
            </AppText>
            <AppText variant="caption" className="text-ink-inverse/60">
              à traiter
            </AppText>
          </View>
          <View className="flex-1 rounded-card border border-line bg-surface p-4">
            <AppText className="font-display text-ink" style={{ fontSize: 22 }}>
              {money(revenue)}
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              encaissé
            </AppText>
          </View>
        </View>

        <View className="mx-5 mt-4 flex-row gap-2">
          {(
            [
              { key: false, label: 'À traiter' },
              { key: true, label: 'Terminées' },
            ] as const
          ).map((f) => (
            <Pressable
              key={String(f.key)}
              testID={`merchant-orders-filter-${f.key ? 'done' : 'active'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: done === f.key }}
              accessibilityLabel={f.label}
              onPress={() => setDone(f.key)}
              className={cn(
                'rounded-pill px-4 py-2',
                done === f.key ? 'bg-brand-500' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  done === f.key ? 'text-ink-inverse' : 'text-ink-muted',
                )}
                style={{ fontSize: 13 }}
              >
                {f.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 ? (
          <View testID="merchant-orders-empty" className="mt-10 items-center gap-2 px-10">
            <Feather name="inbox" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              {done ? 'Aucune commande terminée' : 'Aucune commande en attente'}
            </AppText>
            <AppText variant="caption" className="text-center">
              {mine.length === 0
                ? 'Les commandes portant sur vos ventes flash arriveront ici. Publiez une offre, puis commandez-la depuis l’accueil pour voir le parcours complet.'
                : 'Tout est traité.'}
            </AppText>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {shown.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={(status) => setOrderStatus(order.id, status)}
                {...(onHandover ? { onHandover } : {})}
                {...(server
                  ? {
                      serverActions: (
                        <ServerActions
                          order={order as ServerOrder}
                          onDone={() => void refreshShop()}
                        />
                      ),
                    }
                  : {})}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function OrderCard({
  order,
  onAdvance,
  onHandover,
  serverActions,
}: {
  order: Order;
  onAdvance: (status: OrderStatus) => void;
  onHandover?: (orderId: string) => void;
  /** Commande du serveur : ses gestes remplacent ceux de la démonstration. */
  serverActions?: ReactNode;
}) {
  const options = serverActions ? [] : merchantActions(order.status, order.fulfilment);
  const tone = toneOf(order.status);
  const colors = useColors();
  const [ticketOpen, setTicketOpen] = useState(false);
  // Le ticket sort dès que la commande est payée, jusqu'à ce qu'elle soit prête (CDC V1.1).
  const hasTicket =
    order.status === 'payee' || order.status === 'acceptee' || order.status === 'preparation';

  return (
    <View
      testID={`merchant-order-${order.id}`}
      className="overflow-hidden rounded-card border border-line bg-surface p-4"
    >
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink">
            {order.items.reduce((n, l) => n + l.qty, 0)} article
            {order.items.reduce((n, l) => n + l.qty, 0) > 1 ? 's' : ''} · {money(order.total)}
          </AppText>
          <AppText variant="caption" className="mt-0.5 text-ink-faint">
            {FULFILMENT_LABEL[order.fulfilment]} · commande {order.id.slice(0, 6).toUpperCase()}
          </AppText>
        </View>
        <View className={cn('rounded-pill px-2.5 py-1', tone.split(' ')[0])}>
          <AppText className={cn('font-sans-bold', tone.split(' ')[1])} style={{ fontSize: 10 }}>
            {ORDER_STATUS_LABEL[order.status].toUpperCase()}
          </AppText>
        </View>
      </View>

      <View className="mt-2.5 gap-1 border-t border-line pt-2.5">
        {order.items.map((line) => (
          <View key={line.dealId} className="flex-row items-center gap-2">
            <AppText style={{ fontSize: 14 }}>{line.emoji}</AppText>
            <AppText className="flex-1 text-ink-muted" style={{ fontSize: 13 }} numberOfLines={1}>
              {line.title}
            </AppText>
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              ×{line.qty}
            </AppText>
          </View>
        ))}
      </View>

      {hasTicket ? (
        <View className="mt-3 gap-2">
          <Pressable
            testID={`merchant-order-${order.id}-ticket-toggle`}
            accessibilityRole="button"
            accessibilityState={{ expanded: ticketOpen }}
            accessibilityLabel="Ticket de préparation"
            onPress={() => setTicketOpen((v) => !v)}
            className="flex-row items-center gap-2 self-start rounded-control border border-line px-3 py-2"
          >
            <Feather
              name="printer"
              size={14}
              color={ticketOpen ? colors.brand500 : colors.inkMuted}
            />
            <AppText className="font-sans-semibold text-ink-muted" style={{ fontSize: 12.5 }}>
              {ticketOpen ? 'Masquer le ticket' : 'Ticket de préparation'}
            </AppText>
          </Pressable>
          {ticketOpen ? (
            <PrepTicket
              testID={`merchant-order-${order.id}-ticket`}
              reference={`Commande ${order.id.slice(0, 6).toUpperCase()}`}
              subtitle={FULFILMENT_LABEL[order.fulfilment]}
              lines={order.items.map((l) => ({ label: l.title, qty: l.qty }))}
              qrValue={JSON.stringify({
                v: 1,
                id: order.id,
                t: order.total,
                n: order.items.length,
              })}
            />
          ) : null}
        </View>
      ) : null}

      {/* Remise au coursier partenaire (Uber Direct) : il vient chercher la commande au
          comptoir ; la confier la passe « En livraison ». */}
      {serverActions ?? null}

      {!serverActions && order.fulfilment === 'livraison' && order.status === 'prete' ? (
        <View
          testID={`merchant-order-${order.id}-handover`}
          className="mt-3 flex-row items-center justify-between rounded-control bg-surface-muted px-3.5 py-3"
        >
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
              Remise au coursier
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              Un coursier Uber Direct vient la chercher au comptoir.
            </AppText>
          </View>
          {onHandover ? (
            <Pressable
              testID={`merchant-order-${order.id}-handover-open`}
              accessibilityRole="button"
              accessibilityLabel="Remettre la commande au coursier"
              onPress={() => onHandover(order.id)}
              className="rounded-control bg-brand-500 px-3 py-2"
            >
              <AppText className="font-sans-bold text-white" style={{ fontSize: 12 }}>
                Remettre
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Le geste suivant. Les transitions viennent de la machine à états du
          §11 : on ne propose jamais un chemin illégal. */}
      {options.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {options.map((status, index) => {
            // La machine à états liste le chemin nominal EN TÊTE. Tout le
            // reste — refuser, rembourser — est une sortie de route : la
            // mettre en avant inviterait à la prendre, même quand c'est la
            // seule action restante sur une commande déjà close.
            const secondary = index > 0 || status === 'annulee' || status === 'remboursee';
            return (
              <Pressable
                key={status}
                testID={`merchant-order-${order.id}-${status}`}
                accessibilityRole="button"
                accessibilityLabel={ACTION_LABEL[status] ?? ORDER_STATUS_LABEL[status]}
                onPress={() => onAdvance(status)}
                className={cn(
                  'rounded-control px-4 py-2.5',
                  secondary ? 'border border-line' : 'bg-brand-500 active:bg-brand-600',
                )}
              >
                <AppText
                  className={cn(
                    'font-sans-bold',
                    secondary ? 'text-ink-muted' : 'text-ink-inverse',
                  )}
                  style={{ fontSize: 13 }}
                >
                  {ACTION_LABEL[status] ?? ORDER_STATUS_LABEL[status]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const SERVER_ERROR: Partial<Record<OrdersError, string>> = {
  pickup_refused: 'Code de retrait incorrect. Demandez au client de vous montrer son QR.',
  invalid_transition: 'Cette commande a déjà avancé : la liste se met à jour.',
  service_unavailable: 'La livraison Uber Direct n’est pas encore activée par TK LINK.',
  shop_phone_missing:
    'Ajoutez le numéro de votre commerce (Profil → Mon compte) : le coursier en a besoin.',
  phone_required: 'Le numéro du client manque : contactez le support TK LINK.',
  delivery_unavailable: 'Uber Direct refuse cette course (adresse hors zone).',
  network: 'Pas de connexion. Réessayez.',
};

/**
 * LES GESTES D'UNE COMMANDE DU SERVEUR, au comptoir : préparer, dire « c'est prêt », remettre au
 * client contre son code de retrait, ou appeler un coursier Uber Direct pour une livraison. Le
 * serveur vérifie chaque geste (titulaire du commerce, ordre des étapes, code).
 */
function ServerActions({ order, onDone }: { order: ServerOrder; onDone: () => void }) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OrdersError | null>(null);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [wrongQr, setWrongQr] = useState(false);

  // Le QR du client contient sa commande et son code : on vérifie que c'est CETTE commande, puis le
  // serveur vérifie le code. Un QR d'une autre commande ou étranger à TK LINK est refusé sur place.
  const onScan = (value: string) => {
    const qr = parsePickupQr(value);
    if (!qr || qr.orderId !== order.id) {
      setWrongQr(true);
      return;
    }
    setWrongQr(false);
    setScanning(false);
    setCode(qr.code);
    void run(() => confirmPickup(order.id, qr.code));
  };

  const run = async (action: () => Promise<{ ok: true } | { ok: false; code: OrdersError }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      setError(res.code);
      return;
    }
    setAsking(false);
    setCode('');
    onDone();
  };

  const delivery = order.fulfilment === 'livraison';
  const paid = order.status === 'payee' || order.status === 'acceptee';
  const step: { id: string; label: string; act: () => void } | null = paid
    ? {
        id: 'preparation',
        label: 'En préparation',
        act: () => void run(() => advanceOrder(order.id, 'preparation')),
      }
    : order.status === 'preparation'
      ? delivery
        ? {
            id: 'dispatch',
            label: 'C’est prêt · appeler un coursier',
            act: () => void run(() => dispatchCourier(order.id)),
          }
        : {
            id: 'prete',
            label: 'C’est prêt',
            act: () => void run(() => advanceOrder(order.id, 'prete')),
          }
      : order.status === 'prete' && !delivery
        ? { id: 'pickup', label: 'Remise au client', act: () => setAsking(true) }
        : null;

  return (
    <View className="mt-3 gap-2" testID={`merchant-order-${order.id}-server`}>
      {delivery && (order.status === 'prete' || order.status === 'en_livraison') ? (
        <View className="flex-row items-center justify-between rounded-control bg-surface-muted px-3.5 py-3">
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
              {order.status === 'prete' ? 'Coursier Uber Direct en route' : 'En livraison'}
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              {order.status === 'prete'
                ? 'Il vient chercher la commande au comptoir.'
                : 'Le coursier l’apporte au client.'}
            </AppText>
          </View>
          {order.trackingUrl ? (
            <Pressable
              testID={`merchant-order-${order.id}-tracking`}
              accessibilityRole="link"
              accessibilityLabel="Suivre le coursier"
              onPress={() => order.trackingUrl && void Linking.openURL(order.trackingUrl)}
              className="rounded-control border border-line px-3 py-2"
            >
              <Feather name="navigation" size={14} color={colors.brand500} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {asking && scanning ? (
        <View className="gap-2">
          <QrScanner
            testID={`merchant-order-${order.id}-scanner`}
            title="QR de retrait du client"
            onScan={onScan}
            onClose={() => setScanning(false)}
          />
          {wrongQr ? (
            <AppText
              testID={`merchant-order-${order.id}-wrong-qr`}
              variant="caption"
              className="text-danger"
            >
              Ce QR n’est pas celui de cette commande.
            </AppText>
          ) : null}
        </View>
      ) : null}

      {asking && !scanning ? (
        <View className="gap-2 rounded-control border border-line p-3">
          <View className="flex-row items-center justify-between">
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              Code de retrait du client
            </AppText>
            <Pressable
              testID={`merchant-order-${order.id}-scan`}
              accessibilityRole="button"
              accessibilityLabel="Scanner le QR de retrait du client"
              onPress={() => {
                setWrongQr(false);
                setScanning(true);
              }}
              className="flex-row items-center gap-1.5 rounded-control border border-brand-500 px-3 py-1.5"
            >
              <Feather name="maximize" size={13} color={colors.brand500} />
              <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 12 }}>
                Scanner le QR
              </AppText>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-2">
            <TextInput
              testID={`merchant-order-${order.id}-code`}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="6 chiffres"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Code de retrait à 6 chiffres"
              className="flex-1 rounded-control border border-line bg-surface px-3 py-2.5 font-sans text-ink"
              style={{ fontSize: 18, letterSpacing: 4, fontVariant: ['tabular-nums'] }}
            />
            <Pressable
              testID={`merchant-order-${order.id}-code-submit`}
              accessibilityRole="button"
              accessibilityLabel="Valider la remise"
              accessibilityState={{ disabled: code.length !== 6 || busy }}
              disabled={code.length !== 6 || busy}
              onPress={() => void run(() => confirmPickup(order.id, code))}
              className={cn(
                'rounded-control px-4 py-3',
                code.length === 6 ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-bold',
                  code.length === 6 ? 'text-white' : 'text-ink-faint',
                )}
                style={{ fontSize: 13 }}
              >
                Valider
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : step ? (
        <Pressable
          testID={`merchant-order-${order.id}-${step.id}`}
          accessibilityRole="button"
          accessibilityLabel={step.label}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={step.act}
          className="self-start rounded-control bg-brand-500 px-4 py-2.5 active:bg-brand-600"
        >
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 13 }}>
            {busy ? '…' : step.label}
          </AppText>
        </Pressable>
      ) : null}

      {error ? (
        <AppText
          testID={`merchant-order-${order.id}-error`}
          variant="caption"
          className="text-danger"
        >
          {SERVER_ERROR[error] ?? 'Action impossible pour le moment. Réessayez.'}
        </AppText>
      ) : null}
    </View>
  );
}
