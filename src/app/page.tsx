import UnauthenticatedPage from '~/components/UnauthenticatedPage';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <UnauthenticatedPage showBackLink={false} />;
}
