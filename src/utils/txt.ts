import { StatusBarPriority } from './../constant';
import * as vscode from 'vscode';
import * as constant from '../constant';
import { Hover, ProviderResult, Position, TextDocument, ExtensionContext, Range, StatusBarAlignment, StatusBarItem, WebviewPanel, TextEditor, TextDocumentWillSaveEvent, TextEditorEdit, TextEditorVisibleRangesChangeEvent, TextDocumentChangeEvent, TextEditorSelectionChangeEvent, CancellationToken, TextEditorDecorationType } from 'vscode';
import * as path from 'path';
import * as webviewUtil from './webviewUtil';
import * as editUtil from './editUtil';
import { TextStatus as TextStatus } from '../constant';
import * as logUtil from './logUtil';
import * as messageBroker from './messageBroker';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MessageCode } from './messageBroker';

enum LineType { All, Title, Separator, ModifiedContent }

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

const GetWordRegExp = /[^\t \n║┃┆┇]+/;
const GetDigitRegExp = /(?<=[^:])"(\d+)"/g;
const ReplaceSeparatorRegExp2 = /║/g;

let decorationType : TextEditorDecorationType;

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
const TitleSeparatorStr = SeparatorChar[SeparatorType.FillChar] + SeparatorChar[SeparatorType.TitleVertical] + SeparatorChar[SeparatorType.FillChar];
const TitleEndStr = SeparatorChar[SeparatorType.FillChar] + SeparatorChar[SeparatorType.TitleVertical];
// ╠══════╬═══════════╬══════════════════╬══════════╣
const MiddleStartStr = SeparatorChar[SeparatorType.MiddleLeft] + SeparatorChar[SeparatorType.Horizontal];
// ║  2   ║    31     ║     召唤技能     ║    15    ║
const ContentStartStr = SeparatorChar[SeparatorType.Vertical] + SeparatorChar[SeparatorType.FillChar];
const ContentSeparatorStr = SeparatorChar[SeparatorType.FillChar] + SeparatorChar[SeparatorType.Vertical] + SeparatorChar[SeparatorType.FillChar];
const ContentEndStr = SeparatorChar[SeparatorType.FillChar] + SeparatorChar[SeparatorType.Vertical];
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
const AddedTitleTopStartStr = AddedTitleSeparatorChar[AddedTitleSeparatorType.TopLeft] + AddedTitleSeparatorChar[AddedTitleSeparatorType.Horizontal];
// ┆  ID  ┆ 技能类型  ┆     技能名称     ┆ 冷却时间 ┆
const AddedTitleStartStr = AddedTitleSeparatorChar[AddedTitleSeparatorType.TopLeft] + AddedTitleSeparatorChar[AddedTitleSeparatorType.FillChar];
// ╘══════╧═══════════╧══════════════════╧══════════╛
const AddedTitleBottomStartStr = AddedTitleSeparatorChar[AddedTitleSeparatorType.BottomLeft] + AddedTitleSeparatorChar[AddedTitleSeparatorType.Horizontal];

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
// AddedContentSeparatorType.BottomLeft: '┗'
// AddedContentSeparatorType.BottomCenter: '┻'
// AddedContentSeparatorType.BottomRight: '┛'
const AddedContentSeparatorChar = [' ', '━', '┇', '┏', '┳', '┓', '┗', '┻', '┛'];
// ┏━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┓
const AddedContentTopStartStr = AddedContentSeparatorChar[AddedContentSeparatorType.TopLeft] + AddedContentSeparatorChar[AddedContentSeparatorType.Horizontal];
// ┇  23  ┇    62     ┇    狙击炮技能    ┇    20    ┇
const AddedContentStartStr = AddedContentSeparatorChar[AddedContentSeparatorType.Vertical] + AddedContentSeparatorChar[AddedContentSeparatorType.FillChar];
const AddedContentSeparatorStr = AddedContentSeparatorChar[AddedContentSeparatorType.FillChar] + AddedContentSeparatorChar[AddedContentSeparatorType.Vertical] + AddedContentSeparatorChar[AddedContentSeparatorType.FillChar];
// ┗━━━━━━┻━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━┛
const AddedContentBottomStartStr = AddedContentSeparatorChar[AddedContentSeparatorType.BottomLeft] + AddedContentSeparatorChar[AddedContentSeparatorType.Horizontal];

const SeparatorSet : Set<string> = new Set<string>(SeparatorChar.concat(AddedTitleSeparatorChar, AddedContentSeparatorChar));

let currentFilePath = '';
let currentColumnNameRowIdx = -1;
let currentColumnNameList : string[] = [];
let commandStatusBar : StatusBarItem;
let webViewStatusBar : StatusBarItem;
let webViewPanel : WebviewPanel;
let selfContext : ExtensionContext;
let headerStatuBar : StatusBarItem;
let frontStatuBar : StatusBarItem;
let lastSelectLine : number = -1;
let currentTextStatus : TextStatus = TextStatus.NoText;
let currentTextEditor : TextEditor | undefined = undefined;
let addedLineDic : Map<string, Array<LineInfo>> = new Map();
const contentIsDirtyDic : Map<string, boolean> = new Map();

export function initialize(context : ExtensionContext) : void {
	selfContext = context;
	currentTextEditor = vscode.window.activeTextEditor;
	let disposable;

	disposable = vscode.commands.registerCommand(constant.COMMAND_TEXT_FORMAT, formatTxt);
	selfContext.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand(constant.COMMAND_TEXT_UNDO_FORMAT, undoFormatTxt);
	selfContext.subscriptions.push(disposable);

	disposable = vscode.languages.registerHoverProvider(constant.LANGUAGE_TEXT, { provideHover: provideTxtHover });
	selfContext.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand(constant.COMMAND_TXT_OPEN_WEBVIEW, openWebView);
	selfContext.subscriptions.push(disposable);

	const { activeTextEditor } = vscode.window;
	currentTextEditor = activeTextEditor;
	if(currentTextEditor) {
		editUtil.getInstance.init(currentTextEditor);
		currentFilePath = currentTextEditor.document.fileName;
	}
	// editUtil.getInstance.addEdit(editBuilder => {
	// 							editBuilder.insert(new Position(0, 0), '1\n');
	// 							logUtil.trace('1');
	// 						})
	// 						.startEdit()
	// 						.then(_ => logUtil.debug('2'))
	// 						.addEdit(editBuilder => {
	// 							editBuilder.insert(new Position(0, 0), '2\n');
	// 							logUtil.info('3');
	// 						})
	// 						.startEdit()
	// 						.then(_ => logUtil.warn('4'))
	// 						.addEdit(editBuilder => {
	// 							editBuilder.insert(new Position(0, 0), '3\n');
	// 							logUtil.error('5');
	// 						})
	// 						.startEdit()
	// 						.then(_ => logUtil.fatal('6'));

	// 打开的文本改变时触发
	vscode.window.onDidChangeActiveTextEditor(onTextEditorChange);

	// 状态改变
	const updateTextStatusSubject = new Subject<TextStatus | undefined>();
	messageBroker.addSubject(MessageCode.UpdateTextStatus, updateTextStatusSubject);
	updateTextStatusSubject.subscribe(textState => updateTextStatus(textState));
	messageBroker.sendUpdateTextStatusMessage();

	// 更新文本的信息, 比如表头的信息
	const updateTextInfoSubject = new Subject<void>();
	messageBroker.addSubject(MessageCode.UpdateTextInfo, updateTextInfoSubject);
	updateTextInfoSubject.subscribe(() => updateTextInfo());
	messageBroker.sendUpdateTextInfoMessage();

	// 保存前触发
	vscode.workspace.onWillSaveTextDocument(onWillSave);
	
	// 修改文本
	vscode.workspace.onDidChangeTextDocument(event => messageBroker.sendTextDocumentChangeMessage(event));
	const documentChangeSubject = new Subject<TextDocumentChangeEvent>();
	messageBroker.addSubject(MessageCode.TextDocumentChange, documentChangeSubject);
	documentChangeSubject.subscribe(event => onTextDocumentChange(event));
	
	// 竖直方向可视区域改变
	vscode.window.onDidChangeTextEditorVisibleRanges(event => messageBroker.sendVisibleRangesChangeMessage(event));
	const visibleRangeChangedSubject = new Subject<TextEditorVisibleRangesChangeEvent>();
	messageBroker.addSubject(MessageCode.VisibleRangesChange, visibleRangeChangedSubject);
	visibleRangeChangedSubject.pipe(debounceTime(333)).subscribe(event => onVisibleRangeChanged(event));
	
	// 选择的区域的改变
	vscode.window.onDidChangeTextEditorSelection(event => messageBroker.sendTextEditorSelectChangeMessage(event));
	const textEditorSelectChangeSubject = new Subject<TextEditorSelectionChangeEvent | undefined>();
	messageBroker.addSubject(MessageCode.TextEditorSelectChange, textEditorSelectChangeSubject);
	textEditorSelectChangeSubject.pipe(debounceTime(333)).subscribe(event => onTextEditorSelectChange(event));

	// 更新左下角的命令按钮
	const commandStatusBarSubject = new Subject<void>();
	messageBroker.addSubject(MessageCode.UpdateCommandStatusBar, commandStatusBarSubject);
	commandStatusBarSubject.subscribe(() => updateCommandStatusBar());
	messageBroker.sendUpdateCommandStatusBarMessage();

	// 更新左下角的 webview 按钮
	const webviewStatusBarSubject = new Subject<void>();
	messageBroker.addSubject(MessageCode.UpdateWebviewStatusBar, webviewStatusBarSubject);
	webviewStatusBarSubject.subscribe(() => updateWebviewStatusBar());
	messageBroker.sendUpdateWebviewStatusBarMessage();

	// 更新左下角的 Header 以及 Front 信息
	const infoStatusBarSubject = new Subject<void>();
	messageBroker.addSubject(MessageCode.UpdateInfoStatusBar, infoStatusBarSubject);
	infoStatusBarSubject.subscribe(() => updateInfoStatusBar());
	messageBroker.sendUpdateInfoStatusBarMessage();

	// 将当前选择区域的框出来
	const emphasizeCurrentLineSubject = new Subject<{ position ?: number, bForceUpdate : boolean; }>();
	messageBroker.addSubject(MessageCode.EmphasizeCurrentLine, emphasizeCurrentLineSubject);
	emphasizeCurrentLineSubject.subscribe(param => emphasizeCurrentLine(param.position, param.bForceUpdate));
	messageBroker.sendEmphasizeCurrentLineMessage({ position : undefined, bForceUpdate : true });
}

function formatTxt(): void {
	if(! currentTextEditor) { return; }
	const { document } = currentTextEditor;
	const { lineCount } = document;
	const rowDataList : Array<string[]> = [];
	const rowMaxSizeList = [];
	for(let idx = 0; idx < lineCount; ++ idx) {
		const line = document.lineAt(idx).text;
		if(line.length === 0) { continue; }
		const rowData : string[] = line.split('\t');
		const length = rowData.length;
		if(length > rowMaxSizeList.length) {
			for(let idx2 = rowMaxSizeList.length; idx2 < length; ++ idx2) {
				rowMaxSizeList.push(0);
			}
		}
		for(let idx2 = 0; idx2 < length; ++ idx2) {
			rowData[idx2] = rowData[idx2].trim();
			rowMaxSizeList[idx2] = Math.max(rowMaxSizeList[idx2], getStringLength(rowData[idx2]));
		}
		rowDataList.push(rowData);
	}
	currentFilePath = '';
	const separatorRowData = [];
	const columnCount = rowMaxSizeList.length;
	for(let idx = 0; idx < columnCount; ++ idx) {
		separatorRowData.push(SeparatorChar[SeparatorType.Horizontal]);
	}
	let content = getNewColumnData(separatorRowData,
								   rowMaxSizeList,
								   SeparatorChar[SeparatorType.Horizontal],
								   SeparatorChar[SeparatorType.TopLeft] + SeparatorChar[SeparatorType.Horizontal],
								   SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.TopCenter] + SeparatorChar[SeparatorType.Horizontal],
								   SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.TopRight]);
	content += getNewColumnData(rowDataList[0],
								rowMaxSizeList,
								SeparatorChar[SeparatorType.FillChar],
								TitleStartStr,
								TitleSeparatorStr,
								TitleEndStr);
	content += getNewColumnData(separatorRowData,
								rowMaxSizeList,
								SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.MiddleLeft] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.MiddleCenter] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.MiddleRight]);
	for(let idx = 1; idx < lineCount; ++ idx) {
		if(! rowDataList[idx]) { continue; }
		content += getNewColumnData(rowDataList[idx], rowMaxSizeList);
	}
	content += getNewColumnData(separatorRowData,
								rowMaxSizeList,
								SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.BottomLeft] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.BottomCenter] + SeparatorChar[SeparatorType.Horizontal],
								SeparatorChar[SeparatorType.Horizontal] + SeparatorChar[SeparatorType.BottomRight]);
	editUtil.getInstance.addEdit(editBuilder => {
							const startPos = new Position(0, 0);
							const endPos = new Position(lineCount + 1, 0);
							editBuilder.replace(new Range(startPos, endPos), content);
						}).startEdit()
						.then(_ => {
							messageBroker.sendUpdateTextStatusMessage(TextStatus.TextFormat);
							messageBroker.sendUpdateTextInfoMessage();
							messageBroker.sendUpdateCommandStatusBarMessage();
							messageBroker.sendTextEditorSelectChangeMessage();
						});
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
	
	for(let idx = 0; idx < lineCount; ++ idx) {
		const data = document.lineAt(idx).text;
		let rowData = undefined;
		if(isContent(data)) { rowData = data.split(SeparatorChar[SeparatorType.Vertical]); }
		else if(isTitle(data)) { rowData = data.split(SeparatorChar[SeparatorType.TitleVertical]); }
		else { continue; }
		canExecute = true;
		rowData.shift();
		rowData.pop();
		const length = rowData.length;
		for(let idx2 = 0; idx2 < length; ++ idx2) {
			rowData[idx2] = rowData[idx2].trim();
		}
		content += rowData.join('\t') + '\n';
	}
	if(! canExecute) {
		logUtil.showInfo(`执行 ${constant.COMMAND_TEXT_UNDO_FORMAT} 失败`);
		return;
	}
	currentFilePath = '';
	editUtil.getInstance.addEdit(editBuilder => {
							const startPos = new Position(0, 0);
							const endPos = new Position(lineCount + 1, 0);
							editBuilder.replace(new Range(startPos, endPos), content);
						})
						.startEdit()
						.then(_ => {
							messageBroker.sendUpdateTextStatusMessage(TextStatus.TextNormal);
							messageBroker.sendUpdateTextInfoMessage();
							messageBroker.sendUpdateCommandStatusBarMessage();
							messageBroker.sendTextEditorSelectChangeMessage();
						});
}

function updateCommandStatusBar() : void {
	if(currentTextStatus === TextStatus.NoText) {
		if(commandStatusBar) { commandStatusBar.hide(); }
		return;
	}
	if(! commandStatusBar) { commandStatusBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority.TxtCommand); }

	if(currentTextStatus === TextStatus.TextNormal) {
		commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_FORMAT;
		commandStatusBar.command = constant.COMMAND_TEXT_FORMAT;
	} else if(currentTextStatus === TextStatus.TextFormat) {
		commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_UNDO_FORMAT;
		commandStatusBar.command = constant.COMMAND_TEXT_UNDO_FORMAT;
	}
	commandStatusBar.color = constant.STATUS_BAR_ITEM_TXT_COMMAND_COLOR;
	commandStatusBar.show();
}

function updateWebviewStatusBar() : void {
	if(currentTextStatus === TextStatus.NoText) {
		if(webViewStatusBar) { webViewStatusBar.hide(); }
		return;
	}
	if(! webViewStatusBar) { webViewStatusBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority.TxtWebview); }

	webViewStatusBar.text = constant.STATUS_BAR_ITEM_TXT_WEBVIEW;
	webViewStatusBar.command = constant.COMMAND_TXT_OPEN_WEBVIEW;
	webViewStatusBar.color = constant.COMMAND_TXT_OPEN_WEBVIEW;
	webViewStatusBar.show();
}

function updateInfoStatusBar() : void {
	if(! currentTextEditor || currentTextStatus === TextStatus.NoText) {
		if(headerStatuBar) { headerStatuBar.hide(); }
		if(frontStatuBar) { frontStatuBar.hide(); }
		return;
	}
	if(! headerStatuBar) { headerStatuBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority.TxtHeader); }
	if(! frontStatuBar) { frontStatuBar = vscode.window.createStatusBarItem(StatusBarAlignment.Left, StatusBarPriority.TxtFront); }
	headerStatuBar.show();
	frontStatuBar.show();
	let headerText = '';
	let frontText = '';
	const { document } = currentTextEditor;
	const { selections } = currentTextEditor;
	if(selections.length === 1) {
		const { start, end } = selections[0];
		if(start.line === end.line) {
			const columnIdx = getColumnIdx(document, start);
			let line = document.lineAt(start.line).text;
			let separator = '\t';
			if(currentTextStatus === TextStatus.TextFormat) {
				separator = ContentSeparatorStr;
				if(line.indexOf(separator) === -1) { separator = AddedContentSeparatorStr; }
				line = line.substr(1);
			}
			const rowData = line.split(separator);
			frontText = `front: ${rowData[0].trim()}${rowData.length > 1 ? ', ' + rowData[1].trim() : ''}`;
			if(columnIdx !== -1) {
				const columnIdx2 = getColumnIdx(document, end);
				if(columnIdx === columnIdx2) {
					if(columnIdx === 0) { frontText = ''; }
					else { frontText = `front: ${rowData[0].trim()}${columnIdx > 1 ? ', ' + rowData[1].trim() : ''}`; }
					const columnCount = currentColumnNameList.length;
					headerText = (columnCount > columnIdx ? `header: ${currentColumnNameList[columnIdx]}` : '');
				}
			}
		}
	}
	headerStatuBar.text = headerText;
	frontStatuBar.text = frontText;
}

const modifyContentReg = new RegExp(SeparatorChar[SeparatorType.Vertical], 'g');
const modifyHorizontalReg = new RegExp(SeparatorChar[SeparatorType.Horizontal], 'g');
const modifyMiddleCenterReg = new RegExp(SeparatorChar[SeparatorType.MiddleCenter], 'g');
function emphasizeCurrentLine(position ?: number, bForceUpdate : boolean = false) : void {
	if(! currentTextEditor) { return; }
	const { document } = currentTextEditor;
	removeEmphasizeInfo(document);
	if(currentTextStatus === TextStatus.NoText) { return; }
	if(! position) {
		const { selection } = currentTextEditor;
		if(selection.start.line !== selection.end.line) { return; }
		position = selection.start.line;
	}
	const line = document.lineAt(position).text;
	// if(! line.startsWith(ContentStartStr)) { return; }
	logUtil.debug(`[updateSeparator] line: ${position}`);
	
	if(position <= currentColumnNameRowIdx + 1 || position + 1 >= document.lineCount) {
		return;
	}
	let separatorContent = document.lineAt(currentColumnNameRowIdx + 1).text
								.replace(modifyHorizontalReg, AddedContentSeparatorChar[AddedContentSeparatorType.Horizontal])
								.substr(1);
	separatorContent = separatorContent.substr(0, separatorContent.length - 1);
	// const upContent = AddedContentSeparatorChar[AddedContentSeparatorType.TopLeft]
	// 					+ separatorContent.replace(modifyMiddleCenterReg, AddedContentSeparatorChar[AddedContentSeparatorType.TopCenter])
	// 					+ AddedContentSeparatorChar[AddedContentSeparatorType.TopRight] + '\n';
	// const downContent = AddedContentSeparatorChar[AddedContentSeparatorType.BottomLeft]
	// 					+ separatorContent.replace(modifyMiddleCenterReg, AddedContentSeparatorChar[AddedContentSeparatorType.BottomCenter])
	// 					+ AddedContentSeparatorChar[AddedContentSeparatorType.BottomRight] + '\n';

	// const upLineInfo = new LineInfo(LineType.Separator, upContent, position);
	// const downLineInfo = new LineInfo(LineType.Separator, downContent, position + 1);
	// const range = new Range(new Position(position, 0), new Position(position + 1, 0));
	// const content = document.lineAt(position).text.replace(modifyContentReg, AddedContentSeparatorChar[AddedContentSeparatorType.Vertical]) + '\n';
	// const modifyLineInfo = new LineInfo(LineType.ModifiedContent, content, position);
	// editUtil.getInstance.addEdit(addLine(document.fileName, upLineInfo))
	// 					.addEdit(modifyLine(document.fileName, modifyLineInfo, range))
	// 					.addEdit(addLine(document.fileName, downLineInfo))
	// 					.startEdit();
	if(decorationType) { decorationType.dispose(); }
	decorationType = getDecorationType();
	currentTextEditor.setDecorations(decorationType, [new Range(new Position(position, 0), new Position(position, line.length + 1))]);
}

function getDecorationType() : TextEditorDecorationType {
	return vscode.window.createTextEditorDecorationType({
		outline: '#00DD99 thin solid'
	});
}

const removeModifiedContentReg = new RegExp(AddedContentSeparatorChar[AddedContentSeparatorType.Vertical], 'g');
function removeEmphasizeInfo(document : TextDocument) : void {
	if(! currentTextEditor) { return; }
	const deleteEdit = deleteAddedLineByType(document.fileName, LineType.Separator);
	if(! deleteEdit) { return; }
	const { fileName } = currentTextEditor.document;
	const modifiedContentList = getAddLineByType(fileName, LineType.ModifiedContent);
	if(modifiedContentList.length === 1) {
		const modifiedContent = modifiedContentList[0];
		const range = new Range(new Position(modifiedContent.startPosition, 0), new Position(modifiedContent.endPosition, 0));
		const content = modifiedContent.content.replace(removeModifiedContentReg, SeparatorChar[SeparatorType.Vertical]);
		deleteEdit.push(editBuilder => editBuilder.replace(range, content));
		const addLineList = addedLineDic.get(document.fileName);
		if(addLineList) {
			const idx = addLineList.indexOf(modifiedContentList[0]);
			if(idx > -1) { addLineList.splice(idx, 1); }
		}
	}
	editUtil.getInstance.addEdit(deleteEdit)
						.startEdit();
}

function updateTextInfo() : void {
	currentColumnNameList.length = 0;
	currentColumnNameRowIdx = -1;
	if(! currentTextEditor || currentTextStatus === TextStatus.NoText) {
		return;
	}
	const { document } = currentTextEditor;
	const { lineCount } = document;
	let separator = '\t';
	if(currentTextStatus === TextStatus.TextFormat) {
		for(let idx = 0; idx < lineCount; ++ idx) {
			let line = document.lineAt(idx).text;
			if(line.startsWith(TitleStartStr)) {
				currentColumnNameRowIdx = idx;
				separator = TitleSeparatorStr;
				break;
			}
		}
	} else {
		for(let idx = 0; idx < lineCount; ++ idx) {
			let line = document.lineAt(idx).text;
			if(line.trim().length !== 0) {
				currentColumnNameRowIdx = idx;
				break;
			}
		}
	}
	if(currentColumnNameRowIdx === -1) { return; }
	let line = document.lineAt(currentColumnNameRowIdx).text;
	if(currentTextStatus === TextStatus.TextFormat) { line = line.substr(1); }
	currentColumnNameList = line.split(separator);
	const columnCount = currentColumnNameList.length;
	for(let idx = 0; idx < columnCount; ++ idx) {
		currentColumnNameList[idx] = currentColumnNameList[idx].trim();
	}
}

function getWordAtPosition(document : TextDocument, position : Position) : string {
	const wordRange = document.getWordRangeAtPosition(position, GetWordRegExp);
	if(wordRange === undefined) { return ''; }
	const word = document.getText(wordRange);
	if(word.indexOf('-+-') !== -1 || word.indexOf(' | ') !== -1) { return ''; }
	return word;
}

function getColumnIdx(document: TextDocument, position: Position) : number {
	if(! currentTextEditor || currentTextStatus === TextStatus.NoText || ! position) { return -1; }

	let separator = (currentTextStatus === TextStatus.TextFormat ? ContentSeparatorStr : '\t');
	let line = document.lineAt(position).text;
	if(line.indexOf(separator) === -1) { separator = AddedContentSeparatorStr; }
	line += separator;
	if(currentTextStatus === TextStatus.TextFormat && ! line.startsWith(ContentStartStr) && ! line.startsWith(AddedContentStartStr)) { return -1; }

	const contentIdx = position.character;
	const length = line.length;
	let separatorIdx = -1;
	let idx = 0;

	while(separatorIdx < length) {
		separatorIdx = line.indexOf(separator, separatorIdx + 1);
		if(separatorIdx === -1) { break; }
		if(separatorIdx >= contentIdx) { return idx; }
		++ idx;
	}

	return -1;
}

function provideTxtHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
	const columnIdx = getColumnIdx(document, position);
	if(columnIdx === -1) { return; }

	let separator = '\t';
	let line = document.lineAt(position.line).text;
	if(currentTextStatus === TextStatus.TextFormat) {
		separator = ContentSeparatorStr;
		if(line.indexOf(separator) === -1) { separator = AddedContentSeparatorStr; }
		line = line.substr(1);
	}
	const hoverContent = getWordAtPosition(document, position);
	if(hoverContent.length === 0) { return; }
	const currentRowData = line.split(separator);
	const columnCount = currentColumnNameList.length;
	const header = (columnCount > columnIdx ? currentColumnNameList[columnIdx] : '');
	const frontInfo = (columnIdx === 0 ? '' :
					`|         ---------         |                                 |\n` +
					`|           Front           | **${currentRowData[0].trim()}** |\n`);
	const front2Info = (columnIdx < 2 ? '' :
					`|          Front2           | **${currentRowData[1].trim()}** |\n`);
	const headerInfo = position.line === currentColumnNameRowIdx ? '' :
					`|          Header           |         **${header}**           |\n`;
	const tipInfo = `| Column # ${columnIdx + 1} |                                 |\n` +
					`| :-----------------------: | :-----------------------------: |\n` +
					headerInfo + frontInfo + front2Info +
					`|        ---------          |                                 |\n` +
					`|         Content           |       **${hoverContent}**       |\n`;
	return new Hover(tipInfo);
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

function onTextEditorChange(editor: TextEditor | undefined) {
	if(currentTextEditor) {
		logUtil.debug(`[onTextEditorChange] previous file: ${currentTextEditor.document.fileName}`);
		deleteAddedLineByType(currentTextEditor.document.fileName, LineType.All);
	}
	currentTextEditor = undefined;
	currentFilePath = '';
	if(editor && editor.document.languageId === constant.LANGUAGE_TEXT) {
		currentTextEditor = editor;
		currentFilePath = currentTextEditor.document.fileName;
	}
	editUtil.getInstance.init(currentTextEditor);
	messageBroker.sendUpdateTextStatusMessage();
	messageBroker.sendUpdateTextInfoMessage();
	messageBroker.sendUpdateCommandStatusBarMessage();
	messageBroker.sendUpdateWebviewStatusBarMessage();
	messageBroker.sendUpdateInfoStatusBarMessage();
	messageBroker.sendTextEditorSelectChangeMessage();
}

function getAddLineByType(fileName : string, lineType : LineType) : LineInfo[] {
	if(! addedLineDic.has(fileName)) { addedLineDic.set(fileName, new Array<LineInfo>()); }
	const lineInfoList = addedLineDic.get(fileName);
	if(lineInfoList === undefined) { return []; }
	return lineInfoList.filter(value => value.lineType === lineType);
}

function deleteAddedLineByType(fileName : string, lineType : LineType) : undefined | Array<(editBuilder: TextEditorEdit) => void> {
	const { activeTextEditor } = vscode.window;
	if(! activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		return undefined;
	}
	if(! addedLineDic.has(fileName)) { addedLineDic.set(fileName, new Array<LineInfo>()); }
	const lineInfoList = addedLineDic.get(fileName);
	if(lineInfoList === undefined || lineInfoList.length === 0) { return undefined; }
	let count = lineInfoList.length;
	const callbackList : Array<(editBuilder: TextEditorEdit) => void> = new Array();
	if(lineType === LineType.All) {
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

function modifyLine(fileName : string, lineInfo : LineInfo, range : Range, offset : number = 0) : ((editBuilder: TextEditorEdit) => void) | undefined {
	if(! currentTextEditor || currentTextStatus !== TextStatus.TextFormat) { return undefined; }
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
	// 因为添加之前可能会删除掉一些行, document 中行号还没发生改变, 但是实际存储的行号得修正一下
	lineInfo.startPosition += offset;
	lineInfo.endPosition += offset;
	logUtil.debug(`adjust start: ${lineInfo.startPosition}, end: ${lineInfo.endPosition}`);
	return editBuilder => {
		editBuilder.replace(range, lineInfo.content);
		logUtil.debug(`replace start: ${lineInfo.startPosition}, count: ${addLineCount}`);
	};
}

function onTextEditorSelectChange(event ?: vscode.TextEditorSelectionChangeEvent) {
	if(! currentTextEditor || currentTextStatus === TextStatus.NoText) { return; }
	const { selections } = event ? event : currentTextEditor;
	if(! selections) { return; }
	messageBroker.sendUpdateInfoStatusBarMessage();
	if(selections.length !== 1 || ! selections[0]) { return; }
	const { start, end } = selections[0];
	if(start.line !== end.line) { return; }
	const contentModifiedList = getAddLineByType(currentTextEditor.document.fileName, LineType.ModifiedContent);
	if(contentModifiedList.length > 0 && contentModifiedList[0].startPosition + 1 === start.line) { return; }
	messageBroker.sendEmphasizeCurrentLineMessage({ position: start.line, bForceUpdate: false});
}

// function update() : void {
// 	if(! currentTextEditor) { return; }
// 	updateTextStatus();
// 	updateCommandStatusBar();
// 	checkVisibleRangeChange();
// }

function updateTextStatus(textStatus ?: TextStatus) : void {
	if(textStatus) {
		currentTextStatus = textStatus;
		return;
	}
	if(! currentTextEditor || currentTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
		currentTextStatus = TextStatus.NoText;
		return;
	}
	const { document } = currentTextEditor;
	const { lineCount } = document;
	
	for(let idx = 0; idx < lineCount; ++ idx) {
		const data = document.lineAt(idx).text;
		if(isTitle(data)) {
			currentTextStatus = TextStatus.TextFormat;
			return;
		}
	}

	currentTextStatus = TextStatus.TextNormal;
}

function checkVisibleRangeChange() : void {
	if(! currentTextEditor) { return; }
	if(currentTextStatus !== TextStatus.TextFormat) { return; }
	if(editUtil.getInstance.isEditing()) { return; }
	const { document } = currentTextEditor;
	const filePath = document.fileName;
	const titleLineInfoList = getAddLineByType(filePath, LineType.Title);
	const { visibleRanges } = currentTextEditor;
	if(! visibleRanges || visibleRanges.length === 0 || ! visibleRanges[0] || ! visibleRanges[0].start) { return; }
	let startLine = visibleRanges[0].start.line + 1;
	const separatorList = getAddLineByType(filePath, LineType.Separator);
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
	const deleteEdit = deleteAddedLineByType(filePath, LineType.Title);
	editUtil.getInstance.addEdit(deleteEdit);
	if(startLine < currentColumnNameRowIdx + 2 || startLine + 3 > document.lineCount) {
		if(deleteEdit) { editUtil.getInstance.startEdit(); }
		return;
	}
	const header = document.getText(new Range(new Position(currentColumnNameRowIdx - 1, 0), new Position(currentColumnNameRowIdx + 2, 0)));
	editUtil.getInstance.addEdit(addLine(filePath, new LineInfo(LineType.Title, header, startLine, startLine + 3), offset))
						.startEdit();
}

let currentVisibleRangeStartLine = -1;
function onVisibleRangeChanged(event : TextEditorVisibleRangesChangeEvent) : void {
	if(! currentTextEditor || currentTextStatus === TextStatus.NoText) { return; }
	if(! event || event.textEditor !== currentTextEditor || ! event.visibleRanges) { return; }
	const { visibleRanges } = event;
	if(! visibleRanges || visibleRanges.length === 0 || ! visibleRanges[0]) { return; }
	const { start } = visibleRanges[0];
	if(start.line === currentVisibleRangeStartLine) { return; }
	currentVisibleRangeStartLine = start.line;
	logUtil.debug(`start: (${start.line}, ${start.character})`);
}

function onTextDocumentChange(event: TextDocumentChangeEvent) : void {
	if(! currentTextEditor || currentTextStatus === TextStatus.NoText) { return; }
	const { contentChanges } = event;
	if(! contentChanges || contentChanges.length === 0) { return; }
	messageBroker.sendUpdateTextInfoMessage();
	// const length = contentChanges.length;
	// const fileName = currentTextEditor.document.fileName;
	// const addedLineList = getAddLineByType(fileName, LineType.All);
	// for(let idx = 0; idx < length; ++ idx) {
	// 	const contentChange = contentChanges[idx];
	// 	const { start, end } = contentChange.range;
	// 	const count = start.line - end.line + contentChange.text.split('\n').length - 1;
	// 	if()
	// }
	
}

function onWillSave(event : TextDocumentWillSaveEvent) : void {
	if(! event || ! event.document || ! currentTextEditor) { return; }
	if(currentTextEditor.document !== event.document) { return; }
	if(currentTextStatus === TextStatus.TextFormat) { undoFormatTxt(); }
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
			if(SeparatorSet.has(data.charAt(idx))) { continue; }
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
						  fillChar : string = SeparatorChar[SeparatorType.FillChar],
						  startChar : string = ContentStartStr,
						  intervalChar : string = ContentSeparatorStr,
						  endchar : string = ContentEndStr) : string {
	if(! rowData || rowData.length === 0) { return ''; }
	let line = startChar + alignString(rowData[0], rowMaxWidthList[0], fillChar);
	const length = rowData.length;
	for(let idx = 1; idx < length; ++ idx) {
		line += intervalChar + alignString(rowData[idx], rowMaxWidthList[idx], fillChar);
	}
	return line += endchar + '\n';
}

// ┃  ID  ┃ 技能类型  ┃     技能名称     ┃ 冷却时间 ┃
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
// ┗━━━━━━┻━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━┛
function isAddedContent(line : string) : boolean {
	return line.startsWith(AddedContentTopStartStr) || line.startsWith(AddedContentStartStr) || line.startsWith(AddedContentBottomStartStr);
}