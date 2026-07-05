import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockState = vi.hoisted(() => {
  const imageInstance: {
    onload: (() => void) | null;
    onerror: (() => void) | null;
    naturalWidth: number;
    naturalHeight: number;
    src: string;
  } = {
    onload: null,
    onerror: null,
    naturalWidth: 800,
    naturalHeight: 600,
    src: '',
  };

  const canvasContext = { drawImage: () => {} };

  const canvasInstance: {
    width: number;
    height: number;
    getContext: () => typeof canvasContext | null;
    toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => void;
  } = {
    width: 0,
    height: 0,
    getContext: () => canvasContext,
    toBlob: () => {},
  };

  return { imageInstance, canvasInstance, canvasContext };
});

beforeEach(() => {
  mockState.imageInstance.onload = null;
  mockState.imageInstance.onerror = null;
  mockState.imageInstance.naturalWidth = 800;
  mockState.imageInstance.naturalHeight = 600;
  mockState.imageInstance.src = '';

  mockState.canvasInstance.width = 0;
  mockState.canvasInstance.height = 0;
  mockState.canvasInstance.getContext = vi.fn(() => mockState.canvasContext);
  mockState.canvasInstance.toBlob = vi.fn();

  mockState.canvasContext.drawImage = vi.fn();

  vi.stubGlobal('Image', function MockImage() {
    return mockState.imageInstance;
  } as unknown as typeof Image);

  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      return mockState.canvasInstance as unknown as HTMLElement;
    }
    return document.createElement(tagName);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getImageDimensions', () => {
  it('returns width and height from a loaded image', async () => {
    const { getImageDimensions } = await import('../exif-stripper');
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });

    const promise = getImageDimensions(file);
    mockState.imageInstance.onload!();

    const result = await promise;
    expect(result).toEqual({ width: 800, height: 600 });
  });

  it('rejects when image fails to load', async () => {
    const { getImageDimensions } = await import('../exif-stripper');
    const file = new File([''], 'bad.jpg', { type: 'image/jpeg' });

    const promise = getImageDimensions(file);
    mockState.imageInstance.onerror!();

    await expect(promise).rejects.toThrow('Could not load image');
  });

  it('revokes the blob URL on load', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const { getImageDimensions } = await import('../exif-stripper');
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });

    const promise = getImageDimensions(file);
    mockState.imageInstance.onload!();
    await promise;

    expect(revokeSpy).toHaveBeenCalled();
  });
});

describe('stripExifFromFile', () => {
  it('draws the image on canvas and resolves with blob and dimensions', async () => {
    const fakeBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    mockState.canvasInstance.toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(fakeBlob);
    });

    const { stripExifFromFile } = await import('../exif-stripper');
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });

    const promise = stripExifFromFile(file);
    mockState.imageInstance.onload!();

    const result = await promise;
    expect(result).toEqual({
      blob: fakeBlob,
      width: 800,
      height: 600,
    });
    expect(mockState.canvasContext.drawImage).toHaveBeenCalledWith(mockState.imageInstance, 0, 0);
    expect(mockState.canvasInstance.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.95,
    );
  });

  it('rejects when canvas context is null', async () => {
    mockState.canvasInstance.getContext = vi.fn(() => null);

    const { stripExifFromFile } = await import('../exif-stripper');
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });

    const promise = stripExifFromFile(file);
    mockState.imageInstance.onload!();

    await expect(promise).rejects.toThrow('Could not get canvas context');
  });

  it('rejects when toBlob returns null', async () => {
    mockState.canvasInstance.toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(null);
    });

    const { stripExifFromFile } = await import('../exif-stripper');
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });

    const promise = stripExifFromFile(file);
    mockState.imageInstance.onload!();

    await expect(promise).rejects.toThrow('Could not create blob from canvas');
  });

  it('rejects when image fails to load', async () => {
    const { stripExifFromFile } = await import('../exif-stripper');
    const file = new File([''], 'bad.jpg', { type: 'image/jpeg' });

    const promise = stripExifFromFile(file);
    mockState.imageInstance.onerror!();

    await expect(promise).rejects.toThrow('Could not load image');
  });

  it('revokes the blob URL on load', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const fakeBlob = new Blob(['data'], { type: 'image/jpeg' });
    mockState.canvasInstance.toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(fakeBlob);
    });

    const { stripExifFromFile } = await import('../exif-stripper');
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });

    const promise = stripExifFromFile(file);
    mockState.imageInstance.onload!();
    await promise;

    expect(revokeSpy).toHaveBeenCalled();
  });
});
