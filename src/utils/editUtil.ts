import { TextEditor, TextEditorEdit } from 'vscode';
import { LogUtil } from './logUtil';

class EditTool {

	editThenable : Thenable<any> | undefined;
	editFunctionList : Array<Array<(editBuilder: TextEditorEdit) => void>>;
	editCompleteFunctionList : Array<Array<(_ : any) => void>>;
	continueEditList : Array<boolean>;
	textEditor : TextEditor | undefined;
	editVersion : number;
	
	constructor() {
		this.editVersion = 0;
		this.textEditor = undefined;
		this.editThenable = undefined;
		this.editFunctionList = new Array();
		this.continueEditList = new Array();
		this.editCompleteFunctionList = new Array();
	}
	
	init(textEditor : TextEditor | undefined) : EditTool {
		if(this.textEditor === textEditor) { return this; }
		this.editVersion = 1;
		this.textEditor = textEditor;
		this.editThenable = undefined;
		this.editFunctionList.length = 0;
		this.continueEditList.length = 0;
		this.editCompleteFunctionList.length = 0;
		return this;
	}

	addEdit(editFunction : ((editBuilder: TextEditorEdit) => void) | undefined | Array<(editBuilder: TextEditorEdit) => void>) : EditTool {
		if(! this.textEditor ) {
			LogUtil.error('当前没有初始化 textEditor');
			return this;
		}
		if(! editFunction) { return this; }
		if(! this.editFunctionList.length) { this.editFunctionList.push(new Array()); }
		const lastFunctionList = this.editFunctionList[this.editFunctionList.length - 1];
		if(editFunction instanceof Array) {
			const count = editFunction.length;
			for(let idx = 0; idx < count; ++ idx) {
				lastFunctionList.push(editFunction[idx]);
			}
			return this;
		}
		lastFunctionList.push(editFunction);
		return this;
	}

	startEdit() : this {
		if(! this.textEditor) {
			LogUtil.error('当前没有初始化 textEditor');
			return this;
		}

		if(! this.editThenable) {
			const functionList = this.editFunctionList.shift();
			if(! functionList || ! functionList.length) {
				LogUtil.error('当前没有任何操作');
				return this;
			}
			this.edit(functionList);
		} else { this.continueEditList.push(true); }
		this.editCompleteFunctionList.push(new Array());
		this.editFunctionList.push(new Array());
		return this;
	}

	private edit(functionList : Array<(editBuilder: TextEditorEdit) => void> | undefined) : void {
		if(! this.textEditor) { return; }
		if(! functionList || ! functionList.length) {
			this.editThenable = undefined;
			return;
		}
		this.editThenable = this.textEditor.edit(editBuilder => {
			LogUtil.debug(`start edit version: ${this.editVersion}`);
			const count = functionList.length;
			for(let idx = 0; idx < count; ++ idx) {
				functionList[idx](editBuilder);
			}
			functionList.length = 0;
		}).then(_ => {
			LogUtil.debug(`edit version: ${this.editVersion} complete`);
			
			const then = this.editCompleteFunctionList.shift();
			if(then && then.length) {
				const length = then.length;
				for(let idx = 0; idx < length; ++ idx) { then[idx](undefined); }
				LogUtil.debug(`edit version: ${this.editVersion}, editCompleteFunction executed complete`);
			}
			this.editVersion += 1;
			
			let frontFunctionList = undefined;
			if(this.editFunctionList && this.editFunctionList[0].length) {
				const continueEdit = this.continueEditList.shift();
				if(continueEdit !== undefined) { frontFunctionList = this.editFunctionList.shift(); }
			}
			this.edit(frontFunctionList);
		});
	}
	
	then(onComplete : (_ : any) => void) : EditTool {
		if(! this.textEditor ) {
			LogUtil.error('当前没有初始化 textEditor');
			return this;
		}
		if(! this.editCompleteFunctionList.length) {
			LogUtil.error('当前没有任何编辑操作');
			return this;
		}
		const lastThen = this.editCompleteFunctionList[this.editCompleteFunctionList.length - 1];
		lastThen.push(onComplete);
		return this;
	}
	
	isEditing() : boolean { return this.editThenable !== undefined || this.continueEditList.length > 0; }

	/**
	 * 判断当前是否已经添加了编辑的操作
	 */
	hasEditing() : boolean {
		return this.editFunctionList.length > 0
				? this.editFunctionList[this.editFunctionList.length - 1].length > 0
				: false;
	}
}

export let getInstance : EditTool = new EditTool();
