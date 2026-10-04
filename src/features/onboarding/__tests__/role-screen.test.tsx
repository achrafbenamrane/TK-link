import { fireEvent, render, screen } from '@/shared/testing/render';

import { RoleScreen } from '../ui/role-screen';

describe('<RoleScreen /> — le profil se choisit avant l’inscription', () => {
  it('propose les quatre profils de TK LINK', () => {
    render(<RoleScreen onPick={jest.fn()} onSignIn={jest.fn()} />);
    for (const role of ['consommateur', 'commercant', 'grossiste', 'livreur']) {
      expect(screen.getByTestId(`role-${role}`)).toBeTruthy();
    }
  });

  it('renvoie le profil touché', () => {
    const onPick = jest.fn();
    render(<RoleScreen onPick={onPick} onSignIn={jest.fn()} />);
    fireEvent.press(screen.getByTestId('role-livreur'));
    expect(onPick).toHaveBeenCalledWith('livreur');
  });

  it('laisse se connecter sans choisir', () => {
    const onSignIn = jest.fn();
    render(<RoleScreen onPick={jest.fn()} onSignIn={onSignIn} />);
    fireEvent.press(screen.getByTestId('role-signin'));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('propose une démo par profil, remplie d’exemples, quand la route la fournit', () => {
    const onDemo = jest.fn();
    render(<RoleScreen onPick={jest.fn()} onSignIn={jest.fn()} onDemo={onDemo} />);
    fireEvent.press(screen.getByTestId('role-demo-commercant'));
    expect(onDemo).toHaveBeenCalledWith('commercant');
  });

  it('sans démo fournie, aucun bouton « Démo »', () => {
    render(<RoleScreen onPick={jest.fn()} onSignIn={jest.fn()} />);
    expect(screen.queryByTestId('role-demo-livreur')).toBeNull();
  });
});
