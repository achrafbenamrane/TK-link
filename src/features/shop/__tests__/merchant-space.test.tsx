import { fireEvent, render, screen } from '@/shared/testing/render';

import { MerchantScreen } from '../ui/merchant-screen';
import { ProfileScreen } from '../ui/profile-screen';
import { useShopStore } from '../model/store';

/**
 * L'ALLER ET LE RETOUR entre les deux visages de l'app.
 *
 * L'espace commerçant existait déjà — pour un compte `commercant`, l'accueil
 * montre les lots des grossistes et non les ventes flash — mais le rôle ne se
 * choisissait qu'à l'accueil des nouveaux. Qui était entré comme particulier
 * n'avait aucun moyen d'y accéder, et la conduite de projet en a logiquement
 * conclu que l'interface n'existait pas.
 *
 * Une bascule sans retour serait pire que pas de bascule du tout : l'accueil
 * change, les ventes flash disparaissent, et plus rien ne ramène en arrière.
 * Les deux sens sont donc testés ensemble — c'est la paire qui compte.
 */
describe('espace commerçant — aller et retour', () => {
  beforeEach(() => {
    useShopStore.setState({ merchantApplication: null });
  });

  it('propose d’ouvrir l’espace commerçant une fois la demande envoyée', () => {
    useShopStore.setState({
      merchantApplication: {
        shopName: 'Boulangerie Saint-Cyprien',
        contactName: 'Sofiane',
        email: 'sofiane@exemple.fr',
        phone: '0612345678',
        area: 'Saint-Cyprien',
        category: 'restauration',
      },
    });

    const onOpenMerchantSpace = jest.fn();
    render(<MerchantScreen onOpenMerchantSpace={onOpenMerchantSpace} />);

    fireEvent.press(screen.getByTestId('merchant-open-space'));
    expect(onOpenMerchantSpace).toHaveBeenCalled();
  });

  it('dit par quel canal la réponse arrive, et sous quel délai', () => {
    useShopStore.setState({
      merchantApplication: {
        shopName: 'Boulangerie Saint-Cyprien',
        contactName: 'Sofiane',
        email: 'sofiane@exemple.fr',
        phone: '0612345678',
        area: 'Saint-Cyprien',
        category: 'restauration',
      },
    });

    render(<MerchantScreen />);

    // « Nous revenons vers vous » ne dit ni où regarder ni quand s'inquiéter :
    // qui ignore qu'il doit surveiller sa boîte mail conclut au silence.
    expect(screen.getByText(/e-mail/)).toBeTruthy();
    expect(screen.getByText(/48 h/)).toBeTruthy();
    expect(screen.getByText(/sofiane@exemple\.fr/)).toBeTruthy();
  });

  it('laisse un commerçant revenir à l’app consommateur', () => {
    const onLeaveMerchantSpace = jest.fn();
    render(<ProfileScreen canPublishOffers onLeaveMerchantSpace={onLeaveMerchantSpace} />);

    fireEvent.press(screen.getByTestId('profile-leave-merchant'));
    expect(onLeaveMerchantSpace).toHaveBeenCalled();
  });

  it('n’offre pas cette sortie à un consommateur — il n’est jamais entré', () => {
    render(<ProfileScreen onLeaveMerchantSpace={jest.fn()} />);
    expect(screen.queryByTestId('profile-leave-merchant')).toBeNull();
  });
});
