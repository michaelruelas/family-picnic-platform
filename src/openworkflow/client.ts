import { OpenWorkflow } from 'openworkflow';
import { BackendPostgres } from 'openworkflow/postgres';

export const backend = await BackendPostgres.connect(
  process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/family-picnic',
  { namespaceId: 'family-picnic' },
);

export const ow = new OpenWorkflow({ backend });
