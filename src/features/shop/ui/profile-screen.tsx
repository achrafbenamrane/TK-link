import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Share, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  REWARD_POINTS,
  REWARD_VALUE_EUR,
  selectPoints,
  selectVouchers,
  useShopStore,
} from '../model/store';
import { SharePointsSheet } from './components/share-points-sheet';

function Row({
  icon,
  label,
  onPress,
  danger,
  last,
  testID,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 py-3.5 active:opacity-60',
        !last && 'border-b border-line',
      )}
    >
      <View className="h-9 w-9 items-center justify-center rounded-control bg-surface-muted">
        {icon}
      </View>
      <AppText className={cn('flex-1 font-sans-medium', danger && 'text-brand-600')}>
        {label}
      </AppText>
      <Feather name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

type ProfileScreenProps = {
  /**
   * Ce compte est-il professionnel ? Fourni par la ROUTE : le rôle vit dans
   * `onboarding`, que la boutique n'importe pas. Un consommateur ne voit
   * simplement pas le renvoi vers l'espace pro.
   */
  canPublishOffers?: boolean;
  /**
   * L'avatar CHOISI à l'inscription, rendu par la route.
   *
   * Même raison que `canPublishOffers` : l'avatar vit dans `onboarding`, que
   * la boutique n'importe pas. L'entête affichait jusqu'ici une pastille noire
   * avec un « F » — une initiale codée en dur, sans rapport avec la personne
   * qui regarde l'écran.
   */
  renderAvatar?: () => ReactNode;
  /** Le nom saisi à l'inscription. Vide tant qu'il n'y en a pas. */
  name?: string;
  /** Une ligne de contexte VRAIE — le rôle, pas un quartier inventé. */
  subtitle?: string;
  /**
   * Repasser du côté consommateur.
   *
   * Rendu par la route, comme le reste de ce qui touche au rôle. Sans cette
   * sortie, la bascule vers l'espace commerçant serait un piège : l'accueil
   * devient « Lots des grossistes », les ventes flash disparaissent, et plus
   * rien ne ramène en arrière. Une porte qui ne s'ouvre que dans un sens est un
   * défaut, pas une fonctionnalité.
   */
  onLeaveMerchantSpace?: () => void;
};

export function ProfileScreen({
  canPublishOffers = false,
  onLeaveMerchantSpace,
  renderAvatar,
  name,
  subtitle,
}: ProfileScreenProps = {}) {
  const router = useRouter();
  const points = useShopStore(selectPoints);
  // On s'abonne à la référence STABLE (`s.vouchers`) puis on filtre en mémo :
  // un sélecteur qui renvoie `.filter(...)` crée un nouveau tableau à chaque
  // rendu, ce que Zustand 5 lit comme un changement → boucle infinie, crash.
  const allVouchers = useShopStore(selectVouchers);
  const vouchers = useMemo(() => allVouchers.filter((v) => v.usedAt === null), [allVouchers]);
  const claim = useShopStore((s) => s.claimReward);
  const [shareOpen, setShareOpen] = useState(false);

  const remaining = Math.max(0, REWARD_POINTS - points);
  const pct = Math.min(100, Math.round((points / REWARD_POINTS) * 100));
  const canClaim = points >= REWARD_POINTS;

  const invite = async () => {
    try {
      await Share.share({
        message: 'Je déniche les meilleures ventes flash de mon quartier sur TK LINK ⚡',
      });
    } catch {
      // partage indisponible (web) — sans effet pour la démo
    }
  };

  return (
    <Screen testID="profile-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="pb-4 pt-2">
          <AppText variant="display">Profil</AppText>
        </View>

        {/* L'identité RÉELLE : l'avatar choisi, le nom saisi.
            Le crayon a disparu avec les données factices : rien n'éditait le
            profil, et une icône qui promet une action inexistante coûte plus
            cher que son absence. */}
        <View
          testID="profile-identity"
          className="mb-4 flex-row items-center gap-3 rounded-card border border-line bg-surface p-4"
        >
          <View className="h-14 w-14 overflow-hidden rounded-pill bg-surface-muted">
            {renderAvatar ? renderAvatar() : null}
          </View>
          <View className="flex-1">
            <AppText variant="title" className="text-lg" numberOfLines={1}>
              {name?.trim() ? name : 'Votre profil'}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" className="text-ink-faint" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>

        {/* Loyalty */}
        <View className="mb-5 gap-3 rounded-card bg-ink p-5">
          <View className="flex-row items-center gap-2">
            <Feather name="gift" size={16} color={colors.brand500} />
            <AppText className="font-sans-semibold text-ink-inverse">Fidélité TK LINK</AppText>
          </View>
          <View className="flex-row items-baseline gap-2">
            {/* lineHeight obligatoire : sans lui AppText garde la hauteur de
                ligne de sa variante par défaut (24 px), et un chiffre de 40 px
                en police Unbounded — qui a de longues hampes — se fait rogner. */}
            <AppText
              className="font-display text-ink-inverse"
              style={{ fontSize: 40, lineHeight: 50 }}
            >
              {points}
            </AppText>
            <AppText className="text-ink-inverse/70">points</AppText>
          </View>
          <View className="gap-1.5">
            <View className="h-2 overflow-hidden rounded-pill bg-ink-inverse/20">
              <View className="h-full rounded-pill bg-brand-500" style={{ width: `${pct}%` }} />
            </View>
            <AppText className="text-xs text-ink-inverse/70">
              {remaining > 0
                ? `Encore ${remaining} points pour un bon d’achat de ${REWARD_VALUE_EUR}€`
                : `Un bon d’achat de ${REWARD_VALUE_EUR}€ vous attend 🎉`}
            </AppText>
          </View>
          {/* À 200 points la carte félicitait sans rien proposer : le palier
              s'échange maintenant vraiment contre un bon d'achat. */}
          {canClaim ? (
            <Pressable
              testID="claim-reward"
              accessibilityRole="button"
              accessibilityLabel={`Échanger ${REWARD_POINTS} points contre un bon d’achat`}
              onPress={() => {
                const r = claim();
                if (r.ok) {
                  Alert.alert(
                    'Bon d’achat obtenu 🎉',
                    `Votre code : ${r.voucher.code}
Présentez-le au commerçant pour ${r.voucher.value} € de réduction.`,
                  );
                }
              }}
              className="mt-1 flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3 active:bg-brand-600"
            >
              <Feather name="gift" size={15} color={colors.inkInverse} />
              <AppText className="font-sans-bold text-ink-inverse">
                Échanger contre un bon de {REWARD_VALUE_EUR}€
              </AppText>
            </Pressable>
          ) : null}

          <Pressable
            testID="share-points"
            accessibilityRole="button"
            accessibilityLabel="Offrir des points à un proche"
            onPress={() => setShareOpen(true)}
            className="mt-1 flex-row items-center justify-center gap-2 rounded-control bg-surface py-3 active:opacity-90"
          >
            <Feather name="share-2" size={15} color={colors.ink} />
            <AppText className="font-sans-bold text-ink">Partager mes points</AppText>
          </Pressable>

          {vouchers.length > 0 ? (
            <View className="mt-1 flex-row items-center gap-2 rounded-control bg-ink-inverse/10 px-3 py-2.5">
              <Feather name="tag" size={14} color={colors.brand500} />
              <AppText className="flex-1 text-xs text-ink-inverse">
                {vouchers.length} bon{vouchers.length > 1 ? 's' : ''} d’achat disponible
                {vouchers.length > 1 ? 's' : ''} · {vouchers[0]?.code}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Invite — bouton simple ; le bouton signature vit désormais sur les fiches produit. */}
        <View className="mb-5 gap-2 rounded-card border border-line bg-surface-muted p-5">
          <AppText variant="title" className="text-lg">
            Partagez TK LINK
          </AppText>
          <AppText variant="caption" className="mb-1">
            Un proche rejoint le quartier ? Offrez-lui l’app d’un simple geste.
          </AppText>
          <Pressable
            testID="invite-button"
            accessibilityRole="button"
            accessibilityLabel="Partager l’application TK LINK"
            onPress={invite}
            className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
          >
            <Feather name="share-2" size={15} color={colors.inkInverse} />
            <AppText className="font-sans-bold text-ink-inverse">Partager l’app</AppText>
          </Pressable>
        </View>

        {/* Décision client du 2026-08-10 : un professionnel PILOTE ses ventes
            depuis le web, pas depuis l'app. Le téléphone lui sert à
            s'approvisionner (son accueil, ce sont les lots des grossistes) ;
            publier et suivre ses commandes se fait sur l'espace pro. On le dit
            plutôt que de laisser chercher. */}
        {canPublishOffers && onLeaveMerchantSpace ? (
          <Pressable
            testID="profile-leave-merchant"
            accessibilityRole="button"
            accessibilityLabel="Revenir à l’application consommateur"
            onPress={onLeaveMerchantSpace}
            className="mb-4 flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-4 active:opacity-70"
          >
            <Feather name="repeat" size={16} color={colors.inkMuted} />
            <View className="flex-1">
              <AppText className="font-sans-bold text-ink" style={{ fontSize: 14 }}>
                Revenir à l’app consommateur
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                Démo : bascule le rôle de ce téléphone. En production, c’est le compte qui décide.
              </AppText>
            </View>
          </Pressable>
        ) : null}

        {canPublishOffers ? (
          <View className="mb-4 gap-2 rounded-card bg-surface-inverse p-4">
            <View className="flex-row items-center gap-2">
              <Feather name="monitor" size={16} color={colors.lime} />
              <AppText className="font-sans-bold text-ink-inverse">Espace professionnel</AppText>
            </View>
            <AppText variant="caption" className="text-ink-inverse/70">
              Vos ventes flash, vos commandes reçues et votre facturation se gèrent sur le web —
              écran large, clavier, export comptable.
            </AppText>
            <View className="mt-1 flex-row items-center gap-2 rounded-control bg-ink-inverse/10 px-3 py-2.5">
              <Feather name="link" size={14} color={colors.inkInverse} />
              <AppText className="flex-1 text-ink-inverse" style={{ fontSize: 12.5 }}>
                tklink.fr/pro
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Menu */}
        <View className="rounded-card border border-line bg-surface px-4">
          <Row
            testID="profile-coupons"
            icon={<Feather name="tag" size={17} color={colors.ink} />}
            label="Mes coupons"
            onPress={() => router.push('/coupons')}
          />
          <Row
            testID="profile-empreinte"
            icon={<Ionicons name="finger-print" size={18} color={colors.ink} />}
            label="Empreinte digitale"
            onPress={() => router.push('/empreinte')}
          />
          <Row
            testID="profile-factures"
            icon={<Feather name="maximize" size={17} color={colors.ink} />}
            label="Mes factures QR"
            onPress={() => router.push('/factures')}
          />
          <Row
            testID="profile-adresses"
            icon={<Feather name="map-pin" size={17} color={colors.ink} />}
            label="Adresses de livraison"
            onPress={() => router.push('/adresses')}
          />
          <Row
            testID="profile-commercant"
            icon={<Feather name="briefcase" size={17} color={colors.ink} />}
            label="Devenir commerçant"
            onPress={() => router.push('/commercant')}
          />
          <Row
            testID="profile-aide"
            icon={<Feather name="help-circle" size={17} color={colors.ink} />}
            label="Aide & contact"
            onPress={() => router.push('/aide')}
          />
          <Row
            icon={<Feather name="log-out" size={17} color={colors.brand600} />}
            label="Se déconnecter"
            danger
            last
            onPress={() => router.push('/sign-in')}
          />
        </View>

        <AppText variant="caption" className="mt-6 text-center text-ink-faint">
          TK LINK v0.1
        </AppText>
      </ScrollView>

      <SharePointsSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Screen>
  );
}
