import { Subject } from "rxjs";
import { TextState } from "../constant";

export enum MessageCode {
    Null,
    UpdateTextState,
    All
}

const subjectDic : Map<MessageCode, Subject<any>> = new Map();

export function hasSubject(messageCode : MessageCode) : boolean {
    return messageCode !== MessageCode.Null && subjectDic.has(messageCode);
}

export function AddSubject(messageCode : MessageCode, subject : Subject<any>) : void {
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
    subject.next(msg);
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

export function sendUpdateTextStateMessage(textState : TextState) : void {
    sendMessage(MessageCode.UpdateTextState, textState);
}

