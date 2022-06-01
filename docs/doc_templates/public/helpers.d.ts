import { DocItemWithContext } from "../../site";
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
//# sourceMappingURL=helpers.d.ts.map