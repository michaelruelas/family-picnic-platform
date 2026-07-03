import LoginForm from '~/components/LoginForm';

export default function LoginPage() {
  const devAuthEnabled = process.env.DEV_AUTH_ENABLED === 'true';

  return <LoginForm devAuthEnabled={devAuthEnabled} />;
}
