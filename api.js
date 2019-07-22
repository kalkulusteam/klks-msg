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
const express = require('express');
const api = express();
const Identicon = require('identicon.js');
const fs = require('fs');
const config = require('./config.json');
const identity_1 = require("./identity");
const encryption_1 = require("./encryption");
const messages_1 = require("./messages");
const utilities_1 = require("./utilities");
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
var messages = [];
var relayed = [];
class Api {
    static init() {
        var frontendPort = 11673; //TEST PORT
        api.get('/avatar/:hash', (req, res) => {
            var data = new Identicon(req.params.hash, 420).toString();
            var img = Buffer.from(data, 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': img.length
            });
            res.end(img);
        });
        api.get('/messages/public', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var db = new PouchDB('messages');
            let dbstore = yield db.allDocs();
            var messages = [];
            for (var i = 0; i < dbstore.rows.length; i++) {
                var check = dbstore.rows[i];
                var message = yield db.get(check.id);
                if (message.type === 'public') {
                    delete message._id;
                    delete message._rev;
                    messages.push(message);
                }
            }
            messages.sort(function (a, b) {
                return parseFloat(a.timestamp) - parseFloat(b.timestamp);
            });
            res.send(messages);
        }));
        api.get('/messages/address/:address', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var db = new PouchDB('messages');
            let dbstore = yield db.allDocs();
            var messages = [];
            for (var i = 0; i < dbstore.rows.length; i++) {
                var check = dbstore.rows[i];
                var message = yield db.get(check.id);
                if (message.type === 'private' && message.address === req.params.address) {
                    delete message._id;
                    delete message._rev;
                    let decrypted = yield encryption_1.default.decryptMessage(message.message);
                    message.message = decrypted;
                    messages.push(message);
                }
            }
            messages.sort(function (a, b) {
                return parseFloat(a.timestamp) - parseFloat(b.timestamp);
            });
            res.send(messages);
        }));
        api.get('/connections', (req, res) => res.send(global['peers']));
        api.post('/message', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var body = yield utilities_1.default.body(req);
            if (body['body'].message !== undefined && body['body'].receiver !== undefined) {
                var message = body['body'].message;
                var receiver = body['body'].receiver;
                let identity = yield identity_1.default.load();
                if (receiver === 'public') {
                    var toBroadcast = {
                        message: message,
                        timestamp: new Date().getTime()
                    };
                    identity_1.default.signWithKey(identity['wallet']['prv'], JSON.stringify(toBroadcast)).then(signature => {
                        signature['message'] = toBroadcast;
                        signature['type'] = message;
                        messages_1.default.broadcast(JSON.stringify(signature));
                        messages_1.default.store(signature, 'public');
                        res.send(signature);
                    });
                }
                else if (receiver === 'group') {
                    //SEND GROUP MESSAGE
                }
                else {
                    let user = yield identity_1.default.find(receiver);
                    if (user !== false && user !== undefined) {
                        let encrypted = yield encryption_1.default.encryptMessage(message, user);
                        var toBroadcastEncrypted = {
                            message: encrypted,
                            timestamp: new Date().getTime()
                        };
                        identity_1.default.signWithKey(identity['wallet']['prv'], JSON.stringify(toBroadcastEncrypted)).then(signature => {
                            signature['message'] = toBroadcastEncrypted;
                            signature['type'] = 'private';
                            messages_1.default.broadcast(JSON.stringify(signature));
                            res.send(signature);
                        });
                    }
                    else {
                        res.send({
                            error: true,
                            message: "Can't sign message, users isn't in your contact list."
                        });
                    }
                }
            }
            else {
                res.send({
                    error: true,
                    message: 'Specify message and receiver'
                });
            }
        }));
        api.get('/contacts', (req, res) => __awaiter(this, void 0, void 0, function* () {
            let contacts = [];
            var db = new PouchDB('users');
            let dbcheck = yield db.allDocs();
            for (var i = 0; i < dbcheck.rows.length; i++) {
                var check = dbcheck.rows[i];
                var id = yield db.get(check.id);
                contacts.push(id);
            }
            res.send(contacts);
        }));
        api.post('/contacts/update', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var body = yield utilities_1.default.body(req);
            if (body['body'].address !== undefined) {
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                let success = false;
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i];
                    var id = yield db.get(check.id);
                    if (id.address === body['body'].address) {
                        success = true;
                        try {
                            yield db.put({
                                _id: id._id,
                                _rev: id._rev,
                                nickname: body['body'].nickname,
                                address: id.address,
                                pubkey: id.pubkey,
                                blocked: id.blocked
                            });
                        }
                        catch (e) {
                            console.log(e);
                        }
                    }
                }
                res.send({
                    success: success
                });
            }
            else {
                res.send({
                    error: true,
                    message: 'You must specify an address first.'
                });
            }
        }));
        api.post('/contacts/block', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var body = yield utilities_1.default.body(req);
            if (body['body'].address !== undefined) {
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                let success = false;
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i];
                    var id = yield db.get(check.id);
                    if (id.address === body['body'].address) {
                        success = true;
                        let blocked;
                        if (id.blocked === false || id.blocked === undefined) {
                            blocked = true;
                        }
                        else {
                            blocked = false;
                        }
                        try {
                            yield db.put({
                                _id: id._id,
                                _rev: id._rev,
                                nickname: id.nickname,
                                address: id.address,
                                pubkey: id.pubkey,
                                blocked: blocked
                            });
                        }
                        catch (e) {
                            console.log(e);
                        }
                    }
                }
                res.send({
                    success: success
                });
            }
            else {
                res.send({
                    error: true,
                    message: 'You must specify an address first.'
                });
            }
        }));
        api.listen(frontendPort, () => console.log(`Engine listening on port ${frontendPort}!`));
    }
}
exports.default = Api;
//# sourceMappingURL=api.js.map