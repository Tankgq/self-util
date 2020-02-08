"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const log_1 = require("./log");
const constant = require("../constant");
const vscode_1 = require("vscode");
const path = require("path");
const tools = require("./tools");
const GetWordRegExp = new RegExp('[^\t \n]+');
const GetDigitRegExp = new RegExp(/(?<=[^:])"(\d+)"/g);
let currentTxtFilePath = '';
let currentColumnNameRowIdx = 0;
let currentColumnNameList = [];
let commandStatusBar;
let webViewStatusBar;
let webViewPanel;
let selfContext;
let headerStatuBar;
let frontStatuBar;
let lastSelectStartPos;
let addHeadLineDic = new Map;
function init(context) {
    selfContext = context;
    let disposable;
    disposable = vscode.commands.registerCommand(constant.COMMAND_TEXT_FORMAT, formatTxt);
    selfContext.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand(constant.COMMAND_TEXT_UNDO_FORMAT, undoFormatTxt);
    selfContext.subscriptions.push(disposable);
    disposable = vscode.languages.registerHoverProvider(constant.LANGUAGE_TEXT, { provideHover: provideTxtHover });
    selfContext.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand(constant.COMMAND_TXT_OPEN_WEBVIEW, openWebView);
    selfContext.subscriptions.push(disposable);
    initCommandStatusBarItem();
    initWebViewStatusBarItem();
    vscode.window.onDidChangeActiveTextEditor(onTextEditorChange);
    const { activeTextEditor } = vscode.window;
    if (activeTextEditor) {
        updateSelectInfo(activeTextEditor.document, activeTextEditor.selection.start);
        addHeadLineDic.set(activeTextEditor.document.fileName, -1);
    }
    vscode.window.onDidChangeTextEditorSelection(onTextEditorSelectChange);
    vscode.workspace.onWillSaveTextDocument(onWillSave);
    setInterval(() => update(), 500);
}
exports.init = init;
function formatTxt() {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { document } = activeTextEditor;
    const { lineCount } = document;
    let columnCount = 0;
    const rowDataList = [];
    const rowMaxSizeList = [];
    let tabCount = 0;
    for (let idx = 0; idx < lineCount; ++idx) {
        const line = document.lineAt(idx);
        const rowData = line.text.split('\t');
        const length = rowData.length;
        tabCount += length;
        columnCount = Math.max(columnCount, length);
        while (rowMaxSizeList.length < columnCount) {
            rowMaxSizeList.push(0);
        }
        for (let idx2 = 0; idx2 < length; ++idx2) {
            rowData[idx2] = rowData[idx2].trim();
            rowMaxSizeList[idx2] = Math.max(rowMaxSizeList[idx2], getStringLength(rowData[idx2]));
        }
        rowDataList.push(rowData);
    }
    if (lineCount === tabCount) {
        log_1.showInfo(`执行 ${constant.COMMAND_TEXT_FORMAT} 失败`);
        return;
    }
    currentTxtFilePath = '';
    const separatorRowData = [];
    for (let idx = 0; idx < columnCount; ++idx) {
        separatorRowData.push('-');
    }
    let content = getNewColumnData(separatorRowData, rowMaxSizeList, '-', '+-', '-+-', '-+');
    content += getNewColumnData(rowDataList[0], rowMaxSizeList);
    content += getNewColumnData(separatorRowData, rowMaxSizeList, '-', '+-', '-+-', '-+');
    for (let idx = 1; idx < lineCount; ++idx) {
        if (!rowDataList[idx]) {
            continue;
        }
        if (rowDataList[idx].length === 1 && rowDataList[idx][0].trim().length === 0) {
            continue;
        }
        content += getNewColumnData(rowDataList[idx], rowMaxSizeList);
    }
    content += getNewColumnData(separatorRowData, rowMaxSizeList, '-', '+-', '-+-', '-+');
    activeTextEditor.edit(editBuilder => {
        const startPos = new vscode_1.Position(0, 0);
        const endPos = new vscode_1.Position(lineCount + 1, 0);
        editBuilder.replace(new vscode_1.Range(startPos, endPos), content);
    });
    if (commandStatusBar) {
        commandStatusBar.command = constant.COMMAND_TEXT_UNDO_FORMAT;
        commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_UNDO_FORMAT;
    }
    updateSelectInfo(document, lastSelectStartPos, true, 1);
}
function undoFormatTxt() {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { document } = activeTextEditor;
    const { lineCount } = document;
    let content = '';
    let canExecute = false;
    const filePath = document.fileName;
    const lastLine = addHeadLineDic.get(filePath);
    for (let idx = 0; idx < lineCount; ++idx) {
        const data = document.lineAt(idx).text;
        if (data.length === 0) {
            continue;
        }
        if (data.indexOf('-+-') !== -1) {
            canExecute = true;
            continue;
        }
        if (idx === lastLine) {
            continue;
        }
        const rowData = data.split(' | ');
        const length = rowData.length;
        rowData[0] = rowData[0].substr(1);
        rowData[length - 1] = rowData[length - 1].substr(0, rowData[length - 1].length - 1);
        for (let idx2 = 0; idx2 < length; ++idx2) {
            rowData[idx2] = rowData[idx2].trim();
        }
        content += rowData.join('\t') + '\n';
    }
    if (!canExecute) {
        log_1.showInfo(`执行 ${constant.COMMAND_TEXT_UNDO_FORMAT} 失败`);
        return;
    }
    currentTxtFilePath = '';
    activeTextEditor.edit(editBuilder => {
        const startPos = new vscode_1.Position(0, 0);
        const endPos = new vscode_1.Position(lineCount + 1, 0);
        editBuilder.replace(new vscode_1.Range(startPos, endPos), content);
        addHeadLineDic.set(filePath, -1);
    });
    if (commandStatusBar) {
        commandStatusBar.command = constant.COMMAND_TEXT_FORMAT;
        commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_FORMAT;
    }
    updateSelectInfo(document, lastSelectStartPos, true, -1);
}
function updateCurrentFileHeaderInfo(document, separator, rowNameOffset = 0) {
    let columnCount = currentColumnNameList.length;
    if (columnCount === 0 || currentTxtFilePath !== document.fileName) {
        currentTxtFilePath = document.fileName;
        currentColumnNameList = [];
        const { lineCount } = document;
        for (let idx = 0; idx < lineCount; ++idx) {
            let line = document.lineAt(idx).text;
            if (line.trim().length === 0) {
                continue;
            }
            if (line[0] === '+') {
                continue;
            }
            if (line[0] === '|') {
                line = line.substr(1);
            }
            // format 或者 undoFormat 时 document 的内容并没有立刻刷新, 获取到的内容是旧的
            currentColumnNameRowIdx = idx + rowNameOffset;
            currentColumnNameList = line.split(separator);
            columnCount = currentColumnNameList.length;
            for (let idx2 = 0; idx2 < columnCount; ++idx2) {
                currentColumnNameList[idx2] = currentColumnNameList[idx2].trim();
            }
            break;
        }
    }
}
function getWordAtPosition(document, position) {
    const wordRange = document.getWordRangeAtPosition(position, GetWordRegExp);
    if (wordRange === undefined) {
        return '';
    }
    const word = document.getText(wordRange);
    if (word.indexOf('-+-') !== -1 || word.indexOf(' | ') !== -1) {
        return '';
    }
    return word;
}
function getCurrentLine(document, position) {
    let currentLine = document.lineAt(position).text;
    if (currentLine.charAt(0) === '|') {
        currentLine = currentLine.substr(1);
    }
    return currentLine;
}
class ColumnInfo {
    constructor(line, separator, idx) {
        this.separator = separator;
        this.line = line;
        this.idx = idx;
    }
}
function getCurrentColumnInfo(document, position, rowNameOffset = 0) {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
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
    while (separatorIdx < length) {
        separatorIdx = currentLine.indexOf(separator, separatorIdx + 1);
        if (separatorIdx === -1) {
            break;
        }
        if (separatorIdx >= contentIdx) {
            return new ColumnInfo(currentLine, separator, idx);
        }
        ++idx;
    }
    return undefined;
}
function provideTxtHover(document, position, token) {
    const columnInfo = getCurrentColumnInfo(document, position);
    if (columnInfo === undefined) {
        return;
    }
    var { idx, line, separator } = columnInfo;
    const hoverContent = getWordAtPosition(document, position);
    if (hoverContent.length === 0) {
        return;
    }
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
    return new vscode_1.Hover(tipInfo);
}
function initCommandStatusBarItem() {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { document } = activeTextEditor;
    const { lineCount } = document;
    let command = constant.COMMAND_TEXT_FORMAT;
    for (let idx = 0; idx < lineCount; ++idx) {
        const data = document.lineAt(idx).text;
        if (data.length === 0) {
            continue;
        }
        if (data.indexOf('-+-') !== -1) {
            command = constant.COMMAND_TEXT_UNDO_FORMAT;
            break;
        }
    }
    commandStatusBar = vscode.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 200);
    if (command === constant.COMMAND_TEXT_FORMAT) {
        commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_FORMAT;
        commandStatusBar.command = constant.COMMAND_TEXT_FORMAT;
    }
    else {
        commandStatusBar.text = constant.STATUS_BAR_ITEM_TXT_COMMAND_UNDO_FORMAT;
        commandStatusBar.command = constant.COMMAND_TEXT_UNDO_FORMAT;
    }
    commandStatusBar.color = constant.STATUS_BAR_ITEM_TXT_COMMAND_COLOR;
    commandStatusBar.show();
}
function openWebView() {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { document } = activeTextEditor;
    let { fileName } = document;
    fileName = path.basename(fileName);
    if (webViewPanel) {
        webViewPanel.dispose();
    }
    webViewPanel = vscode.window.createWebviewPanel(constant.WEBVIEW_TYPE_TXT, `${fileName}-webview`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: false
    });
    let separator = getSeparator(document);
    if (separator.length === 0) {
        log_1.showError('格式错误, 无法打开');
        return;
    }
    let content = {};
    const { lineCount } = document;
    let line = 0;
    for (let idx = 0; idx < lineCount; ++idx) {
        const data = document.lineAt(idx).text;
        if (data.length === 0) {
            continue;
        }
        if (data.indexOf('-+-') !== -1) {
            continue;
        }
        const rowData = data.split(separator);
        const length = rowData.length;
        if (rowData[0].charAt(0) === '|' && length > 0) {
            rowData[0] = rowData[0].trim().substr(1);
            rowData[length - 1] = rowData[length - 1].trim().substr(0, rowData[length - 1].length - 1);
        }
        let row = {};
        if (idx === currentColumnNameRowIdx) {
            for (let idx2 = 0; idx2 < length; ++idx2) {
                row[idx2] = { text: rowData[idx2].trim(), style: 0 };
            }
        }
        else {
            row[0] = { text: rowData[0].trim(), style: 0 };
            for (let idx2 = 1; idx2 < length; ++idx2) {
                row[idx2] = { text: rowData[idx2].trim(), style: 1 };
            }
        }
        content[line] = { 'cells': row };
        ++line;
    }
    let htmlContent = tools.getWebViewContent(selfContext, 'src/html/txt.html');
    let contentStr = JSON.stringify(content);
    contentStr = contentStr.replace(GetDigitRegExp, '$1');
    console.log(contentStr);
    htmlContent = htmlContent.replace('rowData', contentStr);
    webViewPanel.webview.html = htmlContent;
}
function initWebViewStatusBarItem() {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    webViewStatusBar = vscode.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 200);
    webViewStatusBar.command = constant.COMMAND_TXT_OPEN_WEBVIEW;
    webViewStatusBar.text = constant.STATUS_BAR_ITEM_TXT_WEBVIEW;
    webViewStatusBar.color = constant.STATUS_BAR_ITEM_TXT_WEBVIEW_COLOR;
    webViewStatusBar.show();
}
function onTextEditorChange(editor) {
    currentTxtFilePath = '';
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        if (commandStatusBar) {
            commandStatusBar.hide();
        }
        if (webViewStatusBar) {
            webViewStatusBar.hide();
        }
        if (headerStatuBar) {
            headerStatuBar.hide();
        }
        if (frontStatuBar) {
            frontStatuBar.hide();
        }
        return;
    }
    const filePath = activeTextEditor.document.fileName;
    if (!addHeadLineDic.has(filePath)) {
        addHeadLineDic.set(filePath, -1);
    }
    if (commandStatusBar) {
        commandStatusBar.show();
    }
    if (webViewStatusBar) {
        webViewStatusBar.show();
    }
    if (headerStatuBar) {
        headerStatuBar.show();
    }
    if (frontStatuBar) {
        frontStatuBar.show();
    }
    updateSelectInfo(activeTextEditor.document, activeTextEditor.selection.start);
}
function updateSelectInfo(document, position, forceUpdate = false, rowNameOffset = 0) {
    if (!position) {
        return;
    }
    if (!forceUpdate && lastSelectStartPos && lastSelectStartPos.character === position.character) {
        return;
    }
    if (!headerStatuBar) {
        headerStatuBar = vscode.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 200);
        headerStatuBar.show();
    }
    if (!frontStatuBar) {
        frontStatuBar = vscode.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 200);
        frontStatuBar.show();
    }
    var columnInfo = getCurrentColumnInfo(document, position, rowNameOffset);
    if (columnInfo === undefined) {
        headerStatuBar.text = '';
        frontStatuBar.text = '';
        return;
    }
    const currentInfo = getWordAtPosition(document, position);
    if (currentInfo.length === 0) {
        headerStatuBar.text = '';
        frontStatuBar.text = '';
        return;
    }
    const { idx, line, separator } = columnInfo;
    const currentRowData = line.split(separator);
    const columnCount = currentColumnNameList.length;
    const header = (columnCount > idx ? currentColumnNameList[idx] : '');
    frontStatuBar.text = `Front: ${currentRowData[0].trim()}, ${currentRowData[1].trimRight()}`;
    if (position.line === currentColumnNameRowIdx) {
        headerStatuBar.text = '';
    }
    else {
        headerStatuBar.text = `Col #${idx + 1}, ${header}`;
    }
    lastSelectStartPos = position;
}
function onTextEditorSelectChange(event) {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { selections } = event;
    if (!selections || selections.length === 0 || !selections[0]) {
        return;
    }
    const position = selections[0].start;
    if (!position) {
        return;
    }
    updateSelectInfo(activeTextEditor.document, position);
}
function update() {
    checkVisibleChange();
}
function checkVisibleChange() {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { document } = activeTextEditor;
    const filePath = document.fileName;
    const lastLine = addHeadLineDic.get(filePath);
    if (lastLine === undefined) {
        return;
    }
    const { visibleRanges } = activeTextEditor;
    if (!visibleRanges || visibleRanges.length === 0 || !visibleRanges[0]) {
        return;
    }
    const start = visibleRanges[0].start;
    if (!start) {
        return;
    }
    if (lastLine === start.line + 1) {
        return;
    }
    const separator = getSeparator(document);
    if (separator.length === 0 || separator === '\t') {
        return;
    }
    updateCurrentFileHeaderInfo(document, separator);
    const header = document.lineAt(currentColumnNameRowIdx);
    activeTextEditor.edit(editBuilder => {
        if (lastLine !== -1) {
            const startPos = new vscode_1.Position(lastLine, 0);
            const endPos = new vscode_1.Position(lastLine + 1, 0);
            editBuilder.delete(new vscode_1.Range(startPos, endPos));
            addHeadLineDic.set(filePath, -1);
        }
        if (start.line <= currentColumnNameRowIdx) {
            return;
        }
        console.log(`current visible range: ${start.line} - ${visibleRanges[0].end.line}`);
        // 此时需要删除的那行还没实际删除, 所以插入的位置不考虑前面是否已经删除了某一行
        const insertPos = new vscode_1.Position(start.line + 1, 0);
        editBuilder.insert(insertPos, header.text + '\n');
        addHeadLineDic.set(filePath, insertPos.line);
        if (lastLine !== -1 && lastLine <= insertPos.line) {
            addHeadLineDic.set(filePath, insertPos.line - 1);
        }
    });
}
function onWillSave(event) {
    if (!event || !event.document) {
        return;
    }
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor || activeTextEditor.document.languageId !== constant.LANGUAGE_TEXT) {
        return;
    }
    const { document } = activeTextEditor;
    const separator = getSeparator(document);
    if (separator === ' | ') {
        undoFormatTxt();
    }
}
function getSeparator(document) {
    if (!document || document.lineCount === 0) {
        return '';
    }
    let idx = 0, { lineCount } = document;
    while (idx < lineCount) {
        const line = document.lineAt(idx).text.trim();
        ++idx;
        if (line.length === 0) {
            continue;
        }
        if (line.indexOf('\t') !== -1) {
            return '\t';
        }
        if (line.indexOf('-+-') !== -1 || line.indexOf(' | ') !== -1) {
            return ' | ';
        }
    }
    return '';
}
function getStringLength(data) {
    if (!data || data.length === 0) {
        return 0;
    }
    const dataLength = data.length;
    let result = dataLength;
    for (let idx = 0; idx < dataLength; ++idx) {
        if (data.charCodeAt(idx) & 0xFF00) {
            ++result;
        }
    }
    return result;
}
function alignString(data, maxWidth, fillChar = ' ') {
    fillChar = fillChar.charAt(0);
    const realLength = getStringLength(data);
    if (realLength >= maxWidth) {
        return data;
    }
    const frontLength = (maxWidth - realLength) >> 1;
    let frontStr = fillChar.repeat(frontLength);
    const behindLength = maxWidth - realLength - frontLength;
    let behindStr = fillChar.repeat(behindLength);
    return frontStr + data + behindStr;
}
function getNewColumnData(rowData, rowMaxWidthList, fillChar = ' ', startChar = '| ', intervalChar = ' | ', endchar = ' |') {
    if (!rowData || rowData.length === 0) {
        return '';
    }
    let line = startChar + alignString(rowData[0], rowMaxWidthList[0], fillChar);
    const length = rowData.length;
    for (let idx = 1; idx < length; ++idx) {
        line += intervalChar + alignString(rowData[idx], rowMaxWidthList[idx], fillChar);
    }
    return line += endchar + '\n';
}
//# sourceMappingURL=txt.js.map