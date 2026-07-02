import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { generatePresignedUploadUrl, isS3Configured } from '~/lib/s3';
import { importPhotoToPhotoPrism, isPhotoPrismConfigured } from '~/lib/photo-prism';

const VALID_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'];

async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

export const photoRouter = router({
  list: protectedProcedure.input(z.object({ eventId: z.string() })).query(async ({ input }) => {
    return prisma.photo.findMany({
      where: { eventId: input.eventId, deletedAt: null },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        eventId: z.string().optional(),
        uploadedByUserId: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        reaction: z.string().optional(),
        sortBy: z.enum(['newest', 'most_reacted']).optional().default('newest'),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
    )
    .query(async ({ input }) => {
      const where: Record<string, unknown> = { deletedAt: null };

      if (input.query) {
        where.OR = [
          { caption: { contains: input.query, mode: 'insensitive' } },
          { uploadedBy: { name: { contains: input.query, mode: 'insensitive' } } },
        ];
      }

      if (input.eventId) {
        where.eventId = input.eventId;
      }

      if (input.uploadedByUserId) {
        where.uploadedByUserId = input.uploadedByUserId;
      }

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) {
          (where.createdAt as Record<string, Date>).gte = input.dateFrom;
        }
        if (input.dateTo) {
          (where.createdAt as Record<string, Date>).lte = input.dateTo;
        }
      }

      if (input.reaction) {
        where.reactions = {
          some: { reaction: input.reaction },
        };
      }

      const orderBy =
        input.sortBy === 'most_reacted'
          ? { reactions: { _count: 'desc' as const } }
          : { createdAt: 'desc' as const };

      const photos = await prisma.photo.findMany({
        where,
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          reactions: true,
          _count: {
            select: { reactions: true },
          },
        },
        orderBy,
        take: (input.limit || 50) + 1,
        ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      });

      const hasMore = photos.length > (input.limit || 50);
      const items = hasMore ? photos.slice(0, -1) : photos;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items,
        nextCursor,
        hasMore,
      };
    }),

  getUploadUrl: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        filename: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isS3Configured()) {
        throw new Error('S3 is not configured. Please set AWS credentials.');
      }

      const { uploadUrl, key, expiresAt } = await generatePresignedUploadUrl(
        input.eventId,
        ctx.session.user.id,
        input.filename,
        input.contentType,
      );

      return { uploadUrl, key, expiresAt };
    }),

  addReaction: protectedProcedure
    .input(
      z.object({
        photoId: z.string(),
        reaction: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!VALID_REACTIONS.includes(input.reaction)) {
        throw new Error('Invalid reaction emoji');
      }

      const photo = await prisma.photo.findUnique({
        where: { id: input.photoId },
      });

      if (!photo) {
        throw new Error('Photo not found');
      }

      const existingReaction = await prisma.photoReaction.findUnique({
        where: {
          photoId_userId_reaction: {
            photoId: input.photoId,
            userId: ctx.session.user.id,
            reaction: input.reaction,
          },
        },
      });

      if (existingReaction) {
        return { action: 'already_exists' as const };
      }

      await prisma.photoReaction.create({
        data: {
          photoId: input.photoId,
          userId: ctx.session.user.id,
          reaction: input.reaction,
        },
      });

      return { action: 'added' as const };
    }),

  removeReaction: protectedProcedure
    .input(
      z.object({
        photoId: z.string(),
        reaction: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingReaction = await prisma.photoReaction.findUnique({
        where: {
          photoId_userId_reaction: {
            photoId: input.photoId,
            userId: ctx.session.user.id,
            reaction: input.reaction,
          },
        },
      });

      if (!existingReaction) {
        return { action: 'not_found' as const };
      }

      await prisma.photoReaction.delete({
        where: { id: existingReaction.id },
      });

      return { action: 'removed' as const };
    }),

  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        photoPrismId: z.string(),
        caption: z.string().optional(),
        url: z.string(),
        thumbnailUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user || !user.householdId) {
        throw new Error('User must belong to a household');
      }

      return prisma.photo.create({
        data: {
          eventId: input.eventId,
          uploadedByUserId: ctx.session.user.id,
          householdId: user.householdId,
          photoPrismId: input.photoPrismId,
          caption: input.caption,
          url: input.url,
          thumbnailUrl: input.thumbnailUrl,
        },
      });
    }),

  confirmUpload: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        s3Key: z.string(),
        filename: z.string(),
        caption: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user || !user.householdId) {
        throw new Error('User must belong to a household');
      }

      let photoPrismId = input.s3Key;
      const thumbnailUrl = input.s3Key;

      if (isPhotoPrismConfigured()) {
        const photoPrismPhoto = await importPhotoToPhotoPrism(
          input.s3Key,
          input.filename,
          input.eventId,
        );
        if (photoPrismPhoto) {
          photoPrismId = photoPrismPhoto.id;
        }
      }

      return prisma.photo.create({
        data: {
          eventId: input.eventId,
          uploadedByUserId: ctx.session.user.id,
          householdId: user.householdId,
          photoPrismId,
          caption: input.caption,
          url: photoPrismId,
          thumbnailUrl,
        },
      });
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return prisma.photo.findUnique({
      where: { id: input.id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        reactions: true,
        household: true,
      },
    });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const photo = await prisma.photo.findUnique({
        where: { id: input.id },
        include: { event: true },
      });

      if (!photo) {
        throw new Error('Photo not found');
      }

      const userIsAdmin = await isAdmin(ctx.session.user.id);
      const isUploader = photo.uploadedByUserId === ctx.session.user.id;

      if (!userIsAdmin && !isUploader) {
        throw new Error('Only the uploader or an admin can delete this photo');
      }

      await prisma.photo.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: ctx.session.user.id,
          eventId: photo.eventId,
          action: 'PHOTO_DELETE',
          oldValue: { id: photo.id, caption: photo.caption, url: photo.url },
          newValue: { deletedAt: new Date().toISOString() },
        },
      });

      return { success: true };
    }),
});
