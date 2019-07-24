const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-find'))
import Identity from './identity'
global['relayed'] = []
const config = require('./config.json')
import Encryption from './encryption'
import Utilities from './utilities';
var argv = require('minimist')(process.argv.slice(2))

export default class Messages {
    static async store(received, type) {
        return new Promise( async response => {
            var db = new PouchDB('messages')
            let dbcheck = await db.allDocs()
            var d = new Date()
            var n = d.toLocaleString()
            received.received_at = n
            received.timestamp = d.getTime()
            received.type = type

            if(dbcheck.rows.length === 0){
                Utilities.log('Saving new message to local database...')
                await db.post(received)
            }else{
                var found = false
                for(var i = 0; i < dbcheck.rows.length; i++){
                    var check = dbcheck.rows[i]
                    var message = await db.get(check.id)
                    if(message.signature === received.signature){
                        found = true
                    }
                }
                if(found === false){
                    await db.post(received)
                    Utilities.log('Saved new message.')
                }else{
                    Utilities.log('Message '+ message.signature +' is stored yet')
                }
            }
            response(true)
        })
    }

    static async broadcast(protocol, message) {
        //Utilities.log('Broadcasting to network..')
        for (let id in global['nodes']) {
            global['nodes'][id].emit(protocol, message)
        }
        if(argv.server){
            global['io'].server.sockets.emit(protocol, message);
            Utilities.log('Broadcast to every connected client..')
        }
        //Utilities.log('Broadcast end.')
    }

    static async broadcastPubKey() {
        Utilities.log('Broadcasting RSA public key to peers...')
        let identity = await Identity.load()
        var publicKey = identity['rsa']['pub']
        var message = publicKey
        Identity.signWithKey(identity['wallet']['prv'], message).then(signature => {
            signature['message'] = message
            Messages.broadcast('pubkey', JSON.stringify(signature))
        })
    }
    
    static async relayMessages(){
        Utilities.log('Relaying stored messages to peers...')
        var db = new PouchDB('messages')
        let dbstore = await db.allDocs()
        for(var i = 0; i < dbstore.rows.length; i++){
            var check = dbstore.rows[i]
            var message = await db.get(check.id)
            var d = new Date()
            var t = d.getTime()
            var e = (t - message.timestamp) / 1000
            if(e < 172800){
                delete message._id
                delete message._rev
                delete message.timestamp
                delete message.received_at
                Messages.broadcast('message',message)
            }
        }
    }

    static async relayMessage(message){
        Utilities.log('Relaying message to peers...')
        if(global['relayed'].indexOf(message.signature) === -1){
            global['relayed'].push(message.signature)
            Messages.broadcast('message',JSON.stringify(message))
        }
    }

    static async relayPubkey(key){
        Utilities.log('Relaying pubkey to peers...')
        Messages.broadcast('pubkey', key)
    }

    static async processMessage(protocol, data){
        try{
            var received = JSON.parse(data.toString())
            Identity.verifySign(received.pubKey, received.signature, received['message']).then(async signature => {
              if(signature === true){
                var blocked = await Identity.isBlocked(received['address'])
                if(blocked === false){
                  Utilities.log('Received valid message from ' + received['address'] + '.')
                  Messages.relayMessage(received)
                  if(protocol === 'pubkey'){
                    Identity.store({
                        address: received['address'],
                        pubkey: received['message']
                    })
                  }else if(protocol === 'message'){
                    var decrypted = await Encryption.decryptMessage(received['message'])
                    if(decrypted !== false){
                        Messages.store(received, 'private')
                        Utilities.log('Received SAFU message from ' + received['address'])
                    }else if(received['type'] === 'public'){
                        Utilities.log('Received public message from ' + received['address'])
                        Messages.store(received, 'public')
                    }
                  }
                }
              }
            })
          }catch(e){
            if(config.DEBUG === true){
              Utilities.log('Received unsigned data, ignoring.')
            }
          }
    }

}