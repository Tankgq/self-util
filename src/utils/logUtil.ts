import * as timeUtil from './timeUtil';
import * as vscode from 'vscode';

export const enum LogLevel {
	TRACE,
	DEBUG,
	INFO,
	WARN,
	ERROR,
	FATAL
}

export class LogUtil {
	private static _logLevel : number = LogLevel.TRACE;

	public static trace(message?: any, ...optionalParams: any[]) : void {
		if(this._logLevel >= LogLevel.TRACE) { return; }
		console.trace(`[TRACE] [${timeUtil.getTimeDetail()}] ` + message, optionalParams);
	}

	public static debug(message?: any, ...optionalParams: any[]) : void {
		if(this._logLevel >= LogLevel.DEBUG) { return; }
		console.debug(`[DEBUG] [${timeUtil.getTimeDetail()}] ` + message, optionalParams);
	}

	public static info(message?: any, ...optionalParams: any[]) : void {
		if(this._logLevel >= LogLevel.INFO ) { return; }
		console.info(`[INFO] [${timeUtil.getTimeDetail()}] ` + message, optionalParams);
	}

	public static warn(message?: any, ...optionalParams: any[]) : void {
		if(this._logLevel >= LogLevel.WARN) { return; }
		console.warn(`[WARN] [${timeUtil.getTimeDetail()}] ` + message, optionalParams);
	}

	public static error(message?: any, ...optionalParams: any[]) : void {
		if(this._logLevel >= LogLevel.ERROR) { return; }
		console.error(`[ERROR] [${timeUtil.getTimeDetail()}] ` + message, optionalParams);
	}

	public static fatal(message?: any, ...optionalParams: any[]) : void {
		if(this._logLevel >= LogLevel.FATAL) { return; }
		console.error(`[FATAL] [${timeUtil.getTimeDetail()}] ` + message, optionalParams);
	}
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