'use client';

import makeQr from 'qrcode-generator';

import { formatMoney } from './data';

/**
 * UN VRAI QR CODE, dessiné en SVG.
 *
 * Pas une imitation : un faux QR sur une étiquette censée être scannée au comptoir serait pire que
 * pas de QR. Le contenu est l'identifiant de la commande, celui que l'app du client affiche dans son
 * propre QR de confirmation (CDC V1.1 : « écran de confirmation avec QR côté client »).
 */
export function QrCode({ value, size = 120 }) {
  const qr = makeQr(0, 'M');
  qr.addData(String(value));
  qr.make();
  const n = qr.getModuleCount();
  const cells = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} />);
    }
  }
  return (
    <svg
      role="img"
      aria-label={`QR code de la commande ${value}`}
      width={size}
      height={size}
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <g fill="#000">{cells}</g>
    </svg>
  );
}

/** La commande, en une phrase de préparation : « 2 × Plateau, 1 × Café ». */
function prepLines(order) {
  return order.lines.map((l) => `${l.qty} × ${l.label}`);
}

/**
 * LE TICKET DE PRÉPARATION — CDC V1.1 (Commerçant > Process) : « une imprimante à étiquettes
 * thermique autonome imprime un ticket de préparation avec une partie autocollante détachable
 * portant le QR de la commande, à coller sur le produit ». Même ticket côté grossiste.
 *
 * Deux zones séparées par un pointillé : le TICKET (pour la cuisine ou l'entrepôt : client, mode de
 * remise, lignes) et l'ÉTIQUETTE (QR + numéro, à détacher et coller). L'impression passe par le
 * navigateur ; la vraie imprimante thermique (Bluetooth ou USB) se branchera sur l'app TK Pro, pas
 * sur ce site — d'où la mention ci-dessous.
 */
export default function PrepLabel({ order, onClose, role }) {
  const mode = order.fulfilment === 'touch-collect' ? 'Touch & Collect' : 'Livraison';
  return (
    <div className="tkpro-modal" role="dialog" aria-modal="true" aria-label="Ticket de préparation">
      <div className="tkpro-modal-card">
        <div className="tkpro-label" id="tkpro-label">
          <div className="tkpro-label-ticket">
            <div className="tkpro-label-brand">
              TK<span>LINK</span>
            </div>
            <div className="tkpro-label-id">{order.id}</div>
            <div className="tkpro-label-meta">
              {order.customer} · {mode}
            </div>
            <ul>
              {prepLines(order).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="tkpro-label-total">{formatMoney(order.totalCents)}</div>
          </div>
          <div className="tkpro-label-cut" aria-hidden="true">
            ✂ détacher
          </div>
          <div className="tkpro-label-sticker">
            <QrCode value={order.id} size={116} />
            <div className="tkpro-label-id small">{order.id}</div>
          </div>
        </div>

        <p className="tkpro-note" style={{ margin: '12px 0 0' }}>
          {role === 'grossiste'
            ? 'À coller sur le colis avant expédition. '
            : 'À coller sur le produit avant la remise. '}
          L’impression automatique à la commande se fera par l’imprimante thermique reliée à
          l’application TK Pro ; ici, le navigateur imprime le même ticket.
        </p>

        <div className="tkpro-profile-foot">
          <button type="button" className="tkpro-btn primary" onClick={() => window.print()}>
            Imprimer
          </button>
          <button type="button" className="tkpro-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
