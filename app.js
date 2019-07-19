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
const encryption_1 = require("./encryption");
const messages_1 = require("./messages");
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
global['peers'] = {};
let connSeq = 0;
let messages = [];
let relayed = [];
const NodeID = crypto.randomBytes(32);
console.log('Your Swarm identity: /swarm/klksmsg/' + NodeID.toString('hex'));
const sw = Swarm({
    id: NodeID,
    utp: true,
    tcp: true
});
//SWARM
function initEngine() {
    return __awaiter(this, void 0, void 0, function* () {
        let identity = yield identity_1.default.load();
        console.log('Identity loaded: ' + identity['wallet']['pub']);
        const port = yield getPort();
        sw.listen(port);
        console.log('Swarm listening to port: ' + port);
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
            if (!global['peers'][peerId]) {
                console.log(`Connected to peer: /swarm/klksmsg/${peerId}`);
                global['peers'][peerId] = {};
                messages_1.default.broadcastPubKey();
            }
            global['peers'][peerId].conn = conn;
            global['peers'][peerId].seq = seq;
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
            conn.on('data', (data) => __awaiter(this, void 0, void 0, function* () {
                try {
                    var received = JSON.parse(data.toString());
                    identity_1.default.verifySign(received.pubKey, received.signature, received['message']).then((signature) => __awaiter(this, void 0, void 0, function* () {
                        if (signature === true) {
                            console.log('Received valid message from ' + received['address'] + '.');
                            var decrypted = yield encryption_1.default.decryptMessage(received['message']);
                            if (decrypted !== false) {
                                received.decrypted = decrypted;
                                messages_1.default.store(received);
                                console.log('\x1b[32m%s\x1b[0m', 'Received SAFU message from ' + received['address']);
                            }
                            else {
                                if (received['message'].indexOf('-----BEGIN PUBLIC KEY-----') !== -1) {
                                    identity_1.default.store({
                                        address: received['address'],
                                        pubkey: received['message']
                                    });
                                }
                                else {
                                    console.log('\x1b[32m%s\x1b[0m', 'Received public message from ' + received['address']);
                                    messages_1.default.store(received);
                                }
                            }
                        }
                    }));
                }
                catch (e) {
                    if (config.DEBUG === 'true') {
                        console.log('Received unsigned data, ignoring.');
                    }
                }
            }));
            conn.on('close', () => {
                if (global['peers'][peerId].seq === seq) {
                    delete global['peers'][peerId];
                }
            });
        });
        setInterval(function () {
            sw.join(swarmchannel);
            messages_1.default.broadcastPubKey();
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
initEngine();
//# sourceMappingURL=app.js.map