"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const getPort = require('get-port');
const isPortAvailable = require('is-port-available');
var formidable = require('formidable');
const fs = require('fs');
const config = require('./config.json');
class Utilities {
    static freeport() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                let port;
                if (process.env.EXPRESS_PORT !== undefined) {
                    port = process.env.EXPRESS_PORT;
                }
                else {
                    port = yield getPort();
                }
                var available = yield isPortAvailable(port);
                while (!available) {
                    port = yield getPort();
                    available = yield isPortAvailable(port);
                }
                response(port);
            }));
        });
    }
    static body(req) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var jsonEmpty = true;
                for (var key in req.body) {
                    if (key !== undefined) {
                        jsonEmpty = false;
                    }
                }
                if (jsonEmpty === true) {
                    var form = new formidable.IncomingForm();
                    form.parse(req, function (err, fields, files) {
                        response({
                            body: fields,
                            files: files
                        });
                    });
                    setTimeout(function () {
                        response(false);
                    }, 200);
                }
                else {
                    response({
                        body: req.body,
                        files: []
                    });
                }
            }));
        });
    }
    static log(toLog) {
        if (config.DEBUG === true) {
            console.log(toLog);
            var d = new Date().toLocaleString();
            fs.appendFileSync('log', '[' + d + '] ' + toLog + '\n');
        }
    }
}
exports.default = Utilities;
//# sourceMappingURL=utilities.js.map