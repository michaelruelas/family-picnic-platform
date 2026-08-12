import { describe, it, expect } from 'vitest';
import { validateHttpUrlFields } from '~/lib/url-validation';

describe('validateHttpUrlFields', () => {
  it('returns null when the body has no URL fields', () => {
    expect(validateHttpUrlFields({}, ['featuredImageUrl'])).toBeNull();
  });

  it('returns null when every named field is absent or empty', () => {
    expect(
      validateHttpUrlFields({ featuredImageUrl: '', mapImageUrl: undefined }, [
        'featuredImageUrl',
        'mapImageUrl',
      ]),
    ).toBeNull();
  });

  it('returns null when every URL field is a valid http(s) URL', () => {
    expect(
      validateHttpUrlFields(
        {
          featuredImageUrl: 'https://cdn.example.com/hero.jpg',
          mapImageUrl: 'http://maps.example.com/static.png',
        },
        ['featuredImageUrl', 'mapImageUrl'],
      ),
    ).toBeNull();
  });

  it('returns a 400 when any field is not a URL', () => {
    const res = validateHttpUrlFields({ featuredImageUrl: 'not-a-url' }, ['featuredImageUrl']);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
  });

  it('returns a 400 when any field uses a non-http(s) scheme', () => {
    const res = validateHttpUrlFields({ featuredImageUrl: 'javascript:alert(1)' }, [
      'featuredImageUrl',
    ]);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
  });

  it('returns the first failing field when multiple are invalid', async () => {
    const res = validateHttpUrlFields(
      { featuredImageUrl: 'javascript:alert(1)', mapImageUrl: 'also-bad' },
      ['featuredImageUrl', 'mapImageUrl'],
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = (await res!.json()) as { error: string };
    expect(body.error).toContain('featuredImageUrl');
  });

  it('skips non-string values without throwing', () => {
    expect(
      validateHttpUrlFields({ featuredImageUrl: 42, mapImageUrl: { not: 'a string' } }, [
        'featuredImageUrl',
        'mapImageUrl',
      ]),
    ).toBeNull();
  });
});
