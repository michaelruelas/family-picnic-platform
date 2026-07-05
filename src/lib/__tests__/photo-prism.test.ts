import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('isPhotoPrismConfigured', () => {
  it('returns false when PHOTOPRISM_API_KEY is not set', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', '');
    const { isPhotoPrismConfigured } = await import('../photo-prism');
    expect(isPhotoPrismConfigured()).toBe(false);
  });

  it('returns true when PHOTOPRISM_API_KEY is set', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'some-api-key');
    const { isPhotoPrismConfigured } = await import('../photo-prism');
    expect(isPhotoPrismConfigured()).toBe(true);
  });
});

describe('importPhotoToPhotoPrism', () => {
  it('returns null when not configured', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', '');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { importPhotoToPhotoPrism } = await import('../photo-prism');
    const result = await importPhotoToPhotoPrism('photos/abc.jpg', 'photo.jpg', 'event-1');
    expect(result).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith('PhotoPrism is not configured. Skipping import.');
    consoleWarn.mockRestore();
  });

  it('returns null when PhotoPrism API returns non-ok', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });
    vi.stubGlobal('fetch', mockFetch);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { importPhotoToPhotoPrism } = await import('../photo-prism');
    const result = await importPhotoToPhotoPrism('photos/test.jpg', 'test.jpg', 'event-1');
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0]![0];
    expect(callUrl).toContain('/api/v1/photos/import');
    consoleError.mockRestore();
  });

  it('returns null when fetch throws', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { importPhotoToPhotoPrism } = await import('../photo-prism');
    const result = await importPhotoToPhotoPrism('photos/test.jpg', 'test.jpg', 'event-1');
    expect(result).toBeNull();
    consoleError.mockRestore();
  });

  it('returns photo on successful import', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    const mockPhoto = { id: 'photo-1', uid: 'abc', name: 'test.jpg', hash: 'abc123' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'import-1', photo: mockPhoto }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const { importPhotoToPhotoPrism } = await import('../photo-prism');
    const result = await importPhotoToPhotoPrism('photos/test.jpg', 'test.jpg', 'event-1');
    expect(result).toEqual(mockPhoto);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.meta.eventId).toBe('event-1');
  });
});

describe('getPhotoPrismThumbnailUrl', () => {
  it('returns null when not configured', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', '');
    const { getPhotoPrismThumbnailUrl } = await import('../photo-prism');
    const result = await getPhotoPrismThumbnailUrl('photo-1');
    expect(result).toBeNull();
  });

  it('returns thumbnail URL when configured', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    vi.stubEnv('PHOTOPRISM_API_URL', 'https://photos.example.com');
    const { getPhotoPrismThumbnailUrl } = await import('../photo-prism');
    const result = await getPhotoPrismThumbnailUrl('photo-1');
    expect(result).toBe('https://photos.example.com/api/v1/photos/photo-1/tile/500');
  });

  it('uses default URL when PHOTOPRISM_API_URL is not set', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    vi.stubEnv('PHOTOPRISM_API_URL', '');
    const { getPhotoPrismThumbnailUrl } = await import('../photo-prism');
    const result = await getPhotoPrismThumbnailUrl('photo-1');
    expect(result).toContain('http://photoprism:8080');
  });
});

describe('getPhotoPrismDownloadUrl', () => {
  it('returns null when not configured', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', '');
    const { getPhotoPrismDownloadUrl } = await import('../photo-prism');
    const result = await getPhotoPrismDownloadUrl('photo-1');
    expect(result).toBeNull();
  });

  it('returns download URL when fetch succeeds', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/photo.jpg' }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const { getPhotoPrismDownloadUrl } = await import('../photo-prism');
    const result = await getPhotoPrismDownloadUrl('photo-1');
    expect(result).toBe('https://cdn.example.com/photo.jpg');
  });

  it('returns null when download fetch returns non-ok', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', mockFetch);
    const { getPhotoPrismDownloadUrl } = await import('../photo-prism');
    const result = await getPhotoPrismDownloadUrl('photo-1');
    expect(result).toBeNull();
  });

  it('returns null when download fetch throws', async () => {
    vi.stubEnv('PHOTOPRISM_API_KEY', 'key123');
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);
    const { getPhotoPrismDownloadUrl } = await import('../photo-prism');
    const result = await getPhotoPrismDownloadUrl('photo-1');
    expect(result).toBeNull();
  });
});
