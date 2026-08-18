import { Feather } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';
import type { Category, Deal } from '../model/schema';
import { fetchRoute, routeToGeoJSON, type Route } from '../lib/directions';
import { formatDistance, TOULOUSE_CENTER } from '../lib/geo';
import { hasMapboxToken, MAPBOX_PUBLIC_TOKEN } from '../lib/mapbox';
import { ProductImage } from './components/product-image';

Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);

type Props = {
  /** Déjà filtrés par catégorie + recherche — la carte n'est qu'un rendu. */
  deals: Deal[];
  category: Category | null;
};

/** Bulle de prix : l'affordance de la carte. Rouge = sélectionnée. */
function PriceBubble({ deal, active }: { deal: Deal; active: boolean }) {
  return (
    <View className="items-center">
      <View
        className={cn(
          'flex-row items-center gap-1 rounded-pill border px-2.5 py-1.5',
          active ? 'border-brand-600 bg-brand-500' : 'border-line bg-surface',
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <AppText style={{ fontSize: 11 }}>{deal.emoji}</AppText>
        <AppText
          className={cn('font-sans-bold', active ? 'text-ink-inverse' : 'text-ink')}
          style={{ fontSize: 12 }}
        >
          {deal.price.toFixed(2)}€
        </AppText>
      </View>
      {/* petite pointe sous la bulle */}
      <View
        className={cn('-mt-0.5 h-1.5 w-1.5 rotate-45', active ? 'bg-brand-500' : 'bg-surface')}
      />
    </View>
  );
}

export function DealsMap({ deals, category }: Props) {
  const router = useRouter();
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Position partagée : demandée une seule fois par HomeScreen. Sans position,
  // la carte s'affiche quand même, centrée sur Toulouse.
  const me = useShopStore((s) => s.userCoord);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routing, setRouting] = useState(false);
  /** Taille réelle du conteneur — la carte attend de la connaître pour se monter. */
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  /**
   * Le chargement du fond de carte a-t-il échoué, et a-t-il fini par aboutir ?
   *
   * Un fond gris sans un mot est le pire des retours : impossible de savoir, sur
   * l'APK de quelqu'un d'autre, si le style a été REFUSÉ (jeton, réseau) ou s'il
   * a été chargé mais jamais PEINT (surface GL). Les deux donnent le même gris,
   * et appellent des corrections opposées. Le SDK v10 n'expose pas la raison,
   * mais il dit lequel des deux cas s'est produit — c'est déjà l'essentiel.
   *
   * Les deux événements ne s'excluent pas (documentation @rnmapbox/maps) : on ne
   * signale donc l'échec que si le chargement n'a jamais abouti.
   */
  const [styleFailed, setStyleFailed] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);
  /**
   * La surface a-t-elle reçu sa passe de mise en page ?
   *
   * Symptôme observé sur l'APK du 16/08 : la carte reste GRISE à la première
   * ouverture — sans bannière d'erreur, donc le style se charge bien — puis
   * s'affiche correctement dès qu'on quitte l'écran et qu'on y revient.
   *
   * La cause est dans le montage différé juste en dessous. Au premier rendu
   * `box` vaut `null` : la carte n'est PAS dans l'arbre. Elle n'y entre qu'une
   * fois la taille mesurée, donc dans un parent DÉJÀ mis en page — et la
   * surface GL d'Android, attachée après coup, n'obtient plus la passe de
   * layout qui déclenche son premier dessin. Revenir sur l'écran en provoque
   * une, d'où la guérison spontanée.
   *
   * On garantit donc ce passage : la carte naît un pixel plus courte, puis
   * reprend sa taille réelle. Un pixel est invisible à l'œil ; le changement de
   * taille, lui, ne l'est pas pour la surface native.
   */
  const [settled, setSettled] = useState(false);

  // Un changement de filtre invalide la sélection : garder une route vers une
  // bulle qui vient de disparaître n'aurait aucun sens. Ajustement PENDANT le
  // rendu (motif recommandé par React pour « remettre à zéro quand une prop
  // change ») plutôt qu'un effet, qui provoquerait un rendu en cascade.
  const [prevCategory, setPrevCategory] = useState(category);
  if (prevCategory !== category) {
    setPrevCategory(category);
    setSelectedId(null);
    setRoute(null);
  }

  useEffect(() => {
    if (!box || settled) return;
    // Hors du corps de l'effet : un setState synchrone y est interdit, et il
    // faut de toute façon que la frame de montage soit passée pour que le
    // changement de taille compte comme une nouvelle.
    const id = setTimeout(() => setSettled(true), 120);
    return () => clearTimeout(id);
  }, [box, settled]);

  const selected = useMemo(
    () => deals.find((d) => d.id === selectedId) ?? null,
    [deals, selectedId],
  );

  const onSelect = async (deal: Deal) => {
    const merchant = getMerchant(deal.merchantId);
    if (!merchant) return;

    setSelectedId(deal.id);
    cameraRef.current?.setCamera({
      centerCoordinate: [merchant.coord.lng, merchant.coord.lat],
      zoomLevel: 14,
      animationDuration: 600,
    });

    const from = me ?? TOULOUSE_CENTER;
    setRouting(true);
    const r = await fetchRoute(from, merchant.coord);
    setRoute(r);
    setRouting(false);
  };

  if (!hasMapboxToken) {
    return (
      <View className="flex-1 items-center justify-center px-10" testID="map-no-token">
        <Feather name="map" size={30} color={colors.inkFaint} />
        <AppText variant="title" className="mt-3 text-center text-ink-faint">
          Carte indisponible
        </AppText>
        <AppText variant="caption" className="mt-1 text-center">
          Le jeton Mapbox n’est pas configuré pour ce build.
        </AppText>
      </View>
    );
  }

  // La caméra s'ouvre sur les OFFRES, pas sur l'utilisateur. Tous les
  // commerçants sont à Toulouse : centrer sur la position réelle affichait une
  // carte vide à qui n'est pas sur place (test fait depuis Constantine → zéro
  // bulle). Le point bleu reste affiché si l'utilisateur est dans la zone.
  const selectedMerchant = selected ? getMerchant(selected.merchantId) : null;

  return (
    <View
      className="flex-1"
      testID="deals-map"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        // Ne re-rendre que si la taille change vraiment : onLayout se déclenche
        // à chaque passe et setState en boucle repartirait sans fin.
        setBox((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height },
        );
      }}
    >
      {/* La carte n'est montée qu'une fois la taille connue, et reçoit des
          dimensions en PIXELS. Avec `flex: 1` seul, elle se mesurait avant la
          fin du layout, figeait son viewport GL sur cette taille-là et ne le
          remettait jamais à jour quand le conteneur grandissait — d'où la carte
          reléguée en bas avec du blanc au-dessus. */}
      {box ? (
        <Mapbox.MapView
          style={{ width: box.width, height: settled ? box.height : box.height - 1 }}
          styleURL={Mapbox.StyleURL.Light}
          // ⚠️ Ne pas remettre `surfaceView={false}` sans avoir vérifié la carte
          // sur un vrai téléphone.
          //
          // Ce composant forçait TextureView, pour que la fiche de détail qu'on
          // superpose ne soit pas masquée par la couche GL. Le remède a coûté
          // plus cher que le mal : sur l'APK du 16/08, la carte s'affichait
          // ENTIÈREMENT GRISE. TextureView n'est pas le chemin de rendu par
          // défaut de @rnmapbox/maps (`surfaceView: true` l'est), et c'est le
          // plus fragile — d'autant plus sous la Nouvelle Architecture, activée
          // par défaut depuis le SDK 56.
          //
          // On revient donc au défaut de la bibliothèque. Si la fiche de détail
          // repasse derrière la carte, c'est un défaut VISIBLE et local ; une
          // carte grise, elle, rend l'écran entier inutilisable.
          //
          // Jeton refusé, style injoignable, téléphone hors ligne : tout passe
          // par là. Sans ce rappel, l'échec est parfaitement silencieux.
          onMapLoadingError={() => setStyleFailed(true)}
          onDidFinishLoadingMap={() => setStyleLoaded(true)}
          scaleBarEnabled={false}
          logoPosition={{ bottom: 96, left: 12 }}
          attributionPosition={{ bottom: 96, left: 92 }}
          onPress={() => {
            setSelectedId(null);
            setRoute(null);
          }}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [TOULOUSE_CENTER.lng, TOULOUSE_CENTER.lat],
              zoomLevel: 12.5,
            }}
          />
          {me ? <Mapbox.UserLocation visible androidRenderMode="normal" /> : null}

          {route ? (
            <Mapbox.ShapeSource id="route-source" shape={routeToGeoJSON(route)}>
              <Mapbox.LineLayer
                id="route-line"
                style={{
                  lineColor: colors.brand500,
                  lineWidth: 4.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                  // Pointillés quand c'est une ligne droite : on ne fait pas
                  // passer une approximation pour un vrai trajet.
                  lineDasharray: route.approximate ? [2, 2] : [1],
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {deals.map((deal) => {
            const merchant = getMerchant(deal.merchantId);
            if (!merchant) return null;
            return (
              <Mapbox.MarkerView
                key={deal.id}
                id={deal.id}
                coordinate={[merchant.coord.lng, merchant.coord.lat]}
                allowOverlap={false}
              >
                <Pressable
                  testID={`bubble-${deal.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${deal.title} chez ${merchant.name}, ${deal.price.toFixed(2)} euros`}
                  onPress={() => onSelect(deal)}
                >
                  <PriceBubble deal={deal} active={deal.id === selectedId} />
                </Pressable>
              </Mapbox.MarkerView>
            );
          })}
        </Mapbox.MapView>
      ) : null}

      {/* Tant que le fond n'est pas peint, on le DIT.
          « La map met du temps à s'afficher » est un reproche fondé : le
          chargement du style prend un instant, et pendant ce temps l'écran est
          un rectangle gris uni. Rien ne distingue « ça arrive » de « c'est
          cassé » — et c'est exactement la confusion qu'on vient de passer deux
          jours à démêler. Un indicateur coûte trois lignes et répond à la
          question avant qu'elle soit posée. */}
      {!styleLoaded && !styleFailed ? (
        <View
          testID="map-loading"
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center gap-3"
          style={{ backgroundColor: colors.surfaceMuted }}
        >
          <ActivityIndicator color={colors.brand500} />
          <AppText variant="caption" className="text-ink-faint">
            Chargement de la carte…
          </AppText>
        </View>
      ) : null}

      {/* L'échec du fond de carte, dit à voix haute. Il se superpose sans
          démonter la carte : les bulles de prix, elles, restent utilisables. */}
      {styleFailed && !styleLoaded ? (
        <View
          testID="map-load-error"
          className="absolute inset-x-4 top-4 rounded-card bg-ink/90 px-4 py-3"
        >
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 13 }}>
            Fond de carte indisponible
          </AppText>
          <AppText className="mt-1 text-ink-inverse/80" style={{ fontSize: 12 }}>
            Le style n’a pas pu être chargé. Vérifiez la connexion — les prix restent affichés et
            cliquables.
          </AppText>
        </View>
      ) : null}

      {/* Carte de détail — remonte l'essentiel sans quitter la carte. */}
      {selected && selectedMerchant ? (
        <View className="absolute inset-x-4 bottom-4" testID="map-detail-card">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/produit/${selected.id}`)}
            className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.16,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <View
              className="h-16 w-16 items-center justify-center rounded-control"
              style={{ backgroundColor: selected.tint }}
            >
              <ProductImage deal={selected} emojiSize={34} />
            </View>
            <View className="flex-1 gap-0.5">
              <AppText variant="caption" className="font-sans-medium text-ink-muted">
                {selectedMerchant.name} · {selectedMerchant.area}
              </AppText>
              <AppText variant="title" className="text-base" numberOfLines={1}>
                {selected.title}
              </AppText>
              <View className="flex-row items-center gap-2">
                <AppText className="font-display text-base text-ink">
                  {selected.price.toFixed(2)}€
                </AppText>
                {routing ? (
                  <ActivityIndicator size="small" color={colors.inkFaint} />
                ) : route ? (
                  <View className="flex-row items-center gap-1">
                    <Feather name="navigation" size={11} color={colors.brand500} />
                    <AppText variant="caption" className="text-ink-muted">
                      {formatDistance(route.km)} · {route.minutes} min
                      {route.approximate ? ' (approx.)' : ''}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.inkFaint} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
