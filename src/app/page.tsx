import UnauthenticatedPage from '~/components/UnauthenticatedPage';

export { dynamic } from '~/components/UnauthenticatedPage';

export default function Home() {
  return <UnauthenticatedPage showBackLink={false} />;
}
