'use client';

import { useState } from 'react';
import Image from 'next/image';
import PhotoReactionButton from '~/components/PhotoReactionButton';

interface Photo {
  id: string;
  caption: string | null;
  url: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  uploadedByUserId: string;
  uploadedBy?: {
    id: string;
    name: string;
  };
  reactions: {
    reaction: string;
    userId: string;
  }[];
}

interface PhotoGridProps {
  photos: Photo[];
  eventName: string;
  userId?: string;
  userRole?: string;
  onDelete?: (photoId: string) => void;
}

export default function PhotoGrid({
  photos,
  eventName,
  userId,
  userRole: _userRole,
  onDelete: _onDelete,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  if (photos.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-stone-100"
            onClick={() => setSelectedPhoto(photo)}
          >
            <Image
              src={photo.thumbnailUrl || photo.url}
              alt={photo.caption || `${eventName} photo`}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {photo.caption && (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="p-2 text-sm text-white">{photo.caption}</p>
              </div>
            )}
            <div className="absolute bottom-2 left-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <PhotoReactionButton
                photoId={photo.id}
                reactions={photo.reactions}
                userId={userId}
                compact
              />
            </div>
          </div>
        ))}
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              className="absolute -top-10 right-0 text-white hover:text-stone-300"
              onClick={() => setSelectedPhoto(null)}
            >
              Close
            </button>
            <Image
              src={selectedPhoto.url}
              alt={selectedPhoto.caption || `${eventName} photo`}
              width={1200}
              height={800}
              className="max-h-[85vh] w-auto rounded-lg object-contain"
            />
            {selectedPhoto.caption && (
              <p className="mt-4 text-center text-white">{selectedPhoto.caption}</p>
            )}
            {selectedPhoto.uploadedBy && (
              <p className="mt-2 text-center text-sm text-stone-400">
                Uploaded by {selectedPhoto.uploadedBy.name}
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <PhotoReactionButton
                photoId={selectedPhoto.id}
                reactions={selectedPhoto.reactions}
                userId={userId}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
