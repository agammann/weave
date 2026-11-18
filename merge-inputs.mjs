import { readFile } from 'node:fs/promises';

export async function readJson(path) {
  const text = await readFile(path, 'utf8');
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`${path}: invalid JSON`);
  }
}

export function validateDecisions(decisions) {
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) {
    throw new Error('Decisions must be a JSON object');
  }
  for (const key of Object.getOwnPropertyNames(decisions)) {
    const value = decisions[key];
    if (value !== undefined && !['base', 'left', 'right'].includes(value)) {
      throw new Error(`Invalid decision for ${key}`);
    }
  }
}

export function checkCurrentDecisions(decisions, conflictKeys) {
  const current = new Set(conflictKeys);
  for (const key of Object.getOwnPropertyNames(decisions)) {
    if (decisions[key] !== undefined && !current.has(key)) {
      throw new Error(`Decision does not match a current conflict: ${key}`);
    }
  }
}
