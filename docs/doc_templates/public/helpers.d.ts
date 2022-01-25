import { DocItemWithContext } from "../../site";
import { FunctionDefinition, VariableDeclaration } from 'solidity-ast';
/**
 * Returns a Markdown heading marker. An optional `hlevel` context variable increases the heading level.
 *
 * Examples:
 *     {{h}} {{name}}
 *     {{h 1}} {{Name}}
 *     {{h}} Functions
 */
export declare function h(this: DocItemWithContext & {
    hlevel?: number;
}, hsublevel: number | object): string;
export declare function trim(text: string): string | undefined;
export declare function joinLines(text?: string): string | undefined;
export declare function publicExternalFunctions(item: DocItemWithContext): FunctionDefinition[] | undefined;
export declare function publicVariables(item: DocItemWithContext): VariableDeclaration[] | undefined;
//# sourceMappingURL=helpers.d.ts.map