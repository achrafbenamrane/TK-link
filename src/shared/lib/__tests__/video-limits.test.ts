import { checkVideo, VIDEO_LIMITS, VIDEO_REFUSAL } from '../image-picker';

const MB = 1024 * 1024;

describe('checkVideo — le format standard de la vidéo du magasin', () => {
  it('accepte une vidéo courte et légère, ou dont on ne connaît pas encore la taille', () => {
    expect(checkVideo({ duration: 12_000, fileSize: 8 * MB })).toEqual({ ok: true });
    expect(checkVideo({})).toEqual({ ok: true });
    expect(checkVideo({ duration: null, fileSize: null })).toEqual({ ok: true });
  });

  it('refuse au-delà de 30 secondes, mais accepte pile 30', () => {
    expect(checkVideo({ duration: VIDEO_LIMITS.maxSeconds * 1000 })).toEqual({ ok: true });
    expect(checkVideo({ duration: VIDEO_LIMITS.maxSeconds * 1000 + 1 })).toEqual({
      ok: false,
      reason: 'trop_longue',
    });
  });

  it('refuse au-delà de 50 Mo, mais accepte pile 50', () => {
    expect(checkVideo({ fileSize: VIDEO_LIMITS.maxMegabytes * MB })).toEqual({ ok: true });
    expect(checkVideo({ fileSize: VIDEO_LIMITS.maxMegabytes * MB + 1 })).toEqual({
      ok: false,
      reason: 'trop_lourde',
    });
  });

  it('dit la limite dans le message de refus', () => {
    expect(VIDEO_REFUSAL.trop_longue).toMatch(/30 secondes/);
    expect(VIDEO_REFUSAL.trop_lourde).toMatch(/50 Mo/);
  });
});
