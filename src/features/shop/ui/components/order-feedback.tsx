import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  canReportIssue,
  ISSUE_HINT,
  ISSUE_KINDS,
  ISSUE_LABEL,
  ROUTE_LABEL,
  type IssueKind,
} from '../../lib/issues';
import { canRate, RATING_TAGS, type RatingTag } from '../../lib/rating';
import type { Order } from '../../model/schema';
import { useShopStore } from '../../model/store';

/**
 * Noter le commerçant — CDC V1.1 : étoiles et tags rapides, sans texte libre,
 * une fois la commande terminée. Une seule note par commande.
 */
export function RateMerchant({ order, merchantName }: { order: Order; merchantName: string }) {
  const colors = useColors();
  const rateOrder = useShopStore((s) => s.rateOrder);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);

  if (!canRate(order.status)) return null;

  if (order.rating) {
    return (
      <View
        testID="order-rating-done"
        className="mb-4 flex-row items-center gap-3 rounded-card border border-line bg-surface p-4"
      >
        <Feather name="star" size={18} color={colors.brand500} />
        <View className="flex-1">
          <AppText className="font-sans-bold text-sm text-ink">Merci pour votre avis</AppText>
          <AppText variant="caption" className="text-ink-faint">
            {merchantName} · {order.rating.stars}/5
            {order.rating.tags.length > 0 ? ` · ${order.rating.tags.join(', ')}` : ''}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="order-rating"
      className="mb-4 gap-3 rounded-card border border-line bg-surface p-4"
    >
      <AppText className="font-sans-bold text-ink">Noter {merchantName}</AppText>
      <View className="flex-row gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            testID={`rating-star-${n}`}
            accessibilityRole="button"
            accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`}
            accessibilityState={{ selected: stars >= n }}
            hitSlop={4}
            onPress={() => setStars(n)}
          >
            <Feather name="star" size={30} color={stars >= n ? colors.brand500 : colors.line} />
          </Pressable>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {RATING_TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              testID={`rating-tag-${tag}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() =>
                setTags((list) =>
                  list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag],
                )
              }
              className={cn(
                'rounded-pill border px-3 py-1.5',
                on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
              )}
            >
              <AppText
                className={cn('font-sans-medium', on ? 'text-brand-600' : 'text-ink-muted')}
                style={{ fontSize: 12.5 }}
              >
                {tag}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Button
        testID="rating-submit"
        label="Envoyer ma note"
        disabled={stars === 0}
        onPress={() => rateOrder(order.id, stars, tags)}
      />
    </View>
  );
}

/**
 * Signaler un problème — le point d'entrée UNIQUE (CDC V1.1). Le client dit ce
 * qui s'est passé ; l'app décide si l'incident part en remboursement ou dans la
 * file du Super Admin.
 */
export function ReportIssue({ order }: { order: Order }) {
  const colors = useColors();
  const reportIssue = useShopStore((s) => s.reportIssue);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<IssueKind | null>(null);

  if (!canReportIssue(order.status)) return null;

  if (order.issue) {
    return (
      <View
        testID="order-issue-done"
        className="mb-4 flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-4"
      >
        <Feather name="alert-circle" size={18} color={colors.brand600} />
        <View className="flex-1">
          <AppText className="font-sans-bold text-sm text-ink">Signalement envoyé</AppText>
          <AppText variant="caption" className="text-ink-faint">
            {ROUTE_LABEL[order.issue.route]}
          </AppText>
        </View>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable
        testID="order-report-open"
        accessibilityRole="button"
        accessibilityLabel="Signaler un problème"
        onPress={() => setOpen(true)}
        className="mb-4 flex-row items-center justify-center gap-2 rounded-control border border-line py-3.5 active:bg-surface-muted"
      >
        <Feather name="flag" size={15} color={colors.inkMuted} />
        <AppText className="font-sans-semibold text-ink-muted" style={{ fontSize: 14 }}>
          Signaler un problème
        </AppText>
      </Pressable>
    );
  }

  return (
    <View
      testID="order-report"
      className="mb-4 gap-3 rounded-card border border-line bg-surface p-4"
    >
      <AppText className="font-sans-bold text-ink">Que s’est-il passé ?</AppText>
      {ISSUE_KINDS.map((k) => {
        const on = kind === k;
        return (
          <Pressable
            key={k}
            testID={`report-kind-${k}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => setKind(k)}
            className={cn(
              'gap-0.5 rounded-control border p-3',
              on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
            )}
          >
            <AppText
              className={cn('font-sans-semibold', on ? 'text-brand-600' : 'text-ink')}
              style={{ fontSize: 14 }}
            >
              {ISSUE_LABEL[k]}
            </AppText>
            <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 12 }}>
              {ISSUE_HINT[k]}
            </AppText>
          </Pressable>
        );
      })}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="Annuler" variant="ghost" onPress={() => setOpen(false)} />
        </View>
        <View className="flex-1">
          <Button
            testID="report-submit"
            label="Envoyer"
            disabled={!kind}
            onPress={() => kind && reportIssue(order.id, kind)}
          />
        </View>
      </View>
    </View>
  );
}
