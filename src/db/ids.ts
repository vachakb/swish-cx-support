import { customAlphabet } from 'nanoid';

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

/** Readable, opaque, prefixed id — e.g. id('ord') -> "ord_a1b2c3...". */
export const id = (prefix: string): string => `${prefix}_${nano()}`;
