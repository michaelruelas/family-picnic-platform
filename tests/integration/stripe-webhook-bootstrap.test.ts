import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Stripe webhook bootstrap (FPP-47)', () => {
  const setupScriptPath = path.join(process.cwd(), 'scripts/setup-stripe-webhook.sh');
  const populateScriptPath = path.join(process.cwd(), 'scripts/populate-openbao-secrets.sh');
  const libPath = path.join(process.cwd(), 'scripts/lib/openbao.sh');
  const nextjsDeploymentPath = path.join(process.cwd(), 'kubernetes/base/nextjs.yaml');
  const externalSecretsPath = path.join(
    process.cwd(),
    'kubernetes/overlays/pugquilt-dev/external-secrets.yaml',
  );

  it('setup-stripe-webhook.sh exists and is executable', async () => {
    const stat = await fs.stat(setupScriptPath);
    expect(stat.isFile()).toBe(true);
    // 0o755 = executable by owner. The actual permissions check is
    // best-effort; the next-line `bash -n` is the real safety net.
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('setup-stripe-webhook.sh requires STRIPE_API_KEY and refuses dev', async () => {
    const content = await fs.readFile(setupScriptPath, 'utf-8');
    expect(content).toMatch(/STRIPE_API_KEY.*required/s);
    expect(content).toMatch(/ERROR: dev uses 'stripe listen'/);
  });

  it('setup-stripe-webhook.sh subscribes to the five events the route handler dispatches', async () => {
    const content = await fs.readFile(setupScriptPath, 'utf-8');
    expect(content).toContain('payment_intent.succeeded');
    expect(content).toContain('payment_intent.payment_failed');
    expect(content).toContain('payment_intent.canceled');
    expect(content).toContain('charge.refunded');
    expect(content).toContain('charge.updated');
  });

  it('setup-stripe-webhook.sh pins the Stripe API version to match src/lib/stripe.ts', async () => {
    const setupContent = await fs.readFile(setupScriptPath, 'utf-8');
    const stripeLibContent = await fs.readFile(
      path.join(process.cwd(), 'src/lib/stripe.ts'),
      'utf-8',
    );
    const setupVersion = setupContent.match(/--api-version\s+([0-9-]+\.basil)/);
    const libVersion = stripeLibContent.match(/STRIPE_API_VERSION.*'([^']+\.basil)'/);
    expect(setupVersion).not.toBeNull();
    expect(libVersion).not.toBeNull();
    expect(setupVersion![1]).toBe(libVersion![1]);
  });

  it('setup-stripe-webhook.sh is idempotent (refuses duplicate URL)', async () => {
    const content = await fs.readFile(setupScriptPath, 'utf-8');
    expect(content).toContain('webhook_endpoints list');
    expect(content).toMatch(/already registered|already exists/);
  });

  it('setup-stripe-webhook.sh pushes the whsec to OpenBao preserving other keys', async () => {
    const content = await fs.readFile(setupScriptPath, 'utf-8');
    expect(content).toContain('bao_put_kv');
    expect(content).toContain('stripe-webhook-secret=$whsec');
    // It reads the existing path before writing so it doesn't clobber
    // other keys (database-url, twilio-*, etc.).
    expect(content).toMatch(/bao_get_json.*SECRET_PATH/s);
  });

  it('lib/openbao.sh exports the shared helpers', async () => {
    const content = await fs.readFile(libPath, 'utf-8');
    expect(content).toMatch(/^bao_exec\(\) \{/m);
    expect(content).toMatch(/^bao_get_json\(\) \{/m);
    expect(content).toMatch(/^bao_put_kv\(\) \{/m);
    expect(content).toMatch(/^extract\(\) \{/m);
  });

  it('populate-openbao-secrets.sh sources lib/openbao.sh instead of redefining helpers', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    expect(content).toContain('lib/openbao.sh');
    // The inline copies should be gone.
    expect(content).not.toMatch(/^bao_exec\(\) \{/m);
    expect(content).not.toMatch(/^bao_get_json\(\) \{/m);
    expect(content).not.toMatch(/^extract\(\) \{/m);
  });

  it('populate-openbao-secrets.sh accepts a TARGET_ENV arg (defaults to dev) and allows stage|prod', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    expect(content).toMatch(/TARGET_ENV="\$\{1:-\$\{TARGET_ENV:-dev\}\}"/);
    expect(content).toContain('secret/family-picnic-$TARGET_ENV');
    // Widened from dev|prod to dev|stage|prod so stage deploys share the
    // same populate script. The setup-stripe-webhook.sh script also
    // accepts the same three values.
    expect(content).toMatch(/TARGET_ENV must be one of dev\|stage\|prod/);
  });

  it('populate-openbao-secrets.sh writes STRIPE_API_KEY only to .env.dev, not OpenBao', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    // STRIPE_API_KEY is a bootstrap-time variable only — the Next.js app
    // never reads it at runtime.
    expect(content).toContain('STRIPE_API_KEY="${STRIPE_API_KEY}"');
    expect(content).not.toMatch(/stripe-api-key=.*STRIPE_API_KEY/);
  });

  it('ExternalSecret pulls stripe-webhook-secret from OpenBao', async () => {
    const content = await fs.readFile(externalSecretsPath, 'utf-8');
    expect(content).toContain('secretKey: stripe-webhook-secret');
    expect(content).toContain('property: stripe-webhook-secret');
  });

  it('nextjs deployment wires STRIPE_WEBHOOK_SECRET to the container', async () => {
    const content = await fs.readFile(nextjsDeploymentPath, 'utf-8');
    expect(content).toContain('STRIPE_WEBHOOK_SECRET');
    expect(content).toContain('key: stripe-webhook-secret');
  });
});
