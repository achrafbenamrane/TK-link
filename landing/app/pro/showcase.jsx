'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * LA VITRINE DU COMMERÇANT — CDC V1.1 (Commerçant > Process) : « établissement, horaires, profil
 * (photos, vidéos, présentation) ». C'est ce que le client voit sur la fiche de l'enseigne.
 *
 * ⚠️ MIROIR de `src/features/merchant/lib/shop-profile.ts` et de l'écran « Ma boutique » de l'app :
 * mêmes limites (6 photos, 2 vidéos, 400 caractères), mêmes règles d'horaires, mêmes limites vidéo
 * (30 secondes, 50 Mo — un format standard, pas un choix d'écran). Le web et l'app éditent la même
 * fiche : ils doivent refuser les mêmes choses.
 *
 * Les horaires démarrent FERMÉS : on n'invente pas d'horaires.
 */
export const MAX_PHOTOS = 6;
export const MAX_VIDEOS = 2;
export const MAX_PRESENTATION = 400;
export const VIDEO_MAX_SECONDS = 30;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export const DAYS = [
  ['lundi', 'Lundi'],
  ['mardi', 'Mardi'],
  ['mercredi', 'Mercredi'],
  ['jeudi', 'Jeudi'],
  ['vendredi', 'Vendredi'],
  ['samedi', 'Samedi'],
  ['dimanche', 'Dimanche'],
];

export function defaultHours() {
  return Object.fromEntries(DAYS.map(([d]) => [d, { open: false, from: '09:00', to: '18:00' }]));
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** « 9h », « 9:5 », « 18 » → « 09:00 », « 09:05 », « 18:00 ». Le reste est rendu tel quel. */
export function normaliseTime(value) {
  // Même règle que `normaliseTime` de l'app (shop-profile.ts) : « 9h » → 09:00, « 9:5 » → 09:05.
  const m = String(value)
    .trim()
    .replace(/h$/, ':00')
    .replace('h', ':')
    .match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return String(value).trim();
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2] ?? '0')).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Erreurs par jour : heure mal formée, ou fermeture avant l'ouverture. */
export function validateHours(hours) {
  const errors = {};
  for (const [day] of DAYS) {
    const h = hours[day];
    if (!h.open) continue;
    if (!TIME_RE.test(h.from) || !TIME_RE.test(h.to)) errors[day] = 'Heures au format 09:00';
    else if (toMinutes(h.to) <= toMinutes(h.from)) errors[day] = 'La fermeture suit l’ouverture';
  }
  return errors;
}

/** Une vidéo est-elle acceptable ? Renvoie un message de refus, ou `null`. */
export function videoRefusal(file, seconds) {
  if (file.size > VIDEO_MAX_BYTES) return 'Vidéo trop lourde (50 Mo au maximum).';
  if (seconds > VIDEO_MAX_SECONDS) return 'Vidéo trop longue (30 secondes au maximum).';
  return null;
}

/** La durée d'une vidéo, lue dans le navigateur (rien n'est envoyé). */
function readDuration(url) {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(el.duration);
    el.onerror = () => resolve(Number.NaN);
    el.src = url;
  });
}

export default function Showcase({ notify }) {
  const [presentation, setPresentation] = useState('');
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoError, setVideoError] = useState(null);
  const [hours, setHours] = useState(defaultHours);
  const [errors, setErrors] = useState({});
  const urls = useRef([]);

  // Les aperçus sont des URL locales : on les libère à la fermeture de la page.
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const addPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || photos.length >= MAX_PHOTOS) return;
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setPhotos((list) => [...list, url]);
  };

  const addVideo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || videos.length >= MAX_VIDEOS) return;
    const url = URL.createObjectURL(file);
    const seconds = await readDuration(url);
    const refusal = videoRefusal(file, seconds);
    if (refusal) {
      URL.revokeObjectURL(url);
      setVideoError(refusal);
      return;
    }
    urls.current.push(url);
    setVideoError(null);
    setVideos((list) => [...list, url]);
  };

  const setDay = (day, change) => {
    setHours((h) => ({ ...h, [day]: { ...h[day], ...change } }));
    setErrors((e) => ({ ...e, [day]: undefined }));
  };

  const save = () => {
    const found = validateHours(hours);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notify('Corrigez les horaires signalés.');
      return;
    }
    notify('Vitrine enregistrée — c’est ce que vos clients voient sur votre fiche.');
  };

  return (
    <section className="tkpro-card" data-testid="showcase">
      <div className="tkpro-card-head">
        <h2>Ma vitrine</h2>
        <span className="tkpro-note-inline">Ce que vos clients voient sur votre fiche</span>
      </div>

      <label className="tkpro-input" style={{ padding: '0 18px' }}>
        <span>Présentation</span>
      </label>
      <textarea
        className="tkpro-textarea"
        value={presentation}
        maxLength={MAX_PRESENTATION}
        onChange={(e) => setPresentation(e.target.value.slice(0, MAX_PRESENTATION))}
        placeholder="Parlez de votre commerce en quelques lignes"
        aria-label="Présentation du commerce"
        data-testid="showcase-presentation"
      />
      <div
        className="tkpro-note-inline"
        style={{ display: 'block', textAlign: 'right', padding: '4px 18px 14px' }}
      >
        {presentation.length}/{MAX_PRESENTATION}
      </div>

      <div className="tkpro-card-head">
        <h2>
          Photos{' '}
          <small>
            {photos.length}/{MAX_PHOTOS}
          </small>
        </h2>
      </div>
      <div className="tkpro-media" style={{ marginBottom: 14 }}>
        {photos.map((u) => (
          <figure key={u}>
            <img src={u} alt="Photo du commerce" />
            <button
              type="button"
              aria-label="Retirer la photo"
              onClick={() => setPhotos((l) => l.filter((x) => x !== u))}
            >
              ×
            </button>
          </figure>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <label className="tkpro-media-add">
            + Photo
            <input
              type="file"
              accept="image/*"
              onChange={addPhoto}
              data-testid="showcase-add-photo"
            />
          </label>
        ) : null}
      </div>

      <div className="tkpro-card-head">
        <h2>
          Vidéos{' '}
          <small>
            {videos.length}/{MAX_VIDEOS}
          </small>
        </h2>
        <span className="tkpro-note-inline">30 secondes et 50 Mo au maximum</span>
      </div>
      <div className="tkpro-media" style={{ marginBottom: 6 }}>
        {videos.map((u) => (
          <figure key={u}>
            <video src={u} muted playsInline />
            <button
              type="button"
              aria-label="Retirer la vidéo"
              onClick={() => setVideos((l) => l.filter((x) => x !== u))}
            >
              ×
            </button>
          </figure>
        ))}
        {videos.length < MAX_VIDEOS ? (
          <label className="tkpro-media-add">
            + Vidéo
            <input
              type="file"
              accept="video/*"
              onChange={addVideo}
              data-testid="showcase-add-video"
            />
          </label>
        ) : null}
      </div>
      {videoError ? (
        <p className="tkpro-error" role="alert" style={{ padding: '0 18px 12px' }}>
          {videoError}
        </p>
      ) : null}

      <div className="tkpro-card-head">
        <h2>Horaires</h2>
        <span className="tkpro-note-inline">Fermés tant que vous ne les réglez pas</span>
      </div>
      <div className="tkpro-hours">
        {DAYS.map(([day, label]) => {
          const h = hours[day];
          return (
            <div key={day}>
              <div className="day">
                <b>{label}</b>
                <label>
                  <input
                    type="checkbox"
                    checked={h.open}
                    onChange={(e) => setDay(day, { open: e.target.checked })}
                    aria-label={`${label} ouvert`}
                    data-testid={`hours-${day}-open`}
                  />{' '}
                  {h.open ? 'Ouvert' : 'Fermé'}
                </label>
                {h.open ? (
                  <span className="range">
                    <input
                      type="text"
                      value={h.from}
                      onChange={(e) => setDay(day, { from: e.target.value })}
                      onBlur={() => setDay(day, { from: normaliseTime(h.from) })}
                      aria-label={`${label} ouverture`}
                      aria-invalid={errors[day] ? 'true' : undefined}
                      data-testid={`hours-${day}-from`}
                    />
                    à
                    <input
                      type="text"
                      value={h.to}
                      onChange={(e) => setDay(day, { to: e.target.value })}
                      onBlur={() => setDay(day, { to: normaliseTime(h.to) })}
                      aria-label={`${label} fermeture`}
                      aria-invalid={errors[day] ? 'true' : undefined}
                      data-testid={`hours-${day}-to`}
                    />
                  </span>
                ) : (
                  <span />
                )}
              </div>
              {errors[day] ? (
                <p className="tkpro-error" role="alert" data-testid={`hours-${day}-error`}>
                  {errors[day]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="tkpro-profile-foot" style={{ padding: '0 18px 18px' }}>
        <button
          type="button"
          className="tkpro-btn primary"
          onClick={save}
          data-testid="showcase-save"
        >
          Enregistrer la vitrine
        </button>
        <span className="tkpro-note-inline">
          Démonstration : rien n’est encore transmis à un serveur.
        </span>
      </div>
    </section>
  );
}
