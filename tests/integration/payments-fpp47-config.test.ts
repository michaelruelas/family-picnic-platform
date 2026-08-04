import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Stripe wiring (FPP-47)', () => {
  const nextjsPath = path.join(process.cwd(), 'kubernetes/base/nextjs.yaml');
  const externalSecretsPath = path.join(
    process.cwd(),
    'kubernetes/overlays/pugquilt-dev/external-secrets.yaml',
  );
  const populateScriptPath = path.join(process.cwd(), 'scripts/populate-openbao-secrets.sh');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const stripeLibPath = path.join(process.cwd(), 'src/lib/stripe.ts');
  const webhookRoutePath = path.join(process.cwd(), 'src/app/api/stripe/webhook/route.ts');
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  it('nextjs deployment reads all three Stripe secrets', async () => {
    const content = await fs.readFile(nextjsPath, 'utf-8');
    expect(content).toContain('STRIPE_SECRET_KEY');
    expect(content).toContain('key: stripe-secret-key');
    expect(content).toContain('STRIPE_PUBLISHABLE_KEY');
    expect(content).toContain('key: stripe-publishable-key');
    expect(content).toContain('STRIPE_WEBHOOK_SECRET');
    expect(content).toContain('key: stripe-webhook-secret');
  });

  it('ExternalSecret declares all three Stripe keys bound from OpenBao', async () => {
    const content = await fs.readFile(externalSecretsPath, 'utf-8');
    for (const key of ['stripe-secret-key', 'stripe-publishable-key', 'stripe-webhook-secret']) {
      expect(content).toContain(`secretKey: ${key}`);
      expect(content).toContain(`property: ${key}`);
    }
  });

  it('populate-openbao-secrets.sh round-trips each Stripe key', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']) {
      expect(content).toMatch(new RegExp(`${key}=\\$\\(resolve`));
      expect(content).toMatch(new RegExp(`env_dev_get ${key}`));
    }
    expect(content).toContain('stripe-secret-key="$STRIPE_SECRET_KEY"');
    expect(content).toContain('stripe-publishable-key="$STRIPE_PUBLISHABLE_KEY"');
    expect(content).toContain('stripe-webhook-secret="$STRIPE_WEBHOOK_SECRET"');
  });

  it('.env.example documents the three Stripe keys', async () => {
    const content = await fs.readFile(envExamplePath, 'utf-8');
    expect(content).toContain('STRIPE_SECRET_KEY=""');
    expect(content).toContain('STRIPE_PUBLISHABLE_KEY=""');
    expect(content).toContain('STRIPE_WEBHOOK_SECRET=""');
  });

  it('stripe.ts reads the three keys from process.env', async () => {
    const content = await fs.readFile(stripeLibPath, 'utf-8');
    expect(content).toContain('process.env.STRIPE_SECRET_KEY');
    expect(content).toContain('process.env.STRIPE_PUBLISHABLE_KEY');
    expect(content).toContain('process.env.STRIPE_WEBHOOK_SECRET');
    expect(content).toMatch(/verifyWebhookSignature|isWebhookConfigured/);
    expect(content).toContain('idempotencyKey');
  });

  it('webhook route verifies signatures with constructEventAsync', async () => {
    const content = await fs.readFile(webhookRoutePath, 'utf-8');
    expect(content).toContain('verifyWebhookSignature');
    expect(content).toContain("'stripe-signature'");
    expect(content).toMatch(/payment_intent\.succeeded/);
    expect(content).toMatch(/payment_intent\.payment_failed/);
    expect(content).toMatch(/charge\.refunded/);
  });

  it('package.json declares the stripe runtime dependencies', async () => {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    expect(content).toMatch(/"stripe":\s*"\^/);
    expect(content).toMatch(/"@stripe\/stripe-js":\s*"\^/);
    expect(content).toMatch(/"@stripe\/react-stripe-js":\s*"\^/);
  });
});
