import { DocItemWithContext, DocItemContext } from 'solidity-docgen/dist/site';
import { NatSpec } from 'solidity-docgen/dist/utils/natspec';
import { FunctionDefinition, VariableDeclaration, ContractDefinition, StructDefinition, ErrorDefinition } from 'solidity-ast';
import { findAll, isNodeType } from 'solidity-ast/utils';
import { keccak256, toUtf8Bytes } from 'ethers';

export function notTest({ item }: DocItemContext): boolean {
  if (item.nodeType !== 'ContractDefinition') return true;
  return !(
    item.name.endsWith('Test') ||
    item.name.startsWith('Test') ||
    item.name.endsWith('Mock') ||
    item.name.startsWith('Mock') ||
    item.name.startsWith('Simulation') ||
    item.name.endsWith('Echidna')
  );
}

export function hasPublicMembers({ item }: DocItemContext): boolean {
  if (item.nodeType !== 'ContractDefinition') return false;

  let variables = item.nodes
    .filter(isNodeType('VariableDeclaration'))
    .filter((v) => v.stateVariable)
    .filter((v) => v.visibility == 'public');
  if (variables && variables.length > 0) return true;

  let events = [...findAll('EventDefinition', item)];
  if (events && events.length > 0) return true;

  let functions = [...findAll('FunctionDefinition', item)].filter((x) => x.visibility == 'public' || x.visibility == 'external');

  if (functions && functions.length > 0) return true;

  return false;
}

export function publicExternalFunctions({ item }: DocItemContext): FunctionDefinition[] {
  return [...findAll('FunctionDefinition', item)].filter((x) => x.visibility == 'public' || x.visibility == 'external');
}

export function publicVariables({ item }: DocItemContext): VariableDeclaration[] | undefined {
  return item.nodeType === 'ContractDefinition'
    ? item.nodes
        .filter(isNodeType('VariableDeclaration'))
        .filter((v) => v.stateVariable)
        .filter((v) => v.visibility == 'public')
    : undefined;
}

const cachedConstants = {};

export function constantValue({ item, build }: DocItemContext): string | undefined {
  if (!item || !item['constant']) return undefined;

  if (item['value']) {
    let value = item['value'];
    if (value['value']) return value['value'];

    if (value['referencedDeclaration']) {
      if (cachedConstants[value['referencedDeclaration']]) return cachedConstants[value['referencedDeclaration']];

      const sources = build.output.sources;
      for (const source of Object.keys(sources)) {
        const constants = [...findAll('VariableDeclaration', sources[source].ast)].filter((x) => x.constant).filter((x) => x.value);
        const index = constants.findIndex((x) => x.id == value['referencedDeclaration']);
        if (index != -1) {
          const constantValue = constants[index].value;
          if (!constantValue) return undefined;

          cachedConstants[value['referencedDeclaration']] = constantValue['value'];
          return constantValue['value'];
        }
      }
    }

    if (value['kind'] == 'functionCall' && value['expression'] && value['expression']['name'] == 'keccak256') {
      if (!value['arguments'] || value['arguments'].length > 1) return undefined;

      if (value['arguments'][0].nodeType == 'Literal' && value['arguments'][0].kind == 'string') {
        const constantValue = keccak256(toUtf8Bytes(value['arguments'][0].value));
        cachedConstants[value['referencedDeclaration']] = constantValue;
        return constantValue;
      }
    }
  }
}

export function structures({ item }: DocItemContext): StructDefinition[] | undefined {
  return item.nodeType === 'ContractDefinition' ? item.nodes.filter(isNodeType('StructDefinition')) : undefined;
}

export function selector({ item }: any): string | undefined {
  if (!item) return undefined;
  let selector: string | undefined;
  if (item.functionSelector) selector = item.functionSelector;
  else if (item.errorSelector) selector = item.errorSelector;

  return selector;
}

export function typeFormatted({ item }: DocItemContext): string | undefined {
  if (item.nodeType === 'VariableDeclaration') {
    if (item.typeName) {
      if (item.typeName.nodeType == 'ElementaryTypeName') {
        return _replaceSpecialCharacters(item.typeName.name);
      } else {
        if (item.typeName.typeDescriptions && item.typeName.typeDescriptions.typeString) {
          return _replaceSpecialCharacters(item.typeName.typeDescriptions.typeString);
        }
      }
    }
  } else {
    return undefined;
  }
}

function _replaceSpecialCharacters(str) {
  return str.replaceAll('&#x3D;&gt;', '=>');
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
    return item.modifiers ? item.modifiers.map((x) => x.modifierName.name).join(', ') : undefined;
  } else {
    return undefined;
  }
}
