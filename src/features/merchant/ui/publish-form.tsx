import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { CATEGORIES, CATEGORY_INFO, type Category } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/cn';
import { AppText, ThemeToggle } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { commissionCents, formatCents, netCents, parseEurosToCents } from '../lib/billing';
import { pickFlashPhoto } from '../lib/photo';
import { RECURRENCE_LABEL, RECURRENCES, type Recurrence } from '../lib/recurrence';
import {
  DURATIONS,
  OFFER_MODES,
  OfferDraftSchema,
  type OfferDraft,
  type OfferMode,
} from '../model/schema';

const MODE_LABEL: Record<OfferMode, string> = {
  'touch-collect': 'Touch & Collect',
  livraison: 'Livraison',
};

type Props = {
  onPublish: (draft: OfferDraft) => void;
  onCancel: () => void;
  /** Nom du commerce, pour l'aperçu en direct. */
  shopName?: string;
  /** Titre de la page — « Nouveau Flash » pour un commerçant, « Nouveau lot » pour un grossiste. */
  title?: string;
  /** Opérations restantes, affichées sous le titre. */
  subtitle?: string;
  /**
   * Offre B2B d'un grossiste : prix catalogue / prix grossiste, quantité minimale de
   * commande, durées longues (jusqu'à 7 jours), retrait ou expédition. Le Flash du
   * commerçant, lui, dure de 15 minutes à 2 heures (CDC V1.1).
   */
  wholesale?: boolean;
};

type Errors = Partial<Record<'title' | 'priceCents' | 'oldPriceCents' | 'stock' | 'modes', string>>;

/** Étiquette au-dessus d'un champ de la grille, comme la maquette. */
function Label({ children }: { children: string }) {
  return (
    <AppText className="text-ink-muted" style={{ fontSize: 11 }} numberOfLines={1}>
      {children}
    </AppText>
  );
}

/**
 * QUAND L'OFFRE PART — CDC §4.2, huitième étape : « publier ou programmer ».
 *
 * Des délais RELATIFS et non un calendrier. Un commerçant programme « ce soir »
 * ou « demain matin », il ne cherche pas une date dans un mois.
 */
const STARTS = [
  { minutes: 0, label: 'Maintenant' },
  { minutes: 60, label: 'Dans 1 h' },
  { minutes: 180, label: 'Dans 3 h' },
  { minutes: 1440, label: 'Demain' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Les durées d'une offre B2B : pas bornée à 2 h (le CDC ne le demande qu'aux Flash clients). */
const B2B_DURATIONS = [120, 1440, 4320, 10080] as const;
const durationLabel = (m: number) =>
  m < 60 ? `${m} min` : m < 1440 ? `${m / 60} h` : m === 1440 ? '1 jour' : `${m / 1440} jours`;

const WHOLESALE_MODE_LABEL: Record<OfferMode, string> = {
  'touch-collect': 'Retrait',
  livraison: 'Expédition',
};

/**
 * NOUVEAU FLASH — la page de création de la maquette du client : étapes
 * Créer · Configurer · Publier, photo, « Aperçu en direct » de la carte telle que le
 * client la verra, grille titre / prix / quantité, durée, fin du Flash, catégorie, stock
 * et modes de remise.
 *
 * Le formulaire ne demande QUE ce que la fiche client affiche (CDC §8). La maquette
 * propose aussi « Vidéo » et « Sublime » (retouche de la photo) : ni l'un ni l'autre
 * n'est dans le CDC (étape 1 : « photo »), ils ne sont pas construits.
 *
 * Ce que le commerçant touchera VRAIMENT — commission de 5 % déduite — s'affiche en
 * direct : la découvrir sur le relevé du mois suivant est la meilleure façon de
 * perdre un commerçant.
 */
export function PublishForm({
  onPublish,
  onCancel,
  shopName,
  title: pageTitle,
  subtitle,
  wholesale = false,
}: Props) {
  const durations: readonly number[] = wholesale ? B2B_DURATIONS : DURATIONS;
  const modeLabel = wholesale ? WHOLESALE_MODE_LABEL : MODE_LABEL;
  const colors = useColors();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('restauration');
  const [oldPrice, setOldPrice] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [duration, setDuration] = useState<number>(wholesale ? 1440 : 60);
  const [minQty, setMinQty] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('aucune');
  const [photoUri, setPhotoUri] = useState('');
  const [modes, setModes] = useState<OfferMode[]>([...OFFER_MODES]);
  const [startIn, setStartIn] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  // Instant figé au montage : pas d'horloge pendant le rendu.
  const [mountedAt] = useState(() => Date.now());

  const priceCents = parseEurosToCents(price) ?? 0;
  const oldCents = parseEurosToCents(oldPrice) ?? 0;
  const qty = Number.parseInt(stock, 10) || 0;
  const potential = priceCents * qty;
  const discount =
    oldCents > 0 && priceCents > 0 ? Math.round((1 - priceCents / oldCents) * 100) : 0;

  // Où en est le commerçant — Créer (titre et prix), Configurer (quantité, remise), Publier.
  const created = title.trim().length >= 3 && priceCents > 0 && oldCents > priceCents;
  const configured = created && qty > 0 && modes.length > 0;
  const step = configured ? 3 : created ? 2 : 1;

  const endsAt = new Date(mountedAt + (startIn + duration) * 60_000);
  const endsDay =
    endsAt.getDate() === new Date(mountedAt).getDate()
      ? "Aujourd'hui"
      : endsAt.toLocaleDateString('fr-FR');
  const preview =
    duration >= 1440
      ? durationLabel(duration)
      : `${pad(Math.floor(duration / 60))}:${pad(duration % 60)}:00`;

  const submit = (state: 'brouillon' | 'publiee') => {
    const parsed = OfferDraftSchema.safeParse({
      title,
      category,
      priceCents,
      oldPriceCents: oldCents,
      stock: qty,
      durationMinutes: duration,
      description,
      photoUri,
      modes,
      audience: wholesale ? 'commercants' : 'clients',
      minQty: Number.parseInt(minQty, 10) || 1,
      recurrence: wholesale ? recurrence : 'aucune',
      // Une intention, pas une date : c'est le store qui horodate.
      startInMinutes: startIn,
      state,
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

  const toggleMode = (m: OfferMode) =>
    setModes((current) => (current.includes(m) ? current.filter((x) => x !== m) : [...current, m]));

  const inputClass =
    'rounded-control border border-line bg-surface-muted px-2.5 font-sans text-ink';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {/* Titre · Étape n/3 · Nuit/Jour */}
      <View className="flex-row items-center gap-2 pt-2">
        <Pressable
          testID="merchant-publish-back"
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={10}
          onPress={onCancel}
        >
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-1.5">
          <AppText variant="display" style={{ fontSize: 16 }} numberOfLines={1}>
            {pageTitle ?? 'Nouveau Flash'}
          </AppText>
          <View className="rounded-pill border border-line px-2 py-0.5">
            <AppText testID="publish-step" className="text-ink-muted" style={{ fontSize: 10 }}>
              Étape {step}/3
            </AppText>
          </View>
        </View>
        <ThemeToggle />
      </View>
      {subtitle ? (
        <AppText variant="caption" className="-mt-2 ml-8 text-ink-faint">
          {subtitle}
        </AppText>
      ) : null}

      {/* Les trois étapes */}
      <View className="flex-row items-start" testID="publish-steps">
        {(['Créer', 'Configurer', 'Publier'] as const).map((label, i) => {
          const n = i + 1;
          const reached = n <= step;
          return (
            <View key={label} className="flex-1 items-center gap-1">
              <View className="w-full flex-row items-center">
                <View
                  className={cn(
                    'h-0.5 flex-1',
                    i === 0 ? 'bg-transparent' : reached ? 'bg-brand-500' : 'bg-line',
                  )}
                />
                <View
                  className={cn(
                    'h-7 w-7 items-center justify-center rounded-pill border',
                    reached ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                  )}
                >
                  <AppText
                    className={reached ? 'font-sans-bold text-white' : 'text-ink-muted'}
                    style={{ fontSize: 12 }}
                  >
                    {n}
                  </AppText>
                </View>
                <View
                  className={cn(
                    'h-0.5 flex-1',
                    i === 2 ? 'bg-transparent' : n < step ? 'bg-brand-500' : 'bg-line',
                  )}
                />
              </View>
              <AppText
                className={n === step ? 'font-sans-bold text-brand-500' : 'text-ink-muted'}
                style={{ fontSize: 11 }}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* La photo : prendre ou importer. Facultative — sans elle, la carte montre l'emoji de la catégorie. */}
      <View className="flex-row gap-2">
        {(
          [
            ['camera', 'camera', 'Prendre photo'],
            ['galerie', 'image', 'Importer'],
          ] as const
        ).map(([source, icon, label]) => (
          <Pressable
            key={source}
            testID={`publish-photo-${source}`}
            accessibilityRole="button"
            accessibilityLabel={
              source === 'camera' ? 'Prendre une photo' : 'Choisir dans la galerie'
            }
            onPress={async () => {
              const uri = await pickFlashPhoto(source);
              if (uri) setPhotoUri(uri);
            }}
            className="flex-1 items-center gap-1 rounded-control border border-line bg-surface-muted py-3 active:opacity-70"
          >
            <Feather name={icon} size={20} color={colors.ink} />
            <AppText className="text-ink-muted" style={{ fontSize: 11.5 }}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {/* Aperçu en direct — la carte telle que le client la verra */}
      <View className="flex-row items-center gap-1.5">
        <Feather name="eye" size={13} color={colors.ink} />
        <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
          Aperçu en direct
        </AppText>
      </View>
      <View
        testID="publish-preview"
        className="gap-2 rounded-card border border-brand-500 bg-surface-muted p-2.5"
      >
        <View className="flex-row gap-2.5">
          <View className="h-[104px] w-[88px] items-center justify-center overflow-hidden rounded-control bg-surface-sunken">
            {photoUri ? (
              <View testID="publish-photo-preview" className="h-full w-full">
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  accessibilityLabel="Photo de l’offre"
                />
                <Pressable
                  testID="publish-photo-remove"
                  accessibilityRole="button"
                  accessibilityLabel="Retirer la photo"
                  hitSlop={6}
                  onPress={() => setPhotoUri('')}
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-pill bg-black/60"
                >
                  <Feather name="x" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <AppText style={{ fontSize: 34 }}>{CATEGORY_INFO[category].emoji}</AppText>
            )}
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1 rounded-pill bg-brand-500 px-2.5 py-1">
                <Feather name="zap" size={12} color="#FFFFFF" />
                <AppText
                  className="font-sans-bold text-white"
                  style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
                >
                  {preview}
                </AppText>
              </View>
              <View className="flex-row items-center gap-1 rounded-pill bg-warning px-2 py-1">
                <Feather name="package" size={11} color="#FFFFFF" />
                <AppText className="font-sans-bold text-white" style={{ fontSize: 10.5 }}>
                  {qty || 0} restant{qty > 1 ? 's' : ''}
                </AppText>
              </View>
            </View>
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 15 }} numberOfLines={1}>
              {title.trim() || 'Titre de l’offre'}
            </AppText>
            <AppText
              variant="caption"
              className="text-ink-muted"
              style={{ fontSize: 11 }}
              numberOfLines={1}
            >
              {shopName ?? 'Votre commerce'}
            </AppText>
            <View className="flex-row items-end justify-between">
              <View className="flex-row items-baseline gap-1.5">
                {oldCents > 0 ? (
                  <AppText className="text-ink-faint line-through" style={{ fontSize: 12 }}>
                    {formatCents(oldCents)}
                  </AppText>
                ) : null}
                <AppText className="font-display text-brand-500" style={{ fontSize: 22 }}>
                  {formatCents(priceCents)}
                </AppText>
              </View>
              {discount > 0 ? (
                <View className="rounded-pill bg-surface-inverse px-2 py-0.5">
                  <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 11 }}>
                    -{discount}%
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View className="flex-row gap-2">
          {modes.map((m) => (
            <View
              key={m}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-control border border-line py-1.5"
            >
              <Feather
                name={m === 'livraison' ? 'truck' : 'shopping-bag'}
                size={12}
                color={m === 'livraison' ? colors.success : colors.accent}
              />
              <AppText
                className={m === 'livraison' ? 'text-success' : 'text-accent-deep'}
                style={{ fontSize: 11 }}
              >
                {modeLabel[m]}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      {/* Titre · prix initial · prix flash · quantité */}
      <View className="flex-row gap-2">
        <View className="gap-1" style={{ flex: 1.7 }}>
          <Label>Titre de l’offre</Label>
          <TextInput
            testID="publish-title"
            value={title}
            onChangeText={setTitle}
            placeholder="Casque audio"
            placeholderTextColor={colors.inkFaint}
            className={inputClass}
            style={{ height: 40, fontSize: 13 }}
            maxLength={60}
            accessibilityLabel="Titre de l’offre"
          />
        </View>
        <View className="flex-1 gap-1">
          <Label>{wholesale ? 'Prix catalogue' : 'Prix initial'}</Label>
          <TextInput
            testID="publish-old-price"
            value={oldPrice}
            onChangeText={setOldPrice}
            placeholder="89,00 €"
            placeholderTextColor={colors.inkFaint}
            keyboardType="decimal-pad"
            className={inputClass}
            style={{ height: 40, fontSize: 13 }}
            accessibilityLabel="Prix initial en euros"
          />
        </View>
        <View className="flex-1 gap-1">
          <Label>{wholesale ? 'Prix grossiste' : 'Prix Flash'}</Label>
          <TextInput
            testID="publish-price"
            value={price}
            onChangeText={setPrice}
            placeholder="39,00 €"
            placeholderTextColor={colors.inkFaint}
            keyboardType="decimal-pad"
            className={inputClass}
            style={{ height: 40, fontSize: 13 }}
            accessibilityLabel="Prix flash en euros"
          />
        </View>
        <View className="gap-1" style={{ flex: 0.8 }}>
          <Label>Quantité</Label>
          <TextInput
            testID="publish-stock"
            value={stock}
            onChangeText={setStock}
            placeholder="5"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            className={inputClass}
            style={{ height: 40, fontSize: 13 }}
            accessibilityLabel="Quantité disponible"
          />
        </View>
      </View>
      {errors.title || errors.oldPriceCents || errors.priceCents || errors.stock ? (
        <View className="gap-0.5">
          {[errors.title, errors.oldPriceCents, errors.priceCents, errors.stock]
            .filter(Boolean)
            .map((e) => (
              <AppText key={e} variant="caption" className="text-brand-600">
                {e}
              </AppText>
            ))}
        </View>
      ) : null}

      {/* Durée · fin du Flash · catégorie */}
      <View className="flex-row gap-2">
        <View className="gap-1" style={{ flex: 1.1 }}>
          <Label>{wholesale ? 'Durée de l’offre' : 'Durée du Flash'}</Label>
          <View className="h-10 flex-row items-center gap-1.5 rounded-control border border-line bg-surface-muted px-2.5">
            <Feather name="zap" size={13} color={colors.brand500} />
            <AppText className="text-ink" style={{ fontSize: 13 }}>
              {duration < 60
                ? `${duration} minutes`
                : duration === 60
                  ? '1 heure'
                  : duration < 1440
                    ? `${duration / 60} heures`
                    : durationLabel(duration)}
            </AppText>
          </View>
        </View>
        <View className="gap-1" style={{ flex: 1.8 }}>
          <Label>{wholesale ? 'Fin de l’offre' : 'Fin du Flash'}</Label>
          <View className="h-10 flex-row items-center gap-1.5 rounded-control border border-line bg-surface-muted px-2.5">
            <Feather name="calendar" size={13} color={colors.inkMuted} />
            <AppText
              testID="publish-ends"
              className="text-ink"
              style={{ fontSize: 12.5 }}
              numberOfLines={1}
            >
              {endsDay}, {pad(endsAt.getHours())}:{pad(endsAt.getMinutes())}
            </AppText>
          </View>
        </View>
        <View className="gap-1" style={{ flex: 0.9 }}>
          <Label>Catégorie</Label>
          <Pressable
            testID="publish-cat-open"
            accessibilityRole="button"
            accessibilityState={{ expanded: categoryOpen }}
            accessibilityLabel={`Catégorie : ${CATEGORY_INFO[category].label}`}
            onPress={() => setCategoryOpen((v) => !v)}
            className="h-10 flex-row items-center gap-1.5 rounded-control border border-line bg-surface-muted px-2.5"
          >
            <AppText style={{ fontSize: 13 }}>{CATEGORY_INFO[category].emoji}</AppText>
            <AppText className="flex-1 text-ink" style={{ fontSize: 12 }} numberOfLines={1}>
              {CATEGORY_INFO[category].short}
            </AppText>
            <Feather
              name={categoryOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.inkMuted}
            />
          </Pressable>
        </View>
      </View>

      {/* Les durées possibles — 15 min à 2 h (CDC V1.1) */}
      <View className="flex-row gap-2">
        {durations.map((m) => {
          const on = duration === m;
          return (
            <Pressable
              key={m}
              testID={`publish-duration-${m}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m < 60 ? `${m} minutes` : `${m / 60} heures`}
              onPress={() => setDuration(m)}
              className={cn(
                'flex-1 items-center rounded-pill border py-1.5',
                on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
              )}
            >
              <AppText
                className={cn('font-sans-semibold', on ? 'text-brand-600' : 'text-ink-muted')}
                style={{ fontSize: 12 }}
              >
                {durationLabel(m)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {wholesale ? (
        <View className="gap-1">
          <Label>Commande minimale (lots) — vide : aucun minimum</Label>
          <TextInput
            testID="publish-min-qty"
            value={minQty}
            onChangeText={(v) => setMinQty(v.replace(/\D/g, ''))}
            placeholder="Ex. 10"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            className={inputClass}
            style={{ height: 40, fontSize: 13 }}
            accessibilityLabel="Quantité minimale de commande"
          />
        </View>
      ) : null}

      {/* CDC V1.1, Grossiste : une offre B2B est ponctuelle ou récurrente. */}
      {wholesale ? (
        <View className="gap-1">
          <Label>Récurrence — republication automatique</Label>
          <View className="flex-row gap-1.5">
            {RECURRENCES.map((r) => {
              const on = recurrence === r;
              return (
                <Pressable
                  key={r}
                  testID={`publish-recurrence-${r}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={RECURRENCE_LABEL[r]}
                  onPress={() => setRecurrence(r)}
                  className={cn(
                    'flex-1 items-center rounded-control border py-2',
                    on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                  )}
                >
                  <AppText
                    className={cn('font-sans-semibold', on ? 'text-brand-600' : 'text-ink-muted')}
                    style={{ fontSize: 11 }}
                    numberOfLines={1}
                  >
                    {RECURRENCE_LABEL[r]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {categoryOpen ? (
        <View
          testID="publish-cat-list"
          className="rounded-control border border-line bg-surface-muted"
        >
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              testID={`publish-cat-${c}`}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
              accessibilityLabel={CATEGORY_INFO[c].label}
              onPress={() => {
                setCategory(c);
                setCategoryOpen(false);
              }}
              className="flex-row items-center gap-2 px-3 py-2.5"
            >
              <AppText style={{ fontSize: 14 }}>{CATEGORY_INFO[c].emoji}</AppText>
              <AppText
                className={category === c ? 'font-sans-bold text-brand-500' : 'text-ink'}
                style={{ fontSize: 13 }}
              >
                {CATEGORY_INFO[c].label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Stock disponible · modes de remise (interrupteurs) */}
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1.5">
          <Label>Stock disponible</Label>
          <AppText testID="publish-stock-left" className="text-warning" style={{ fontSize: 12.5 }}>
            {qty} unité{qty > 1 ? 's' : ''} restante{qty > 1 ? 's' : ''}
          </AppText>
          <View className="flex-row items-center gap-2">
            <Pressable
              testID="publish-stock-dec"
              accessibilityRole="button"
              accessibilityLabel="Une unité de moins"
              hitSlop={8}
              onPress={() => setStock(String(Math.max(0, qty - 1)))}
              className="h-6 w-6 items-center justify-center rounded-pill border border-line"
            >
              <Feather name="minus" size={13} color={colors.ink} />
            </Pressable>
            <View className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <View
                className="h-full rounded-pill bg-warning"
                style={{ width: `${Math.min(100, (qty / 50) * 100)}%` }}
              />
            </View>
            <Pressable
              testID="publish-stock-inc"
              accessibilityRole="button"
              accessibilityLabel="Une unité de plus"
              hitSlop={8}
              onPress={() => setStock(String(Math.min(999, qty + 1)))}
              className="h-6 w-6 items-center justify-center rounded-pill border border-line"
            >
              <Feather name="plus" size={13} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        {OFFER_MODES.map((m) => (
          <View key={m} className="items-center gap-1.5">
            <AppText className="text-ink-muted" style={{ fontSize: 10.5 }}>
              {modeLabel[m]}
            </AppText>
            <Switch
              testID={`publish-mode-${m}`}
              accessibilityLabel={modeLabel[m]}
              value={modes.includes(m)}
              onValueChange={() => toggleMode(m)}
              trackColor={{
                true: m === 'livraison' ? colors.success : colors.accent,
                false: colors.line,
              }}
            />
          </View>
        ))}
      </View>
      {errors.modes ? (
        <AppText variant="caption" className="text-brand-600">
          {errors.modes}
        </AppText>
      ) : null}

      <View className="gap-1.5">
        <Label>Précision (facultatif)</Label>
        <TextInput
          testID="publish-description"
          value={description}
          onChangeText={setDescription}
          placeholder="Ex. À retirer avant 19 h"
          placeholderTextColor={colors.inkFaint}
          multiline
          className="rounded-control border border-line bg-surface-muted px-3 py-2 font-sans text-ink"
          style={{ minHeight: 56, fontSize: 13 }}
          maxLength={240}
          accessibilityLabel="Précision sur l’offre"
        />
      </View>

      {/* Ce que ça rapporte VRAIMENT — CDC §21 */}
      <View className="gap-1.5 rounded-card bg-surface-inverse p-3.5">
        <View className="flex-row items-center justify-between">
          <AppText className="text-ink-inverse/70" style={{ fontSize: 12 }}>
            Si tout part : {qty || 0} × {formatCents(priceCents)}
          </AppText>
          <AppText className="font-sans-semibold text-ink-inverse" style={{ fontSize: 12.5 }}>
            {formatCents(potential)}
          </AppText>
        </View>
        <View className="flex-row items-center justify-between">
          <AppText className="text-ink-inverse/70" style={{ fontSize: 12 }}>
            Commission TK LINK (5 %)
          </AppText>
          <AppText className="text-ink-inverse/70" style={{ fontSize: 12 }}>
            − {formatCents(commissionCents(potential))}
          </AppText>
        </View>
        <View className="flex-row items-center justify-between border-t border-ink-inverse/15 pt-1.5">
          <AppText className="font-sans-bold text-accent" style={{ fontSize: 13 }}>
            Vous touchez
          </AppText>
          <AppText
            testID="publish-net"
            className="font-display text-accent"
            style={{ fontSize: 16 }}
          >
            {formatCents(netCents(potential))}
          </AppText>
        </View>
      </View>

      {/* Quand elle part — CDC §4.2. */}
      <View className="gap-1.5">
        <Label>Mise en ligne</Label>
        <View className="flex-row gap-2">
          {STARTS.map((s) => (
            <Pressable
              key={s.minutes}
              testID={`publish-start-${s.minutes}`}
              accessibilityRole="button"
              accessibilityState={{ selected: startIn === s.minutes }}
              accessibilityLabel={`Mise en ligne : ${s.label}`}
              onPress={() => setStartIn(s.minutes)}
              className={cn(
                'flex-1 items-center rounded-pill border py-1.5',
                startIn === s.minutes
                  ? 'border-brand-500 bg-brand-500'
                  : 'border-line bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  startIn === s.minutes ? 'text-white' : 'text-ink-muted',
                )}
                style={{ fontSize: 11.5 }}
              >
                {s.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Pressable
          testID="publish-submit"
          accessibilityRole="button"
          accessibilityLabel="Publier l’offre"
          onPress={() => submit('publiee')}
          className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
        >
          <AppText className="font-sans-bold text-white" style={{ fontSize: 15 }}>
            {wholesale
              ? startIn === 0
                ? 'Publier l’offre'
                : 'Programmer l’offre'
              : startIn === 0
                ? 'Publier le Flash'
                : 'Programmer le Flash'}
          </AppText>
          <Feather name="zap" size={16} color="#FFFFFF" />
        </Pressable>

        {/* Le brouillon — premier état du §4.1. Il ne consomme pas d'opération :
            enregistrer une idée n'est pas la publier. */}
        <Pressable
          testID="publish-draft"
          accessibilityRole="button"
          accessibilityLabel="Enregistrer en brouillon"
          onPress={() => submit('brouillon')}
          className="flex-row items-center justify-center gap-2 rounded-control border border-brand-500 py-3 active:opacity-70"
        >
          <Feather name="bookmark" size={15} color={colors.brand500} />
          <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 14 }}>
            Enregistrer le brouillon
          </AppText>
        </Pressable>
        <Pressable
          testID="publish-cancel"
          accessibilityRole="button"
          accessibilityLabel="Annuler"
          onPress={onCancel}
          className="items-center py-1"
        >
          <AppText variant="caption" className="text-ink-muted">
            Annuler
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
