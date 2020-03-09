import * as vscode from 'vscode';
import * as constant from '../constant';
import { Hover, ProviderResult, CancellationToken, Position, TextDocument, ExtensionContext, Range, StatusBarAlignment, StatusBarItem, WebviewPanel, TextEditor, TextDocumentWillSaveEvent, TextEditorEdit, TextEditorVisibleRangesChangeEvent, TextDocumentChangeEvent } from 'vscode';
import * as path from 'path';
import * as webviewUtil from './webviewUtil';
import * as editUtil from './editUtil';
import { TextState } from '../constant';
import * as logUtil from './logUtil';
import * as messageBroker from './messageBroker';
import { interval, fromEvent, Subject, UnaryFunction, Observable, ConnectableObservable } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { MessageCode } from './messageBroker';

const GetWordRegExp = new RegExp(/[^\t \n]+/);
const GetDigitRegExp = new RegExp(/(?<=[^:])"(\d+)"/g);
enum SeparatorType {
	FillChar,
	Horizontal,
	Vertical,
	TitleVertical,
	TopLeft,
	TopCenter,
	TopRight,
	MiddleLeft,
	MiddleCenter,
	MiddleRight,
	BottomLeft,
	BottomCenter,
	BottomRight
}
// SeparatorType.FillChar: ' '
// SeparatorType.Horizontal: '═'
// SeparatorType.Vertical: '║'
// SeparatorType.Vertical: '┃'
// SeparatorType.TopLeft: '╔'
// SeparatorType.TopCenter: '╦'
// SeparatorType.TopRight: '╗'
// SeparatorType.MiddleLeft: '╠'
// SeparatorType.MiddleCenter: '╬'
// SeparatorType.MiddleRight: '╣'
// SeparatorType.BottomLeft: '╚'
// SeparatorType.BottomCenter: '╩'
// SeparatorType.BottomRight: '╝'
const SeparatorChar = [' ', '═', '║', '┃', '╔', '╦', '╗', '╠', '╬', '╣', '╚', '╩', '╝'];
// ╔══════╦═══════════╦══════════════════╦══════════╗
const TopStartStr = SeparatorChar[SeparatorType.TopLeft] + SeparatorChar[SeparatorType.Horizontal];
// ┃  ID  ┃ 技能类型  ┃     技能名称     ┃ 冷却时间 ┃
const TitleStartStr = SeparatorChar[SeparatorType.TitleVertical] + SeparatorChar[SeparatorType.FillChar];
// ╠══════╬═══════════╬══════════════════╬══════════╣
const MiddleStartStr = SeparatorChar[SeparatorType.MiddleLeft] + SeparatorChar[SeparatorType.Horizontal];
// ║  2   ║    31     ║     召唤技能     ║    15    ║
const ContentStartStr = SeparatorChar[SeparatorType.Vertical] + SeparatorChar[SeparatorType.FillChar];
// ╚══════╩═══════════╩══════════════════╩══════════╝
const BottomStartStr = SeparatorChar[SeparatorType.BottomLeft] + SeparatorChar[SeparatorType.Horizontal];

enum AddedTitleSeparatorType {
	FillChar,
	Horizontal,
	Vertical,
	TopLeft,
	TopCenter,
	TopRight,
	BottomLeft,
	BottomCenter,
	BottomRight
}
// AddedTitleSeparatorType.FillChar: ' '
// AddedTitleSeparatorType.Horizontal: '═'
// AddedTitleSeparatorType.Vertical: '┆'
// AddedTitleSeparatorType.TopLeft: '╒'
// AddedTitleSeparatorType.TopCenter: '╤'
// AddedTitleSeparatorType.TopRight: '╕'
// AddedTitleSeparatorType.BottomLeft: '╘'
// AddedTitleSeparatorType.BottomCenter: '╧'
// AddedTitleSeparatorType.BottomRight: '╛'
const AddedTitleSeparatorChar = [' ', '═', '┆', '╒', '╤', '╗', '╘', '╧', '╛'];
// ╒══════╤═══════════╤══════════════════╤══════════╕
const AddedTitleTopStartStr = AddedTitleSeparatorChar[AddedTitleSeparatorType.TopLeft] +AddedTitleSeparatorChar[AddedTitleSeparatorType.Horizontal];
// ┆  ID  ┆ 技能类型  ┆     技能名称     ┆ 冷却时间 ┆
const AddedTitleStartStr = AddedTitleSeparatorChar[AddedTitleSeparatorType.TopLeft] +AddedTitleSeparatorChar[AddedTitleSeparatorType.FillChar];
// ╘══════╧═══════════╧══════════════════╧══════════╛
const AddedTitleBottomStartStr = AddedTitleSeparatorChar[AddedTitleSeparatorType.BottomLeft] +AddedTitleSeparatorChar[AddedTitleSeparatorType.Horizontal];

enum AddedContentSeparatorType {
	FillChar,
	Horizontal,
	Vertical,
	TopLeft,
	TopCenter,
	TopRight,
	BottomLeft,
	BottomCenter,
	BottomRight
}
// AddedContentSeparatorType.FillChar: ' '
// AddedContentSeparatorType.Horizontal: '━'
// AddedContentSeparatorType.Vertical: '┇'
// AddedContentSeparatorType.TopLeft: '┏'
// AddedContentSeparatorType.TopCenter: '┳'
// AddedContentSeparatorType.TopRight: '┓'
// AddedContentSeparatorType.BottomLeft: '┖'
// AddedContentSeparatorType.BottomCenter: '┻'
// AddedContentSeparatorType.BottomRight: '┛'
const AddedContentSeparatorChar = [' ', '━', '┇', '┏', '┳', '┓', '┖', '┻', '┛'];
// ┏━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┓
const AddedContentTopStartStr = AddedContentSeparatorChar[AddedContentSeparatorType.TopLeft] + AddedContentSeparatorChar[AddedContentSeparatorType.Horizontal];
// ┇  23  ┇    62     ┇    狙击炮技能    ┇    20    ┇
const AddedContentStartStr = AddedContentSeparatorChar[AddedContentSeparatorType.Vertical] + AddedContentSeparatorChar[AddedContentSeparatorType.FillChar];
// ┖──────┸━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━┛
const AddedContentBottomStartStr = AddedContentSeparatorChar[AddedContentSeparatorType.BottomLeft] + AddedContentSeparatorChar[AddedContentSeparatorType.Horizontal];

let currentTxtFilePath = '';
let currentColumnNameRowIdx = 0;
let currentColumnNameList : string[] = [];
let commandStatusBar : StatusBarItem;
let webViewStatusBar : StatusBarItem;
let webViewPanel : WebviewPanel;
let selfContext : ExtensionContext;
let headerStatuBar : StatusBarItem;
let frontStatuBar : StatusBarItem;
let lastSelectLine : number = -1;
let currentState : TextState = TextState.NoText;
let currentTextEditor : TextEditor | undefined = undefined;
let addedLineDic : Map<string, Array<LineInfo>> = new Map();

let scrollSubject : Subject<TextEditorVisibleRangesChangeEvent> = new Subject();
let documentSubject : Subject<TextDocumentChangeEvent> = new Subject();

export function init(context : ExtensionContext) : void {
	selfContext = context;
	let disposable;

	disposable = vscode.commands.registerCommand(constant.COMMAND_TEXT_FORMAT, formatTxt);
	selfContext.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand(constant.COMMAND_TEXT_UNDO_FORMAT, undoFormatTxt);
	selfContext.subscriptions.push(disposable);

	disposable = vscode.languages.registerHoverProvider(constant.LANGUAGE_TEXT, {provideHover: provideTxtHover});
	selfContext.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand(constant.COMMAND_TXT_OPEN_WEBVIEW, openWebView);
	selfContext.subscriptions.push(disposable);

	vscode.window.onDidChangeTextEditorSelection(onTextEditorSelectChange);

	vscode.workspace.onWillSaveTextDocument(onWillSave);

	vscode.workspace.onDidChangeTextDocument(event => documentSubject.next(event));
	documentSubject.subscribe(event => {
		const { contentChanges } = event;
		if(! contentChanges || contentChanges.length === 0 || ! contentChanges[0]) { return; }
		const contentChange = contentChanges[0];
		const { start, end } = contentChange.range;
		logUtil.info(`range: (${start.line}, ${start.character}), end: (${end.line}, ${end.character}), text: ${contentChange.text}`);
	});

	vscode.window.onDidChangeTextEditorVisibleRanges(event => {
		scrollSubject.next(event);
	});
	scrollSubject.pipe(throttleTime(500)).subscribe(event => {
		const { visibleRanges } = event;
		if(! visibleRanges || visibleRanges.length === 0 || ! visibleRanges[0]) { return; }
		const { start, end } = visibleRanges[0];
		logUtil.debug(`start: (${start.line}, ${start.character}), end: (${end.line}, ${end.character})`);
		messageBroker.sendUpdateTextStateMessage(TextState.NoText);
	});

	interval(500).subscribe(_ => update());

	updateCurrentActiveTextEditor();
	checkCurrentState();

	updateCommandStatusBar();
	initWebViewStatusBarItem();
	
	vscode.window.onDidChangeActiveTextEditor(onTextEditorChange);
	const { activeTextEditor } = vscode.window;
	currentTextEditor = activeTextEditor;
	if(activeTextEditor) {
		editUtil.getInstance.init(activeTextEditor);

		deleteAddLineByType(activeTextEditor.document.fileName, LineType.LineTypeAll);
		updateSelectInfo(activeTextEditor.document, activeTextEditor.selection.start);
		// editUtil.getInstance.addEdit(editBuilder => {
		// 						editBuilder.insert(new Position(0, 0), '1\n');
		// 						logUtil.trace('1');
		// 					})
		// 					.startEdit()
		// 					.then(_ => logUtil.debug('2'))
		// 					.addEdit(editBuilder => {
		// 						editBuilder.insert(new Position(0, 0), '2\n');
		// 						logUtil.info('3');
		// 					})
		// 					.startEdit()
		// 					.then(_ => logUtil.warn('4'))
		// 					.addEdit(editBuilder => {
		// 						editBuilder.insert(new Position(0, 0), '3\n');
		// 						logUtil.error('5');
		// 					})
		// 					.startEdit()
		// 					.then(_ => logUtil.fatal('6'));
	}
}

function updateCurrentActiveTextEditor() : void {
	const { activeTextEditor } = vscode.window;
	if(currentTextEditor !== activeTextEditor) { currentTextEditor = activeTextEditor; }
}

function formatTxt(): void {
	if(! currentTextEditor) { return; }
	const { document } = currentTextEditor;
	const { lineCount } = document;
	let columnCount = 0;
	const rowDataList : Array<string[]> = [];
	const rowMaxSizeList = [];
	let tabCount = 0;
	for(let idx = 0; idx < lineCount; ++ idx) {
		const line = document.lineAt(idx);
		const rowData : string [] = line.text.split('\t');
		const length = rowData.length;
		tabCount += length;
		columnCount = Math.max(columnCount, length);
		while(rowMaxSizeList.length < columnCount) {
			rowMaxSizeList.push(0);
		}
		for(let idx2 = 0; idx2 < length; ++ idx2) {
			rowData[idx2] = rowData[idx2].trim();
			rowMaxSizeList[idx2] = Math.max(rowMaxSizeList[idx2], getStringLength(rowData[idx2]));
		}
		rowDataList.push(rowData);
	}
	if(lineCount === tabCount) {
		logUtil.showInfo(`执行 ${constant.COMMAND_TEXT_FORMAT} 失败`);
		return;
	}
	currentTxtFilePath = '';
	const separatorRowData = [];
	for(let idx = 0; idx < columnCount; ++ idx) {
		separatorRowData.push(SeparatorChar[SeparatorType.Horizontal]);
	}
	let content = getNewColumnData(separatorRowData,
								   rowMaxSizeList,
								   SeparatorChar[SeparatorType.Horizontal],
								   SeparatorChar[SeparatorType.TopLeft] + SeparatorChar[SeparatorType.Horizontal],
								   SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.TopCenter] + SeparatorChar[SeparatorType.Horizontal],
								   SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.TopRight]);
	content += getNewColumnData(rowDataList[0], rowMaxSizeList);
	content += getNewColumnData(separatorRowData,
								rowMaxSizeList,
								SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.MiddleLeft] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.MiddleCenter] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.MiddleRight]);
	for(let idx = 1; idx < lineCount; ++ idx) {
		if(! rowDataList[idx]) { continue; }
		if(rowDataList[idx].length === 1 && rowDataList[idx][0].trim().length === 0) {
			continue;
		}
		content += getNewColumnData(rowDataList[idx], rowMaxSizeList);
	}
	content += getNewColumnData(separatorRowData,
								rowMaxSizeList,
								SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.BottomLeft] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.BottomCenter] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.BottomRight]);
	currentTextEditor.edit(editBuilder => {
		const startPos = new Position(0, 0);
		const endPos = new Position(lineCount + 1, 0);
		editBuilder.replace(new Range(startPos, endPos), content);
	});
	
	if(commandStatusBar) {
		commandStatusBar.command = constant.COMMAND_TEXT_UNDO_FORMAT;
		commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_UNDO_FORMAT;
	}
	updateSelectInfo(document, currentTextEditor.selection.start, true, 1);
}

function undoFormatTxt(): void {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return;
	}
	const { document } = activeTextEditor;
	const { lineCount } = document;
	let content = '';
	let canExecute = false;
	const filePath = document.fileName;
	
	for(let idx = 0; idx < lineCount; ++ idx) {
		const data = document.lineAt(idx).text;
		if(data.length === 0) { continue; }
		if(data.indexOf('-+-') !== -1) {
			canExecute = true;
			continue;
		}
		if(isAddedTitle(data) || isAddedContent(data)) { return; }
		const rowData : string[] = data.split(' | ');
		const length = rowData.length;
		rowData[0] = rowData[0].substr(1);
		rowData[length - 1] = rowData[length - 1].substr(0, rowData[length - 1].length - 1);
		for(let idx2 = 0; idx2 < length; ++ idx2) {
			rowData[idx2] = rowData[idx2].trim();
		}
		content += rowData.join('\t') + '\n';
	}
	if(! canExecute) {
		logUtil.showInfo(`执行 ${constant.COMMAND_TEXT_UNDO_FORMAT} 失败`);
		return;
	}
	currentTxtFilePath = '';
	editUtil.getInstance
			.addEdit(editBuilder => {
				const startPos = new Position(0, 0);
				const endPos = new Position(lineCount + 1, 0);
				editBuilder.replace(new Range(startPos, endPos), content);
			}).startEdit()
			.then(_ => {
					updateCommandStatusBar();
			});
	updateSelectInfo(document, activeTextEditor.selection.start, true, -1);
}

function updateCurrentFileHeaderInfo(document : TextDocument, separator : string, rowNameOffset = 0) : void {
	let columnCount = currentColumnNameList.length;
	if(columnCount === 0 || currentTxtFilePath !== document.fileName) {
		currentTxtFilePath = document.fileName;
		currentColumnNameList = [];
		const { lineCount } = document;
		for(let idx = 0; idx < lineCount; ++ idx) {
			let line = document.lineAt(idx).text;
			if(line.trim().length === 0) { continue; }
			if(line[0] === '+') { continue; }
			if(line[0] === '|') { line = line.substr(1); }
			// format 或者 undoFormat 时 document 的内容并没有立刻刷新, 获取到的内容是旧的
			currentColumnNameRowIdx = idx + rowNameOffset;
			currentColumnNameList = line.split(separator);
			columnCount = currentColumnNameList.length;
			for(let idx2 = 0; idx2 < columnCount; ++ idx2) {
				currentColumnNameList[idx2] = currentColumnNameList[idx2].trim();
			}
			break;
		}
	}
}

function getWordAtPosition(document : TextDocument, position : Position) : string {
	const wordRange = document.getWordRangeAtPosition(position, GetWordRegExp);
	if(wordRange === undefined) { return ''; }
	const word = document.getText(wordRange);
	if(word.indexOf('-+-') !== -1 || word.indexOf(' | ') !== -1) { return ''; }
	return word;
}

function getCurrentLine(document : TextDocument, position : Position) : string {
	let currentLine = document.lineAt(position).text;
	if(currentLine.charAt(0) === '|') { currentLine = currentLine.substr(1); }
	return currentLine;
}

class ColumnInfo {
	readonly separator : string;
	readonly line : string;
	readonly idx : number;

	constructor(line : string, separator : string, idx : number) {
		this.separator = separator;
		this.line = line;
		this.idx = idx;
	}
}

enum LineType {
	LineTypeAll, LineTypeTitle, LineTypeSeparator
}

class LineInfo {
	readonly lineType : LineType;
	readonly content : string;
	startPosition : number;
	endPosition : number;

	constructor(lineType : LineType, content : string, startPosition : number, endPosition : number = -1) {
		this.lineType = lineType;
		this.content = content;
		this.startPosition = startPosition;
		this.endPosition = endPosition === -1 ? startPosition + 1 : endPosition;
	}
}

function getCurrentColumnInfo(document: TextDocument, position: Position, rowNameOffset = 0) : ColumnInfo | undefined {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return undefined;
	}
	
	let currentLine = getCurrentLine(document, position);
	const separator = getSeparator(document);
	updateCurrentFileHeaderInfo(document, separator, rowNameOffset);

	const contentIdx = position.character;
	const length = currentLine.length;
	let separatorIdx = -1;
	let idx = 0;

	currentLine = currentLine + separator;
	while(separatorIdx < length) {
		separatorIdx = currentLine.indexOf(separator, separatorIdx + 1);
		if(separatorIdx === -1) { break; }
		if(separatorIdx >= contentIdx) { return new ColumnInfo(currentLine, separator, idx); }
		++ idx;
	}

	return undefined;
}

function provideTxtHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
	const columnInfo = getCurrentColumnInfo(document, position);
	if(columnInfo === undefined) { return; }

	var { idx, line, separator } = columnInfo;
	const hoverContent = getWordAtPosition(document, position);
	if(hoverContent.length === 0) { return; }
	const currentRowData = line.split(separator);
	const columnCount = currentColumnNameList.length;
	const header = (columnCount > idx ? currentColumnNameList[idx] : '');
	const shortInfo = (position.line === currentColumnNameRowIdx);
	const headerInfo = shortInfo ? '' :
						`|  Header  |         **${header}**           |\n` +
						`|   Front  | **${currentRowData[0].trim()}** |\n`;
	const tipInfo = `| Column # ${idx + 1} |                                 |\n` +
					`| :-----------------: | :-----------------------------: |\n` + headerInfo +
					`|       Front2        | **${currentRowData[1].trim()}** |\n` +
					`|      Content        |       **${hoverContent}**       |\n`;
	return new Hover(tipInfo);
}

function updateCommandStatusBar() : void {
	if(currentState === TextState.NoText) {
		if(commandStatusBar) { commandStatusBar.hide(); }
		return;
	}
	if(! commandStatusBar) {
		commandStatusBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 200);
	}

	if(currentState === TextState.TextNormal) {
		commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_FORMAT;
		commandStatusBar.command = constant.COMMAND_TEXT_FORMAT;
	} else if(currentState === TextState.TextFormat) {
		commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_UNDO_FORMAT;
		commandStatusBar.command = constant.COMMAND_TEXT_UNDO_FORMAT;
	}
	commandStatusBar.color = constant.STATUS_BAR_ITEM_TXT_COMMAND_COLOR;
	commandStatusBar.show();
}

function openWebView() : void {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return;
	}
	const { document } = activeTextEditor;
	let { fileName } = document;
	fileName = path.basename(fileName);
	if(webViewPanel) { webViewPanel.dispose(); }
	webViewPanel = vscode.window.createWebviewPanel(
		constant.WEBVIEW_TYPE_TXT,
		`${fileName}-webview`,
		vscode.ViewColumn.One, {
			enableScripts: true,
			retainContextWhenHidden: false
		}
	);
	let separator = getSeparator(document);
	if(separator.length === 0) {
		logUtil.showError('格式错误, 无法打开');
		return;
	}
	let content : any = {};
	const { lineCount } = document;
	let line = 0;
	for(let idx = 0; idx < lineCount; ++ idx) {
		const data = document.lineAt(idx).text.trim();
		if(data.length === 0) { continue; }
		if(! isTitle(data) && ! isContent(data)) { continue; }
		const rowData : string[] = data.split(separator);
		const length = rowData.length;
		if(rowData[0].charAt(0) === '|' && length > 0) {
			rowData[0] = rowData[0].trim().substr(1);
			rowData[length - 1] = rowData[length - 1].trim().substr(0, rowData[length - 1].length - 1);
		}
		let row : any = {};
		if(idx === currentColumnNameRowIdx) {
			for(let idx2 = 0; idx2 < length; ++ idx2) {
				row[idx2] = { text: rowData[idx2].trim(), style: 0 };
			}
		} else {
			row[0] = { text: rowData[0].trim(), style: 0 };
			for(let idx2 = 1; idx2 < length; ++ idx2) {
				row[idx2] = { text: rowData[idx2].trim(), style: 1 };
			}
		}
		content[line] = { 'cells': row };
		++ line;
	}
	let htmlContent = webviewUtil.getWebViewContent(selfContext, 'src/html/txt.html');
	let contentStr = JSON.stringify(content);
	contentStr = contentStr.replace(GetDigitRegExp, '$1');
	htmlContent = htmlContent.replace('rowData', contentStr);
	webViewPanel.webview.html = htmlContent;
}

function initWebViewStatusBarItem() : void {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return;
	}
	webViewStatusBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 200);

	webViewStatusBar.command = constant.COMMAND_TXT_OPEN_WEBVIEW;
	webViewStatusBar.text = constant.STATUS_BAR_ITEM_TXT_WEBVIEW;
	webViewStatusBar.color = constant.STATUS_BAR_ITEM_TXT_WEBVIEW_COLOR;
	webViewStatusBar.show();
}

function onTextEditorChange(editor: TextEditor | undefined) {
	if(currentTextEditor) {
		logUtil.debug(`[onTextEditorChange] previous file: ${currentTextEditor.document.fileName}`);
		deleteAddLineByType(currentTextEditor.document.fileName, LineType.LineTypeAll);
		editUtil.getInstance.init(undefined);
	}
	currentTxtFilePath = '';
	currentTextEditor = undefined;
	checkCurrentState();
	updateCommandStatusBar();
	if(! editor || editor.document.languageId !== constant.LANGUAGE_TEXT) {
		if(webViewStatusBar) { webViewStatusBar.hide(); }
		if(headerStatuBar) { headerStatuBar.hide(); }
		if(frontStatuBar) { frontStatuBar.hide(); }
		return;
	}
	editUtil.getInstance.init(editor);
	currentTextEditor = editor;
	const filePath = editor.document.fileName;
	if(webViewStatusBar) { webViewStatusBar.show(); }
	updateSelectInfo(editor.document, editor.selection.start);
}

function updateSelectInfo(document : TextDocument, position : Position, forceUpdate = false, rowNameOffset = 0) : void {
	if(! position) { return; }
	if(! headerStatuBar) { headerStatuBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 200); }
	if(! frontStatuBar) { frontStatuBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 200); }
	headerStatuBar.show();
	frontStatuBar.show();
	var columnInfo = getCurrentColumnInfo(document, position, rowNameOffset);
	if(columnInfo === undefined) {
		headerStatuBar.text = '';
		frontStatuBar.text = '';
		return;
	}
	const currentInfo = getWordAtPosition(document, position);
	if(currentInfo.length === 0) {
		headerStatuBar.text = '';
		frontStatuBar.text = '';
		return;
	}
	const { idx, line, separator } = columnInfo;
	const currentRowData = line.split(separator);
	const columnCount = currentColumnNameList.length;
	const header = (columnCount > idx ? currentColumnNameList[idx] : '');
	frontStatuBar.text = `Front: ${currentRowData[0].trim()}, ${currentRowData[1].trim()}`;
	if(position.line === currentColumnNameRowIdx) { headerStatuBar.text = ''; } 
	else { headerStatuBar.text = `Col #${idx + 1}, ${header}`; }
}

function updateSeparator(document : TextDocument, position : Position) : void {
	if(currentState !== TextState.TextFormat) { return; }
	if(position.line === lastSelectLine) { return; }
	if(editUtil.getInstance.isEditing()) { return; }
	const line = document.lineAt(position.line).text;
	if(line.indexOf('-+-') !== -1 || line.indexOf('=+=') !== -1) { return; }
	logUtil.debug(`[updateSelectInfo] position: ${position.line}`);
	const lineInfoList = getAddLineByType(document.fileName, LineType.LineTypeAll);
	let previousIsAdd = false;
	let nextIsAdd = false;
	if(lineInfoList.length > 0) {
		const count = lineInfoList.length;
		for(let idx = 0; idx < count; ++ idx) {
			if(lineInfoList[idx].lineType === LineType.LineTypeSeparator) {
				if(lineInfoList[idx].startPosition + 1 === position.line) { previousIsAdd = true; }
				if(lineInfoList[idx].endPosition === position.line + 2) { nextIsAdd = true; }
				continue;
			}
			if(lineInfoList[idx].startPosition + 1 === position.line) { previousIsAdd = true; }
			if(lineInfoList[idx].startPosition === position.line + 1) { nextIsAdd = true; }
		}
	}
	const deleteEdit = deleteAddLineByType(document.fileName, LineType.LineTypeSeparator);
	editUtil.getInstance.addEdit(deleteEdit);
	if(position.line <= currentColumnNameRowIdx + 1 || position.line + 1 >= document.lineCount) {
		if(deleteEdit) { editUtil.getInstance.startEdit(); }
		lastSelectLine = -1;
		return;
	}
	const previous = document.lineAt(position.line - 1).text;
	const next = document.lineAt(position.line + 1).text;
	if((! previousIsAdd && previous.indexOf('-+-') !== -1) || (! nextIsAdd && next.indexOf('-+-') !== -1)) {
		if(deleteEdit) { editUtil.getInstance.startEdit(); }
		lastSelectLine = -1;
		return;
	}
	const offset = (lastSelectLine !== -1 && lastSelectLine < position.line) ? -2 : 0;
	const content = document.lineAt(currentColumnNameRowIdx + 1).text.replace(/-/g, '=') + '\n';
	const upLineInfo = new LineInfo(LineType.LineTypeSeparator, content, position.line);
	const downLineInfo = new LineInfo(LineType.LineTypeSeparator, content, position.line + 1);
	editUtil.getInstance.addEdit(addLine(document.fileName, upLineInfo, offset))
					 .addEdit(addLine(document.fileName, downLineInfo, offset + 1))
					 .startEdit();
	lastSelectLine = position.line + 1 + offset;
	logUtil.debug(`[updateSelectInfo] lastSelectLine: ${lastSelectLine}`);
}

function getAddLineByType(fileName : string, lineType : LineType) : LineInfo[] {
	if(! addedLineDic.has(fileName)) { addedLineDic.set(fileName, new Array<LineInfo>()); }
	const lineInfoList = addedLineDic.get(fileName);
	if(lineInfoList === undefined) { return []; }
	return lineInfoList.filter(value => value.lineType === lineType);
}

function deleteAddLineByType(fileName : string, lineType : LineType) : ((editBuilder: TextEditorEdit) => void) | undefined | Array<(editBuilder: TextEditorEdit) => void> {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return undefined;
	}
	if(! addedLineDic.has(fileName)) { addedLineDic.set(fileName, new Array<LineInfo>()); }
	const lineInfoList = addedLineDic.get(fileName);
	if(lineInfoList === undefined || lineInfoList.length === 0) { return undefined; }
	let count = lineInfoList.length;
	const callbackList : Array<(editBuilder: TextEditorEdit) => void> = new Array();
	if(lineType === LineType.LineTypeAll) {
		for(let idx = 0; idx < count; ++ idx) {
			const deleteLineInfo = lineInfoList[idx];
			const startPos = new Position(deleteLineInfo.startPosition, 0);
			const endPos = new Position(deleteLineInfo.endPosition, 0);
			callbackList.push(editBuilder => editBuilder.delete(new Range(startPos, endPos)));
			logUtil.debug(`delete start: ${deleteLineInfo.startPosition}, end: ${deleteLineInfo.endPosition}`);
		}
		lineInfoList.length = 0;
		return callbackList;
	}
	const deleteIdxList = lineInfoList.map((value, index) => value.lineType === lineType ? index : -1)
									  .filter(value => value >= 0);
	if(deleteIdxList.length === 0) { return undefined; }
	const deleteCount = deleteIdxList.length;
	
	const deleteRangeList = new Array<Range>();
	for(let idx = 0; idx < deleteCount; ++ idx) {
		const deleteIdx = deleteIdxList[idx];
		const deleteLineInfo = lineInfoList[deleteIdx];
		const startPos = new Position(deleteLineInfo.startPosition, 0);
		const endPos = new Position(deleteLineInfo.endPosition, 0);
		deleteRangeList.push(new Range(startPos, endPos));
	}
	if(deleteCount === count) {
		for(let idx = 0; idx < deleteCount; ++ idx) {
			callbackList.push(editBuilder => editBuilder.delete(deleteRangeList[idx]));
			logUtil.debug(`delete start: ${deleteRangeList[idx].start.line}, end: ${deleteRangeList[idx].end.line}`);
		}
		lineInfoList.length = 0;
		return callbackList;
	}
	for(let idx = deleteCount - 1; idx >= 0; -- idx) {
		const deleteIdx = deleteIdxList[idx];
		const deleteLineInfo = lineInfoList[deleteIdx];
		lineInfoList.splice(deleteIdx, 1);
		count -= 1;
		const deleteLineCount = deleteLineInfo.endPosition - deleteLineInfo.startPosition;
		for(let idx2 = 0; idx2 < count; ++ idx2) {
			if(lineInfoList[idx2].startPosition < deleteLineInfo.startPosition) { continue; }
			lineInfoList[idx2].startPosition -= deleteLineCount;
			lineInfoList[idx2].endPosition -= deleteLineCount;
		}
		// 要删除的那些行还没实际删除, 所以要删的那些行的行号不能修改
		callbackList.push(editBuilder => editBuilder.delete(deleteRangeList[idx]));
		logUtil.debug(`delete start: ${deleteRangeList[idx].start.line}, end: ${deleteRangeList[idx].end.line}`);
	}
	return callbackList;
}

function addLine(fileName : string, lineInfo : LineInfo, offset : number = 0) : ((editBuilder: TextEditorEdit) => void) | undefined {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return undefined;
	}
	let lineInfoList = addedLineDic.get(fileName);
	if(lineInfoList === undefined) {
		lineInfoList = new Array<LineInfo>();
		addedLineDic.set(fileName, lineInfoList);
	}
	const count = lineInfoList.length;
	const addLineCount = lineInfo.endPosition - lineInfo.startPosition;
	for(let idx = 0; idx < count; ++ idx) {
		if(lineInfoList[idx].startPosition < lineInfo.startPosition) { continue; }
		lineInfoList[idx].startPosition += addLineCount;
		lineInfoList[idx].endPosition += addLineCount;
		logUtil.debug(`start: ${lineInfoList[idx].startPosition - addLineCount} -> ${lineInfoList[idx].startPosition}`);
	}
	lineInfoList.push(lineInfo);
	const insertPos = new Position(lineInfo.startPosition, 0);
	// 因为添加之前可能会删除掉一些行, document 中行号还没发生改变, 但是实际存储的行号得修正一下
	lineInfo.startPosition += offset;
	lineInfo.endPosition += offset;
	logUtil.debug(`adjust start: ${lineInfo.startPosition}, end: ${lineInfo.endPosition}`);
	return editBuilder => {
		editBuilder.insert(insertPos, lineInfo.content);
		logUtil.debug(`insert start: ${insertPos.line}, count: ${addLineCount}`);
	};
}

function onTextEditorSelectChange(event : vscode.TextEditorSelectionChangeEvent) {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return;
	}
	const { selections } = event;
	if(! selections || selections.length === 0 || ! selections[0]) { return; }
	const position = selections[0].start;
	if(! position) {  return; }
	updateSelectInfo(activeTextEditor.document, position);
	updateSeparator(activeTextEditor.document, position);
}

function update() : void {
	if(! currentTextEditor) { return; }
	checkCurrentState();
	updateCommandStatusBar();
	checkVisibleRangeChange();
}

function checkCurrentState() : void {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		currentState = TextState.NoText;
		return;
	}
	const { document } = activeTextEditor;
	const { lineCount } = document;
	
	for(let idx = 0; idx < lineCount; ++ idx) {
		const data = document.lineAt(idx).text;
		if(data.length === 0) { continue; }
		if(data.indexOf('-+-') !== -1) {
			currentState = TextState.TextFormat;
			return;
		}
	}

	currentState = TextState.TextNormal;
}

function checkVisibleRangeChange() : void {
	if(! currentTextEditor) { return; }
	if(currentState !== TextState.TextFormat) { return; }
	if(editUtil.getInstance.isEditing()) { return; }
	const { document } = currentTextEditor;
	const filePath = document.fileName;
	const titleLineInfoList = getAddLineByType(filePath, LineType.LineTypeTitle);
	const { visibleRanges } = currentTextEditor;
	if(! visibleRanges || visibleRanges.length === 0 || ! visibleRanges[0] || ! visibleRanges[0].start) { return; }
	let startLine = visibleRanges[0].start.line + 1;
	const separatorList = getAddLineByType(filePath, LineType.LineTypeSeparator);
	if(separatorList.length === 2) {
		const upStart = Math.min(separatorList[0].startPosition, separatorList[1].startPosition);
		const upEnd = Math.min(separatorList[0].endPosition, separatorList[1].endPosition);
		const downStart = Math.max(separatorList[0].startPosition, separatorList[1].startPosition);
		const downEnd = Math.max(separatorList[0].endPosition, separatorList[1].endPosition);
		if(startLine > upStart && startLine < downEnd) {
			startLine = downEnd;
		}
	}
	let offset = 0;
	if(titleLineInfoList.length !== 0 && titleLineInfoList[0].startPosition === startLine) { return; }
	if(titleLineInfoList.length !== 0) {
		if(startLine > titleLineInfoList[0].startPosition) {
			offset = - Math.min(startLine - titleLineInfoList[0].startPosition, 3);
			startLine -= offset;
		}
	}
	const separator = getSeparator(document);
	if(separator.length === 0 || separator === '\t') { return; }
	updateCurrentFileHeaderInfo(document, separator);
	const deleteEdit = deleteAddLineByType(filePath, LineType.LineTypeTitle);
	editUtil.getInstance.addEdit(deleteEdit);
	if(startLine < currentColumnNameRowIdx + 2 || startLine + 3 > document.lineCount) {
		if(deleteEdit) { editUtil.getInstance.startEdit(); }
		return;
	}
	const header = document.getText(new Range(new Position(currentColumnNameRowIdx - 1, 0), new Position(currentColumnNameRowIdx + 2, 0)));
	editUtil.getInstance.addEdit(addLine(filePath, new LineInfo(LineType.LineTypeTitle, header, startLine, startLine + 3), offset))
					 .startEdit();
}

function onWillSave(event : TextDocumentWillSaveEvent) : void {
	if(! event || ! event.document) { return; }
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return;
	}
	const { document } = activeTextEditor;
	const separator = getSeparator(document);
	if(separator === ' | ') { undoFormatTxt(); }
}

function getSeparator(document : TextDocument) : string {
	if(! document || document.lineCount === 0) { return ''; }
	let idx = 0, { lineCount } = document;
	while(idx < lineCount) {
		const line = document.lineAt(idx).text.trim();
		++ idx;
		if(line.length === 0) { continue; }
		if(line.indexOf('\t') !== -1) { return '\t'; }
		if(line.indexOf('-+-') !== -1 || line.indexOf(' | ') !== -1) { return ' | '; }
	}
	return '';
}

function getStringLength(data : string) : number {
	if(! data || data.length === 0) { return 0; }
	const dataLength = data.length;
	let result = dataLength;
	for(let idx = 0; idx < dataLength; ++ idx) {
		if(data.charCodeAt(idx) & 0xFF00) {
			if(SeparatorChar.indexOf(data.charAt(idx)) !== -1) { continue; }
			++ result;
		}
	}
	return result;
}

function alignString(data : string, maxWidth : number, fillChar : string = ' ') : string {
	fillChar = fillChar.charAt(0);
	const realLength = getStringLength(data);
	if(realLength >= maxWidth) { return data; }
	const frontLength = (maxWidth - realLength) >> 1;
	let frontStr = fillChar.repeat(frontLength);
	const behindLength = maxWidth - realLength - frontLength;
	let behindStr = fillChar.repeat(behindLength);
	return frontStr + data + behindStr;
}

function getNewColumnData(rowData : string[],
						  rowMaxWidthList : number[],
						  fillChar : string = ' ',
						  startChar : string = '║ ',
						  intervalChar : string = ' ║ ',
						  endchar : string = ' ║') : string {
	if(! rowData || rowData.length === 0) { return ''; }
	let line = startChar + alignString(rowData[0], rowMaxWidthList[0], fillChar);
	const length = rowData.length;
	for(let idx = 1; idx < length; ++ idx) {
		line += intervalChar + alignString(rowData[idx], rowMaxWidthList[idx], fillChar);
	}
	return line += endchar + '\n';
}

// ╠  ID  ╬ 技能类型  ╬     技能名称     ╬ 冷却时间 ╣
function isTitle(line : string) : boolean {
	return line.startsWith(TitleStartStr);
}

// ║  2   ║    31     ║     召唤技能     ║    15    ║
function isContent(line : string) : boolean {
	return line.startsWith(ContentStartStr);
}

// ╔══════╦═══════════╦══════════════════╦══════════╗
// ╠══════╬═══════════╬══════════════════╬══════════╣
// ╚══════╩═══════════╩══════════════════╩══════════╝
function isSeparator(line : string) : boolean {
	return line.startsWith(TopStartStr) || line.startsWith(MiddleStartStr) || line.startsWith(BottomStartStr);
}

// ╒══════╤═══════════╤══════════════════╤══════════╕
// ┆  ID  ┆ 技能类型  ┆     技能名称     ┆ 冷却时间 ┆
// ╘══════╧═══════════╧══════════════════╧══════════╛
function isAddedTitle(line : string) : boolean {
	return line.startsWith(AddedTitleTopStartStr) || line.startsWith(AddedTitleStartStr) || line.startsWith(AddedTitleBottomStartStr);
}

// ┏━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┓
// ┇  23  ┇    62     ┇    狙击炮技能    ┇    20    ┇
// ┖──────┸━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━┛
function isAddedContent(line : string) : boolean {
	return line.startsWith(AddedContentTopStartStr) || line.startsWith(AddedContentStartStr) || line.startsWith(AddedContentBottomStartStr);
}