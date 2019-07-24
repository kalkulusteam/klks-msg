"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const main_1 = require("./main");
const api_1 = require("./api");
const p2p_1 = require("./p2p");
var fs = require('fs');
require('events').EventEmitter.defaultMaxListeners = 150;
var argv = require('minimist')(process.argv.slice(2));
if (argv.server === undefined) {
    console.log('Starting interface');
    main_1.default.main(electron_1.app, electron_1.BrowserWindow);
}
api_1.default.init();
p2p_1.default.init();
//# sourceMappingURL=app.js.map