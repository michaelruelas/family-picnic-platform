import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Twilio SMS configuration wiring (QUB-8)', () => {
  const nextjsPath = path.join(process.cwd(), 'kubernetes/base/nextjs.yaml');
  const externalSecretsPath = path.join(
    process.cwd(),
    'kubernetes/overlays/pugquilt-dev/external-secrets.yaml',
  );
  const populateScriptPath = path.join(process.cwd(), 'scripts/populate-openbao-secrets.sh');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const twilioLibPath = path.join(process.cwd(), 'src/lib/twilio.ts');

  it('nextjs deployment reads TWILIO_PHONE_NUMBER from nextjs-secrets', async () => {
    const content = await fs.readFile(nextjsPath, 'utf-8');
    expect(content).toContain('TWILIO_PHONE_NUMBER');
    expect(content).toContain('key: twilio-phone-number');
  });

  it('nextjs deployment still wires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN', async () => {
    const content = await fs.readFile(nextjsPath, 'utf-8');
    expect(content).toContain('TWILIO_ACCOUNT_SID');
    expect(content).toContain('TWILIO_AUTH_TOKEN');
    expect(content).toContain('key: twilio-account-sid');
    expect(content).toContain('key: twilio-auth-token');
  });

  it('ExternalSecret declares twilio-phone-number bound from OpenBao', async () => {
    const content = await fs.readFile(externalSecretsPath, 'utf-8');
    expect(content).toContain('secretKey: twilio-phone-number');
    expect(content).toContain('property: twilio-phone-number');
  });

  it('populate-openbao-secrets.sh round-trips TWILIO_PHONE_NUMBER', async () => {
    const content = await fs.readFile(populateScriptPath, 'utf-8');
    expect(content).toMatch(/TWILIO_PHONE_NUMBER=\$\(resolve/);
    expect(content).toMatch(/env_dev_get TWILIO_PHONE_NUMBER/);
    expect(content).toMatch(/twilio-phone-number="\$TWILIO_PHONE_NUMBER"/);
  });

  it('.env.example documents TWILIO_PHONE_NUMBER as E.164', async () => {
    const content = await fs.readFile(envExamplePath, 'utf-8');
    const lines = content.split('\n');
    const blockLines: string[] = [];
    let inBlock = false;
    for (const line of lines) {
      if (line.match(/^\s*TWILIO_/)) {
        inBlock = true;
      }
      if (inBlock) {
        blockLines.push(line);
        if (line.match(/^\s*TWILIO_PHONE_NUMBER/)) break;
      }
    }
    const block = blockLines.join('\n');
    expect(block).toContain('TWILIO_PHONE_NUMBER');
    const full = await fs.readFile(envExamplePath, 'utf-8');
    expect(full).toMatch(/TWILIO_PHONE_NUMBER[\s\S]*?E\.164/);
  });

  it('twilio.ts reads TWILIO_PHONE_NUMBER from process.env', async () => {
    const content = await fs.readFile(twilioLibPath, 'utf-8');
    expect(content).toContain('process.env.TWILIO_PHONE_NUMBER');
    expect(content).toMatch(/isValidE164|getFromPhoneNumber/);
  });
});
