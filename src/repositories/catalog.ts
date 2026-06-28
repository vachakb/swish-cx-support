import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { scenarios, serviceability } from '../db/schema';

export type Serviceability = typeof serviceability.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;

export const listServiceability = () => db.select().from(serviceability).all();

export const findArea = (city: string, area: string) =>
  db.select().from(serviceability)
    .where(and(eq(serviceability.city, city), eq(serviceability.area, area))).get();

export const listScenarios = () => db.select().from(scenarios).all();

export const getScenario = (id: string) =>
  db.select().from(scenarios).where(eq(scenarios.id, id)).get();
