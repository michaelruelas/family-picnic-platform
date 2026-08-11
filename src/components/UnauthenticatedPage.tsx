import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, getEnabledOAuthProviders } from '~/lib/auth';
import LoginForm from '~/components/LoginForm';

export default async function UnauthenticatedPage({
  showBackLink = true,
}: {
  showBackLink?: boolean;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect('/events');
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
