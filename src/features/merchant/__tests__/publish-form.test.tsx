import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { pickFlashPhoto } from '../lib/photo';
import { minutesUntilTomorrowAt } from '../lib/schedule';
import { OfferDraftSchema, PublishedOfferSchema } from '../model/schema';
import { PublishForm } from '../ui/publish-form';

jest.mock('../lib/photo', () => ({
  pickFlashPhoto: jest.fn(),
}));

const pick = pickFlashPhoto as jest.MockedFunction<typeof pickFlashPhoto>;

beforeEach(() => {
  pick.mockReset();
});

describe('création d’un Flash — étapes 1 et 7 du CDC V1.1', () => {
  const fillRequired = () => {
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Plateau de viennoiseries');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '18');
    fireEvent.changeText(screen.getByTestId('publish-price'), '9');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '10');
  };

  it('propose la photo (étape 1) et les deux modes de remise (étape 7)', () => {
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('publish-photo-camera')).toBeTruthy();
    expect(screen.getByTestId('publish-photo-galerie')).toBeTruthy();
    expect(screen.getByTestId('publish-mode-touch-collect')).toBeTruthy();
    expect(screen.getByTestId('publish-mode-livraison')).toBeTruthy();
    // « Sur place » n’existe pas dans le CDC.
    expect(screen.queryByText('Sur place')).toBeNull();
  });

  it('affiche la photo choisie, et permet de la retirer', async () => {
    pick.mockResolvedValue('file:///cache/produit.jpg');
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByTestId('publish-photo-galerie'));
    await waitFor(() => expect(screen.getByTestId('publish-photo-preview')).toBeTruthy());

    fireEvent.press(screen.getByTestId('publish-photo-remove'));
    expect(screen.queryByTestId('publish-photo-preview')).toBeNull();
    expect(screen.getByTestId('publish-photo-camera')).toBeTruthy();
  });

  it('une photo refusée ou annulée ne change rien : elle est facultative', async () => {
    pick.mockResolvedValue(null);
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.press(screen.getByTestId('publish-photo-camera'));
    await waitFor(() => expect(pick).toHaveBeenCalledWith('camera'));
    expect(screen.queryByTestId('publish-photo-preview')).toBeNull();
  });

  it('publie avec la photo et les modes choisis', async () => {
    pick.mockResolvedValue('file:///cache/produit.jpg');
    const onPublish = jest.fn();
    render(<PublishForm onPublish={onPublish} onCancel={jest.fn()} />);

    fillRequired();
    fireEvent.press(screen.getByTestId('publish-photo-galerie'));
    await waitFor(() => expect(screen.getByTestId('publish-photo-preview')).toBeTruthy());
    fireEvent(screen.getByTestId('publish-mode-livraison'), 'valueChange', false); // retire la livraison
    fireEvent.press(screen.getByTestId('publish-submit'));

    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0]![0]).toMatchObject({
      photoUri: 'file:///cache/produit.jpg',
      modes: ['touch-collect'],
    });
  });

  it('refuse de publier sans aucun mode de remise', () => {
    const onPublish = jest.fn();
    render(<PublishForm onPublish={onPublish} onCancel={jest.fn()} />);
    fillRequired();
    fireEvent(screen.getByTestId('publish-mode-touch-collect'), 'valueChange', false);
    fireEvent(screen.getByTestId('publish-mode-livraison'), 'valueChange', false);
    fireEvent.press(screen.getByTestId('publish-submit'));

    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByText('Choisissez au moins un mode de remise')).toBeTruthy();
  });
});

describe('schémas — photo et modes de remise', () => {
  const draft = {
    title: 'Plateau',
    category: 'restauration' as const,
    priceCents: 900,
    oldPriceCents: 1800,
    stock: 10,
    durationMinutes: 60,
  };

  it('par défaut : sans photo, et les deux modes', () => {
    const parsed = OfferDraftSchema.parse(draft);
    expect(parsed.photoUri).toBe('');
    expect(parsed.modes).toEqual(['touch-collect', 'livraison']);
  });

  it('refuse une liste de modes vide, et un mode qui n’existe pas', () => {
    expect(OfferDraftSchema.safeParse({ ...draft, modes: [] }).success).toBe(false);
    expect(OfferDraftSchema.safeParse({ ...draft, modes: ['sur-place'] }).success).toBe(false);
  });

  it('relit une offre enregistrée AVANT ces champs, sans la perdre', () => {
    // Un champ requis ferait échouer toute la réhydratation : offres, quota et
    // brouillons effacés. Les défauts rendent l'ancien format lisible.
    const legacy = PublishedOfferSchema.parse({
      id: 'o1',
      title: 'Plateau',
      category: 'restauration',
      priceCents: 900,
      oldPriceCents: 1800,
      stock: 10,
      stockLeft: 10,
      durationMinutes: 60,
      publishedAt: 1_700_000_000_000,
    });
    expect(legacy.photoUri).toBe('');
    expect(legacy.modes).toEqual(['touch-collect', 'livraison']);
  });
});

describe('page « Nouveau Flash » — la maquette du client', () => {
  it('montre les trois étapes et avance avec la saisie', () => {
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('publish-steps')).toBeTruthy();
    expect(screen.getByTestId('publish-step')).toHaveTextContent('Étape 1/3');

    fireEvent.changeText(screen.getByTestId('publish-title'), 'Casque audio sans fil');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '89');
    fireEvent.changeText(screen.getByTestId('publish-price'), '39');
    expect(screen.getByTestId('publish-step')).toHaveTextContent('Étape 2/3');

    fireEvent.changeText(screen.getByTestId('publish-stock'), '5');
    expect(screen.getByTestId('publish-step')).toHaveTextContent('Étape 3/3');
  });

  it('montre l’aperçu en direct : titre, prix, remise, restants', () => {
    render(<PublishForm shopName="Techno Capitole" onPublish={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Casque audio sans fil');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '89');
    fireEvent.changeText(screen.getByTestId('publish-price'), '39');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '5');

    const preview = screen.getByTestId('publish-preview');
    expect(preview).toHaveTextContent(/Casque audio sans fil/);
    expect(preview).toHaveTextContent(/Techno Capitole/);
    expect(preview).toHaveTextContent(/-56%/);
    expect(preview).toHaveTextContent(/5 restants/);
  });

  it('règle le stock avec − et +, et choisit la catégorie dans une liste', () => {
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.press(screen.getByTestId('publish-stock-inc'));
    fireEvent.press(screen.getByTestId('publish-stock-inc'));
    expect(screen.getByTestId('publish-stock-left')).toHaveTextContent('2 unités restantes');

    expect(screen.queryByTestId('publish-cat-list')).toBeNull();
    fireEvent.press(screen.getByTestId('publish-cat-open'));
    fireEvent.press(screen.getByTestId('publish-cat-high-tech'));
    expect(screen.queryByTestId('publish-cat-list')).toBeNull();
  });

  it('ne propose ni « Vidéo » ni « Sublime » : absents du CDC', () => {
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByText('Vidéo')).toBeNull();
    expect(screen.queryByText(/Sublime/)).toBeNull();
  });
});

describe('mise en ligne — « Demain » à l’heure choisie (CDC V1.1 : jusqu’à la veille)', () => {
  // 14 oct. 2026, 22:10 heure locale : « demain » est déjà tout proche.
  const NOW = new Date(2026, 9, 14, 22, 10, 0, 0);

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate'] });
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const fillRequired = () => {
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Plateau de viennoiseries');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '18');
    fireEvent.changeText(screen.getByTestId('publish-price'), '9');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '10');
  };

  it('n’affiche le sélecteur d’heure que sous « Demain »', () => {
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByTestId('publish-tomorrow')).toBeNull();

    fireEvent.press(screen.getByTestId('publish-start-1440'));
    expect(screen.getByTestId('publish-tomorrow')).toBeTruthy();
    expect(screen.getByTestId('publish-tomorrow-label')).toHaveTextContent('Demain à 09:00');
    expect(screen.getByTestId('publish-tomorrow-time-08')).toBeTruthy();
    expect(screen.getByTestId('publish-tomorrow-time-20')).toBeTruthy();
    expect(screen.getByTestId('publish-tomorrow-time-09').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('publish-tomorrow-time-09').props.accessibilityRole).toBe('radio');

    fireEvent.press(screen.getByTestId('publish-start-0'));
    expect(screen.queryByTestId('publish-tomorrow')).toBeNull();
  });

  it('publie demain à 10:00 : startInMinutes = minutes jusqu’à demain 10:00', () => {
    const onPublish = jest.fn();
    render(<PublishForm onPublish={onPublish} onCancel={jest.fn()} />);
    fillRequired();
    fireEvent.press(screen.getByTestId('publish-start-1440'));
    fireEvent.press(screen.getByTestId('publish-tomorrow-time-10'));
    expect(screen.getByTestId('publish-tomorrow-label')).toHaveTextContent('Demain à 10:00');
    expect(screen.getByTestId('publish-tomorrow-time-10').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('publish-tomorrow-time-09').props.accessibilityState).toMatchObject({
      selected: false,
    });

    fireEvent.press(screen.getByTestId('publish-submit'));

    expect(onPublish).toHaveBeenCalledTimes(1);
    const expected = minutesUntilTomorrowAt(10, NOW);
    expect(expected).toBe(11 * 60 + 50); // 22:10 → 10:00 le lendemain
    expect(onPublish.mock.calls[0]![0]).toMatchObject({ startInMinutes: expected });
  });

  it('la fin du Flash suit l’heure choisie : demain 10:00 + 1 h (durée par défaut)', () => {
    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.press(screen.getByTestId('publish-start-1440'));
    fireEvent.press(screen.getByTestId('publish-tomorrow-time-10'));
    expect(screen.getByTestId('publish-ends')).toHaveTextContent(/, 11:00$/);
    expect(screen.getByTestId('publish-ends')).not.toHaveTextContent(/Aujourd/);

    fireEvent.press(screen.getByTestId('publish-tomorrow-time-18'));
    expect(screen.getByTestId('publish-ends')).toHaveTextContent(/, 19:00$/);
  });

  it('les autres options ne changent pas : Maintenant, Dans 1 h, Dans 3 h', () => {
    for (const [testID, minutes] of [
      ['publish-start-0', 0],
      ['publish-start-60', 60],
      ['publish-start-180', 180],
    ] as const) {
      const onPublish = jest.fn();
      const { unmount } = render(<PublishForm onPublish={onPublish} onCancel={jest.fn()} />);
      fillRequired();
      fireEvent.press(screen.getByTestId(testID));
      expect(screen.queryByTestId('publish-tomorrow')).toBeNull();
      fireEvent.press(screen.getByTestId('publish-submit'));
      expect(onPublish.mock.calls[0]![0]).toMatchObject({ startInMinutes: minutes });
      unmount();
    }
  });

  it('l’offre B2B (grossiste) propose aussi « Demain » avec l’heure', () => {
    const onPublish = jest.fn();
    render(<PublishForm wholesale onPublish={onPublish} onCancel={jest.fn()} />);
    fillRequired();
    fireEvent.press(screen.getByTestId('publish-start-1440'));
    fireEvent.press(screen.getByTestId('publish-tomorrow-time-08'));
    fireEvent.press(screen.getByTestId('publish-submit'));
    expect(onPublish.mock.calls[0]![0]).toMatchObject({
      audience: 'commercants',
      startInMinutes: minutesUntilTomorrowAt(8, NOW),
    });
  });
});
