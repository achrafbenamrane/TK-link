import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { isImportantParcel, pickupPin } from '@/shared/lib/handover';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { AppText, Button, FingerprintScanner, QrScanner, type ScanState } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { courierGain, formatEur, timelineState, TIMELINE } from '../lib/courier';
import { isDemoMission } from '../lib/demo';
import { useCourierStore, type CourierActive } from '../model/store';
import { clock, CodeBoxes, CourierHeader, Panel, PhoneButton, type BiometricResult } from './parts';

type Props = {
  active: CourierActive;
  authenticate: (reason: string) => Promise<BiometricResult>;
  /** La commande est prise chez le commerçant : elle passe « en livraison ». */
  onPickedUp: (orderId: string) => void;
};

/**
 * LE RETRAIT CHEZ LE COMMERÇANT — étape 10 du process livreur : l'identité d'abord, par
 * l'empreinte de SON téléphone (biométrie locale : seule l'heure est retenue, jamais
 * l'empreinte), puis le code à 4 chiffres ou le QR de l'étiquette collée sur le colis.
 *
 * Le commerçant voit « Identité validée » s'afficher sur son écran de remise.
 */
function PickupValidation({ active, authenticate }: Omit<Props, 'onPickedUp'>) {
  const colors = useColors();
  const confirmIdentity = useCourierStore((s) => s.confirmIdentity);
  const confirmPickup = useCourierStore((s) => s.confirmPickup);

  const orderId = active.mission.orderId;
  const demo = isDemoMission(orderId);
  const [scan, setScan] = useState<ScanState>(active.identityAt ? 'ok' : 'repos');
  const [pin, setPin] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [noBiometrics, setNoBiometrics] = useState(false);

  const identified = Boolean(active.identityAt);

  const verify = async () => {
    if (identified || scan === 'scan') return;
    setScan('scan');
    setMessage(null);
    const res = await authenticate(
      isImportantParcel(active.mission.totalEur, PLATFORM_SETTINGS.importantParcelMinEur)
        ? 'Confirmer la prise en charge d’un colis important'
        : 'Confirmer votre identité pour récupérer la commande',
    );
    if (res.ok) {
      confirmIdentity();
      setScan('ok');
      return;
    }
    setScan('echec');
    if (res.reason === 'indisponible') {
      setNoBiometrics(true);
      setMessage(
        'Aucune empreinte n’est enregistrée sur ce téléphone. Ajoutez-en une dans les réglages pour valider une remise.',
      );
    } else if (res.reason === 'echec') {
      setMessage('Empreinte non reconnue — réessayez.');
    } else {
      setMessage('Validation annulée.');
    }
  };

  const confirm = () => {
    const res = confirmPickup(pin);
    if (res.ok) {
      setMessage(null);
      setPin('');
    } else if (res.reason === 'biometrie') {
      setMessage('Confirmez d’abord votre identité avec votre empreinte.');
    } else if (res.reason === 'code') {
      setMessage('Ce code n’est pas celui de la commande.');
    }
  };

  const onScanned = (value: string) => {
    setQrOpen(false);
    try {
      const parsed = JSON.parse(value) as { id?: string };
      if (parsed.id === orderId) {
        setPin(pickupPin(orderId));
        setMessage('QR reconnu : code rempli.');
        return;
      }
    } catch {
      // un QR qui n'est pas celui d'une commande TK LINK
    }
    setMessage('Ce QR n’est pas celui de cette commande.');
  };

  return (
    <Panel testID="courier-pickup" title="Validation du retrait" className="border-brand-500">
      {/* La même validation que sur l'écran du commerçant */}
      <View className="items-center">
        <FingerprintScanner
          testID="courier-fingerprint"
          state={scan}
          size={84}
          idleCaption="Posez votre doigt pour confirmer votre identité"
          onPress={() => void verify()}
        />
      </View>
      <AppText variant="caption" className="text-center">
        Votre empreinte reste sur ce téléphone : TK LINK n’en garde jamais.
      </AppText>

      {identified ? (
        <View
          testID="courier-identity-ok"
          className="flex-row items-center gap-3 rounded-card border border-success bg-surface-muted p-3"
        >
          <View className="h-9 w-9 items-center justify-center rounded-pill bg-success">
            <Feather name="check" size={18} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <AppText className="font-sans-bold text-success">Identité validée</AppText>
            <AppText variant="caption" className="text-ink-faint">
              Vous êtes autorisé à récupérer le colis.
            </AppText>
          </View>
          <AppText variant="caption" className="text-ink-muted">
            {active.identityAt ? clock(active.identityAt) : ''}
          </AppText>
        </View>
      ) : null}

      {noBiometrics && demo && !identified ? (
        <Pressable
          testID="courier-identity-demo"
          accessibilityRole="button"
          onPress={() => {
            confirmIdentity();
            setScan('ok');
            setMessage(null);
          }}
          className="items-center rounded-control border border-dashed border-brand-500 py-3"
        >
          <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13 }}>
            Démo — simuler la pose du doigt
          </AppText>
        </Pressable>
      ) : null}

      {/* Le code ou le QR, une fois l'identité confirmée */}
      <AppText variant="caption" className="font-sans-semibold text-ink-muted">
        Au comptoir : code de remise ou QR de l’étiquette
      </AppText>
      {demo ? (
        <AppText testID="courier-demo-pin" variant="caption" className="text-brand-600">
          Démo — code de remise : {pickupPin(orderId)}
        </AppText>
      ) : null}
      <CodeBoxes
        testID="courier-pin"
        label="Code de remise"
        length={4}
        value={pin}
        onChange={setPin}
      />
      <Pressable
        testID="courier-scan-pickup"
        accessibilityRole="button"
        onPress={() => setQrOpen((v) => !v)}
        className="flex-row items-center justify-center gap-2 rounded-control border border-line bg-surface-muted py-3"
      >
        <Feather name="maximize" size={15} color={colors.brand500} />
        <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
          {qrOpen ? 'Fermer le scanner' : 'Scanner le QR de l’étiquette'}
        </AppText>
      </Pressable>
      {qrOpen ? (
        <QrScanner testID="courier-qr-pickup" onScan={onScanned} onClose={() => setQrOpen(false)} />
      ) : null}

      {message ? (
        <AppText testID="courier-message" variant="caption" className="text-danger">
          {message}
        </AppText>
      ) : null}

      <Button
        testID="courier-confirm-pickup"
        label="Confirmer la prise en charge"
        disabled={!identified || pin.length !== 4}
        onPress={confirm}
      />
    </Panel>
  );
}

/**
 * MISSION ACTIVE — la deuxième maquette : commerce d'origine, client final, type / heure cible /
 * distance, détails de la commande, instructions, progression, et le geste suivant.
 */
export function MissionDetail({ active, authenticate, onPickedUp }: Props) {
  const colors = useColors();
  const startRoute = useCourierStore((s) => s.startRoute);
  const startDelivery = useCourierStore((s) => s.startDelivery);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [more, setMore] = useState(false);

  const m = active.mission;
  const gain = courierGain(m.distanceKm);
  const km = m.distanceKm !== null ? `${m.distanceKm.toFixed(1).replace('.', ',')} km` : '—';

  return (
    <View testID="courier-active" className="gap-3">
      <CourierHeader title="Mission active" badge="En cours" />

      <Panel title="Commerce d’origine">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-pill border border-brand-500">
            <Feather name="shopping-bag" size={18} color={colors.brand500} />
          </View>
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink">{m.merchantName}</AppText>
            <AppText variant="caption" className="text-ink-faint" numberOfLines={2}>
              {m.merchantArea || 'Chez le commerçant'}
            </AppText>
          </View>
          <PhoneButton phone={m.merchantPhone} label="le commerce" />
        </View>
      </Panel>

      <Panel title="Client final">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-pill border border-line bg-surface-muted">
            <Feather name="user" size={18} color={colors.inkMuted} />
          </View>
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink">{m.clientName ?? 'Client'}</AppText>
            <AppText variant="caption" className="text-ink-faint" numberOfLines={2}>
              {m.dropoff || 'Adresse du client'}
            </AppText>
          </View>
          <PhoneButton phone={m.clientPhone} label="le client" />
        </View>
        <View className="flex-row rounded-control bg-surface-muted py-2.5">
          {[
            { label: 'Type', value: 'Livraison' },
            { label: 'Heure cible', value: m.targetTime ?? '—' },
            { label: 'Distance', value: km },
          ].map((c) => (
            <View key={c.label} className="flex-1 items-center gap-0.5">
              <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 10.5 }}>
                {c.label}
              </AppText>
              <AppText className="font-sans-bold text-ink" style={{ fontSize: 14 }}>
                {c.value}
              </AppText>
            </View>
          ))}
        </View>
      </Panel>

      <Panel
        title="Détails de la commande"
        right={
          <AppText testID="courier-order-ref" variant="caption" className="text-ink-faint">
            #{m.ref ?? m.orderId.slice(0, 8).toUpperCase()}
          </AppText>
        }
      >
        <View className="flex-row items-center justify-between">
          <AppText className="text-ink" style={{ fontSize: 13 }}>
            {m.itemCount} article{m.itemCount > 1 ? 's' : ''}
            {m.bags ? ` • ${m.bags} sac${m.bags > 1 ? 's' : ''}` : ''}
          </AppText>
          <Pressable
            testID="courier-order-more"
            accessibilityRole="button"
            accessibilityState={{ expanded: more }}
            hitSlop={8}
            onPress={() => setMore((v) => !v)}
          >
            <AppText className="font-sans-semibold text-accent-deep" style={{ fontSize: 12.5 }}>
              {more ? 'Masquer le détail' : 'Voir le détail'}
            </AppText>
          </Pressable>
        </View>
        {more ? (
          <View testID="courier-order-detail" className="gap-0.5">
            <AppText variant="caption">Valeur de la commande : {formatEur(m.totalEur)}</AppText>
            <AppText variant="caption">
              Votre gain : {gain.complet ? formatEur(gain.eur) : `dès ${formatEur(gain.eur)}`}
            </AppText>
          </View>
        ) : null}
        {m.instructions ? (
          <View className="gap-0.5 border-t border-line pt-2.5">
            <AppText variant="caption" className="font-sans-semibold text-ink-muted">
              Instructions client
            </AppText>
            <AppText testID="courier-instructions" className="text-ink" style={{ fontSize: 13 }}>
              {m.instructions}
            </AppText>
          </View>
        ) : null}
      </Panel>

      <Panel title="Progression de la mission" testID="courier-timeline">
        {TIMELINE.map((line, i) => {
          const state = timelineState(line.step, active.step);
          const at = active.at[line.step];
          return (
            <View key={line.step} className="flex-row items-center gap-3">
              <View className="w-6 items-center">
                <View
                  className={cn(
                    'h-5 w-5 items-center justify-center rounded-pill',
                    state === 'fait'
                      ? 'bg-success'
                      : state === 'en_cours'
                        ? 'border-2 border-brand-500'
                        : 'border border-line bg-surface-muted',
                  )}
                >
                  {state === 'fait' ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
                  {state === 'en_cours' ? (
                    <View className="h-2 w-2 rounded-pill bg-brand-500" />
                  ) : null}
                </View>
                {i < TIMELINE.length - 1 ? <View className="mt-0.5 h-3 w-px bg-line" /> : null}
              </View>
              <AppText
                testID={`courier-timeline-${line.step}`}
                className={cn(
                  'flex-1',
                  state === 'a_venir' ? 'text-ink-faint' : 'font-sans-semibold text-ink',
                )}
                style={{ fontSize: 13 }}
              >
                {line.label}
              </AppText>
              <AppText
                variant="caption"
                className={
                  state === 'en_cours' ? 'font-sans-semibold text-brand-500' : 'text-ink-faint'
                }
              >
                {state === 'en_cours' && !at
                  ? 'En cours'
                  : state === 'a_venir'
                    ? 'À venir'
                    : at
                      ? clock(at)
                      : ''}
              </AppText>
            </View>
          );
        })}
      </Panel>

      {active.step === 'en_route_commercant' && pickupOpen ? (
        <PickupValidation active={active} authenticate={authenticate} />
      ) : null}

      {active.step === 'acceptee' ? (
        <Button
          testID="courier-start-route"
          label="Partir chez le commerçant"
          onPress={startRoute}
        />
      ) : null}
      {active.step === 'en_route_commercant' && !pickupOpen ? (
        <Button
          testID="courier-open-pickup"
          label="Récupérer la commande"
          onPress={() => setPickupOpen(true)}
        />
      ) : null}
      {active.step === 'prise_en_charge' ? (
        <Button
          testID="courier-start-delivery"
          label="Partir chez le client"
          onPress={() => {
            startDelivery();
            onPickedUp(m.orderId);
          }}
        />
      ) : null}
    </View>
  );
}
