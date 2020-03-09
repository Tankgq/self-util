import * as timeUtil from './timeUtil';
import * as vscode from 'vscode';

export const enum LogLevel {
	Trace,
	Debug,
	Info,
	Warn,
	Error,
	Fatal
}

export let logLevel : LogLevel = LogLevel.Trace;

export function trace(message?: any, ...optionalParams: any[]) : void {
	if(logLevel > LogLevel.Trace) { return; }
	console.trace(`[TRACE] [${timeUtil.getTimeDetail()}] ${message}`, optionalParams);
}

export function debug(message?: any, ...optionalParams: any[]) : void {
	if(logLevel > LogLevel.Debug) { return; }
	console.debug(`[DEBUG] [${timeUtil.getTimeDetail()}] ${message}\n${getCallStack()}`, optionalParams);
}

export function info(message?: any, ...optionalParams: any[]) : void {
	if(logLevel > LogLevel.Info ) { return; }
	console.info(`[INFO] [${timeUtil.getTimeDetail()}] ${message}\n${getCallStack()}`, optionalParams);
}

export function warn(message?: any, ...optionalParams: any[]) : void {
	if(logLevel > LogLevel.Warn) { return; }
	console.warn(`[WARN] [${timeUtil.getTimeDetail()}] ${message}\n${getCallStack()}`, optionalParams);
}

export function error(message?: any, ...optionalParams: any[]) : void {
	if(logLevel > LogLevel.Error) { return; }
	console.error(`[ERROR] [${timeUtil.getTimeDetail()}] ${message}\n${getCallStack()}`, optionalParams);
}

export function fatal(message?: any, ...optionalParams: any[]) : void {
	if(logLevel > LogLevel.Fatal) { return; }
	console.error(`[FATAL] [${timeUtil.getTimeDetail()}] ${message}\n${getCallStack()}`, optionalParams);
}

const getCallStackRegex = /(?<=logUtil\.\w+:\d+:\d+\)\n)(?![\w\W]*?logUtil)[\w\W]*/;
export function getCallStack() : string {
	let result = '';
	try { throw new Error(); }
	catch (e) {
		result = e.stack;
		let m = getCallStackRegex.exec(result);
		if(m && m.length) { result = m[0]; }
	}
	return result;
}

export function showInfo(message : string) : void {
	vscode.window.showInformationMessage(`[self-util] ${message}`);
}

export function showWarn(message : string) : void {
	vscode.window.showWarningMessage(`[self-util] ${message}`);
}

export function showError(message : string) : void {
	vscode.window.showErrorMessage(`[self-util] ${message}`);
}