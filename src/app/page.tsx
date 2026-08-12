import UnauthenticatedPage from '~/components/UnauthenticatedPage';

export const dynamic = 'force-dynamic';

export default function Home() {
  // "Back to home" is hidden because `/` is the home page — the link
  // would point back at itself. `/login` hides it for the same reason.
  return <UnauthenticatedPage showBackLink={false} />;
}
