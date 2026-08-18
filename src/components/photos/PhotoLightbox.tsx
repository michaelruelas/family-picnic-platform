'use client';

import { useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import PhotoReactionButton from '~/components/PhotoReactionButton';

export interface LightboxPhoto {
  id: string;
  caption: string | null;
  url: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  uploadedByUserId: string;
  uploadedBy?: { id: string; name: string } | null;
  reactions: { reaction: string; userId: string }[];
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  userId?: string;
}

export default function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  userId,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const onCloseRef = useRef(onClose);
  const onNavigateRef = useRef(onNavigate);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    onNavigateRef.current = onNavigate;
  }, [onClose, onNavigate]);

  const total = photos.length;
  const hasPrev = total > 1 && currentIndex > 0;
  const hasNext = total > 1 && currentIndex < total - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigateRef.current(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < total - 1) {
        onNavigateRef.current(currentIndex + 1);
      }
    },
    [currentIndex, total],
  );

  useEffect(() => {
    if (!photo) return;
    previousActiveElement.current = document.activeElement;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [photo, handleKeyDown]);

  if (!photo) return null;
  if (typeof window === 'undefined') return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || 'Photo'}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-sm bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {hasPrev && (
        <button
          onClick={() => onNavigate(currentIndex - 1)}
          aria-label="Previous photo"
          className="absolute top-1/2 left-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-sm bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {hasNext && (
        <button
          onClick={() => onNavigate(currentIndex + 1)}
          aria-label="Next photo"
          className="absolute top-1/2 right-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-sm bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div className="relative max-h-[80vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <Image
          src={photo.url}
          alt={photo.caption || 'Photo'}
          width={1600}
          height={1200}
          className="max-h-[80vh] w-auto max-w-[90vw] rounded-sm object-contain"
          sizes="90vw"
          priority
        />
      </div>

      <div className="mt-4 max-w-[90vw] text-center" onClick={(e) => e.stopPropagation()}>
        {photo.caption && <p className="text-base text-white">{photo.caption}</p>}
        {photo.uploadedBy && (
          <p className="mt-1 text-sm text-white/60">Uploaded by {photo.uploadedBy.name}</p>
        )}
        <div className="mt-3 flex justify-center">
          <PhotoReactionButton photoId={photo.id} reactions={photo.reactions} userId={userId} />
        </div>
        {total > 1 && (
          <p className="mt-2 text-xs text-white/50">
            {currentIndex + 1} of {total}
          </p>
        )}
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} aria-hidden="true" />
    </div>
  );

  return createPortal(content, document.body);
}
