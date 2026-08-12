import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, getEnabledOAuthProviders } from '~/lib/auth';
import { SIGNED_IN_REDIRECT } from '~/lib/constants';
import LoginForm from '~/components/LoginForm';

export default async function UnauthenticatedPage({
  showBackLink = false,
}: {
  showBackLink?: boolean;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect(SIGNED_IN_REDIRECT);
  }

  const devAuthEnabled = process.env.DEV_AUTH_ENABLED === 'true';
  const enabledProviders = getEnabledOAuthProviders();

  return (
    <LoginForm
      devAuthEnabled={devAuthEnabled}
      enabledProviders={enabledProviders}
      showBackLink={showBackLink}
    />
  );
}
