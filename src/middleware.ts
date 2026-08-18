import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
  }
  return posthogClient;
}

export function middleware(request: NextRequest) {
  const client = getPostHogClient();
  if (client) {
    const url = request.nextUrl;
    const distinctId =
      request.cookies.get('ph_distinct_id')?.value ??
      request.headers.get('x-forwarded-for') ??
      'anonymous';

    client.capture({
      event: '$pageview',
      distinctId,
      properties: {
        $current_url: url.toString(),
        $pathname: url.pathname,
        $host: url.host,
        $referrer: request.headers.get('referer') ?? '',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
};
