import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { randomAvatar } from '../lib/avatar';
import { AVATARS } from '../model/avatars';
import { selectAvatar, useOnboardingStore } from '../model/store';
import { AvatarView } from './avatar-view';

/**
 * L'avatar cliquable du haut de l'inscription — le cercle à « + » de la
 * maquette du client.
 *
 * Un tap ouvre la galerie des dix illustrations livrées par le client, d'un
 * coup d'œil : dix visages se parcourent plus vite avec les yeux qu'avec des
 * flèches. Le choix est enregistré tout de suite (profil local).
 */
export function AvatarPicker({ size = 92 }: { size?: number }) {
  const colors = useColors();
  const avatar = useOnboardingStore(selectAvatar);
  const setAvatar = useOnboardingStore((s) => s.setAvatar);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID="avatar-picker"
        accessibilityRole="button"
        accessibilityLabel="Choisir mon avatar"
        onPress={() => setOpen(true)}
      >
        <View
          className="rounded-pill border-2 border-brand-500 p-0.5"
          style={{ width: size + 8, height: size + 8 }}
        >
          <AvatarView avatar={avatar} size={size} />
        </View>
        <View className="absolute -bottom-0.5 -right-0.5 h-8 w-8 items-center justify-center rounded-pill border-2 border-surface bg-brand-500">
          <Feather name="plus" size={16} color={colors.inkInverse} />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View className="flex-1 justify-end bg-black/60">
          <View
            testID="avatar-sheet"
            className="max-h-[80%] rounded-t-card bg-surface px-5 pb-8 pt-4"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <AppText variant="title">Votre avatar</AppText>
              <Pressable
                testID="avatar-close"
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                hitSlop={10}
                onPress={() => setOpen(false)}
              >
                <Feather name="x" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable
                testID="avatar-random"
                accessibilityRole="button"
                accessibilityLabel="Avatar au hasard"
                onPress={() => setAvatar(randomAvatar())}
                className="mb-4 flex-row items-center justify-center gap-2 self-center rounded-pill bg-surface-muted px-4 py-2"
              >
                <Feather name="shuffle" size={15} color={colors.ink} />
                <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
                  Surprenez-moi
                </AppText>
              </Pressable>

              <View className="flex-row flex-wrap justify-between gap-y-3">
                {AVATARS.map((a, i) => {
                  const selected = avatar.preset === i;
                  return (
                    <Pressable
                      key={a.id}
                      testID={`avatar-${a.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={a.label}
                      onPress={() => {
                        setAvatar({ preset: i });
                        setOpen(false);
                      }}
                      className={cn(
                        'w-[22%] items-center gap-1 rounded-card border p-1.5',
                        selected ? 'border-brand-500 bg-brand-50' : 'border-transparent',
                      )}
                    >
                      <AvatarView avatar={{ preset: i }} size={56} />
                      <AppText
                        className={cn(
                          'text-center',
                          selected ? 'font-sans-semibold text-brand-600' : 'text-ink-faint',
                        )}
                        style={{ fontSize: 9.5, lineHeight: 12 }}
                        numberOfLines={2}
                      >
                        {a.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
