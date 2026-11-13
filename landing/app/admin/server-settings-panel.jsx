'use client';

import { useCallback, useEffect, useState } from 'react';

import { SERVER_SETTINGS, parseInput, toDisplay } from './server-settings';

/**
 * « SUR LE SERVEUR » — les réglages que les vraies commandes appliquent (migration 0022) : la
 * commission, le crédit de parrainage, la durée et le nombre de réservations, les visuels IA.
 *
 * Chaque réglage s'enregistre seul, sur son bouton : un changement de commission engage de l'argent,
 * il ne part pas avec une autre retouche de la page. Rien ne s'affiche sans la clé de service du
 * back-office (ou sans la migration) : les réglages de dessous restent alors ceux de la
 * démonstration.
 */
export default function ServerSettingsPanel({ notify, onLive }) {
  const [values, setValues] = useState(null);
  const [inputs, setInputs] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);

  // `onLive` est un setter d'état (stable) : la lecture initiale ne part qu'une fois.
  const load = useCallback(async () => {
    const data = await fetch('/admin/api/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    if (!data?.settings) return;
    setValues(data.settings);
    onLive?.(true);
    setInputs(
      Object.fromEntries(SERVER_SETTINGS.map((d) => [d.key, toDisplay(d, data.settings[d.key])])),
    );
  }, [onLive]);

  useEffect(() => {
    // Lecture des réglages du serveur ; l'état n'est posé qu'à la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture initiale
    void load();
  }, [load]);

  if (!values) return null;

  const save = async (def) => {
    const parsed = parseInput(def, inputs[def.key]);
    if (parsed.error) {
      setErrors((e) => ({ ...e, [def.key]: parsed.error }));
      return;
    }
    setBusy(def.key);
    const res = await fetch('/admin/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: def.key, value: parsed.value }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      notify(`${def.label} : ${inputs[def.key]} ${def.unit}, appliqué par le serveur.`);
      await load();
    } else {
      setErrors((e) => ({ ...e, [def.key]: 'Le serveur a refusé cette valeur. Réessayez.' }));
    }
  };

  return (
    <section className="tkpro-card" style={{ marginBottom: 18 }} data-testid="server-settings">
      <div className="tkpro-card-head">
        <h2>Sur le serveur — appliqué aux vraies commandes</h2>
      </div>
      <div className="tkadmin-settings">
        {SERVER_SETTINGS.map((def) => (
          <div className="tkadmin-setting" key={def.key}>
            <label className="tkadmin-setting-label" htmlFor={`server-${def.key}`}>
              {def.label}
            </label>
            <span className="tkadmin-setting-input">
              <input
                id={`server-${def.key}`}
                inputMode="decimal"
                value={inputs[def.key] ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setInputs((current) => ({ ...current, [def.key]: v }));
                  setErrors((current) => ({ ...current, [def.key]: undefined }));
                }}
                aria-invalid={errors[def.key] ? 'true' : undefined}
                data-testid={`server-setting-${def.key}`}
              />
              <em>{def.unit}</em>
              <button
                type="button"
                className="tkpro-btn"
                disabled={busy === def.key || inputs[def.key] === toDisplay(def, values[def.key])}
                onClick={() => void save(def)}
              >
                {busy === def.key ? '…' : 'Appliquer'}
              </button>
            </span>
            {errors[def.key] ? (
              <span className="tkpro-error" role="alert">
                {errors[def.key]}
              </span>
            ) : null}
            <span className="tkadmin-setting-source">{def.source}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
