import { render, screen } from '@/shared/testing/render';

import { FlashCard } from '../ui/components/flash-card';
import { getDeal } from '../model/catalog';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('la séance sur la carte', () => {
  it('affiche le film et l’heure — « place de cinéma » ne se vend pas seul', () => {
    render(<FlashCard deal={getDeal('d_cinema')!} />);

    const strip = screen.getByTestId('deal-d_cinema-screening');
    expect(strip).toBeTruthy();
    expect(screen.getByText('Le Grand Bleu')).toBeTruthy();
    expect(screen.getByText('20:15')).toBeTruthy();
  });

  it('ne montre aucun bandeau de séance sur un produit qui n’en a pas', () => {
    render(<FlashCard deal={getDeal('d_cote')!} />);
    expect(screen.queryByTestId('deal-d_cote-screening')).toBeNull();
  });

  it('annonce le film à la synthèse vocale, pas seulement le mot « place »', () => {
    render(<FlashCard deal={getDeal('d_cinema')!} />);
    const label = screen.getByTestId('deal-d_cinema').props.accessibilityLabel as string;
    expect(label).toContain('Le Grand Bleu');
    expect(label).toContain('20 h 15');
  });
});
