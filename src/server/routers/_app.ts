import { router } from '~/lib/trpc';
import { authRouter } from './auth.router';
import { householdRouter } from './household.router';
import { userRouter } from './user.router';
import { eventRouter } from './event.router';
import { invitationRouter } from './invitation.router';
import { rsvpRouter } from './rsvp.router';
import { potluckRouter } from './potluck.router';
import { photoRouter } from './photo.router';
import { communicationRouter } from './communication.router';
import { adminRouter } from './admin.router';
import { dependentRouter } from './dependent.router';

export const appRouter = router({
  auth: authRouter,
  household: householdRouter,
  user: userRouter,
  event: eventRouter,
  invitation: invitationRouter,
  rsvp: rsvpRouter,
  potluck: potluckRouter,
  photo: photoRouter,
  communication: communicationRouter,
  admin: adminRouter,
  dependent: dependentRouter,
});

export type AppRouter = typeof appRouter;
