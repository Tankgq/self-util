"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const txt = require("./utils/txt");
function activate(context) {
    console.log('"self-util" is now active');
    txt.init(context);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map