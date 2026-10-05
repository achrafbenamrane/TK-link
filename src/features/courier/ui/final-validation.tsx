import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { deliveryCode } from '@/shared/lib/handover';
import { AppText, Button, QrScanner } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { isDemoMission } from '../lib/demo';
import type { Mission } from '../model/store';
import { clock, CodeBoxes, CourierHeader, Panel, PhoneButton } from './parts';

type Props = {
  mission: Mission;
  /** Quand la remise a été validée (ms) ; `null` tant qu'elle ne l'est pas. */
  doneAt: number | null;
  /** Valide la remise avec le code du client. */
  onValidate: (code: string) => { ok: true } | { ok: false; reason: 'pas_de_mission' | 'code' };
  /** Retour à l'écran précédent (navigation) ou, une fois terminée, aux missions. */
  onClose: () => void;
};

/**
 * VALIDATION FINALE — la quatrième maquette : le client scanne son QR code, ou donne son code à
 * six chiffres, et le livreur valide la remise. C'est la preuve de remise du process (étape 12).
 */
export function FinalValidation({ mission, doneAt, onValidate, onClose }: Props) {
  const colors = useColors();
  const [code, setCode] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = (value: string) => {
    const res = onValidate(value);
    if (res.ok) setMessage(null);
    else setMessage('Ce code n’est pas celui du client. Vérifiez-le avec lui.');
  };

  const onScanned = (value: string) => {
    setQrOpen(false);
    try {
      const parsed = JSON.parse(value) as { id?: string; d?: string };
      if (parsed.id === mission.orderId && parsed.d) {
        setCode(parsed.d);
        submit(parsed.d);
        return;
      }
    } catch {
      // un QR qui n'est pas celui d'une commande TK LINK
    }
    setMessage('Ce QR n’est pas celui de cette commande.');
  };

  return (
    <View testID="courier-final" className="gap-3">
      <CourierHeader
        title="Validation finale"
        badge={doneAt ? 'Terminée' : 'En cours'}
        onBack={doneAt ? undefined : onClose}
      />

      <Panel title="Client final">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-pill border border-line bg-surface-muted">
            <Feather name="user" size={18} color={colors.inkMuted} />
          </View>
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink">{mission.clientName ?? 'Client'}</AppText>
            <AppText variant="caption" className="text-ink-faint" numberOfLines={2}>
              {mission.dropoff}
            </AppText>
          </View>
          <PhoneButton phone={mission.clientPhone} label="le client" />
        </View>
      </Panel>

      {!doneAt ? (
        <Panel title="Validation client final">
          <AppText variant="caption">
            Le QR code ou le code client suffit pour confirmer la remise.
          </AppText>

          <Pressable
            testID="courier-scan-delivery"
            accessibilityRole="button"
            onPress={() => setQrOpen((v) => !v)}
            className="flex-row items-center gap-3 rounded-card border border-brand-500 bg-brand-50 p-3.5"
          >
            <View className="flex-1">
              <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13.5 }}>
                Scanner le QR code du client
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                Présentez le scanner au QR code affiché sur le téléphone du client.
              </AppText>
            </View>
            <Feather name="maximize" size={34} color={colors.ink} />
          </Pressable>
          {qrOpen ? (
            <QrScanner
              testID="courier-qr-delivery"
              onScan={onScanned}
              onClose={() => setQrOpen(false)}
            />
          ) : null}

          <AppText variant="caption" className="text-center text-ink-faint">
            OU
          </AppText>

          <View className="gap-2 rounded-card border border-brand-500 bg-brand-50 p-3.5">
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13.5 }}>
              Saisir le code de validation
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              Demandez le code à 6 chiffres au client.
            </AppText>
            {isDemoMission(mission.orderId) ? (
              <AppText testID="courier-demo-code" variant="caption" className="text-brand-600">
                Démo — code client : {deliveryCode(mission.orderId)}
              </AppText>
            ) : null}
            <CodeBoxes
              testID="courier-delivery-code"
              label="Code de validation du client"
              length={6}
              value={code}
              onChange={setCode}
            />
          </View>

          {message ? (
            <AppText testID="courier-message" variant="caption" className="text-danger">
              {message}
            </AppText>
          ) : null}

          <Button
            testID="courier-confirm-delivery"
            label="Valider la remise"
            disabled={code.length !== 6}
            onPress={() => submit(code)}
          />
        </Panel>
      ) : (
        <>
          <View
            testID="courier-delivered"
            className="flex-row items-center gap-3 rounded-card border border-success bg-surface-muted p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-pill bg-success">
              <Feather name="check" size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <AppText className="font-sans-bold text-success">Livraison confirmée</AppText>
              <AppText variant="caption" className="text-ink-muted">
                Remise validée avec succès à {clock(doneAt)}. Merci pour votre service !
              </AppText>
            </View>
          </View>
          <Button testID="courier-delivered-close" label="Retour aux missions" onPress={onClose} />
        </>
      )}
    </View>
  );
}
