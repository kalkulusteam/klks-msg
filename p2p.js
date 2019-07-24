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
const identity_1 = require("./identity");
const utilities_1 = require("./utilities");
const messages_1 = require("./messages");
const config = require('./config.json');
var app = require('express')();
var server = require('http').Server(app);
global['io'] = { server: null, client: null };
global['io'].server = require('socket.io')(server);
global['io'].client = require('socket.io-client');
const getPort = require('get-port');
var dns = require('dns');
const publicIp = require('public-ip');
global['nodes'] = {};
global['connected'] = {};
var argv = require('minimist')(process.argv.slice(2));
class P2P {
    static init() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                utilities_1.default.log('Starting P2P client.');
                let identity = yield identity_1.default.load();
                utilities_1.default.log('Identity loaded: ' + identity['wallet']['pub']);
                let bootstrap = config.BOOTSTRAP_NODES;
                for (var k in bootstrap) {
                    if (!global['nodes'][bootstrap[k]]) {
                        //INIT CONNECTION
                        utilities_1.default.log('Init bootstrap connection to ' + bootstrap[k]);
                        let lookupURL = bootstrap[k].replace('http://', '').replace(':' + config.P2P_PORT, '');
                        dns.lookup(lookupURL, function onLookup(err, ip, family) {
                            return __awaiter(this, void 0, void 0, function* () {
                                let publicip = yield publicIp.v4();
                                if (ip !== publicip) {
                                    global['nodes'][bootstrap[k]] = global['io'].client.connect(bootstrap[k], { reconnect: true });
                                    global['nodes'][bootstrap[k]].on('connect', function () {
                                        utilities_1.default.log('Connected to peer: ' + global['nodes'][bootstrap[k]].io.uri);
                                        global['connected'][bootstrap[k]] = true;
                                    });
                                    global['nodes'][bootstrap[k]].on('disconnect', function () {
                                        utilities_1.default.log('Disconnected from peer: ' + global['nodes'][bootstrap[k]].io.uri);
                                        global['connected'][bootstrap[k]] = false;
                                    });
                                    //PROTOCOLS
                                    global['nodes'][bootstrap[k]].on('message', function (data) {
                                        console.log('Received message');
                                        messages_1.default.processMessage('message', data);
                                    });
                                    global['nodes'][bootstrap[k]].on('pubkey', function (data) {
                                        console.log('Received pubkey message');
                                        messages_1.default.processMessage('pubkey', data);
                                    });
                                }
                            });
                        });
                    }
                }
                if (argv.server) {
                    let p2pport = yield getPort({ port: config.P2P_PORT });
                    console.log('Starting P2P server on port ' + p2pport);
                    server.listen(config.P2P_PORT);
                    global['io'].server.on('connection', function (socket) {
                        utilities_1.default.log('Peer connected.');
                        socket.on('message', function (data) {
                            utilities_1.default.log('Relaying received message to peers...');
                            if (config.DEBUG === true) {
                                console.log(data);
                            }
                            messages_1.default.relayMessage(data);
                        });
                        socket.on('pubkey', function (data) {
                            utilities_1.default.log('Relaying received pubkey to peers...');
                            if (config.DEBUG === true) {
                                console.log(data);
                            }
                            messages_1.default.relayPubkey(data);
                        });
                    });
                }
                //BACKGROUND TASKS
                setInterval(function () {
                    messages_1.default.broadcastPubKey();
                    messages_1.default.relayMessages();
                }, 30000);
                response(true);
            }));
        });
    }
}
exports.default = P2P;
//# sourceMappingURL=p2p.js.map