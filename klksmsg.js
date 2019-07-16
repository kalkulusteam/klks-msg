const crypto = require('crypto')
const Swarm = require('discovery-swarm')
const getPort = require('get-port')
const readline = require('readline')
const sign = require('./crypto/sign.js')
require('dotenv').config()
const fs = require('fs')
require('events').EventEmitter.defaultMaxListeners = 150;

const peers = {}
let connSeq = 0
let rl
var messages = []

//COMMUNICATION FUNCTIONS
console.log('To broadcast a message to an user write with the following pattern (ADDRESS:MESSAGE) or send unencrypted message to every peer.')
const askUser = async () => {
  rl = readline.createInterface({
    input: process.stdin,
    output: null
  });
  rl.on('line', message => {
    if(message.length > 0){
      var split = message.split(':')
      if(split[1] !== undefined){
        if (fs.existsSync('users/'+split[0]+'.pem')) {
          let encrypted = encryptMessage(split[1], 'users/'+split[0]+'.pem')
          sign.signWithKey(process.env.NODE_KEY, encrypted).then(signature => {
            signature.message = encrypted
            broadCast(JSON.stringify(signature))
            rl.close()
            rl = undefined
            askUser()
          })
        }else{
          console.log('CAN\'T FIND ' + split[0] + ' PUBKEY!')
        }
      }else{
        //console.log('Sending unencrypted message: ' + message)
        sign.signWithKey(process.env.NODE_KEY, message).then(signature => {
          signature.message = message
          broadCast(JSON.stringify(signature))
          rl.close()
          rl = undefined
          askUser()
        })
      }
    }
  })
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

;(async () => {

  const port = await getPort()
  sw.listen(port)
  console.log('Listening to port: ' + port)

  sw.join(process.env.SWARM_CHANNEL)
  sw.on('connect-failed', function(peer, details) { 
    if(process.env.DEBUG === 'TRUE'){
      console.log('CONNECTION ERROR', peer, details)
    }
  })
  sw.on('peer', function(peer) { 
    if(process.env.DEBUG === 'TRUE'){
      console.log(peer)
    }
  })
  sw.on('handshaking', function(connection, info) { 
    if(process.env.DEBUG === 'TRUE'){
      console.log(connection, info)
    }
  })
  sw.on('connection', (conn, info) => {
    const seq = connSeq

    const peerId = info.id.toString('hex')
    if (!peers[peerId]) {
      console.log(`Connected #${seq} to peer: ${peerId}`)
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
        console.log('exception', exception)
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
      sw.join(process.env.SWARM_CHANNEL)
      broadCastPubKey()
      messages = []
    },
    15000
  )
  console.log('Bootstraping connections, the interface will be ready soon...')
  var connectionReady = setInterval(function(){
    if(sw.connected > 0){
      console.log('Interface ready, write a message when you\'re ready.')
      clearInterval(connectionReady)
      askUser()
    }
  },5000)
})()