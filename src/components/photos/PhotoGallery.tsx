'use client';

import { useState } from 'react';
import PhotoCard from '~/components/PhotoCard';
import PhotoLightbox, { LightboxPhoto } from './PhotoLightbox';

interface PhotoGalleryProps {
  photos: LightboxPhoto[];
  eventName: string;
  userId?: string;
  userRole?: string;
}

export default function PhotoGallery({ photos, eventName, userId, userRole }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            eventName={eventName}
            userId={userId}
            userRole={userRole}
            onOpen={() => setLightboxIndex(index)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          userId={userId}
        />
      )}
    </>
  );
}
