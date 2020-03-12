import { Subject } from "rxjs";
import { TextStatus } from "../constant";
import { TextEditorVisibleRangesChangeEvent, TextDocumentChangeEvent, Position, TextEditorSelectionChangeEvent } from 'vscode';

export enum MessageCode {
    Null,
    /**
     * 竖直方向可视区域改变
     */
    VisibleRangesChange,
    /**
     * 将当前选择区域的框出来
     */
    EmphasizeCurrentLine,
    /**
     * 修改文本
     */
    TextDocumentChange,
    /**
     * 状态改变
     */
    UpdateTextStatus,
    /**
     * 更新左下角的命令按钮
     */
    UpdateCommandStatusBar,
    /**
     * 更新左下角的 Header 以及 Front 信息
     */
    UpdateInfoStatusBar,
    /**
     * 更新左下角的 webview 按钮
     */
    UpdateWebviewStatusBar,
    /**
     * 选择的区域的改变
     */
    TextEditorSelectChange,
    All
}

const subjectDic : Map<MessageCode, Subject<any>> = new Map();

export function hasSubject(messageCode : MessageCode) : boolean {
    return messageCode !== MessageCode.Null && subjectDic.has(messageCode);
}

export function addSubject(messageCode : MessageCode, subject : Subject<any>) : void {
    if(messageCode === MessageCode.Null || ! subject) { return; }
    let sourceSubject = subjectDic.get(messageCode);
    if(sourceSubject) {
        sourceSubject.subscribe(subject);
        return;
    }
    sourceSubject = new Subject<any>();
    sourceSubject.subscribe(subject);
    subjectDic.set(messageCode, sourceSubject);
}

export function sendMessage(messageCode : MessageCode, ... msg : any) : void {
    if(messageCode === MessageCode.Null) { return; }
    const subject = subjectDic.get(messageCode);
    if(! subject) { return; }
    if(msg.length) { subject.next(msg[0]); }
    else { subject.next(); }
}

export function dispose(messageCode: MessageCode) : void {
    if(messageCode === MessageCode.Null) { return; }
    if(messageCode === MessageCode.All) {
        for(let idx = MessageCode.Null + 1; idx < MessageCode.All; ++ idx) {
            const subject = subjectDic.get(idx);
            if(! subject) { continue; }
            subject.complete();
            subject.unsubscribe();
            subjectDic.delete(idx);
        }
        return;
    }
    const subject = subjectDic.get(messageCode);
    if(! subject) { return; }
    subject.complete();
    subject.unsubscribe();
    subjectDic.delete(messageCode);
}

export function sendVisibleRangesChangeMessage(event : TextEditorVisibleRangesChangeEvent) : void {
    sendMessage(MessageCode.VisibleRangesChange, event);
}

export function sendEmphasizeCurrentLineMessage(param : { position ?: number, bForceUpdate : boolean }) : void {
    sendMessage(MessageCode.EmphasizeCurrentLine, param);
}

export function sendTextDocumentChangeMessage(event : TextDocumentChangeEvent) : void {
    sendMessage(MessageCode.TextDocumentChange, event);
}

export function sendUpdateTextStatusMessage(textStatus ?: TextStatus) : void {
    sendMessage(MessageCode.UpdateTextStatus, textStatus);
}

export function sendUpdateCommandStatusBar() : void {
    sendMessage(MessageCode.UpdateCommandStatusBar);
}

export function sendUpdateInfoStatusBar() : void {
    sendMessage(MessageCode.UpdateInfoStatusBar);
}

export function sendUpdateWebviewStatusBar() : void {
    sendMessage(MessageCode.UpdateWebviewStatusBar);
}

export function sendTextEditorSelectChange(event ?: TextEditorSelectionChangeEvent) : void {
    sendMessage(MessageCode.TextEditorSelectChange, event);
}
