const { app, BrowserWindow } = require('electron')
var childProcess = require('child_process');
var utilities = require('./libs/utilities.js');
const express = require('express')
const Identicon = require('identicon.js')
const api = express()
const crypto = require('crypto')
const Swarm = require('discovery-swarm')
const getPort = require('get-port')
const sign = require('./libs/sign.js')
require('dotenv').config()
const fs = require('fs')
require('events').EventEmitter.defaultMaxListeners = 150;
var argv = require('minimist')(process.argv.slice(2))

const peers = {}
let connSeq = 0
let rl
var messages = []
var relayed = []

async function initMessenger(){
  var frontendPort = await utilities.freeport();
  api.get('/avatar/:hash', (req, res) => {
    var data = new Identicon(req.params.hash, 420).toString();
    var img = new Buffer(data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    res.end(img); 
  })

  api.get('/connections', (req, res) => res.send(sw.connected))
  api.post('/send-message', (req,res) => {
    var body = req.body
    if(body.message !== undefined && body.receiver !== undefined){
      var message = body.message
      var receiver = body.receiver
        if(receiver !== 'public'){
          if (fs.existsSync('users/'+receiver+'.pem')) {
            let encrypted = encryptMessage(split[1], 'users/'+receiver+'.pem')
            sign.signWithKey(process.env.NODE_KEY, encrypted).then(signature => {
              signature.message = encrypted
              messages.push(signature.signature)
              broadCast(JSON.stringify(signature))
            })
          }else{
            res.send({
              error: true,
              message: 'CAN\'T FIND ' + receiver + ' PUBKEY!'
            })
          }
        }else{
          sign.signWithKey(process.env.NODE_KEY, message).then(signature => {
            signature.message = message
            messages.push(signature.signature)
            broadCast(JSON.stringify(signature))
            res.send(signature)
          })
        }
    }else{
      res.send({
        error: true,
        message: 'Specify message and receiver'
      })
    }
  })
  
  api.listen(frontendPort, () => console.log(`Engine listening on port ${frontendPort}!`))
}
//INIT MESSENGER FUNCTIONS
initMessenger()

function renderWindow () {
  let win = new BrowserWindow({
    width: 1024,
    height: 550,
    webPreferences: {
      nodeIntegration: true
    },
    icon: 'assets/img/favicon.png'
  })
  win.maximize()
  win.loadFile('index.html')
}

function initInterface(){
  app.on('ready', renderWindow)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  app.on('before-quit', () =>{
    console.log('Quitting messenger.')
  })
  app.on('activate', () => {
    if (win === null) {
      renderWindow()
    }
  })
}

//INIT INTERFACE
if(argv.server === undefined){
  initInterface()
}

const broadCast = async (message) => {
  //console.log('Broadcasting now...')
  if(sw.connected > 0){
    for (let id in peers) {
      peers[id].conn.write(message)
    }
  }
}

const broadCastPubKey = async () => {
  if(sw.connected > 0){
    //console.log('Broadcasting pubKey to peers...')
    var publicKey = fs.readFileSync('keys/public.pem', "utf8");
    var message = publicKey
    sign.signWithKey(process.env.NODE_KEY, message).then(signature => {
      signature.message = message
      broadCast(JSON.stringify(signature))
    })
  }
}
//COMMUNICATION FUNCTIONS

//SWARM
const NodeID = crypto.randomBytes(32)
console.log('Your Swarm identity: /swarm/klksmsg/' + NodeID.toString('hex'))

const sw = Swarm({
  id: NodeID,
  utp: true,
  tcp: true
})
//SWARM

//ENCRYPTION
const generateKeys = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', 
  {
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
    fs.writeFileSync('keys/private.pem', privateKey)
    fs.writeFileSync('keys/public.pem', publicKey)
  }
}

var encryptMessage = function(toEncrypt, keyPath) {
  var publicKey = fs.readFileSync(keyPath, "utf8");
  var buffer = Buffer.from(toEncrypt);
  var encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString("base64");
};

var decryptMessage = function(toDecrypt, keyPath) {
  var privateKey = fs.readFileSync(keyPath, "utf8");
  var buffer = Buffer.from(toDecrypt, "base64");
  const decrypted = crypto.privateDecrypt(
      {
          key: privateKey.toString()
      },
      buffer,
  )
  return decrypted.toString("utf8");
}
//ENCRYPTION

async function initEngine(){

  const port = await getPort()
  sw.listen(port)
  console.log('Listening to port: ' + port)
  const swarmchannel = process.env.SWARM_CHANNEL
  sw.join(swarmchannel)

  sw.on('connect-failed', function(peer, details) { 
    if(process.env.DEBUG === 'TRUE'){
      console.log('CONNECTION ERROR', peer, details)
    }
  })
  
  sw.on('connection', (conn, info) => {
    const seq = connSeq

    const peerId = info.id.toString('hex')
    if (!peers[peerId]) {
      console.log(`Connected to peer: /swarm/klksmsg/${peerId}`)
      peers[peerId] = {}
      broadCastPubKey()
    }

    peers[peerId].conn = conn
    peers[peerId].seq = seq
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

    conn.on('data', data => {
      try{
        var received = JSON.parse(data.toString())
        sign.verifySign(received.pubKey, received.signature, received.message).then(signature => {
          if(signature === true){
            try{
              var decrypted = decryptMessage(received.message, 'keys/private.pem')
              var d = new Date()
              var n = d.toLocaleString()
              if(messages.indexOf(received.signature) === -1){
                messages.push(received.signature)
                console.log('\x1b[32m%s\x1b[0m \x1b[36m%s\x1b[0m', '['+ n +'] [SAFU]',received.address + ':', decrypted)
              }
            }catch(e){
              if(received.message.indexOf('-----BEGIN PUBLIC KEY-----') !== -1){
                if (!fs.existsSync('users/'+ received.address +'.pem')) {
                  fs.writeFileSync('users/'+ received.address +'.pem', received.message)
                  console.log('Received new public key.')
                }
              }else{
                var d = new Date()
                var n = d.toLocaleString()
                if(messages.indexOf(received.signature) === -1){
                  messages.push(received.signature)
                  console.log('\x1b[32m%s\x1b[0m \x1b[36m%s\x1b[0m', '['+ n +']',received.address + ':', received.message)
                }
              }
            }
            if(process.env.RELAY === 'true'){
              broadCast(data.toString())
            }
          }
        })
      }catch(e){
        if(process.env.DEBUG === 'true'){
          console.log('Received unsigned data, ignoring.')
        }
      }
    })

    conn.on('close', () => {
      if (peers[peerId].seq === seq) {
        delete peers[peerId]
      }
    })

  })
  
  generateKeys()
  setInterval(
    function (){
      sw.join(swarmchannel)
      broadCastPubKey()
      messages = []
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

//INIT MESSENGER ENGINE
initEngine()