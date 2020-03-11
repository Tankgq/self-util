import { Subject } from "rxjs";
import { TextStatus } from "../constant";
import { TextEditorVisibleRangesChangeEvent, TextDocumentChangeEvent, Position, TextEditorSelectionChangeEvent } from 'vscode';

export enum MessageCode {
    Null,
    VisibleRangesChange,
    TextDocumentChange,
    UpdateTextStatus,
    UpdateCommandStatusBar,
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
    subject.next.apply(subject, msg);
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

export function sendTextDocumentChangeMessage(event : TextDocumentChangeEvent) : void {
    sendMessage(MessageCode.TextDocumentChange, event);
}

export function sendUpdateTextStatusMessage(textStatus ?: TextStatus) : void {
    sendMessage(MessageCode.TextDocumentChange, textStatus);
}

export function sendUpdateCommandStatusBar() : void {
    sendMessage(MessageCode.UpdateCommandStatusBar);
}

export function sendTextEditorSelectChange(event ?: TextEditorSelectionChangeEvent) : void {
    sendMessage(MessageCode.TextEditorSelectChange, event);
}