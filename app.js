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
const electron_1 = require("electron");
const main_1 = require("./main");
const api_1 = require("./api");
const identity_1 = require("./identity");
const crypto = require('crypto');
const Swarm = require('discovery-swarm');
const getPort = require('get-port');
const fs = require('fs');
const config = require('./config.json');
require('events').EventEmitter.defaultMaxListeners = 150;
var argv = require('minimist')(process.argv.slice(2));
if (argv.server === undefined) {
    console.log('Starting interface');
    main_1.default.main(electron_1.app, electron_1.BrowserWindow);
}
api_1.default.init();
identity_1.default.create();
const peers = {};
let connSeq = 0;
let messages = [];
let relayed = [];
const broadCast = (message) => __awaiter(this, void 0, void 0, function* () {
    //console.log('Broadcasting now...')
    if (sw.connected > 0) {
        for (let id in peers) {
            peers[id].conn.write(message);
        }
    }
});
const broadCastPubKey = () => __awaiter(this, void 0, void 0, function* () {
    if (sw.connected > 0) {
        //console.log('Broadcasting pubKey to peers...')
        var publicKey = fs.readFileSync('keys/public.pem', "utf8");
        var message = publicKey;
        identity_1.default.signWithKey(config.NODE_KEY, message).then(signature => {
            signature['message'] = message;
            broadCast(JSON.stringify(signature));
        });
    }
});
const NodeID = crypto.randomBytes(32);
console.log('Your Swarm identity: /swarm/klksmsg/' + NodeID.toString('hex'));
const sw = Swarm({
    id: NodeID,
    utp: true,
    tcp: true
});
//SWARM
//ENCRYPTION
const generateKeys = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        namedCurve: 'secp256k1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    if (!fs.existsSync('keys/private.pem')) {
        fs.writeFileSync('keys/private.pem', privateKey);
        fs.writeFileSync('keys/public.pem', publicKey);
    }
};
var encryptMessage = function (toEncrypt, keyPath) {
    var publicKey = fs.readFileSync(keyPath, "utf8");
    var buffer = Buffer.from(toEncrypt);
    var encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString("base64");
};
var decryptMessage = function (toDecrypt, keyPath) {
    var privateKey = fs.readFileSync(keyPath, "utf8");
    var buffer = Buffer.from(toDecrypt, "base64");
    const decrypted = crypto.privateDecrypt({
        key: privateKey.toString()
    }, buffer);
    return decrypted.toString("utf8");
};
//ENCRYPTION
function initEngine() {
    return __awaiter(this, void 0, void 0, function* () {
        const port = yield getPort();
        sw.listen(port);
        console.log('Listening to port: ' + port);
        const swarmchannel = config.SWARM_CHANNEL;
        sw.join(swarmchannel);
        sw.on('connect-failed', function (peer, details) {
            if (config.DEBUG === 'TRUE') {
                console.log('CONNECTION ERROR', peer, details);
            }
        });
        sw.on('connection', (conn, info) => {
            const seq = connSeq;
            const peerId = info.id.toString('hex');
            if (!peers[peerId]) {
                console.log(`Connected to peer: /swarm/klksmsg/${peerId}`);
                peers[peerId] = {};
                broadCastPubKey();
            }
            peers[peerId].conn = conn;
            peers[peerId].seq = seq;
            connSeq++;
            if (info.initiator) {
                try {
                    conn.setKeepAlive(true, 600);
                }
                catch (exception) {
                    setTimeout(function () {
                        conn.setKeepAlive(true, 600);
                    }, 10000);
                }
            }
            conn.on('data', data => {
                try {
                    var received = JSON.parse(data.toString());
                    identity_1.default.verifySign(received.pubKey, received.signature, received.message).then(signature => {
                        if (signature === true) {
                            try {
                                var decrypted = decryptMessage(received.message, 'keys/private.pem');
                                var d = new Date();
                                var n = d.toLocaleString();
                                if (messages.indexOf(received.signature) === -1) {
                                    messages.push(received.signature);
                                    console.log('\x1b[32m%s\x1b[0m \x1b[36m%s\x1b[0m', '[' + n + '] [SAFU]', received.address + ':', decrypted);
                                }
                            }
                            catch (e) {
                                if (received.message.indexOf('-----BEGIN PUBLIC KEY-----') !== -1) {
                                    if (!fs.existsSync('users/' + received.address + '.pem')) {
                                        fs.writeFileSync('users/' + received.address + '.pem', received.message);
                                        console.log('Received new public key.');
                                    }
                                }
                                else {
                                    var d = new Date();
                                    var n = d.toLocaleString();
                                    if (messages.indexOf(received.signature) === -1) {
                                        messages.push(received.signature);
                                        console.log('\x1b[32m%s\x1b[0m \x1b[36m%s\x1b[0m', '[' + n + ']', received.address + ':', received.message);
                                    }
                                }
                            }
                            if (config.RELAY === 'true') {
                                broadCast(data.toString());
                            }
                        }
                    });
                }
                catch (e) {
                    if (config.DEBUG === 'true') {
                        console.log('Received unsigned data, ignoring.');
                    }
                }
            });
            conn.on('close', () => {
                if (peers[peerId].seq === seq) {
                    delete peers[peerId];
                }
            });
        });
        generateKeys();
        setInterval(function () {
            sw.join(swarmchannel);
            broadCastPubKey();
            messages = [];
        }, 15000);
        console.log('Bootstraping connections, the interface will be ready soon...');
        var connectionReady = setInterval(function () {
            if (sw.connected > 0) {
                console.log('Interface ready, now you can start messaging.');
                clearInterval(connectionReady);
            }
        }, 5000);
    });
}
//INIT MESSENGER ENGINE
initEngine();
//# sourceMappingURL=app.js.map