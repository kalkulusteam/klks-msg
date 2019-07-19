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
const messages_1 = require("./messages");
const utilities_1 = require("./utilities");
const PouchDB = require('pouchdb');
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
                messages.push(message);
            }
            res.send(messages);
        }));
        //api.get('/connections', (req, res) => res.send(sw.connected))
        api.post('/messages/send', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var body = yield utilities_1.default.body(req);
            if (body['body'].message !== undefined && body['body'].receiver !== undefined) {
                var message = body['body'].message;
                var receiver = body['body'].receiver;
                let identity = yield identity_1.default.load();
                if (receiver === 'private') {
                    //SEND PRIVATE MESSAGE
                }
                else if (receiver === 'group') {
                    //SEND GROUP MESSAGE
                }
                else {
                    identity_1.default.signWithKey(identity['wallet']['prv'], message).then(signature => {
                        signature['message'] = message;
                        messages_1.default.broadcast(JSON.stringify(signature));
                        res.send(signature);
                    });
                }
            }
            else {
                res.send({
                    error: true,
                    message: 'Specify message and receiver'
                });
            }
        }));
        api.listen(frontendPort, () => console.log(`Engine listening on port ${frontendPort}!`));
    }
}
exports.default = Api;
//# sourceMappingURL=api.js.map