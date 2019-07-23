import { app, BrowserWindow } from 'electron';
import Main from './main';
import Api from './api';
import Identity from './identity';
import Encryption from './encryption';
import Messages from './messages';
import Utilities from './utilities';

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

global['relayed'] = []

async function initEngine(){
  
  let identity = await Identity.load()
  console.log('Identity loaded: ' + identity['wallet']['pub'])
  
  await startSwarm()

  global['sw'].on('connection', (conn, info) => {
    const seq = global['connseq']
    const peerId = info.id.toString('hex')
    console.log('New connection with '+ peerId +'!')
    if(peerId !== global['swarmid'].toString('hex')){
      if (!global['peers'][peerId]) {
        console.log(`Connected to peer: /swarm/klksmsg/${peerId}`)
        global['peers'][peerId] = {}
      }

      global['peers'][peerId].conn = conn
      global['peers'][peerId].seq = seq
      global['connseq']++
      setInterval(function(){
        if (info.initiator) {
          try {
            if (typeof conn.setKeepAlive === "function") {
              conn.setKeepAlive(true, 99999999999999999999999999999)
            }
          } catch (exception) {
            setTimeout(function(){
              conn.setKeepAlive(true, 99999999999999999999999999999)
            }, 10000)
          }
        }
      }, 30000)

      conn.on('data', async data => {
        try{
          var received = JSON.parse(data.toString())
          Identity.verifySign(received.pubKey, received.signature, received['message']).then(async signature => {
            if(signature === true){
              var blocked = await Identity.isBlocked(received['address'])
              if(blocked === false){
                console.log('Received valid message from ' + received['address'] + '.')
                Messages.relayMessage(received)
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
         delete global['peers'][peerId]
      })
    }else{
      console.log('Trying to connect to yourself.')
    }
  })
  
  setInterval(
    function (){
      if(Utilities.connections() === 0){
        console.log('No connections.')
        if(argv.server === undefined){
          console.log('Try to connect again.')
          global['sw'].destroy(function (){
            startSwarm()
          })
        } 
      }else{
        Messages.broadcastPubKey()
        //Messages.relayMessages()
      }
    },
    30000
  )
}

async function startSwarm(){
  global['peers'] = {}
  global['connseq'] = 0
  global['swarmid'] = crypto.randomBytes(32)
  console.log('Bootstraping connections, the network will be ready soon...')
  console.log('Your Swarm identity: /swarm/klksmsg/' + global['swarmid'].toString('hex'))
  global['sw'] = Swarm({
    id: global['swarmid'],
    utp: true,
    tcp: true
  })

  const port = await getPort()
  global['sw'].listen(port)
  console.log('Swarm listening to port: ' + port)
  global['sw'].join(config.SWARM_CHANNEL)

}

initEngine()