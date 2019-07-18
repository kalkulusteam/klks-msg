"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const api = express();
const Identicon = require('identicon.js');
const fs = require('fs');
const sign = require('./libs/sign.js');
const config = require('./config.json');
var messages = [];
var relayed = [];
class Api {
    static init() {
        var frontendPort = 11673; //TEST CORRECTION
        api.get('/avatar/:hash', (req, res) => {
            var data = new Identicon(req.params.hash, 420).toString();
            var img = Buffer.from(data, 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': img.length
            });
            res.end(img);
        });
        //api.get('/connections', (req, res) => res.send(sw.connected))
        api.post('/send-message', (req, res) => {
            var body = req.body;
            if (body.message !== undefined && body.receiver !== undefined) {
                var message = body.message;
                var receiver = body.receiver;
                if (receiver !== 'public') {
                    if (fs.existsSync('users/' + receiver + '.pem')) {
                        /*let encrypted = encryptMessage(split[1], 'users/'+receiver+'.pem')
                        sign.signWithKey(config.NODE_KEY, encrypted).then(signature => {
                        signature.message = encrypted
                        messages.push(signature.signature)
                        broadCast(JSON.stringify(signature))
                        })*/
                    }
                    else {
                        res.send({
                            error: true,
                            message: 'CAN\'T FIND ' + receiver + ' PUBKEY!'
                        });
                    }
                }
                else {
                    sign.signWithKey(config.NODE_KEY, message).then(signature => {
                        signature.message = message;
                        /*messages.push(signature.signature)
                        broadCast(JSON.stringify(signature))
                        res.send(signature)*/
                    });
                }
            }
            else {
                res.send({
                    error: true,
                    message: 'Specify message and receiver'
                });
            }
        });
        api.listen(frontendPort, () => console.log(`Engine listening on port ${frontendPort}!`));
    }
}
exports.default = Api;
//# sourceMappingURL=api.js.map