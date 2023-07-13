import { DocItemWithContext, DocItemContext } from 'solidity-docgen/dist/site';
import { NatSpec } from 'solidity-docgen/dist/utils/natspec';
import { FunctionDefinition, VariableDeclaration, ContractDefinition } from 'solidity-ast';
import { findAll, isNodeType } from 'solidity-ast/utils';

export function notTest({ item }: DocItemContext): boolean {
    if (item.nodeType !== 'ContractDefinition') return true;
    return !(
        item.name.endsWith('Test')
        || item.name.startsWith('Test')
        || item.name.endsWith('Mock')
        || item.name.startsWith('Mock')
        || item.name.startsWith('Simulation')
        || item.name.endsWith('Echidna')
    )
}

export function hasPublicMembers({ item }: DocItemContext): boolean {
    if (item.nodeType !== 'ContractDefinition') return false;

    let variables = item.nodes.filter(isNodeType('VariableDeclaration')).filter(v => v.stateVariable).filter(v => v.visibility == 'public')
    if (variables && variables.length > 0) return true;

    let events = [...findAll('EventDefinition', item)];
    if (events && events.length > 0) return true;

    let functions = [...findAll('FunctionDefinition', item)]
    .filter((x) => (x.visibility == 'public' || x.visibility == 'external'));

    if (functions && functions.length > 0) return true;

    return false;
}
 
export function publicExternalFunctions({ item }: DocItemContext): FunctionDefinition[] {
    return [...findAll('FunctionDefinition', item)]
    .filter((x) => (x.visibility == 'public' || x.visibility == 'external'));
}

export function publicVariables({ item }: DocItemContext): VariableDeclaration[] | undefined {
    return (item.nodeType === 'ContractDefinition')
      ? item.nodes.filter(isNodeType('VariableDeclaration')).filter(v => v.stateVariable).filter(v => v.visibility == 'public')
      : undefined;
}


export function typeFormatted({ item }: DocItemContext): string | undefined {
    if (item.nodeType === 'VariableDeclaration') {
      if (item.typeName) {
        if (item.typeName.nodeType == 'ElementaryTypeName') {
          return item.typeName.name;
        } else {
          if (item.typeName.typeDescriptions && item.typeName.typeDescriptions.typeString) {
            return item.typeName.typeDescriptions.typeString;
          }
        }
      }
    } else {
      return undefined;
    }
  }

  export function stateMutabilityFiltered({ item }: DocItemContext): string | undefined {
    if (item.nodeType === 'FunctionDefinition') {
      if (item.stateMutability == 'nonpayable') {
        return undefined;
      }
      return item.stateMutability ? item.stateMutability : undefined;
    } else if (item.nodeType === 'VariableDeclaration') {
      if (item.mutability == 'mutable') {
        return undefined;
      }
      return item.mutability ? item.mutability : undefined;
    }
  }

  export function withModifiers({ item }: DocItemContext): string | undefined {
    if (item.nodeType === 'FunctionDefinition') {
      return item.modifiers ? item.modifiers.map((x) => x.modifierName.name).join(', ')  : undefined;
    } else {
      return undefined;
    }
  }