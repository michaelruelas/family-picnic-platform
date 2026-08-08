import PhotoCard from '~/components/PhotoCard';
import EmptyState from '~/components/ui/EmptyState';

export interface GalleryPhoto {
  id: string;
  caption: string | null;
  url: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  uploadedByUserId: string;
  reactions: { reaction: string; userId: string }[];
}

export interface EventGallerySectionProps {
  photos: GalleryPhoto[];
  eventName: string;
  userId: string | null;
  userRole: string | null;
  /**
   * FPP-7: "No date range filter (per QUB-27)." Photos are rendered
   * in `createdAt` descending order — the server page is responsible
   * for any ordering / trimming. The `take` happens server-side.
   */
}

/**
 * FPP-46 / FPP-7: Gallery tab content. Renders the event's photo
 * grid (no date range filter, per QUB-27) with a friendly empty
 * state when there are no photos yet.
 */
export function EventGallerySection({
  photos,
  eventName,
  userId,
  userRole,
}: EventGallerySectionProps) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-terracotta text-sm font-semibold tracking-widest uppercase">
            Captured moments
          </p>
          <h2 className="font-display text-foreground mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            Photos
          </h2>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="photo"
            title="No photos yet"
            description="Photos from this event will appear here once shared."
          />
        </div>
      ) : (
        <div
          className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3"
          data-testid="event-gallery-grid"
        >
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              eventName={eventName}
              userId={userId ?? undefined}
              userRole={userRole ?? undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
