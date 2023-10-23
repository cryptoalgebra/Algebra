import { VariableDeclaration } from "solidity-ast";

export function trim(text: string) {
  if (typeof text === 'string') {
    return text.trim();
  }
}

export function joinLines(text?: string): string | undefined {
  if (typeof text === 'string') {
    return text.split('\n').join(' ').split('\r').join(' ').replace(/\s{2,}/g, ' ');
  }
}

/**
 * Format a variable as its type followed by its name, if available.
 */
export function formatVariable(v: VariableDeclaration): string {
  return [v.typeName?.typeDescriptions.typeString!].concat(v.name || []).join(' ');
}

export const eq = (a: unknown, b: unknown) => a === b;