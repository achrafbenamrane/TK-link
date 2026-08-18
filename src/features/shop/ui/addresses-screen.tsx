import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, EmptyState, Screen, TextField } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { colors } from '@/shared/theme/colors';

import { AddressDraftSchema, type Address, type AddressDraft } from '../model/schema';
import { useShopStore } from '../model/store';

const EMPTY: AddressDraft = { label: '', street: '', zip: '', city: 'Toulouse', notes: '' };

type Errors = Partial<Record<keyof AddressDraft, string>>;

function Field({
  label,
  value,
  onChangeText,
  error,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
  testID?: string;
}) {
  return (
    <View className="gap-1.5">
      <AppText variant="caption" className="font-sans-semibold text-ink-muted">
        {label}
      </AppText>
      <View className="flex-row">
        <TextField
          value={value}
          onChangeText={onChangeText}
          className={cn(error && 'border-brand-500')}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" className="text-brand-600">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function AddressForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: AddressDraft;
  onSubmit: (draft: AddressDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AddressDraft>(initial);
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: keyof AddressDraft) => (v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
    // On efface l'erreur dès la correction : la laisser affichée pendant que
    // l'utilisateur répare le champ est punitif.
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const parsed = AddressDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof AddressDraft | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <View className="gap-3">
      <Field
        testID="address-label"
        label="Nom"
        placeholder="Maison, Bureau…"
        value={draft.label}
        onChangeText={set('label')}
        error={errors.label}
      />
      <Field
        testID="address-street"
        label="Rue et numéro"
        placeholder="12 rue des Filatiers"
        value={draft.street}
        onChangeText={set('street')}
        error={errors.street}
      />
      <View className="flex-row gap-3">
        <View className="w-32">
          <Field
            testID="address-zip"
            label="Code postal"
            placeholder="31000"
            keyboardType="number-pad"
            maxLength={5}
            value={draft.zip}
            onChangeText={set('zip')}
            error={errors.zip}
          />
        </View>
        <View className="flex-1">
          <Field
            testID="address-city"
            label="Ville"
            value={draft.city}
            onChangeText={set('city')}
            error={errors.city}
          />
        </View>
      </View>
      <Field
        testID="address-notes"
        label="Instructions livreur (facultatif)"
        placeholder="Digicode 1234, 3ᵉ étage"
        value={draft.notes ?? ''}
        onChangeText={set('notes')}
      />

      <View className="mt-2 flex-row gap-3">
        <View className="flex-1">
          <Button label="Annuler" variant="secondary" onPress={onCancel} />
        </View>
        <View className="flex-1">
          <Button testID="address-save" label="Enregistrer" onPress={submit} />
        </View>
      </View>
    </View>
  );
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  onDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onDefault: () => void;
}) {
  return (
    <View
      testID={`address-${address.id}`}
      className={cn(
        'mb-3 gap-2 rounded-card border bg-surface p-4',
        address.isDefault ? 'border-brand-500' : 'border-line',
      )}
    >
      <View className="flex-row items-center gap-2">
        <Feather name="map-pin" size={15} color={colors.brand500} />
        <AppText className="flex-1 font-sans-bold text-ink">{address.label}</AppText>
        {address.isDefault ? (
          <View className="rounded-pill bg-brand-500 px-2 py-0.5">
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10 }}>
              PAR DÉFAUT
            </AppText>
          </View>
        ) : null}
      </View>

      <AppText variant="caption" className="text-ink-muted">
        {address.street}
        {'\n'}
        {address.zip} {address.city}
        {address.notes ? `\n${address.notes}` : ''}
      </AppText>

      <View className="mt-1 flex-row gap-4 border-t border-line pt-2.5">
        {!address.isDefault ? (
          <Pressable accessibilityRole="button" onPress={onDefault} hitSlop={6}>
            <AppText variant="caption" className="font-sans-semibold text-ink-muted">
              Définir par défaut
            </AppText>
          </Pressable>
        ) : null}
        <View className="flex-1" />
        <Pressable
          testID={`address-edit-${address.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Modifier ${address.label}`}
          onPress={onEdit}
          hitSlop={6}
        >
          <AppText variant="caption" className="font-sans-semibold text-ink">
            Modifier
          </AppText>
        </Pressable>
        <Pressable
          testID={`address-delete-${address.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Supprimer ${address.label}`}
          onPress={onDelete}
          hitSlop={6}
        >
          <AppText variant="caption" className="font-sans-semibold text-brand-600">
            Supprimer
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function AddressesScreen() {
  const addresses = useShopStore((s) => s.addresses);
  const addAddress = useShopStore((s) => s.addAddress);
  const updateAddress = useShopStore((s) => s.updateAddress);
  const removeAddress = useShopStore((s) => s.removeAddress);
  const setDefaultAddress = useShopStore((s) => s.setDefaultAddress);

  /** null = pas de formulaire ; 'new' = création ; sinon l'id en cours d'édition. */
  const [editing, setEditing] = useState<string | null>(null);

  const current = addresses.find((a) => a.id === editing);

  const confirmDelete = (address: Address) =>
    Alert.alert('Supprimer l’adresse ?', `« ${address.label} » sera retirée de votre compte.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeAddress(address.id) },
    ]);

  return (
    <Screen testID="addresses-screen">
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
            <BackButton fallbackHref="/profil" />
            <AppText variant="display" className="text-3xl">
              Adresses
            </AppText>
            <AppText variant="caption" className="mt-1">
              Où livrer vos ventes flash.
            </AppText>
          </View>

          {editing ? (
            <AddressForm
              initial={
                current
                  ? {
                      label: current.label,
                      street: current.street,
                      zip: current.zip,
                      city: current.city,
                      notes: current.notes ?? '',
                    }
                  : EMPTY
              }
              onCancel={() => setEditing(null)}
              onSubmit={(draft) => {
                if (current) updateAddress(current.id, draft);
                else addAddress(draft);
                setEditing(null);
              }}
            />
          ) : (
            <>
              {addresses.length === 0 ? (
                <View className="pt-10">
                  <EmptyState
                    testID="addresses-empty"
                    icon={<Feather name="map-pin" size={30} color={colors.inkFaint} />}
                    title="Aucune adresse"
                    description="Ajoutez une adresse pour être livré en moins de 30 minutes."
                  />
                </View>
              ) : (
                addresses.map((address) => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    onEdit={() => setEditing(address.id)}
                    onDelete={() => confirmDelete(address)}
                    onDefault={() => setDefaultAddress(address.id)}
                  />
                ))
              )}

              <View className="mt-3">
                <Button
                  testID="address-add"
                  label="Ajouter une adresse"
                  onPress={() => setEditing('new')}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
