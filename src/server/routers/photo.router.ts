import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';

const VALID_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'];

export const photoRouter = router({
  list: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.photo.findMany({
        where: { eventId: input.eventId },
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

  getUploadUrl: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        filename: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const presignedUrl = `/api/photo-upload?eventId=${input.eventId}&filename=${input.filename}`;
      return { uploadUrl: presignedUrl };
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

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
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
});
