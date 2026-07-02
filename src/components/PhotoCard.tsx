'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PhotoReactionButton from './PhotoReactionButton';

interface PhotoCardProps {
  photo: {
    id: string;
    caption: string | null;
    url: string;
    thumbnailUrl: string | null;
    createdAt: Date;
    uploadedByUserId: string;
    reactions: {
      reaction: string;
      userId: string;
    }[];
  };
  eventName: string;
  userId?: string;
  userRole?: string;
}

export default function PhotoCard({ photo, eventName, userId, userRole }: PhotoCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const canDelete = userId && (userRole === 'ADMIN' || photo.uploadedByUserId === userId);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/photo-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setShowMenu(false);
    }
  };

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

      {canDelete && (
        <div className="absolute top-2 right-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 z-10 w-32 rounded-lg bg-white py-1 shadow-lg ring-1 ring-stone-200">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-4 shadow-lg">
            <p className="mb-3 text-sm font-medium text-stone-900">Delete this photo?</p>
            <p className="mb-3 text-xs text-stone-500">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
