"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const Main_1 = require("./Main");
const Api_1 = require("./Api");
var argv = require('minimist')(process.argv.slice(2));
if (argv.server === undefined) {
    console.log('Starting interface');
    Main_1.default.main(electron_1.app, electron_1.BrowserWindow);
}
Api_1.default.init();
//# sourceMappingURL=App.js.map