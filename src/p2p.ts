import Identity from './identity'
import Utilities from './utilities'
import Messages from './messages'
import { getPriority } from 'os';

const config = require('./config.json')
var app = require('express')()
var server = require('http').Server(app)
let io = {server: null, client: null}
io.server = require('socket.io')(server)
io.client = require('socket.io-client')
const getPort = require('get-port')

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
                    global['nodes'][bootstrap[k]] = io.client.connect(bootstrap[k], {reconnect: true})
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
                       Messages.processMessage('message', data)
                    })
                    global['nodes'][bootstrap[k]].on('pubkey', function (data) {
                        Messages.processMessage('pubkey', data)
                     })
                }
            }

            if(argv.server){
                let p2pport = await getPort({port: config.P2P_PORT})
                console.log('Starting P2P server on port ' + p2pport)
                server.listen(config.P2P_PORT);
                io.server.on('connection', function (socket) {
                    Utilities.log('Peer connected.')

                    socket.on('message', function (data) {
                        Utilities.log('Relaying message to peers');
                        if(config.DEBUG === true){
                            console.log(data)
                        }
                        Messages.relayMessage(data)
                    })

                    socket.on('pubkey', function (data) {
                        Utilities.log('Relaying pubkey to peers');
                        if(config.DEBUG === true){
                            console.log(data)
                        }
                        Messages.relayPubkey(data)
                    })

                });
            }
            
            response(true)
        })
    }
}