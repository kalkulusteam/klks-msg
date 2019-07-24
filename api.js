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
const getPort = require('get-port');
var messages = [];
var relayed = [];
class Api {
    static init() {
        return __awaiter(this, void 0, void 0, function* () {
            var lockfiles = ['./settings/LOCK', './messages/LOCK', './messages/LOCK'];
            for (var l in lockfiles) {
                if (fs.existsSync(lockfiles[l])) {
                    fs.unlinkSync(lockfiles[l]);
                }
            }
            let apiport = yield getPort({ port: config.API_PORT });
            api.get('/avatar/:hash', (req, res) => {
                var data = new Identicon(req.params.hash, 420).toString();
                var img = Buffer.from(data, 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': img.length
                });
                res.end(img);
            });
            api.get('/discussions', (req, res) => __awaiter(this, void 0, void 0, function* () {
                let contacts = {};
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i];
                    var id = yield db.get(check.id);
                    if (id.nickname === undefined) {
                        let nickname = id.address.substr(0, 4) + '.' + id.address.substr(-4);
                        id.nickname = nickname;
                    }
                    contacts[id.address] = id.nickname;
                }
                contacts[global['identity']['wallet']['pub']] = 'Me';
                var db = new PouchDB('messages');
                let dbstore = yield db.allDocs();
                let discussions = [];
                let ids = [];
                let messages = [];
                for (var i = 0; i < dbstore.rows.length; i++) {
                    var check = dbstore.rows[i];
                    var message = yield db.get(check.id);
                    if (message.type === 'private') {
                        delete message._id;
                        delete message._rev;
                        let decrypted = yield encryption_1.default.decryptMessage(message.message);
                        message.message = decrypted;
                        messages.push(message);
                    }
                }
                messages.sort(function (a, b) {
                    return parseFloat(b.timestamp) - parseFloat(a.timestamp);
                });
                for (var k in messages) {
                    var message = messages[k];
                    if (ids.indexOf(message.address) === -1) {
                        ids.push(message.address);
                        var d = new Date(message.timestamp);
                        discussions.push({
                            address: message.address,
                            nickname: contacts[message.address],
                            last_message: d.toLocaleString()
                        });
                    }
                }
                res.send(discussions);
            }));
            api.get('/messages/public', (req, res) => __awaiter(this, void 0, void 0, function* () {
                let contacts = {};
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i];
                    var id = yield db.get(check.id);
                    if (id.nickname === undefined) {
                        let nickname = id.address.substr(0, 4) + '.' + id.address.substr(-4);
                        id.nickname = nickname;
                    }
                    contacts[id.address] = id.nickname;
                }
                contacts[global['identity']['wallet']['pub']] = 'Me';
                var db = new PouchDB('messages');
                let dbstore = yield db.allDocs();
                var signatures = [];
                var messages = [];
                for (var i = 0; i < dbstore.rows.length; i++) {
                    var check = dbstore.rows[i];
                    var message = yield db.get(check.id);
                    if (message.type === 'public' && signatures.indexOf(message.signature) === -1) {
                        signatures.push(message.signature);
                        delete message._id;
                        delete message._rev;
                        message.message = JSON.parse(message.message);
                        if (message.address === global['identity']['wallet']['pub']) {
                            message.is_mine = true;
                        }
                        else {
                            message.is_mine = false;
                        }
                        message.nickname = contacts[message.address];
                        messages.push(message);
                    }
                }
                messages.sort(function (a, b) {
                    return parseFloat(a.message.timestamp) - parseFloat(b.message.timestamp);
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
            api.get('/connections', (req, res) => {
                let connections = global['connected'];
                res.send(connections);
            });
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
                            signature['message'] = JSON.stringify(toBroadcast);
                            signature['type'] = 'public';
                            messages_1.default.broadcast('message', signature);
                            //Messages.store(signature,'public')
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
                                signature['message'] = JSON.stringify(toBroadcastEncrypted);
                                signature['type'] = 'private';
                                messages_1.default.broadcast('message', signature);
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
                let identities = [];
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i];
                    var id = yield db.get(check.id);
                    delete id._id;
                    delete id._rev;
                    if (id.nickname === undefined) {
                        let nickname = id.address.substr(0, 4) + '.' + id.address.substr(-4);
                        id.nickname = nickname;
                    }
                    if (identities.indexOf(id.address) === -1) {
                        identities.push(id.address);
                        contacts.push(id);
                    }
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
            api.listen(apiport, () => console.log('Api listening on port ' + apiport));
        });
    }
}
exports.default = Api;
//# sourceMappingURL=api.js.map