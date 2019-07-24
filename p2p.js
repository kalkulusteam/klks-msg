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
const getPort = require('get-port');
var dns = require('dns');
const publicIp = require('public-ip');
global['clients'] = {};
global['nodes'] = {};
global['connected'] = {};
var argv = require('minimist')(process.argv.slice(2));
class P2P {
    static init() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                console.log('Starting P2P client.');
                global['identity'] = yield identity_1.default.load();
                console.log('Identity loaded: ' + global['identity']['wallet']['pub']);
                let bootstrap = config.BOOTSTRAP_NODES;
                for (var k in bootstrap) {
                    if (!global['clients'][bootstrap[k]]) {
                        //INIT CONNECTION
                        console.log('Bootstrap connection to ' + bootstrap[k]);
                        let lookupURL = bootstrap[k].replace('http://', '').replace(':' + config.P2P_PORT, '');
                        let ip = yield this.lookup(lookupURL);
                        let publicip = yield publicIp.v4();
                        let node = bootstrap[k];
                        if (ip !== publicip) {
                            global['nodes'][node] = require('socket.io-client')(node, { reconnect: true });
                            global['nodes'][node].on('connect', function () {
                                console.log('Connected to peer: ' + global['nodes'][node].io.uri);
                                global['connected'][node] = true;
                            });
                            global['nodes'][node].on('disconnect', function () {
                                console.log('Disconnected from peer: ' + global['nodes'][node].io.uri);
                                global['connected'][node] = false;
                            });
                            //PROTOCOLS
                            global['nodes'][bootstrap[k]].on('message', function (data) {
                                utilities_1.default.log('Received message from outer space.');
                                messages_1.default.processMessage('message', data);
                            });
                            global['nodes'][bootstrap[k]].on('pubkey', function (data) {
                                utilities_1.default.log('Received pubkey message from outer space.');
                                messages_1.default.processMessage('pubkey', data);
                            });
                        }
                    }
                }
                if (argv.server) {
                    //INIT SOCKETIO SERVER
                    let p2pport = yield getPort({ port: config.P2P_PORT });
                    utilities_1.default.log('Starting P2P server on port ' + p2pport);
                    server.listen(config.P2P_PORT);
                    global['io'].server.on('connection', function (socket) {
                        utilities_1.default.log('New peer connected: ' + socket.id);
                        //PROTOCOLS
                        socket.on('message', function (data) {
                            utilities_1.default.log('Relaying received message to peers...');
                            messages_1.default.relayMessage(data);
                        });
                        socket.on('pubkey', function (data) {
                            utilities_1.default.log('Relaying received pubkey to peers...');
                            messages_1.default.relayPubkey(data);
                        });
                        //TODO: check if peer can act as server, then relay information to all the peers.
                    });
                }
                //BACKGROUND TASKS
                setInterval(function () {
                    messages_1.default.broadcastPubKey();
                    //Messages.relayMessages()
                }, 30000);
                response(true);
            }));
        });
    }
    static lookup(lookupURL) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(response => {
                dns.lookup(lookupURL, function onLookup(err, ip, family) {
                    return __awaiter(this, void 0, void 0, function* () {
                        response(ip);
                    });
                });
            });
        });
    }
}
exports.default = P2P;
//# sourceMappingURL=p2p.js.map