import { fireEvent, render, screen } from '@/shared/testing/render';

import {
  DEFAULT_CUSTOM,
  EDITOR_TABS,
  FIELDS,
  FIELD_KEYS,
  optionCount,
  pick,
  randomCustom,
  shade,
} from '../lib/avatar-parts';
import { AvatarSchema, CustomAvatarSchema, OnboardingSchema } from '../model/schema';
import { useOnboardingStore } from '../model/store';
import { AvatarFigure } from '../ui/avatar-figure';
import { AvatarPicker } from '../ui/avatar-picker';
import { AvatarView } from '../ui/avatar-view';

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe('avatar personnalisé — contrat de stockage', () => {
  it('relit une galerie d’avant sans avatar composé', () => {
    expect(AvatarSchema.parse({ preset: 3 })).toEqual({ preset: 3 });
  });

  it('complète un avatar composé incomplet avec les valeurs par défaut', () => {
    const avatar = AvatarSchema.parse({ preset: 0, custom: { hair: 4, cap: 2 } });
    expect(avatar.custom).toEqual({ ...DEFAULT_CUSTOM, hair: 4, cap: 2 });
  });

  it('écarte un avatar composé illisible au lieu de faire échouer tout le profil', () => {
    const state = OnboardingSchema.parse({
      completed: true,
      firstName: 'Sofiane',
      avatar: { preset: 2, custom: 'pas un objet' },
    });
    expect(state.avatar).toEqual({ preset: 2 });
    expect(state.firstName).toBe('Sofiane');
    expect(state.completed).toBe(true);
  });

  it('les valeurs par défaut du schéma sont celles de l’éditeur', () => {
    expect(CustomAvatarSchema.parse({})).toEqual(DEFAULT_CUSTOM);
  });
});

describe('pièces de l’avatar', () => {
  it('chaque champ a au moins deux choix, et un libellé par choix', () => {
    for (const key of FIELD_KEYS) {
      const field = FIELDS[key];
      expect(field.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(field.options.map((o) => (typeof o === 'string' ? o : o.label))).size).toBe(
        field.options.length,
      );
    }
  });

  it('chaque champ est proposé par un onglet de l’éditeur, et un seul', () => {
    const listed = EDITOR_TABS.flatMap((t) => t.fields).sort();
    expect(listed).toEqual([...FIELD_KEYS].sort());
  });

  it('ramène un index hors liste dans la liste', () => {
    const n = optionCount('hair');
    expect(pick({ ...DEFAULT_CUSTOM, hair: n + 2 }, 'hair')).toBe(2);
  });

  it('le hasard tombe toujours dans les listes, et reste sobre sur les accessoires', () => {
    for (const r of [0, 0.25, 0.5, 0.99, 1]) {
      const a = randomCustom(() => r);
      for (const key of FIELD_KEYS) expect(a[key]).toBeLessThan(optionCount(key));
    }
    // Un tirage « haut » : l’accessoire rare ne sort que si le hasard le veut vraiment.
    const rare = randomCustom(() => 0.99);
    expect([rare.beard, rare.glasses, rare.cap, rare.freckles]).toEqual([0, 0, 0, 0]);
  });

  it('assombrit et éclaircit une couleur', () => {
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#FF1478', 0)).toBe('#ff1478');
  });
});

describe('<AvatarFigure /> — le logo TK LINK est toujours là', () => {
  const tops = optionCount('top');
  const caps = optionCount('cap');

  it.each(Array.from({ length: tops }, (_, i) => i))('la tenue %i porte le logo', (top) => {
    render(<AvatarFigure avatar={{ ...DEFAULT_CUSTOM, top, cap: 0 }} size={80} />);
    expect(screen.getAllByTestId('avatar-logo')).toHaveLength(1);
  });

  it.each(Array.from({ length: caps - 1 }, (_, i) => i + 1))(
    'le couvre-chef %i porte le logo, en plus de la tenue',
    (cap) => {
      render(<AvatarFigure avatar={{ ...DEFAULT_CUSTOM, cap }} size={80} />);
      expect(screen.getAllByTestId('avatar-logo')).toHaveLength(2);
    },
  );

  it('le logo reste dessiné quel que soit le tissu, rose comme blanc', () => {
    for (const topColor of Array.from({ length: optionCount('topColor') }, (_, i) => i)) {
      const { unmount } = render(
        <AvatarFigure
          avatar={{ ...DEFAULT_CUSTOM, topColor, cap: 1, capColor: topColor }}
          size={80}
        />,
      );
      expect(screen.getAllByTestId('avatar-logo')).toHaveLength(2);
      unmount();
    }
  });
});

describe('<AvatarView />', () => {
  it('affiche l’illustration de la galerie quand rien n’est composé', () => {
    render(<AvatarView avatar={{ preset: 1 }} size={48} />);
    expect(screen.getByLabelText('Avatar : Tickets en main')).toBeTruthy();
  });

  it('affiche l’avatar composé quand il existe', () => {
    render(<AvatarView avatar={{ preset: 1, custom: DEFAULT_CUSTOM }} size={48} />);
    expect(screen.getByLabelText('Avatar personnalisé')).toBeTruthy();
  });
});

describe('<AvatarPicker /> — éditeur d’avatar', () => {
  const openEditor = () => {
    render(<AvatarPicker />);
    fireEvent.press(screen.getByTestId('avatar-picker'));
    fireEvent.press(screen.getByTestId('avatar-create'));
  };

  it('compose un avatar et l’enregistre', () => {
    openEditor();
    expect(screen.getByTestId('avatar-editor')).toBeTruthy();

    fireEvent.press(screen.getByTestId('avatar-tab-cheveux'));
    fireEvent.press(screen.getByTestId('avatar-opt-hair-4'));
    fireEvent.press(screen.getByTestId('avatar-opt-hairColor-6'));
    fireEvent.press(screen.getByTestId('avatar-tab-casquette'));
    fireEvent.press(screen.getByTestId('avatar-opt-cap-1'));
    fireEvent.press(screen.getByTestId('avatar-opt-capColor-2'));
    fireEvent.press(screen.getByTestId('avatar-editor-save'));

    expect(screen.queryByTestId('avatar-editor')).toBeNull();
    expect(useOnboardingStore.getState().avatar.custom).toEqual({
      ...DEFAULT_CUSTOM,
      hair: 4,
      hairColor: 6,
      cap: 1,
      capColor: 2,
    });
  });

  it('fermer sans enregistrer ne change rien', () => {
    openEditor();
    fireEvent.press(screen.getByTestId('avatar-tab-visage'));
    fireEvent.press(screen.getByTestId('avatar-opt-skin-5'));
    fireEvent.press(screen.getByTestId('avatar-editor-close'));

    expect(screen.queryByTestId('avatar-editor')).toBeNull();
    expect(useOnboardingStore.getState().avatar).toEqual({ preset: 0 });
  });

  it('rappelle que le logo est toujours sur la tenue et sur le couvre-chef', () => {
    openEditor();
    fireEvent.press(screen.getByTestId('avatar-tab-tenue'));
    expect(screen.getByTestId('avatar-editor-note')).toHaveTextContent(/logo TK LINK/);
    fireEvent.press(screen.getByTestId('avatar-tab-casquette'));
    expect(screen.getByTestId('avatar-editor-note')).toHaveTextContent(/logo TK LINK/);
  });

  it('ne propose une couleur de couvre-chef que si on en porte un', () => {
    openEditor();
    fireEvent.press(screen.getByTestId('avatar-tab-casquette'));
    expect(screen.queryByTestId('avatar-field-capColor')).toBeNull();
    fireEvent.press(screen.getByTestId('avatar-opt-cap-2'));
    expect(screen.getByTestId('avatar-field-capColor')).toBeTruthy();
  });

  it('réinitialise le brouillon', () => {
    openEditor();
    fireEvent.press(screen.getByTestId('avatar-tab-visage'));
    fireEvent.press(screen.getByTestId('avatar-opt-skin-5'));
    fireEvent.press(screen.getByTestId('avatar-editor-reset'));
    fireEvent.press(screen.getByTestId('avatar-editor-save'));

    expect(useOnboardingStore.getState().avatar.custom).toEqual(DEFAULT_CUSTOM);
  });

  it('rouvre l’éditeur sur l’avatar déjà composé, et propose de le modifier', () => {
    useOnboardingStore.getState().setAvatar({ preset: 0, custom: { ...DEFAULT_CUSTOM, hair: 8 } });
    render(<AvatarPicker />);
    fireEvent.press(screen.getByTestId('avatar-picker'));
    expect(screen.getByLabelText('Modifier mon avatar')).toBeTruthy();

    fireEvent.press(screen.getByTestId('avatar-create'));
    fireEvent.press(screen.getByTestId('avatar-tab-cheveux'));
    expect(screen.getByTestId('avatar-opt-hair-8')).toHaveProp('accessibilityState', {
      selected: true,
    });
  });

  it('choisir une illustration de la galerie remplace l’avatar composé', () => {
    useOnboardingStore.getState().setAvatar({ preset: 0, custom: DEFAULT_CUSTOM });
    render(<AvatarPicker />);
    fireEvent.press(screen.getByTestId('avatar-picker'));
    fireEvent.press(screen.getByTestId('avatar-tickets'));

    expect(useOnboardingStore.getState().avatar).toEqual({ preset: 1 });
  });
});
