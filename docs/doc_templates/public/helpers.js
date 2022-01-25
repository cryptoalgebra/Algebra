"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicVariables = exports.publicExternalFunctions = exports.joinLines = exports.trim = exports.h = void 0;
const utils_1 = require("solidity-ast/utils");
/**
 * Returns a Markdown heading marker. An optional `hlevel` context variable increases the heading level.
 *
 * Examples:
 *     {{h}} {{name}}
 *     {{h 1}} {{Name}}
 *     {{h}} Functions
 */
function h(hsublevel) {
    var _a;
    hsublevel = typeof hsublevel === 'number' ? Math.max(1, hsublevel) : 1;
    return new Array(((_a = this.hlevel) !== null && _a !== void 0 ? _a : 1) + hsublevel - 1).fill('#').join('');
}
exports.h = h;
;
function trim(text) {
    if (typeof text === 'string') {
        return text.trim();
    }
}
exports.trim = trim;
function joinLines(text) {
    if (typeof text === 'string') {
        return text.replace(/\n+/g, ' ');
    }
}
exports.joinLines = joinLines;
function publicExternalFunctions(item) {
    return [...(0, utils_1.findAll)('FunctionDefinition', item)].filter((x) => x.visibility == 'public' || x.visibility == 'external');
}
exports.publicExternalFunctions = publicExternalFunctions;
function publicVariables(item) {
    return (item.nodeType === 'ContractDefinition')
        ? item.nodes.filter((0, utils_1.isNodeType)('VariableDeclaration')).filter(v => v.stateVariable).filter(v => v.visibility == 'public')
        : undefined;
}
exports.publicVariables = publicVariables;
//# sourceMappingURL=helpers.js.map