export interface Clock {
  now(): string;
}

export interface Ids {
  newId(): string;
}

import { randomUUID } from "node:crypto";

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export const systemIds: Ids = {
  newId: () => randomUUID(),
};
