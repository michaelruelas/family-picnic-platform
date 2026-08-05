import { NextResponse } from 'next/server';
import { prisma } from '~/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const target = await prisma.event.findFirst({
    where: {
      status: 'PUBLISHED',
      photos: { some: { deletedAt: null } },
    },
    orderBy: { date: 'desc' },
    select: { id: true },
  });

  if (target) {
    return NextResponse.redirect(new URL(`/events/${target.id}/photos`, request.url), 301);
  }

  return new NextResponse(fallbackHtml(), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function fallbackHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photos · Family Picnic</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 6rem auto; padding: 0 1.5rem; color: #2b2d42; }
      h1 { font-size: 2rem; margin: 0 0 1rem; }
      p { line-height: 1.5; }
      a { color: #c5644a; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>No photos yet</h1>
    <p>No published event has shared photos right now. Check back soon, or browse upcoming events.</p>
    <p><a href="/events">See upcoming events →</a></p>
  </body>
</html>`;
}
