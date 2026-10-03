/**
 * Remplaçant de `@rnmapbox/maps` pour la plateforme WEB uniquement.
 *
 * La carte est native (iOS / Android) : sa version web exige `mapbox-gl`, que
 * le projet n'embarque pas. Sur le web — l'aperçu navigateur qui sert à
 * regarder les écrans — on affiche donc une zone vide plutôt que de casser tout
 * le bundle. Les builds natifs ne passent JAMAIS par ce fichier
 * (voir metro.config.js : la règle ne vaut que pour `platform === 'web'`).
 */
const React = require('react');
const { View } = require('react-native');

const passthrough = ({ children }) => React.createElement(View, null, children);
const empty = () => null;

const Mapbox = new Proxy(
  { setAccessToken: () => undefined, setTelemetryEnabled: () => undefined },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'StyleURL') return {};
      if (prop === 'MapView' || prop === 'Camera') return passthrough;
      return empty;
    },
  },
);

module.exports = Mapbox;
module.exports.default = Mapbox;
