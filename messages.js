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
PouchDB.plugin(require('pouchdb-find'));
const identity_1 = require("./identity");
global['relayed'] = [];
const config = require('./config.json');
const encryption_1 = require("./encryption");
const utilities_1 = require("./utilities");
var argv = require('minimist')(process.argv.slice(2));
class Messages {
    static store(received, type) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var db = new PouchDB('messages');
                let dbcheck = yield db.allDocs();
                var d = new Date();
                var n = d.toLocaleString();
                received.received_at = n;
                received.timestamp = d.getTime();
                received.type = type;
                if (dbcheck.rows.length === 0) {
                    utilities_1.default.log('Saving new message to local database...');
                    yield db.post(received);
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
                        utilities_1.default.log('Saved new message.');
                    }
                    else {
                        utilities_1.default.log('Message ' + message.signature + ' is stored yet');
                    }
                }
                response(true);
            }));
        });
    }
    static broadcast(protocol, message) {
        return __awaiter(this, void 0, void 0, function* () {
            //Utilities.log('Broadcasting to network..')
            for (let id in global['nodes']) {
                global['nodes'][id].emit(protocol, message);
            }
            if (argv.server) {
                global['io'].server.sockets.emit(protocol, message);
                utilities_1.default.log('Broadcast to every connected client..');
            }
            //Utilities.log('Broadcast end.')
        });
    }
    static broadcastPubKey() {
        return __awaiter(this, void 0, void 0, function* () {
            utilities_1.default.log('Broadcasting RSA public key to peers...');
            let identity = yield identity_1.default.load();
            var publicKey = identity['rsa']['pub'];
            var message = publicKey;
            identity_1.default.signWithKey(identity['wallet']['prv'], message).then(signature => {
                signature['message'] = message;
                Messages.broadcast('pubkey', signature);
            });
        });
    }
    static relayMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            utilities_1.default.log('Relaying stored messages to peers...');
            var db = new PouchDB('messages');
            let dbstore = yield db.allDocs();
            for (var i = 0; i < dbstore.rows.length; i++) {
                var check = dbstore.rows[i];
                var message = yield db.get(check.id);
                var d = new Date();
                var t = d.getTime();
                var e = (t - message.timestamp) / 1000;
                if (e < 172800) {
                    delete message._id;
                    delete message._rev;
                    delete message.timestamp;
                    delete message.received_at;
                    Messages.broadcast('message', message);
                }
            }
        });
    }
    static relayMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            utilities_1.default.log('Relaying message to peers...');
            if (global['relayed'].indexOf(message.signature) === -1) {
                global['relayed'].push(message.signature);
                Messages.broadcast('message', message);
            }
        });
    }
    static relayPubkey(key) {
        return __awaiter(this, void 0, void 0, function* () {
            utilities_1.default.log('Relaying pubkey to peers...');
            Messages.broadcast('pubkey', key);
        });
    }
    static processMessage(protocol, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var received = data;
                console.log(received);
                identity_1.default.verifySign(received.pubKey, received.signature, received['message']).then((signature) => __awaiter(this, void 0, void 0, function* () {
                    if (signature === true) {
                        var blocked = yield identity_1.default.isBlocked(received['address']);
                        if (blocked === false) {
                            utilities_1.default.log('Received valid message from ' + received['address'] + '.');
                            Messages.relayMessage(received);
                            if (protocol === 'pubkey') {
                                identity_1.default.store({
                                    address: received['address'],
                                    pubkey: received['message']
                                });
                            }
                            else if (protocol === 'message') {
                                var decrypted = yield encryption_1.default.decryptMessage(received['message']);
                                if (decrypted !== false) {
                                    Messages.store(received, 'private');
                                    utilities_1.default.log('Received SAFU message from ' + received['address']);
                                }
                                else if (received['type'] === 'public') {
                                    utilities_1.default.log('Received public message from ' + received['address']);
                                    Messages.store(received, 'public');
                                }
                            }
                        }
                    }
                }));
            }
            catch (e) {
                if (config.DEBUG === true) {
                    utilities_1.default.log('Received unsigned data, ignoring.');
                }
            }
        });
    }
}
exports.default = Messages;
//# sourceMappingURL=messages.js.map