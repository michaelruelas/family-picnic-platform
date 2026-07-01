'use client';

import Image from 'next/image';
import PhotoReactionButton from './PhotoReactionButton';

interface PhotoCardProps {
  photo: {
    id: string;
    caption: string | null;
    url: string;
    thumbnailUrl: string | null;
    createdAt: Date;
    reactions: {
      reaction: string;
      userId: string;
    }[];
  };
  eventName: string;
  userId?: string;
}

export default function PhotoCard({ photo, eventName, userId }: PhotoCardProps) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-stone-100">
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
      <PhotoReactionButton photoId={photo.id} reactions={photo.reactions} userId={userId} />
    </div>
  );
}
