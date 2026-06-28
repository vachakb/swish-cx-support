import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { config } from '../config';
import * as schema from './schema';

const client = createClient({ url: config.dbUrl });

export const db = drizzle(client, { schema });
export type DB = typeof db;
