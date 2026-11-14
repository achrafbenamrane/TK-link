import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { orderRef } from '@/shared/lib/order-ref';
import { AppText, Button, HeaderBackButton, PrepTicket, Screen, TextField } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatCents } from '../lib/billing';
import {
  advanceB2bOrder,
  type B2bOrder,
  confirmB2bPickup,
  fetchB2bSales,
} from '../lib/wholesale-api';
import { B2B_STATUS_LABEL, type B2bStatus, nextB2bStep, PREP_STEPS } from '../lib/wholesale-orders';

/** Ce qui reste à faire : payée, en préparation, prête ou expédiée. */
const OPEN: readonly B2bStatus[] = ['payee', 'acceptee', 'preparation', 'prete', 'en_livraison'];

/** Les étapes de la barre de suivi, selon que le grossiste expédie ou que le commerçant vient. */
const TRACK: Record<B2bOrder['fulfilment'], readonly B2bStatus[]> = {
  livraison: ['payee', 'preparation', 'en_livraison', 'livree'],
  'touch-collect': ['payee', 'preparation', 'prete', 'recuperee'],
};

/**
 * LES VENTES DU GROSSISTE SUR LE SERVEUR (migration 0023) — étapes 10 à 12 de son schéma, sur de
 * vraies commandes payées : ticket de préparation, bon de préparation coché, expédition, livraison
 * (ou remise au comptoir contre le code de l'acheteur). Pas d'« Accepter » : payée vaut acceptation.
 */
export function ServerWholesalerOrders({ onBack }: { onBack?: () => void }) {
  const colors = useColors();
  const [orders, setOrders] = useState<B2bOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  // Le bon de préparation coché sur CET appareil : un geste de l'entrepôt, pas une donnée vendue.
  const [prep, setPrep] = useState<Record<string, string[]>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetchB2bSales();
    setFailed(!res.ok);
    if (res.ok) setOrders(res.value);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const list = useMemo(() => orders ?? [], [orders]);
  const shown = useMemo(() => list.filter((o) => OPEN.includes(o.status) !== done), [list, done]);
  const todo = list.filter((o) => o.status === 'payee' || o.status === 'acceptee').length;

  const run = async (orderId: string, action: () => Promise<{ ok: boolean }>, message: string) => {
    setBusy(orderId);
    setErrors((e) => ({ ...e, [orderId]: '' }));
    const res = await action();
    setBusy(null);
    if (res.ok) await load();
    else setErrors((e) => ({ ...e, [orderId]: message }));
  };

  return (
    <Screen testID="wholesaler-orders" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-10">
        <View className="flex-row items-center gap-3 pt-2">
          {onBack ? <HeaderBackButton testID="wholesaler-orders-back" onPress={onBack} /> : null}
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Commandes des commerçants
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {todo > 0
                ? `${todo} commande${todo > 1 ? 's' : ''} à préparer.`
                : 'Rien en attente pour l’instant.'}
            </AppText>
          </View>
        </View>

        <View className="flex-row gap-2">
          {(
            [
              { key: false, label: 'À traiter' },
              { key: true, label: 'Terminées' },
            ] as const
          ).map((f) => (
            <Pressable
              key={String(f.key)}
              testID={`wholesaler-filter-${f.key ? 'done' : 'active'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: done === f.key }}
              onPress={() => setDone(f.key)}
              className={cn(
                'rounded-pill px-4 py-2',
                done === f.key ? 'bg-brand-500' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  done === f.key ? 'text-white' : 'text-ink-muted',
                )}
                style={{ fontSize: 13 }}
              >
                {f.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {orders === null ? (
          <View className="items-center gap-3 pt-12">
            <AppText variant="caption" className="text-center">
              {failed ? 'Les commandes n’ont pas pu être chargées.' : 'Chargement des commandes…'}
            </AppText>
            {failed ? (
              <Button
                testID="wholesaler-orders-retry"
                label="Réessayer"
                variant="outline"
                size="sm"
                onPress={() => void load()}
              />
            ) : null}
          </View>
        ) : shown.length === 0 ? (
          <View testID="wholesaler-orders-empty" className="items-center gap-2 px-8 pt-12">
            <Feather name="inbox" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="text-center text-base">
              {done ? 'Aucune commande terminée' : 'Aucune commande en attente'}
            </AppText>
            <AppText variant="caption" className="text-center">
              Les commandes des commerçants arrivent ici dès qu’elles sont payées : le ticket de
              préparation est prêt tout de suite.
            </AppText>
          </View>
        ) : (
          shown.map((o) => {
            const step = nextB2bStep(o);
            const shipped = o.fulfilment === 'livraison';
            const checked = prep[o.id] ?? [];
            // Le colis ne part pas tant que le bon n'est pas coché (expédition seulement).
            const blocked =
              shipped &&
              o.status === 'preparation' &&
              !PREP_STEPS.every((p) => checked.includes(p.key));
            const track = TRACK[o.fulfilment];
            const stage = track.indexOf(o.status === 'acceptee' ? 'payee' : o.status);
            const ref = orderRef(o.id);
            return (
              <View
                key={o.id}
                testID={`wholesaler-order-${o.id}`}
                className="gap-2.5 rounded-card border border-line bg-surface-muted p-4"
              >
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <AppText className="font-sans-bold text-ink" numberOfLines={2}>
                      {o.title}
                    </AppText>
                    <AppText variant="caption" className="mt-0.5 text-ink-faint">
                      {ref} · {o.counterpart} · {new Date(o.at).toLocaleDateString('fr-FR')}
                    </AppText>
                  </View>
                  <View className="rounded-sm border border-line px-2 py-1">
                    <AppText
                      testID={`wholesaler-order-${o.id}-status`}
                      className="font-sans-bold text-ink-muted"
                      style={{ fontSize: 10 }}
                    >
                      {B2B_STATUS_LABEL[o.status].toUpperCase()}
                    </AppText>
                  </View>
                </View>

                <View className="flex-row items-center justify-between border-t border-line pt-2">
                  <AppText className="text-ink-muted" style={{ fontSize: 13 }}>
                    {o.qty} lot{o.qty > 1 ? 's' : ''} ·{' '}
                    {shipped ? 'à expédier' : 'retrait chez vous'}
                  </AppText>
                  <AppText className="font-sans-bold text-ink" style={{ fontSize: 15 }}>
                    {formatCents(o.totalCents)}
                  </AppText>
                </View>

                {shipped && o.address ? (
                  <View className="flex-row items-start gap-1.5">
                    <Feather name="map-pin" size={13} color={colors.inkMuted} />
                    <AppText
                      testID={`wholesaler-order-${o.id}-address`}
                      variant="caption"
                      className="flex-1 text-ink-muted"
                    >
                      {o.address}
                    </AppText>
                  </View>
                ) : null}

                {o.status === 'payee' || o.status === 'acceptee' || o.status === 'preparation' ? (
                  <View className="gap-2">
                    <Pressable
                      testID={`wholesaler-order-${o.id}-ticket-toggle`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: ticketFor === o.id }}
                      accessibilityLabel="Ticket de préparation"
                      onPress={() => setTicketFor((cur) => (cur === o.id ? null : o.id))}
                      className="flex-row items-center gap-2 self-start rounded-control border border-line px-3 py-2"
                    >
                      <Feather
                        name="printer"
                        size={14}
                        color={ticketFor === o.id ? colors.brand500 : colors.inkMuted}
                      />
                      <AppText
                        className="font-sans-semibold text-ink-muted"
                        style={{ fontSize: 12.5 }}
                      >
                        {ticketFor === o.id ? 'Masquer le ticket' : 'Ticket de préparation'}
                      </AppText>
                    </Pressable>
                    {ticketFor === o.id ? (
                      <PrepTicket
                        testID={`wholesaler-order-${o.id}-ticket`}
                        reference={ref}
                        subtitle={`Commerçant : ${o.counterpart}`}
                        lines={[{ label: o.title, qty: o.qty }]}
                        qrValue={JSON.stringify({ v: 1, id: o.id, n: o.qty, b2b: 1 })}
                      />
                    ) : null}
                  </View>
                ) : null}

                <View testID={`wholesaler-order-${o.id}-track`} className="flex-row gap-1">
                  {track.map((s, i) => (
                    <View
                      key={s}
                      className={cn(
                        'h-1 flex-1 rounded-pill',
                        stage >= 0 && i <= stage ? 'bg-brand-500' : 'bg-line',
                      )}
                    />
                  ))}
                </View>

                {shipped && o.status === 'preparation' ? (
                  <View
                    testID={`wholesaler-order-${o.id}-slip`}
                    className="gap-1.5 rounded-control border border-line bg-surface p-3"
                  >
                    <View className="flex-row items-center gap-1.5">
                      <Feather name="clipboard" size={13} color={colors.inkMuted} />
                      <AppText className="font-sans-semibold text-ink" style={{ fontSize: 12.5 }}>
                        Bon de préparation · {o.qty} lot{o.qty > 1 ? 's' : ''}
                      </AppText>
                    </View>
                    {PREP_STEPS.map((p) => {
                      const on = checked.includes(p.key);
                      return (
                        <Pressable
                          key={p.key}
                          testID={`wholesaler-order-${o.id}-prep-${p.key}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={p.label}
                          onPress={() =>
                            setPrep((all) => ({
                              ...all,
                              [o.id]: on ? checked.filter((k) => k !== p.key) : [...checked, p.key],
                            }))
                          }
                          className="flex-row items-center gap-2 py-1"
                        >
                          <Feather
                            name={on ? 'check-square' : 'square'}
                            size={17}
                            color={on ? colors.brand500 : colors.inkFaint}
                          />
                          <AppText
                            className={on ? 'text-ink' : 'text-ink-muted'}
                            style={{ fontSize: 13 }}
                          >
                            {p.label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {step?.kind === 'handover' ? (
                  <View className="gap-2">
                    <TextField
                      testID={`wholesaler-order-${o.id}-code`}
                      placeholder="Code de retrait du commerçant (6 chiffres)"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={codes[o.id] ?? ''}
                      onChangeText={(v) =>
                        setCodes((c) => ({ ...c, [o.id]: v.replace(/\D/g, '') }))
                      }
                    />
                    <Button
                      testID={`wholesaler-order-${o.id}-handover`}
                      label={step.label}
                      loading={busy === o.id}
                      disabled={(codes[o.id] ?? '').length !== 6}
                      onPress={() =>
                        void run(
                          o.id,
                          () => confirmB2bPickup(o.id, codes[o.id] ?? ''),
                          'Code incorrect : demandez au commerçant celui de sa commande.',
                        )
                      }
                    />
                  </View>
                ) : step ? (
                  <Button
                    testID={`wholesaler-order-${o.id}-advance`}
                    label={blocked ? 'Cochez le bon de préparation' : step.label}
                    loading={busy === o.id}
                    disabled={blocked}
                    onPress={() =>
                      void run(
                        o.id,
                        () => advanceB2bOrder(o.id, step.to),
                        'L’étape n’a pas pu être enregistrée. Rouvrez la commande et réessayez.',
                      )
                    }
                  />
                ) : null}

                {errors[o.id] ? (
                  <AppText
                    testID={`wholesaler-order-${o.id}-error`}
                    variant="caption"
                    className="text-danger"
                  >
                    {errors[o.id]}
                  </AppText>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
