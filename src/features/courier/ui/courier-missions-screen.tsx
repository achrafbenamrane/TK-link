import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { AppText, Button, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { canReceiveMissions, courierGain, formatEur } from '../lib/courier';
import { availableMissions } from '../lib/available';
import { isDemoMission } from '../lib/demo';
import { useCourierStore, type Mission } from '../model/store';
import { FinalValidation } from './final-validation';
import { MissionDetail } from './mission-detail';
import { MissionNavigation } from './mission-navigation';
import { CourierHeader, type BiometricResult } from './parts';

export type MessageTarget = 'commerce' | 'client' | 'support';

type Props = {
  /** Les missions proposées — fabriquées par la route à partir des commandes prêtes. */
  missions: Mission[];
  /** Empreinte / visage de CE téléphone. Fournie par la route (la biométrie vit dans `shop`). */
  authenticate: (reason: string) => Promise<BiometricResult>;
  /** La commande est prise chez le commerçant : elle passe « en livraison ». */
  onPickedUp: (orderId: string) => void;
  /** La commande est remise : elle passe « livrée ». */
  onDelivered: (orderId: string) => void;
  /** Ouvre une conversation (commerce, client ou support TK LINK). */
  onMessage: (who: MessageTarget, mission: Mission | null) => void;
  /** Montrer des missions d'EXEMPLE quand il n'y en a aucune — pour la démonstration. */
  showExamples?: boolean;
};

function GainLine({ mission }: { mission: Mission }) {
  const colors = useColors();
  const gain = courierGain(mission.distanceKm);
  return (
    <View className="flex-row items-center gap-1.5">
      <Feather name="credit-card" size={13} color={colors.inkFaint} />
      <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
        {gain.complet ? formatEur(gain.eur) : `dès ${formatEur(gain.eur)}`}
      </AppText>
    </View>
  );
}

/**
 * L'ONGLET « MISSIONS » — étapes 8 à 12 du process livreur, dans l'ordre des maquettes :
 *
 *   proposées (réception, acceptation) → mission active (retrait, empreinte + code) →
 *   navigation / suivi → validation finale (QR ou code à six chiffres du client).
 *
 * C'est l'étape de la mission qui décide de l'écran : un livreur qui rouvre l'app retombe
 * là où il en était.
 */
export function CourierMissionsScreen({
  missions,
  authenticate,
  onPickedUp,
  onDelivered,
  onMessage,
  showExamples = false,
}: Props) {
  const colors = useColors();
  const status = useCourierStore((s) => s.status);
  const online = useCourierStore((s) => s.online);
  const active = useCourierStore((s) => s.active);
  const declined = useCourierStore((s) => s.declined);
  const acceptMission = useCourierStore((s) => s.acceptMission);
  const declineMission = useCourierStore((s) => s.declineMission);
  const confirmDelivery = useCourierStore((s) => s.confirmDelivery);

  // « J'arrive chez le client » : on passe de la navigation à la validation finale.
  const [arrived, setArrived] = useState(false);
  // La remise validée : on garde la mission pour l'écran de confirmation, le store l'a rangée.
  const [done, setDone] = useState<{ mission: Mission; at: number } | null>(null);

  const ready = status === 'valide';
  // En démonstration, les missions d'exemple s'ajoutent aux vraies : elles montrent tout le détail
  // (client, téléphones, itinéraire) qu'une commande locale n'a pas.
  const offers = availableMissions({
    missions,
    showExamples,
    declined,
    activeOrderId: active?.mission.orderId,
  });

  if (done) {
    return (
      <Screen testID="courier-missions-screen" padded={false}>
        <ScrollView
          contentContainerClassName="gap-3 px-5 pb-28"
          showsVerticalScrollIndicator={false}
        >
          <FinalValidation
            mission={done.mission}
            doneAt={done.at}
            onValidate={() => ({ ok: true })}
            onClose={() => {
              setDone(null);
              setArrived(false);
            }}
          />
        </ScrollView>
      </Screen>
    );
  }

  if (active) {
    const m = active.mission;
    return (
      <Screen testID="courier-missions-screen" padded={false}>
        <ScrollView
          contentContainerClassName="gap-3 px-5 pb-28"
          showsVerticalScrollIndicator={false}
        >
          {active.step === 'en_livraison' && arrived ? (
            <FinalValidation
              mission={m}
              doneAt={null}
              onClose={() => setArrived(false)}
              onValidate={(code) => {
                const res = confirmDelivery(code);
                if (res.ok) {
                  setDone({ mission: m, at: Date.now() });
                  onDelivered(m.orderId);
                }
                return res;
              }}
            />
          ) : active.step === 'en_livraison' ? (
            <MissionNavigation
              mission={m}
              onArrive={() => setArrived(true)}
              onMessage={() => onMessage('client', m)}
              onIncident={() => onMessage('support', m)}
            />
          ) : (
            <MissionDetail active={active} authenticate={authenticate} onPickedUp={onPickedUp} />
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen testID="courier-missions-screen" padded={false}>
      <ScrollView contentContainerClassName="gap-3 px-5 pb-28" showsVerticalScrollIndicator={false}>
        <CourierHeader title="Missions" />

        {!ready ? (
          <AppText variant="caption" className="text-ink-faint">
            Votre compte doit être validé pour recevoir des missions.
          </AppText>
        ) : !online ? (
          <View testID="courier-offline" className="items-center gap-2 py-10">
            <Feather name="power" size={28} color={colors.inkFaint} />
            <AppText variant="caption" className="text-center">
              Vous êtes hors ligne. Passez disponible depuis l’accueil pour recevoir des missions.
            </AppText>
          </View>
        ) : (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <AppText variant="label">Missions disponibles</AppText>
            </View>

            {offers.length === 0 ? (
              <View testID="courier-no-missions" className="items-center gap-2 py-10">
                <Feather name="navigation" size={28} color={colors.inkFaint} />
                <AppText variant="caption" className="text-center">
                  Aucune mission pour le moment. Elles apparaissent dès qu’une commande en livraison
                  est prête chez un commerçant.
                </AppText>
              </View>
            ) : (
              offers.map((m) => (
                <View
                  key={m.orderId}
                  testID={`courier-offer-${m.orderId}`}
                  className="gap-3 rounded-card border border-line bg-surface p-4"
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <AppText className="font-sans-bold text-ink" numberOfLines={1}>
                        {m.merchantName}
                      </AppText>
                      <AppText variant="caption" className="text-ink-faint" numberOfLines={2}>
                        {m.merchantArea ? `${m.merchantArea} → ` : ''}
                        {m.dropoff || 'adresse du client'}
                      </AppText>
                    </View>
                    <View className="items-end gap-1">
                      <GainLine mission={m} />
                      {isDemoMission(m.orderId) ? (
                        <View
                          testID={`courier-example-${m.orderId}`}
                          className="rounded-pill bg-brand-50 px-2 py-0.5"
                        >
                          <AppText
                            className="font-sans-semibold text-brand-600"
                            style={{ fontSize: 10 }}
                          >
                            Exemple
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row justify-between rounded-control bg-surface-muted px-3 py-2.5">
                    {[
                      { icon: 'package', label: 'Articles', value: String(m.itemCount) },
                      {
                        icon: 'map-pin',
                        label: 'Distance',
                        value:
                          m.distanceKm !== null
                            ? `${m.distanceKm.toFixed(1).replace('.', ',')} km`
                            : '—',
                      },
                      { icon: 'clock', label: 'Délai', value: m.etaMin ? `${m.etaMin} min` : '—' },
                    ].map((c) => (
                      <View key={c.label} className="flex-1 items-center gap-0.5">
                        <Feather name={c.icon as 'clock'} size={14} color={colors.brand500} />
                        <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
                          {c.value}
                        </AppText>
                        <AppText
                          variant="caption"
                          className="text-ink-faint"
                          style={{ fontSize: 10.5 }}
                        >
                          {c.label}
                        </AppText>
                      </View>
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        testID={`courier-decline-${m.orderId}`}
                        label="Refuser"
                        variant="ghost"
                        onPress={() => declineMission(m.orderId)}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        testID={`courier-accept-${m.orderId}`}
                        label="Accepter"
                        disabled={!canReceiveMissions(status, online)}
                        onPress={() => acceptMission(m)}
                      />
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <AppText variant="caption" className="text-center text-ink-faint">
          Rémunération : {formatEur(PLATFORM_SETTINGS.courierBaseFeeEur)} par commande, puis{' '}
          {formatEur(PLATFORM_SETTINGS.courierPerKmEur)}/km au-delà de la zone de base.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
