import * as txt from './utils/txt';
import { ExtensionContext } from 'vscode';

export function activate(context: ExtensionContext) {

	console.log('"self-util" is now active');

	txt.init(context);
}

export function deactivate() {}
