import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { SLIDES, type Slide } from '../../lib/communication';

/** Une diapositive : l'icône, le titre, une phrase. Un appui ouvre sa destination, si elle en a une. */
function SlideCard({ slide }: { slide: Slide }) {
  const colors = useColors();
  const router = useRouter();
  const body = (
    <View className="flex-row items-center gap-3.5 rounded-card border border-brand-500 bg-surface-muted p-4">
      <View className="h-14 w-14 items-center justify-center rounded-pill border border-brand-500 bg-brand-50">
        <Feather name={slide.icon} size={24} color={colors.brand500} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          <View className="rounded-pill border border-brand-500 bg-brand-50 px-2 py-0.5">
            <AppText className="font-sans-bold text-brand-600" style={{ fontSize: 9 }}>
              TK LINK
            </AppText>
          </View>
        </View>
        <AppText className="font-sans-bold text-ink" style={{ fontSize: 15 }}>
          {slide.title}
        </AppText>
        <AppText variant="caption" className="text-ink-muted">
          {slide.text}
        </AppText>
      </View>
      {slide.href ? <Feather name="chevron-right" size={18} color={colors.brand500} /> : null}
    </View>
  );

  if (!slide.href) return <View testID={`home-slide-${slide.id}`}>{body}</View>;
  const href = slide.href;
  return (
    <Pressable
      testID={`home-slide-${slide.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${slide.title}. ${slide.text}`}
      onPress={() => router.push(href)}
    >
      {body}
    </Pressable>
  );
}

/**
 * LE BANDEAU DE COMMUNICATION TK LINK — des diapositives qu'on fait glisser, avec des points pour
 * dire où l'on en est. Pas de défilement automatique : un texte qui change tout seul se lit mal, et
 * une boucle de minuterie n'a rien à faire sur l'écran le plus regardé de l'app.
 */
export function CommunicationSlides() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1)));
  };

  return (
    <View testID="home-slides" className="mb-4 gap-2">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        accessibilityLabel="Informations TK LINK"
      >
        {SLIDES.map((slide) => (
          // Chaque page fait la largeur de l'écran (c'est ce que le paging attend) ; la carte garde ses marges.
          <View key={slide.id} style={{ width }} className="px-5">
            <SlideCard slide={slide} />
          </View>
        ))}
      </ScrollView>
      <View className="flex-row items-center justify-center gap-1.5">
        {SLIDES.map((slide, i) => (
          <View
            key={slide.id}
            testID={`home-slide-dot-${i}`}
            accessibilityState={{ selected: i === index }}
            className={cn('h-1.5 rounded-pill', i === index ? 'w-4 bg-brand-500' : 'w-1.5 bg-line')}
          />
        ))}
      </View>
    </View>
  );
}
