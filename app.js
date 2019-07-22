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
const utilities_1 = require("./utilities");
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
global['relayed'] = [];
function initEngine() {
    return __awaiter(this, void 0, void 0, function* () {
        let identity = yield identity_1.default.load();
        console.log('Identity loaded: ' + identity['wallet']['pub']);
        yield startSwarm();
        global['sw'].on('connection', (conn, info) => {
            const seq = global['connseq'];
            const peerId = info.id.toString('hex');
            console.log('New connection with ' + peerId + '!');
            if (peerId !== global['swarmid'].toString('hex')) {
                if (!global['peers'][peerId]) {
                    console.log(`Connected to peer: /swarm/klksmsg/${peerId}`);
                    global['peers'][peerId] = {};
                }
                global['peers'][peerId].conn = conn;
                global['peers'][peerId].seq = seq;
                global['connseq']++;
                if (info.initiator) {
                    try {
                        if (typeof conn.setKeepAlive === "function") {
                            conn.setKeepAlive(true, 600);
                        }
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
                                var blocked = yield identity_1.default.isBlocked(received['address']);
                                if (blocked === false) {
                                    console.log('Received valid message from ' + received['address'] + '.');
                                    messages_1.default.relayMessage(received);
                                    var decrypted = yield encryption_1.default.decryptMessage(received['message']);
                                    if (decrypted !== false) {
                                        messages_1.default.store(received, 'private');
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
                                            if (received['type'] === 'public') {
                                                console.log('\x1b[32m%s\x1b[0m', 'Received public message from ' + received['address']);
                                                messages_1.default.store(received, 'public');
                                            }
                                        }
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
                    delete global['peers'][peerId];
                });
            }
            else {
                console.log('Trying to connect to yourself.');
            }
        });
        setInterval(function () {
            if (utilities_1.default.connections() === 0) {
                console.log('No connections.');
                if (argv.server === undefined) {
                    console.log('Try to connect again.');
                    global['sw'].destroy(function () {
                        startSwarm();
                    });
                }
            }
            else {
                messages_1.default.broadcastPubKey();
                //Messages.relayMessages()
            }
        }, 30000);
    });
}
function startSwarm() {
    return __awaiter(this, void 0, void 0, function* () {
        global['peers'] = {};
        global['connseq'] = 0;
        global['swarmid'] = crypto.randomBytes(32);
        console.log('Bootstraping connections, the network will be ready soon...');
        console.log('Your Swarm identity: /swarm/klksmsg/' + global['swarmid'].toString('hex'));
        global['sw'] = Swarm({
            id: global['swarmid'],
            utp: true,
            tcp: true
        });
        const port = yield getPort();
        global['sw'].listen(port);
        console.log('Swarm listening to port: ' + port);
        global['sw'].join(config.SWARM_CHANNEL);
    });
}
initEngine();
//# sourceMappingURL=app.js.map