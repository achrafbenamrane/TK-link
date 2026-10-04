import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { isImportantParcel, pickupPin } from '@/shared/lib/handover';
import { pickImage } from '@/shared/lib/image-picker';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { AppText, Button, Screen, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  canReceiveMissions,
  courierGain,
  formatEur,
  MISSION_STEPS,
  STEP_LABEL,
  VEHICLE_LABEL,
} from '../lib/courier';
import { DEMO_MISSIONS, isDemoMission } from '../lib/demo';
import { useCourierStore, type Mission } from '../model/store';

type Props = {
  /** Les missions proposées — fabriquées par la route à partir des commandes prêtes. */
  missions: Mission[];
  /** Biométrie locale (colis important). Fournie par la route. */
  authenticate: (reason: string) => Promise<boolean>;
  /** La commande est prise chez le commerçant : elle passe « en livraison ». */
  onPickedUp: (orderId: string) => void;
  /** La commande est remise : elle passe « livrée ». */
  onDelivered: (orderId: string) => void;
  /** Reprendre l'inscription (compte pas encore validé). */
  onOpenSetup: () => void;
  /**
   * Montrer des missions d'EXEMPLE quand il n'y en a aucune — pour la démonstration
   * au client. Elles sont signalées comme telles.
   */
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
 * LE TABLEAU DE BORD LIVREUR — étapes 7 à 12 du schéma du client :
 * disponibilité → réception → acceptation → retrait chez le commerçant (QR/PIN,
 * biométrie si colis important) → livraison → confirmation avec preuve.
 */
export function CourierHomeScreen({
  missions,
  authenticate,
  onPickedUp,
  onDelivered,
  onOpenSetup,
  showExamples = false,
}: Props) {
  const colors = useColors();
  const status = useCourierStore((s) => s.status);
  const vehicle = useCourierStore((s) => s.vehicle);
  const online = useCourierStore((s) => s.online);
  const active = useCourierStore((s) => s.active);
  const declined = useCourierStore((s) => s.declined);
  const setOnline = useCourierStore((s) => s.setOnline);
  const acceptMission = useCourierStore((s) => s.acceptMission);
  const declineMission = useCourierStore((s) => s.declineMission);
  const startRoute = useCourierStore((s) => s.startRoute);
  const confirmPickup = useCourierStore((s) => s.confirmPickup);
  const startDelivery = useCourierStore((s) => s.startDelivery);
  const confirmDelivery = useCourierStore((s) => s.confirmDelivery);

  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const ready = status === 'valide';
  const examples = showExamples && missions.length === 0;
  const offers = (examples ? DEMO_MISSIONS : missions).filter((m) => !declined.includes(m.orderId));
  const submitProfile = useCourierStore((s) => s.submitProfile);
  const validateAccount = useCourierStore((s) => s.validateAccount);
  const setDeviceEnrolled = useCourierStore((s) => s.setDeviceEnrolled);

  // Démo : un compte prêt à livrer en un geste, sans passer par les justificatifs.
  const activateDemo = () => {
    submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'demo', selfieUri: 'demo' });
    validateAccount();
    setDeviceEnrolled(true);
    setOnline(true);
  };

  const pickup = async () => {
    if (!active) return;
    const important = isImportantParcel(
      active.mission.totalEur,
      PLATFORM_SETTINGS.importantParcelMinEur,
    );
    // La biométrie se demande AVANT de valider : un colis important ne passe pas
    // sans elle (V1.1).
    const biometricOk = important
      ? await authenticate('Confirmer la prise en charge d’un colis important')
      : true;
    const res = confirmPickup(pin, biometricOk);
    if (res.ok) {
      setPin('');
      setMessage(null);
    } else if (res.reason === 'code') {
      setMessage('Ce code n’est pas celui de la commande.');
    } else if (res.reason === 'biometrie') {
      setMessage('La biométrie est requise pour un colis important.');
    }
  };

  const deliver = async () => {
    if (!active) return;
    const proof = await pickImage('camera', { aspect: [4, 3] });
    if (!proof) {
      setMessage('Une preuve de remise est nécessaire : prenez la photo du colis remis.');
      return;
    }
    const orderId = active.mission.orderId;
    const res = confirmDelivery(proof);
    if (res.ok) {
      setMessage(null);
      onDelivered(orderId);
    }
  };

  return (
    <Screen testID="courier-home-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="flex-row items-center justify-between pt-3">
          <Wordmark size={22} />
          <AppText variant="caption" className="text-ink-faint">
            TK Deliver{vehicle ? ` · ${VEHICLE_LABEL[vehicle]}` : ''}
          </AppText>
        </View>

        {/* Disponibilité — étape 7 */}
        <View className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4">
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink">
              {online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              {ready
                ? online
                  ? 'Les missions près de vous arrivent ici.'
                  : 'Passez en ligne pour recevoir des missions.'
                : 'Votre compte doit être validé pour recevoir des missions.'}
            </AppText>
          </View>
          <Switch
            testID="courier-online-toggle"
            accessibilityLabel="Disponibilité"
            value={online}
            disabled={!ready}
            onValueChange={(v) => {
              if (!setOnline(v))
                setMessage('Terminez la mission en cours avant de passer hors ligne.');
            }}
            trackColor={{ true: colors.brand500, false: colors.line }}
          />
        </View>

        {!ready && showExamples ? (
          <Pressable
            testID="courier-demo-activate"
            accessibilityRole="button"
            onPress={activateDemo}
            className="items-center rounded-control border border-dashed border-brand-500 py-3.5"
          >
            <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13.5 }}>
              Démo — activer un compte livreur d’exemple
            </AppText>
          </Pressable>
        ) : null}

        {!ready ? (
          <Pressable
            testID="courier-open-setup"
            accessibilityRole="button"
            onPress={onOpenSetup}
            className="flex-row items-center gap-3 rounded-card bg-brand-50 p-4"
          >
            <Feather name="shield" size={18} color={colors.brand600} />
            <View className="flex-1">
              <AppText className="font-sans-bold text-brand-700">Terminer mon inscription</AppText>
              <AppText variant="caption" className="text-brand-700">
                Identité, véhicule et sécurité : il manque encore quelques étapes.
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.brand600} />
          </Pressable>
        ) : null}

        {message ? (
          <AppText testID="courier-message" variant="caption" className="text-danger">
            {message}
          </AppText>
        ) : null}

        {/* Mission en cours — étapes 9 à 12 */}
        {active ? (
          <View
            testID="courier-active"
            className="gap-3 rounded-card border border-brand-500 bg-surface p-4"
          >
            <View className="flex-row items-center justify-between">
              <AppText className="font-sans-bold text-ink">Mission en cours</AppText>
              <AppText
                testID="courier-active-step"
                variant="caption"
                className="font-sans-semibold text-brand-600"
              >
                {STEP_LABEL[active.step]}
              </AppText>
            </View>
            <View className="flex-row gap-1">
              {MISSION_STEPS.map((s, i) => (
                <View
                  key={s}
                  className={cn(
                    'h-1 flex-1 rounded-pill',
                    i <= MISSION_STEPS.indexOf(active.step) ? 'bg-brand-500' : 'bg-line',
                  )}
                />
              ))}
            </View>
            <View className="gap-0.5">
              <AppText className="font-sans-semibold text-ink">
                {active.mission.merchantName}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                Retrait : {active.mission.merchantArea || 'chez le commerçant'}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                Livraison : {active.mission.dropoff || 'adresse du client'}
              </AppText>
            </View>

            {active.step === 'acceptee' ? (
              <Button
                testID="courier-start-route"
                label="Je pars chez le commerçant"
                onPress={startRoute}
              />
            ) : null}

            {active.step === 'en_route_commercant' ? (
              <View className="gap-2">
                <AppText variant="caption" className="text-ink-faint">
                  Au comptoir : scannez le QR de l’étiquette ou saisissez le code de remise donné
                  par le commerçant.
                </AppText>
                {isDemoMission(active.mission.orderId) ? (
                  <AppText testID="courier-demo-pin" variant="caption" className="text-brand-600">
                    Démo — code de remise : {pickupPin(active.mission.orderId)}
                  </AppText>
                ) : null}
                <TextInput
                  testID="courier-pin"
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="Code à 4 chiffres"
                  placeholderTextColor={colors.inkFaint}
                  accessibilityLabel="Code de remise"
                  className="rounded-control border border-line bg-surface px-3.5 py-3 font-sans text-ink"
                  style={{ fontSize: 18, letterSpacing: 6 }}
                />
                <Button
                  testID="courier-confirm-pickup"
                  label="Confirmer la prise en charge"
                  disabled={pin.length !== 4}
                  onPress={pickup}
                />
              </View>
            ) : null}

            {active.step === 'prise_en_charge' ? (
              <Button
                testID="courier-start-delivery"
                label="Partir chez le client"
                onPress={() => {
                  startDelivery();
                  onPickedUp(active.mission.orderId);
                }}
              />
            ) : null}

            {active.step === 'en_livraison' ? (
              <Button
                testID="courier-confirm-delivery"
                label="Remise au client — prendre la preuve"
                onPress={deliver}
              />
            ) : null}
          </View>
        ) : null}

        {/* Offres — étapes 8 et 9 */}
        {!active && ready && online ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <AppText variant="label">Missions disponibles</AppText>
              {examples ? (
                <View
                  testID="courier-examples-badge"
                  className="rounded-pill bg-brand-50 px-2.5 py-1"
                >
                  <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 11 }}>
                    Exemples
                  </AppText>
                </View>
              ) : null}
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
                    <GainLine mission={m} />
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
        ) : null}

        {/* La règle de rémunération, dite telle que le CDC la pose. */}
        <AppText variant="caption" className="text-center text-ink-faint">
          Rémunération : {formatEur(PLATFORM_SETTINGS.courierBaseFeeEur)} par commande, puis{' '}
          {formatEur(PLATFORM_SETTINGS.courierPerKmEur)}/km au-delà de la zone de base.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
