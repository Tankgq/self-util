import * as vscode from 'vscode';

export function showInfo(message : string) : void {
	vscode.window.showInformationMessage(`[self-util] ${message}`);
}

export function showWarn(message : string) : void {
	vscode.window.showWarningMessage(`[self-util] ${message}`);
}

export function showError(message : string) : void {
	vscode.window.showErrorMessage(`[self-util] ${message}`);
}