import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { CATEGORIES, CATEGORY_INFO, type Category } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { commissionCents, formatCents, netCents, parseEurosToCents } from '../lib/billing';
import { DURATIONS, OfferDraftSchema, type OfferDraft } from '../model/schema';

type Props = {
  onPublish: (draft: OfferDraft) => void;
  onCancel: () => void;
};

type Errors = Partial<Record<'title' | 'priceCents' | 'oldPriceCents' | 'stock', string>>;

/** Champ de saisie court, avec son erreur sous lui. */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline gap-2">
        <AppText variant="caption" className="font-sans-semibold text-ink-muted">
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {children}
      {error ? (
        <AppText variant="caption" className="text-brand-600">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * PUBLIER UNE VENTE FLASH — CDC §9.
 *
 * Le formulaire ne demande QUE ce que la fiche client affiche (CDC §8) : titre,
 * catégorie, prix barré, prix flash, quantité, durée. Un champ de plus serait un
 * champ que le commerçant remplit sans que personne ne le lise.
 *
 * Le calcul de ce qu'il touchera vraiment — commission de 5 % déduite — est
 * affiché EN DIRECT sous les prix. Découvrir la commission sur le relevé du
 * mois suivant est la meilleure façon de perdre un commerçant.
 */
export function PublishForm({ onPublish, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('restauration');
  const [oldPrice, setOldPrice] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const priceCents = parseEurosToCents(price) ?? 0;
  const oldCents = parseEurosToCents(oldPrice) ?? 0;
  const qty = Number.parseInt(stock, 10) || 0;
  const potential = priceCents * qty;

  const submit = () => {
    const parsed = OfferDraftSchema.safeParse({
      title,
      category,
      priceCents,
      oldPriceCents: oldCents,
      stock: qty,
      durationMinutes: duration,
      description,
    });

    if (!parsed.success) {
      const found: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors | undefined;
        if (key && !found[key]) found[key] = issue.message;
      }
      setErrors(found);
      return;
    }

    setErrors({});
    onPublish(parsed.data);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="gap-4 px-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <Field label="Ce que vous vendez" error={errors.title}>
        <TextInput
          testID="publish-title"
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Plateau de viennoiseries"
          placeholderTextColor={colors.inkFaint}
          className="rounded-control bg-surface-muted px-4 font-sans text-ink"
          style={{ height: 50, fontSize: 16 }}
          maxLength={60}
          accessibilityLabel="Titre de l’offre"
        />
      </Field>

      <Field label="Catégorie">
        <View className="flex-row flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable
                key={c}
                testID={`publish-cat-${c}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={CATEGORY_INFO[c].label}
                onPress={() => setCategory(c)}
                className={cn(
                  'flex-row items-center gap-1.5 rounded-pill px-3 py-2',
                  on ? 'bg-brand-500' : 'bg-surface-muted',
                )}
              >
                <AppText style={{ fontSize: 13 }}>{CATEGORY_INFO[c].emoji}</AppText>
                <AppText
                  className={cn('font-sans-semibold', on ? 'text-ink-inverse' : 'text-ink-muted')}
                  style={{ fontSize: 12.5 }}
                >
                  {CATEGORY_INFO[c].short}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Prix initial" hint="€" error={errors.oldPriceCents}>
            <TextInput
              testID="publish-old-price"
              value={oldPrice}
              onChangeText={setOldPrice}
              placeholder="34,90"
              placeholderTextColor={colors.inkFaint}
              keyboardType="decimal-pad"
              className="rounded-control bg-surface-muted px-4 font-sans text-ink"
              style={{ height: 50, fontSize: 16 }}
              accessibilityLabel="Prix initial en euros"
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Prix flash" hint="€" error={errors.priceCents}>
            <TextInput
              testID="publish-price"
              value={price}
              onChangeText={setPrice}
              placeholder="24,90"
              placeholderTextColor={colors.inkFaint}
              keyboardType="decimal-pad"
              className="rounded-control bg-surface-muted px-4 font-sans text-ink"
              style={{ height: 50, fontSize: 16 }}
              accessibilityLabel="Prix flash en euros"
            />
          </Field>
        </View>
      </View>

      <Field label="Quantité" hint="ce que vous avez en trop" error={errors.stock}>
        <TextInput
          testID="publish-stock"
          value={stock}
          onChangeText={setStock}
          placeholder="8"
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          className="rounded-control bg-surface-muted px-4 font-sans text-ink"
          style={{ height: 50, fontSize: 16 }}
          accessibilityLabel="Quantité disponible"
        />
      </Field>

      <Field label="Durée de la vente">
        <View className="flex-row flex-wrap gap-2">
          {DURATIONS.map((m) => {
            const on = duration === m;
            return (
              <Pressable
                key={m}
                testID={`publish-duration-${m}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m < 60 ? `${m} minutes` : `${m / 60} heures`}
                onPress={() => setDuration(m)}
                className={cn('rounded-pill px-4 py-2', on ? 'bg-ink' : 'bg-surface-muted')}
              >
                <AppText
                  className={cn('font-sans-semibold', on ? 'text-ink-inverse' : 'text-ink-muted')}
                  style={{ fontSize: 12.5 }}
                >
                  {m < 60 ? `${m} min` : `${m / 60} h`}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Précision" hint="facultatif">
        <TextInput
          testID="publish-description"
          value={description}
          onChangeText={setDescription}
          placeholder="Ex. À retirer avant 19 h"
          placeholderTextColor={colors.inkFaint}
          multiline
          className="rounded-control bg-surface-muted px-4 py-3 font-sans text-ink"
          style={{ minHeight: 70, fontSize: 15 }}
          maxLength={240}
          accessibilityLabel="Précision sur l’offre"
        />
      </Field>

      {/* Ce que ça rapporte VRAIMENT — CDC §21 */}
      <View className="gap-2 rounded-card bg-surface-inverse p-4">
        <View className="flex-row items-center gap-2">
          <Feather name="trending-up" size={15} color={colors.lime} />
          <AppText className="font-sans-semibold text-ink-inverse" style={{ fontSize: 13 }}>
            Si tout part
          </AppText>
        </View>
        <View className="flex-row items-center justify-between">
          <AppText className="text-ink-inverse/70" style={{ fontSize: 12.5 }}>
            {qty || 0} × {formatCents(priceCents)}
          </AppText>
          <AppText className="font-sans-semibold text-ink-inverse" style={{ fontSize: 13 }}>
            {formatCents(potential)}
          </AppText>
        </View>
        <View className="flex-row items-center justify-between">
          <AppText className="text-ink-inverse/70" style={{ fontSize: 12.5 }}>
            Commission TK LINK (5 %)
          </AppText>
          <AppText className="text-ink-inverse/70" style={{ fontSize: 12.5 }}>
            − {formatCents(commissionCents(potential))}
          </AppText>
        </View>
        <View className="mt-1 flex-row items-center justify-between border-t border-ink-inverse/15 pt-2">
          <AppText className="font-sans-bold text-lime" style={{ fontSize: 13 }}>
            Vous touchez
          </AppText>
          <AppText testID="publish-net" className="font-display text-lime" style={{ fontSize: 17 }}>
            {formatCents(netCents(potential))}
          </AppText>
        </View>
      </View>

      <View className="gap-2">
        <Pressable
          testID="publish-submit"
          accessibilityRole="button"
          accessibilityLabel="Publier l’offre"
          onPress={submit}
          className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-4 active:bg-brand-600"
        >
          <Feather name="zap" size={17} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 15 }}>
            Publier la vente flash
          </AppText>
        </Pressable>
        <Pressable
          testID="publish-cancel"
          accessibilityRole="button"
          accessibilityLabel="Annuler"
          onPress={onCancel}
          className="items-center py-2"
        >
          <AppText variant="caption" className="text-ink-muted">
            Annuler
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
