import Identity from './identity'
import Utilities from './utilities'
import Messages from './messages'
import { getPriority } from 'os';

const config = require('./config.json')
var app = require('express')()
var server = require('http').Server(app)
global['io'] = { server: null, client: null, sockets: {} }
global['io'].server = require('socket.io')(server)
const getPort = require('get-port')
var dns = require('dns')
const publicIp = require('public-ip');

global['clients'] = {}
global['nodes'] = {}
global['connected'] = {}
var argv = require('minimist')(process.argv.slice(2))

export default class P2P {
    static async init() {
        return new Promise(async response => {
            console.log('Starting P2P client.')

            global['identity'] = await Identity.load()
            console.log('Identity loaded: ' + global['identity']['wallet']['pub'])

            let bootstrap = config.BOOTSTRAP_NODES
            for (var k in bootstrap) {
                if (!global['clients'][bootstrap[k]]) {
                    //INIT CONNECTION
                    console.log('Bootstrap connection to ' + bootstrap[k])
                    let lookupURL = bootstrap[k].replace('http://', '').replace(':' + config.P2P_PORT, '')
                    let ip = await this.lookup(lookupURL)
                    let publicip = await publicIp.v4()
                    let node = bootstrap[k]

                    if (ip !== publicip) {
                        global['nodes'][node] = require('socket.io-client')(node, { reconnect: true })
                        global['nodes'][node].on('connect', function () {
                            console.log('Connected to peer: ' + global['nodes'][node].io.uri)
                            global['connected'][node] = true
                        })
                        global['nodes'][node].on('disconnect', function () {
                            console.log('Disconnected from peer: ' + global['nodes'][node].io.uri)
                            global['connected'][node] = false
                        })

                        //PROTOCOLS
                        global['nodes'][bootstrap[k]].on('message', function (data) {
                            Utilities.log('Received message from outer space.')
                            Messages.processMessage('message', data)
                        })
                        global['nodes'][bootstrap[k]].on('pubkey', function (data) {
                            Utilities.log('Received pubkey message from outer space.')
                            Messages.processMessage('pubkey', data)
                        })
                    }
                }
            }

            if (argv.server) {
                //INIT SOCKETIO SERVER
                let p2pport = await getPort({ port: config.P2P_PORT })
                Utilities.log('Starting P2P server on port ' + p2pport)
                server.listen(config.P2P_PORT);
                global['io'].server.on('connection', function (socket) {
                    Utilities.log('New peer connected: ' + socket.id)
                    global['io'].sockets[socket.id] = socket
                    //PROTOCOLS
                    socket.on('message', function (data) {
                        Utilities.log('Relaying received message to peers...');
                        Messages.relayMessage(data)
                    })

                    socket.on('pubkey', function (data) {
                        Utilities.log('Relaying received pubkey to peers...');
                        Messages.relayPubkey(data)
                    })

                    //TODO: check if peer can act as server, then relay information to all the peers.
                });
            }

            //BACKGROUND TASKS
            setInterval(
                function () {
                    Messages.broadcastPubKey()
                    Messages.broadcastMessages()
                }
                , 30000)

            response(true)
        })
    }

    static async lookup(lookupURL) {
        return new Promise(response => {
            dns.lookup(lookupURL, async function onLookup(err, ip, family) {
                response(ip)
            })
        })
    }
}