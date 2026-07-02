const PHOTOPRISM_API_URL = process.env.PHOTOPRISM_API_URL || 'http://photoprism:8080';
const PHOTOPRISM_API_KEY = process.env.PHOTOPRISM_API_KEY || '';

export interface PhotoPrismPhoto {
  id: string;
  uid: string;
  type: string;
  name: string;
  hash: string;
  width: number;
  height: number;
  orientation: number;
  colors: string;
  quality: number;
  ratio: string;
  size: number;
  bytes: number;
  modified: string;
  created: string;
  imported: string;
}

export interface PhotoPrismImportResponse {
  id: string;
  photo: PhotoPrismPhoto;
}

export async function importPhotoToPhotoPrism(
  s3Key: string,
  filename: string,
  eventId: string,
): Promise<PhotoPrismPhoto | null> {
  if (!isPhotoPrismConfigured()) {
    console.warn('PhotoPrism is not configured. Skipping import.');
    return null;
  }

  try {
    const response = await fetch(`${PHOTOPRISM_API_URL}/api/v1/photos/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PHOTOPRISM_API_KEY}`,
      },
      body: JSON.stringify({
        method: 'upload',
        files: [
          {
            name: filename,
            hash: s3Key.split('/').pop()?.replace('.', ''),
            originalPath: s3Key,
          },
        ],
        meta: {
          eventId,
        },
      }),
    });

    if (!response.ok) {
      console.error('PhotoPrism import failed:', await response.text());
      return null;
    }

    const data = (await response.json()) as PhotoPrismImportResponse;
    return data.photo;
  } catch (error) {
    console.error('PhotoPrism import error:', error);
    return null;
  }
}

export async function getPhotoPrismThumbnailUrl(photoId: string): Promise<string | null> {
  if (!isPhotoPrismConfigured()) {
    return null;
  }

  return `${PHOTOPRISM_API_URL}/api/v1/photos/${photoId}/tile/500`;
}

export async function getPhotoPrismDownloadUrl(photoId: string): Promise<string | null> {
  if (!isPhotoPrismConfigured()) {
    return null;
  }

  try {
    const response = await fetch(`${PHOTOPRISM_API_URL}/api/v1/photos/${photoId}/download`, {
      headers: {
        Authorization: `Bearer ${PHOTOPRISM_API_KEY}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  } catch {
    return null;
  }
}

export function isPhotoPrismConfigured(): boolean {
  return !!PHOTOPRISM_API_KEY;
}
