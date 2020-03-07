import { TextEditor, TextEditorEdit } from 'vscode';
import * as timeUtil from './timeUtil';
import { LogUtil } from './logUtil';

class EditTool {

	editCallbackList : Array<(editBuilder: TextEditorEdit) => void> = new Array;
	editThenable : Thenable<any> | undefined = undefined;
	activeTextEditor : TextEditor | undefined = undefined;
	
	constructor() {}
	
	init(textEditor : TextEditor | undefined) : EditTool {
		if(this.activeTextEditor === textEditor) { return this; }
		this.activeTextEditor = textEditor;
		this.editCallbackList.length = 0;
		this.editThenable = undefined;
		return this;
	}
	
	addEdit(callback : ((editBuilder: TextEditorEdit) => void) | undefined | Array<(editBuilder: TextEditorEdit) => void>) : EditTool {
		if(! this.activeTextEditor || ! callback) { return this; }
		if(callback instanceof Array) {
			const count = callback.length;
			for(let idx = 0; idx < count; ++ idx) {
				this.editCallbackList.push(callback[idx]);
			}
			return this;
		}
		this.editCallbackList.push(callback);
		return this;
	}
	
	startEdit() : this {
		if(this.editCallbackList.length == 0 || ! this.activeTextEditor) { return this; }
		const callbackList = this.editCallbackList;
		this.editCallbackList = new Array();
		if(this.editThenable) {
			this.editThenable = this.editThenable.then(_ => {
				if(! this.activeTextEditor) { return; }
				if(this.editThenable) {
					LogUtil.error('之前的编辑还未结束');
					return;
				}
				this.editThenable = this.activeTextEditor.edit(editBuilder => {
					const count = callbackList.length;
					for(let idx = 0; idx < count; ++ idx) {
						callbackList[idx](editBuilder);
					}
					callbackList.length = 0;
				});
				return this.editThenable.then(_ => this.editThenable = undefined);
			});
		} else {
			this.editThenable = this.activeTextEditor.edit(editBuilder => {
				const count = callbackList.length;
				for(let idx = 0; idx < count; ++ idx) {
					callbackList[idx](editBuilder);
				}
				callbackList.length = 0;
			});
			this.editThenable = this.editThenable.then(_ => this.editThenable = undefined);
		}
		return this;
	}
	
	then(onfulfilled?: ((value: any) => void | Thenable<void>) | undefined, onrejected?: ((reason: any) => void | Thenable<void>) | undefined) : EditTool {
		if(! this.editThenable) {
			LogUtil.error('当前没有进行编辑');
			return this;
		}
		if(this.editCallbackList.length !== 0) {
			LogUtil.error('当前还没执行 startEdit()');
			return this;
		}
		this.editThenable = this.editThenable.then(onfulfilled, onrejected);
		return this;
	}
	
	isEditing() : boolean { return this.editThenable !== undefined; }
}

export let getInstance : EditTool = new EditTool();
