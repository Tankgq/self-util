"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
function showInfo(message) {
    vscode.window.showInformationMessage(`[self-util] ${message}`);
}
exports.showInfo = showInfo;
function showWarn(message) {
    vscode.window.showWarningMessage(`[self-util] ${message}`);
}
exports.showWarn = showWarn;
function showError(message) {
    vscode.window.showErrorMessage(`[self-util] ${message}`);
}
exports.showError = showError;
//# sourceMappingURL=log.js.map