import { describe, it, expect } from 'vitest';

describe('ow-workflows module exports', () => {
  it('exports scheduledBroadcastDelivery workflow', async () => {
    const mod = await import('../ow-workflows');
    expect(mod.scheduledBroadcastDelivery).toBeDefined();
    expect(typeof mod.scheduledBroadcastDelivery).toBe('object');
  });

  it('exports rsvpConfirm workflow', async () => {
    const mod = await import('../ow-workflows');
    expect(mod.rsvpConfirm).toBeDefined();
    expect(typeof mod.rsvpConfirm).toBe('object');
  });

  it('exports rsvpDecline workflow', async () => {
    const mod = await import('../ow-workflows');
    expect(mod.rsvpDecline).toBeDefined();
    expect(typeof mod.rsvpDecline).toBe('object');
  });

  it('exports deliverCommunications workflow', async () => {
    const mod = await import('../ow-workflows');
    expect(mod.deliverCommunications).toBeDefined();
    expect(typeof mod.deliverCommunications).toBe('object');
  });

  it('exports exactly four workflow definitions', async () => {
    const mod = await import('../ow-workflows');
    const workflowKeys = Object.keys(mod).filter(
      (k) => k !== 'defineWorkflow' && typeof mod[k as keyof typeof mod] === 'object',
    );
    expect(workflowKeys).toHaveLength(4);
  });

  it('all exports are objects', async () => {
    const { scheduledBroadcastDelivery, rsvpConfirm, rsvpDecline, deliverCommunications } =
      await import('../ow-workflows');
    const workflows = [scheduledBroadcastDelivery, rsvpConfirm, rsvpDecline, deliverCommunications];
    workflows.forEach((wf, i) => {
      expect(wf).toBeTruthy();
      expect(typeof wf).toBe('object');
    });
  });
});
