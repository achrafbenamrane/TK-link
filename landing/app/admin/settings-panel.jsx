'use client';

import { useState } from 'react';

import {
  DEFAULT_SETTINGS,
  FIXED_SETTINGS,
  SETTING_GROUPS,
  resetSettings,
  toInput,
  validateSettings,
  writeSettings,
} from '../pro/platform';

/**
 * LES RÉGLAGES — CDC §12.3 : ce que le Super Admin doit pouvoir régler sans qu'on touche au code.
 *
 * Le plus visible : « le nombre 5 doit être un paramètre Super Admin, et non une constante
 * inscrite dans le code » (§6.2). Changer ce nombre ici change aussi ce que l'espace commerçant
 * affiche (même navigateur) : c'est la preuve que la valeur vit à un seul endroit.
 *
 * Les trois paramètres que le CDC n'a pas chiffrés (zone de base du livreur, colis important,
 * durée de réservation du panier) restent VIDES tant que le client ne les a pas arrêtés : on les
 * affiche « à définir », jamais avec un chiffre plausible (§14).
 */
export default function SettingsPanel({ settings, onSaved, notify }) {
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, toInput(settings[k])])),
  );
  const [errors, setErrors] = useState({});

  const set = (key) => (event) => {
    setInputs((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = (event) => {
    event.preventDefault();
    const result = validateSettings(inputs);
    setErrors(result.errors);
    if (!result.ok) {
      notify('Corrigez les champs signalés.');
      return;
    }
    if (!writeSettings(result.values)) {
      notify('Enregistrement impossible : le stockage du navigateur est bloqué.');
      return;
    }
    onSaved(result.values);
    notify('Réglages enregistrés — l’espace commerçant les relira à son ouverture.');
  };

  const reset = () => {
    const defaults = resetSettings();
    setInputs(Object.fromEntries(Object.keys(defaults).map((k) => [k, toInput(defaults[k])])));
    setErrors({});
    onSaved(defaults);
    notify('Valeurs d’origine rétablies.');
  };

  return (
    <>
      <div className="tkpro-head">
        <div>
          <h1>Réglages</h1>
          <p>
            Ce que le cahier des charges veut pouvoir changer sans toucher au code (§12.3). Un champ
            vide veut dire « pas encore arrêté » : rien n’est inventé à sa place.
          </p>
        </div>
      </div>

      <form onSubmit={save} noValidate data-testid="admin-settings-form">
        {SETTING_GROUPS.map((group) => (
          <section className="tkpro-card" key={group.title} style={{ marginBottom: 18 }}>
            <div className="tkpro-card-head">
              <h2>{group.title}</h2>
            </div>
            <div className="tkadmin-settings">
              {group.fields.map((f) => (
                <label className="tkadmin-setting" key={f.key}>
                  <span className="tkadmin-setting-label">{f.label}</span>
                  <span className="tkadmin-setting-input">
                    <input
                      inputMode="decimal"
                      value={inputs[f.key]}
                      onChange={set(f.key)}
                      placeholder={f.nullable ? 'à définir' : ''}
                      aria-invalid={errors[f.key] ? 'true' : undefined}
                      aria-describedby={`${f.key}-source`}
                      data-testid={`setting-${f.key}`}
                    />
                    <em>{f.unit}</em>
                  </span>
                  {errors[f.key] ? (
                    <span className="tkpro-error" role="alert">
                      {errors[f.key]}
                    </span>
                  ) : null}
                  <span className="tkadmin-setting-source" id={`${f.key}-source`}>
                    {f.source}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="tkpro-card" style={{ marginBottom: 18 }}>
          <div className="tkpro-card-head">
            <h2>Fixé par le cahier des charges</h2>
          </div>
          <div className="tkadmin-levers">
            {FIXED_SETTINGS.map((s) => (
              <div key={s.label}>
                <b>{s.value}</b>
                <span>
                  {s.label} — {s.source}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="tkpro-profile-foot">
          <button type="submit" className="tkpro-btn primary" data-testid="settings-save">
            Enregistrer les réglages
          </button>
          <button type="button" className="tkpro-btn" onClick={reset}>
            Rétablir les valeurs d’origine
          </button>
          <span className="tkpro-note-inline">
            Démonstration : enregistrés dans ce navigateur, pas encore sur un serveur.
          </span>
        </div>
      </form>
    </>
  );
}
