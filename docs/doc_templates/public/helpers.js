"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinLines = exports.trim = exports.h = exports.devIsUnique = void 0;
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
function devIsUnique(natspec) {
    return natspec && (natspec.dev != natspec.notice);
}
exports.devIsUnique = devIsUnique;
//# sourceMappingURL=helpers.js.map