import { OpenWorkflow } from 'openworkflow';
import { BackendPostgres } from 'openworkflow/postgres';

let _ow: OpenWorkflow | null = null;

export async function getOpenWorkflow(): Promise<OpenWorkflow> {
  if (_ow) return _ow;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const backend = await BackendPostgres.connect(databaseUrl, {
    namespaceId: 'family-picnic',
  });

  _ow = new OpenWorkflow({ backend });
  return _ow;
}
