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
const PouchDB = require('pouchdb');
class Messages {
    static store(received) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var db = new PouchDB('messages');
                let dbcheck = yield db.allDocs();
                var d = new Date();
                var n = d.toLocaleString();
                received.received_at = n;
                if (dbcheck.rows.length === 0) {
                    yield db.post(received);
                    console.log('Saved new message.');
                }
                else {
                    var found = false;
                    for (var i = 0; i < dbcheck.rows.length; i++) {
                        var check = dbcheck.rows[i];
                        var message = yield db.get(check.id);
                        if (message.signature === received.signature) {
                            found = true;
                        }
                    }
                    if (found === false) {
                        yield db.post(received);
                        console.log('Saved new message.');
                    }
                }
                response(true);
            }));
        });
    }
    static broadcast(message) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Broadcasting to network..');
            for (let id in global['peers']) {
                global['peers'][id].conn.write(message);
            }
            console.log('Broadcast end.');
        });
    }
}
exports.default = Messages;
//# sourceMappingURL=messages.js.map