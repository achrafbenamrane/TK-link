import {
  buildPrompt,
  cleanBrief,
  falInput,
  parseStatus,
  parseSubmit,
  resultUrl,
  storageType,
} from '../functions/_shared/fal';

/**
 * Les visuels IA des commerces (fal.ai, décision du 13/11/2026). Ce qui se teste sans clé : le texte
 * envoyé au modèle, et la lecture prudente des réponses.
 */
describe('le texte envoyé au modèle', () => {
  it('décrit le commerce selon sa catégorie, sans texte incrusté ni visage', () => {
    const p = buildPrompt('image', 'Le Petit Toulousain', 'restauration', 'viennoiseries du matin');
    expect(p).toContain('"Le Petit Toulousain"');
    expect(p).toContain('bakery');
    expect(p).toContain('viennoiseries du matin');
    expect(p).toMatch(/No text, no logos, no watermark, no identifiable faces\.$/);
  });

  it('une vidéo demande un mouvement de caméra de 5 secondes', () => {
    expect(buildPrompt('video', 'Studio', 'beaute', '')).toContain('cinematic camera move');
    expect(falInput('video', 'x')).toEqual({ prompt: 'x', duration: '5', aspect_ratio: '16:9' });
  });

  it('une catégorie inconnue retombe sur une vitrine générique', () => {
    expect(buildPrompt('image', 'X', 'inconnue', '')).toContain('local service business');
  });

  it('nettoie la description du commerçant : une ligne, 300 caractères', () => {
    expect(cleanBrief('  pains\n\tet  gâteaux ')).toBe('pains et gâteaux');
    expect(cleanBrief('x'.repeat(400))).toHaveLength(300);
    expect(cleanBrief(12)).toBe('');
  });

  it('les images gardent le filtre de contenu actif', () => {
    expect(falInput('image', 'x')).toMatchObject({ enable_safety_checker: true, num_images: 1 });
  });
});

describe('les réponses de fal.ai', () => {
  const submit = {
    request_id: 'req_1',
    status_url: 'https://queue.fal.run/fal-ai/flux/requests/req_1/status',
    response_url: 'https://queue.fal.run/fal-ai/flux/requests/req_1',
  };

  it('lit une soumission', () => {
    expect(parseSubmit(submit)).toEqual({
      requestId: 'req_1',
      statusUrl: submit.status_url,
      responseUrl: submit.response_url,
    });
  });

  it('refuse une adresse hors de queue.fal.run : la clé y serait envoyée', () => {
    expect(parseSubmit({ ...submit, status_url: 'https://evil.example/status' })).toBeNull();
    expect(parseSubmit({ ...submit, request_id: 1 })).toBeNull();
  });

  it('suit l’état de la génération', () => {
    expect(parseStatus({ status: 'IN_QUEUE' })).toBe('en_cours');
    expect(parseStatus({ status: 'IN_PROGRESS' })).toBe('en_cours');
    expect(parseStatus({ status: 'COMPLETED' })).toBe('termine');
    expect(parseStatus({ status: 'FAILED' })).toBe('echec');
    expect(parseStatus(null)).toBe('echec');
  });

  it('trouve le fichier produit', () => {
    expect(resultUrl('image', { images: [{ url: 'https://fal.media/a.jpg' }] })).toBe(
      'https://fal.media/a.jpg',
    );
    expect(resultUrl('video', { video: { url: 'https://fal.media/v.mp4' } })).toBe(
      'https://fal.media/v.mp4',
    );
  });

  it('une image écartée par le filtre de contenu n’est pas publiée', () => {
    expect(
      resultUrl('image', {
        images: [{ url: 'https://fal.media/a.jpg' }],
        has_nsfw_concepts: [true],
      }),
    ).toBeNull();
    expect(resultUrl('image', { images: [] })).toBeNull();
  });

  it('range le fichier sous le bon type', () => {
    expect(storageType('video', 'application/octet-stream')).toEqual({
      ext: 'mp4',
      mime: 'video/mp4',
    });
    expect(storageType('image', 'image/png')).toEqual({ ext: 'png', mime: 'image/png' });
    expect(storageType('image', null)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
  });
});
