import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

// ⚠️ Adresse PROVISOIRE : aucun domaine TK LINK n'est enregistré à ce jour.
// À remplacer par la vraie boîte du support avant publication — un lien
// « nous écrire » qui n'arrive nulle part est pire que pas de lien du tout.
const SUPPORT_EMAIL = 'contact@tklink.app';
const SUPPORT_PHONE = '+33612345678';

const FAQ = [
  {
    q: 'C’est quoi une vente flash ?',
    a: 'Un commerçant de votre quartier propose un produit à prix réduit, en quantité limitée et pour une durée limitée. Quand le compte à rebours atteint zéro ou que le stock part, l’offre disparaît.',
  },
  {
    q: 'La livraison est-elle vraiment gratuite ?',
    a: 'Oui. TK LINK ne prend pas de frais de livraison à l’utilisateur et n’ajoute aucun frais caché. Le prix affiché est le prix payé.',
  },
  {
    q: 'Comment fonctionnent les points de fidélité ?',
    a: 'Chaque euro dépensé vous rapporte un point. À 200 points, vous recevez un bon d’achat de 2 €. Vos points sont partageables avec vos proches.',
  },
  {
    q: 'Qui me livre ?',
    a: 'Un livreur identifié, vérifié avant sa première course. Vous retrouvez sa course et votre facture QR dans l’onglet Commandes.',
  },
  {
    q: 'À quoi sert la facture QR ?',
    a: 'C’est la preuve de votre commande. Présentez-la au commerçant ou au livreur : elle contient le numéro de commande et le montant.',
  },
  {
    q: 'Je suis commerçant, comment rejoindre TK LINK ?',
    a: 'Depuis votre profil, « Devenir commerçant ». Vos deux premières ventes flash sont offertes, puis la commission reste sous le coût d’un terminal de paiement.',
  },
];

function ContactRow({
  icon,
  label,
  value,
  onPress,
  testID,
}: {
  icon: 'mail' | 'phone';
  label: string;
  value: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}`}
      onPress={onPress}
      className="flex-1 items-center gap-2 rounded-card border border-line bg-surface p-4 active:opacity-70"
    >
      <View className="h-10 w-10 items-center justify-center rounded-pill bg-brand-50">
        <Feather name={icon} size={17} color={colors.brand500} />
      </View>
      <AppText className="font-sans-bold text-ink">{label}</AppText>
      <AppText variant="caption" className="text-center text-ink-faint">
        {value}
      </AppText>
    </Pressable>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((v) => !v)}
      className="border-b border-line py-4"
    >
      <View className="flex-row items-center gap-3">
        <AppText className={cn('flex-1 font-sans-semibold', open ? 'text-brand-600' : 'text-ink')}>
          {q}
        </AppText>
        <Feather
          name={open ? 'minus' : 'plus'}
          size={16}
          color={open ? colors.brand500 : colors.inkFaint}
        />
      </View>
      {open ? (
        <AppText variant="caption" className="mt-2 leading-relaxed text-ink-muted">
          {a}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function HelpScreen() {
  // Linking peut échouer (pas de client mail sur l'appareil) — on n'insiste pas.
  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen testID="help-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="pb-4 pt-2">
          <AppText variant="display" className="text-3xl">
            Aide
          </AppText>
          <AppText variant="caption" className="mt-1">
            Une question ? On répond vite.
          </AppText>
        </View>

        <View className="mb-6 flex-row gap-3">
          <ContactRow
            testID="help-email"
            icon="mail"
            label="Écrivez-nous"
            value={SUPPORT_EMAIL}
            onPress={() => open(`mailto:${SUPPORT_EMAIL}?subject=Aide%20TK%20LINK`)}
          />
          <ContactRow
            testID="help-phone"
            icon="phone"
            label="Appelez-nous"
            value="06 12 34 56 78"
            onPress={() => open(`tel:${SUPPORT_PHONE}`)}
          />
        </View>

        <AppText variant="title" className="mb-1 text-lg">
          Questions fréquentes
        </AppText>
        <View>
          {FAQ.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </View>

        <AppText variant="caption" className="mt-6 text-center text-ink-faint">
          TK LINK v0.1 · Conçu par PROGIX · Lancement à Toulouse
        </AppText>
      </ScrollView>
    </Screen>
  );
}
