import LoginForm from '~/components/LoginForm';
import { getEnabledOAuthProviders } from '~/lib/auth';

export default function LoginPage() {
  const devAuthEnabled = process.env.DEV_AUTH_ENABLED === 'true';
  const enabledProviders = getEnabledOAuthProviders();

  return <LoginForm devAuthEnabled={devAuthEnabled} enabledProviders={enabledProviders} />;
}
