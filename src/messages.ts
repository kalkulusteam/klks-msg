const PouchDB = require('pouchdb')
import id from './identity'

export default class Messages {
    static async store(received) {
        return new Promise( async response => {
            var db = new PouchDB('messages')
            let dbcheck = await db.allDocs()
            var d = new Date()
            var n = d.toLocaleString()
            received.received_at = n

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
        console.log('Broadcasting to network..')
        for (let id in global['peers']) {
            global['peers'][id].conn.write(message)
        }
        console.log('Broadcast end.')
    }
    
}