const PouchDB = require('pouchdb')
const crypto = require('crypto')
import id from './identity'

export default class Identity {
    static async encryptMessage(toEncrypt, publicKey) {
        return new Promise( async response => {
            var buffer = Buffer.from(toEncrypt)
            var encrypted = crypto.publicEncrypt(publicKey, buffer)
            response(encrypted.toString("base64"))
        })
    }

    static async decryptMessage(toDecrypt) {
        return new Promise( async response => {
            try {
                let identity = await id.load()
                var privateKey = identity['rsa']['priv']
                var buffer = Buffer.from(toDecrypt, "base64")
                const decrypted = crypto.privateDecrypt(
                    {
                        key: privateKey.toString()
                    },
                    buffer,
                )
                response(decrypted.toString("utf8"))
            }catch(e){
                response(false)
            }
        })
    }
}