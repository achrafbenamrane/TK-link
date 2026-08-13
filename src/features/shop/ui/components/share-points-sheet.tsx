import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, Share, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { useShopStore } from '../../model/store';

const PRESETS = [25, 50, 100];

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Offrir des points à un proche — la fidélité partagée demandée en cadrage.
 *
 * Le transfert réel entre comptes suppose un back-end ; ici on débite le solde
 * et on génère un code à partager. La feuille le dit franchement plutôt que de
 * laisser croire que le proche a déjà reçu quelque chose.
 */
export function SharePointsSheet({ visible, onClose }: Props) {
  const points = useShopStore((s) => s.points);
  const share = useShopStore((s) => s.sharePoints);

  const [amount, setAmount] = useState(25);
  const [code, setCode] = useState<string | null>(null);

  const affordable = PRESETS.filter((p) => p <= points);
  const canSend = amount > 0 && amount <= points;

  const close = () => {
    setCode(null);
    setAmount(25);
    onClose();
  };

  const onSend = async () => {
    const result = share(amount);
    if (!result.ok) return;
    setCode(result.code);
    try {
      await Share.share({
        message: `Je t’offre ${amount} points TK LINK ⚡ Utilise le code ${result.code} dans l’app`,
      });
    } catch {
      // partage annulé ou indisponible — le code reste affiché
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 justify-end bg-ink/40" onPress={close}>
        {/* Pressable interne : un tap sur la feuille ne doit pas la refermer. */}
        <Pressable
          testID="share-points-sheet"
          onPress={(e) => e.stopPropagation()}
          className="gap-4 rounded-t-card bg-surface px-5 pb-8 pt-5"
        >
          <View className="h-1 w-10 self-center rounded-pill bg-surface-sunken" />

          {code ? (
            <View className="items-center gap-3 py-2">
              <View className="h-14 w-14 items-center justify-center rounded-pill bg-brand-50">
                <Feather name="gift" size={24} color={colors.brand500} />
              </View>
              <AppText variant="title" className="text-center text-xl">
                {amount} points offerts
              </AppText>
              <View className="rounded-card border border-line bg-surface-muted px-5 py-3">
                <AppText className="text-center font-display text-xl text-ink">{code}</AppText>
              </View>
              <AppText variant="caption" className="text-center">
                Transmettez ce code à votre proche — il le saisit dans l’app pour recevoir vos
                points.
              </AppText>
              <View className="mt-1 w-full">
                <Button label="Terminé" onPress={close} />
              </View>
            </View>
          ) : (
            <>
              <View>
                <AppText variant="title" className="text-xl">
                  Offrir des points
                </AppText>
                <AppText variant="caption" className="mt-1">
                  Vous avez {points} points. Choisissez ce que vous offrez.
                </AppText>
              </View>

              {affordable.length === 0 ? (
                <AppText variant="caption" className="py-2">
                  Il vous faut au moins 25 points pour en offrir.
                </AppText>
              ) : (
                <View className="flex-row gap-2.5">
                  {affordable.map((p) => {
                    const active = amount === p;
                    return (
                      <Pressable
                        key={p}
                        testID={`share-amount-${p}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setAmount(p)}
                        className={cn(
                          'flex-1 items-center rounded-card border py-3.5',
                          active ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                        )}
                      >
                        <AppText
                          className={cn(
                            'font-display text-lg',
                            active ? 'text-ink-inverse' : 'text-ink',
                          )}
                        >
                          {p}
                        </AppText>
                        <AppText
                          variant="caption"
                          className={cn(
                            'text-xs',
                            active ? 'text-ink-inverse/80' : 'text-ink-faint',
                          )}
                        >
                          points
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Button
                testID="share-points-send"
                label={`Offrir ${amount} points`}
                onPress={onSend}
                disabled={!canSend}
              />
              <Pressable onPress={close} className="py-1">
                <AppText variant="caption" className="text-center text-ink-faint">
                  Annuler
                </AppText>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
