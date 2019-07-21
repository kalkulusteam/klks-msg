const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-find'))
import Identity from './identity'

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
                await db.post(received)
                console.log('Saved new message.')
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
                    console.log('Saved new message.')
                }
            }
            response(true)
        })
    }

    static async broadcast(message) {
        //console.log('Broadcasting to network..')
        for (let id in global['peers']) {
            global['peers'][id].conn.write(message)
        }
        //console.log('Broadcast end.')
    }

    static async broadcastPubKey() {
        console.log('Broadcasting RSA public key to peers...')
        let identity = await Identity.load()
        var publicKey = identity['rsa']['pub']
        var message = publicKey
        Identity.signWithKey(identity['wallet']['prv'], message).then(signature => {
            signature['message'] = message
            Messages.broadcast(JSON.stringify(signature))
        })
    }
    
    static async relayMessages(){
        console.log('Relaying received messages to peers...')
        var db = new PouchDB('messages')
        let dbstore = await db.allDocs()
        var messages = []
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
                Messages.broadcast(message)
            }
        }
    }

}