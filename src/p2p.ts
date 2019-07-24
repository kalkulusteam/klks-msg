import Identity from './identity'
import Utilities from './utilities'
import Messages from './messages'
import { getPriority } from 'os';

const config = require('./config.json')
var app = require('express')()
var server = require('http').Server(app)
global['io'] = {server: null, client: null}
global['io'].server = require('socket.io')(server)
global['io'].client = require('socket.io-client')
const getPort = require('get-port')
var dns = require('dns')
const publicIp = require('public-ip');

global['nodes'] = {}
global['connected'] = {}
var argv = require('minimist')(process.argv.slice(2))

export default class P2P {
    static async init() {
        return new Promise( async response => {
            Utilities.log('Starting P2P client.')
                        
            let identity = await Identity.load()
            Utilities.log('Identity loaded: ' + identity['wallet']['pub'])

            let bootstrap = config.BOOTSTRAP_NODES
            for(var k in bootstrap){
                if(!global['nodes'][bootstrap[k]]){
                    //INIT CONNECTION
                    Utilities.log('Init bootstrap connection to ' + bootstrap[k])
                    let lookupURL = bootstrap[k].replace('http://','').replace(':' + config.P2P_PORT,'')
                    dns.lookup(lookupURL, async function onLookup(err, ip, family) {
                        let publicip = await publicIp.v4()
                        if(ip !== publicip){
                            global['nodes'][bootstrap[k]] = global['io'].client.connect(bootstrap[k], {reconnect: true})
                            global['nodes'][bootstrap[k]].on('connect', function () {
                                Utilities.log('Connected to peer: ' + global['nodes'][bootstrap[k]].io.uri)
                                global['connected'][bootstrap[k]] = true
                            })
                            global['nodes'][bootstrap[k]].on('disconnect', function () {
                                Utilities.log('Disconnected from peer: ' + global['nodes'][bootstrap[k]].io.uri)
                                global['connected'][bootstrap[k]] = false
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
                    })
                }
            }

            if(argv.server){
                //INIT SOCKETIO SERVER
                let p2pport = await getPort({port: config.P2P_PORT})
                Utilities.log('Starting P2P server on port ' + p2pport)
                server.listen(config.P2P_PORT);
                global['io'].server.on('connection', function (socket) {
                    Utilities.log('New peer connected.')

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
                function (){
                    Messages.broadcastPubKey()
                    Messages.relayMessages()
                }
            ,30000)

            response(true)
        })
    }
}