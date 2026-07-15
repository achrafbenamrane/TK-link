import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  CATEGORIES,
  CATEGORY_LABELS,
  MerchantApplicationSchema,
  type Category,
  type MerchantApplication,
} from '../model/schema';
import { useShopStore } from '../model/store';

type Draft = {
  shopName: string;
  category: Category | null;
  contactName: string;
  phone: string;
  email: string;
  area: string;
};

const EMPTY: Draft = {
  shopName: '',
  category: null,
  contactName: '',
  phone: '',
  email: '',
  area: '',
};

/** Les arguments de vente, repris du cadrage produit avec le client. */
const SELLING_POINTS = [
  { icon: 'gift' as const, text: 'Vos 2 premières ventes flash offertes' },
  { icon: 'percent' as const, text: 'Commission légère, sous le prix d’un TPE' },
  { icon: 'zap' as const, text: 'Écoulez vos invendus en quelques minutes' },
  { icon: 'users' as const, text: 'Visible par tout votre quartier' },
];

export function MerchantScreen() {
  const submitted = useShopStore((s) => s.merchantApplication);
  const submit = useShopStore((s) => s.submitMerchantApplication);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof MerchantApplication, string>>>({});

  const set = (key: keyof Draft) => (v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = () => {
    const parsed = MerchantApplicationSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Partial<Record<keyof MerchantApplication, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof MerchantApplication | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    submit(parsed.data);
  };

  if (submitted) {
    return (
      <Screen testID="merchant-screen">
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-brand-50">
            <Feather name="check" size={28} color={colors.brand500} />
          </View>
          <AppText variant="display" className="text-center text-2xl">
            Demande envoyée
          </AppText>
          <AppText variant="caption" className="text-center">
            Merci {submitted.contactName} — nous revenons vers {submitted.shopName} sous 48 h pour
            lancer vos premières ventes flash.
          </AppText>
          {/* Honnêteté : pas de back-end pour l'instant, la demande reste locale. */}
          <View className="mt-3 flex-row gap-2 rounded-card border border-line bg-surface-muted p-3">
            <Feather name="info" size={15} color={colors.inkFaint} />
            <AppText variant="caption" className="flex-1 text-ink-faint">
              Démo : la demande est enregistrée sur cet appareil, pas encore envoyée à un serveur.
            </AppText>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="merchant-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="pb-4 pt-2">
            <AppText variant="display" className="text-3xl">
              Devenir commerçant
            </AppText>
            <AppText variant="caption" className="mt-1">
              Vendez vos invendus à votre quartier, en un éclair.
            </AppText>
          </View>

          <View className="mb-5 gap-2.5 rounded-card bg-ink p-4">
            {SELLING_POINTS.map((point) => (
              <View key={point.text} className="flex-row items-center gap-2.5">
                <Feather name={point.icon} size={14} color={colors.brand500} />
                <AppText className="flex-1 text-sm text-ink-inverse">{point.text}</AppText>
              </View>
            ))}
          </View>

          <View className="gap-3">
            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Nom du commerce
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="merchant-shop"
                  placeholder="Maison Hammamet"
                  value={draft.shopName}
                  onChangeText={set('shopName')}
                  className={cn(errors.shopName && 'border-brand-500')}
                />
              </View>
              {errors.shopName ? (
                <AppText variant="caption" className="text-brand-600">
                  {errors.shopName}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Catégorie
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((category) => {
                  const active = draft.category === category;
                  return (
                    <Pressable
                      key={category}
                      testID={`merchant-cat-${category}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        setDraft((d) => ({ ...d, category }));
                        setErrors((e) => ({ ...e, category: undefined }));
                      }}
                      className={cn(
                        'rounded-pill border px-4 py-2',
                        active ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
                      )}
                    >
                      <AppText
                        className={cn(
                          'text-sm',
                          active
                            ? 'font-sans-bold text-ink-inverse'
                            : 'font-sans-medium text-ink-muted',
                        )}
                      >
                        {CATEGORY_LABELS[category]}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              {errors.category ? (
                <AppText variant="caption" className="text-brand-600">
                  {errors.category}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Quartier
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="merchant-area"
                  placeholder="Empalot"
                  value={draft.area}
                  onChangeText={set('area')}
                  className={cn(errors.area && 'border-brand-500')}
                />
              </View>
              {errors.area ? (
                <AppText variant="caption" className="text-brand-600">
                  {errors.area}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Votre nom
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="merchant-contact"
                  placeholder="Farid"
                  value={draft.contactName}
                  onChangeText={set('contactName')}
                  className={cn(errors.contactName && 'border-brand-500')}
                />
              </View>
              {errors.contactName ? (
                <AppText variant="caption" className="text-brand-600">
                  {errors.contactName}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Téléphone
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="merchant-phone"
                  placeholder="06 12 34 56 78"
                  keyboardType="phone-pad"
                  value={draft.phone}
                  onChangeText={set('phone')}
                  className={cn(errors.phone && 'border-brand-500')}
                />
              </View>
              {errors.phone ? (
                <AppText variant="caption" className="text-brand-600">
                  {errors.phone}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                E-mail
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="merchant-email"
                  placeholder="contact@moncommerce.fr"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={draft.email}
                  onChangeText={set('email')}
                  className={cn(errors.email && 'border-brand-500')}
                />
              </View>
              {errors.email ? (
                <AppText variant="caption" className="text-brand-600">
                  {errors.email}
                </AppText>
              ) : null}
            </View>

            <View className="mt-2">
              <Button testID="merchant-submit" label="Envoyer ma demande" onPress={onSubmit} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
