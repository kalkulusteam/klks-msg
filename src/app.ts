import { app, BrowserWindow } from 'electron';
import Main from './main';
import Api from './api';
import Identity from './identity';
import Encryption from './encryption';
import Messages from './messages';

const crypto = require('crypto')
const Swarm = require('discovery-swarm')
const getPort = require('get-port')
const fs = require('fs')
const config = require('./config.json')
require('events').EventEmitter.defaultMaxListeners = 150;
var argv = require('minimist')(process.argv.slice(2))

if(argv.server === undefined){
    console.log('Starting interface')
    Main.main(app, BrowserWindow);
}

Api.init()

global['peers'] = {}
let connSeq = 0
global['relayed'] = []
  
const NodeID = crypto.randomBytes(32)
console.log('Your Swarm identity: /swarm/klksmsg/' + NodeID.toString('hex'))

const sw = Swarm({
  id: NodeID,
  utp: true,
  tcp: true
})
//SWARM

async function initEngine(){

  let identity = await Identity.load()
  console.log('Identity loaded: ' + identity['wallet']['pub'])

  const port = await getPort()
  sw.listen(port)
  console.log('Swarm listening to port: ' + port)
  const swarmchannel = config.SWARM_CHANNEL
  sw.join(swarmchannel)

  sw.on('connect-failed', function(peer, details) { 
    if(config.DEBUG === 'TRUE'){
      console.log('CONNECTION ERROR', peer, details)
    }
  })
  
  sw.on('connection', (conn, info) => {
    const seq = connSeq
    const peerId = info.id.toString('hex')
    if (!global['peers'][peerId]) {
      console.log(`Connected to peer: /swarm/klksmsg/${peerId}`)
      global['peers'][peerId] = {}
      Messages.broadcastPubKey()
    }

    global['peers'][peerId].conn = conn
    global['peers'][peerId].seq = seq
    connSeq++

    if (info.initiator) {
      try {
        conn.setKeepAlive(true, 600)
      } catch (exception) {
        setTimeout(function(){
          conn.setKeepAlive(true, 600)
        }, 10000)
      }
    }

    conn.on('data', async data => {
      try{
        var received = JSON.parse(data.toString())
        Identity.verifySign(received.pubKey, received.signature, received['message']).then(async signature => {
          if(signature === true){
            var blocked = await Identity.isBlocked(received['address'])
            if(blocked === false){
              console.log('Received valid message from ' + received['address'] + '.')
              var decrypted = await Encryption.decryptMessage(received['message'])
              if(decrypted !== false){
                Messages.store(received, 'private')
                console.log('\x1b[32m%s\x1b[0m', 'Received SAFU message from ' + received['address'])
              }else{
                if(received['message'].indexOf('-----BEGIN PUBLIC KEY-----') !== -1){
                  Identity.store({
                    address: received['address'],
                    pubkey: received['message']
                  })
                }else{
                  if(received['type'] === 'public'){
                    console.log('\x1b[32m%s\x1b[0m', 'Received public message from ' + received['address'])
                    Messages.store(received, 'public')
                  }
                }
              }
            }
          }
        })
      }catch(e){
        if(config.DEBUG === 'true'){
          console.log('Received unsigned data, ignoring.')
        }
      }
    })

    conn.on('close', () => {
      if (global['peers'][peerId].seq === seq) {
        delete global['peers'][peerId]
      }
    })

  })
  
  setInterval(
    function (){
      if(sw.connected === 0){
        console.log('No connections, try to connect again..')
        sw.join(config.SWARM_CHANNEL)
      }else{
        Messages.broadcastPubKey()
        Messages.relayMessages()
      }
    },
    15000
  )
  
  console.log('Bootstraping connections, the interface will be ready soon...')
  var connectionReady = setInterval(function(){
    if(sw.connected > 0){
      console.log('Interface ready, now you can start messaging.')
      clearInterval(connectionReady)
    }
  },5000)
}

initEngine()