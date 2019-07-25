const express = require('express')
const api = express()
const Identicon = require('identicon.js')
const fs = require('fs')
const config = require('./config.json')
import Identity from './identity'
import Encryption from './encryption'
import Messages from './messages'
import Utilities from './utilities'
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-find'))
const getPort = require('get-port')

var messages = []
var relayed = []

export default class Api {
    static async init() {

        var lockfiles = ['./settings/LOCK', './messages/LOCK', './messages/LOCK']
        for (var l in lockfiles) {
            if (fs.existsSync(lockfiles[l])) {
                fs.unlinkSync(lockfiles[l])
            }
        }

        let apiport = await getPort({ port: config.API_PORT })
        api.get('/avatar/:hash', (req, res) => {
            var data = new Identicon(req.params.hash, 420).toString();
            var img = Buffer.from(data, 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': img.length
            });
            res.end(img);
        })

        api.get('/discussions', async (req, res) => {

            let contacts = {}
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            for (var i = 0; i < dbcheck.rows.length; i++) {
                var check = dbcheck.rows[i]
                var id = await db.get(check.id)
                if (id.nickname === undefined) {
                    let nickname = id.address.substr(0, 4) + '.' + id.address.substr(-4)
                    id.nickname = nickname
                }
                contacts[id.address] = id.nickname
            }
            contacts[global['identity']['wallet']['pub']] = 'Me'

            var db = new PouchDB('messages')
            let dbstore = await db.allDocs()
            let discussions = []
            let ids = []
            let messages = []
            for (var i = 0; i < dbstore.rows.length; i++) {
                var check = dbstore.rows[i]
                var message = await db.get(check.id)
                if (message.type === 'private') {
                    delete message._id
                    delete message._rev
                    let decrypted = await Encryption.decryptMessage(message.message)
                    message.message = decrypted
                    messages.push(message)
                }
            }
            messages.sort(function (a, b) {
                return parseFloat(b.timestamp) - parseFloat(a.timestamp);
            });
            for (var k in messages) {
                var message = messages[k]
                if (ids.indexOf(message.address) === -1) {
                    ids.push(message.address)
                    var d = new Date(message.timestamp)
                    discussions.push({
                        address: message.address,
                        nickname: contacts[message.address],
                        last_message: d.toLocaleString()
                    })
                }
            }
            res.send(discussions)
        })

        api.get('/messages/public', async (req, res) => {

            let contacts = {}
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            for (var i = 0; i < dbcheck.rows.length; i++) {
                var check = dbcheck.rows[i]
                var id = await db.get(check.id)
                if (id.nickname === undefined) {
                    let nickname = id.address.substr(0, 4) + '.' + id.address.substr(-4)
                    id.nickname = nickname
                }
                contacts[id.address] = id.nickname
            }
            contacts[global['identity']['wallet']['pub']] = 'Me'

            var db = new PouchDB('messages')
            let dbstore = await db.allDocs()
            var signatures = []
            var messages = []
            for (var i = 0; i < dbstore.rows.length; i++) {
                var check = dbstore.rows[i]
                var message = await db.get(check.id)

                if (message.type === 'public' && signatures.indexOf(message.signature) === -1) {
                    signatures.push(message.signature)
                    delete message._id
                    delete message._rev
                    message.message = JSON.parse(message.message)
                    if (message.address === global['identity']['wallet']['pub']) {
                        message.is_mine = true
                    } else {
                        message.is_mine = false
                    }
                    message.nickname = contacts[message.address]
                    messages.push(message)
                }
            }
            messages.sort(function (a, b) {
                return parseFloat(a.message.timestamp) - parseFloat(b.message.timestamp);
            });
            res.send(messages)
        })

        api.get('/messages/address/:address', async (req, res) => {
            var db = new PouchDB('messages')
            let dbstore = await db.allDocs()
            var messages = []
            for (var i = 0; i < dbstore.rows.length; i++) {
                var check = dbstore.rows[i]
                var message = await db.get(check.id)
                var print = false
                if (message.type === 'private' && (message.address === req.params.address || message.address === global['identity']['wallet']['pub'])) {
                    delete message._id
                    delete message._rev
                    let parsed = JSON.parse(message.message)
                    let decrypted = await Encryption.decryptMessage(parsed.message)
                    let checkreceiver = decrypted.toString().split('*|*|*')
                    if(checkreceiver[1] === undefined){
                        message.message = decrypted
                        messages.push(message)
                    }else{
                        if(checkreceiver[0] === req.params.address){
                            message.message = checkreceiver[1]
                            messages.push(message)
                        }
                    }
                }
            }
            messages.sort(function (a, b) {
                return parseFloat(a.timestamp) - parseFloat(b.timestamp);
            });
            res.send(messages)
        })

        api.get('/connections', (req, res) => {
            let connections = global['connected']
            res.send(connections)
        })

        api.post('/message', async (req, res) => {
            var body = await Utilities.body(req)
            if (body['body'].message !== undefined && body['body'].receiver !== undefined) {
                var message = body['body'].message
                var receiver = body['body'].receiver
                let identity = await Identity.load()

                if (receiver === 'public') {

                    var toBroadcast = {
                        message: message,
                        timestamp: new Date().getTime()
                    }

                    Identity.signWithKey(identity['wallet']['prv'], JSON.stringify(toBroadcast)).then(signature => {
                        signature['message'] = JSON.stringify(toBroadcast)
                        signature['type'] = 'public'
                        Messages.broadcast('message', signature)
                        //Messages.store(signature,'public')
                        res.send(signature)
                    })
                } else if (receiver === 'group') {
                    //SEND GROUP MESSAGE
                } else {
                    let user = await Identity.find(receiver)
                    if (user !== false && user !== undefined) {
                        let timestamp = new Date().getTime()
                        let encrypted = await Encryption.encryptMessage(message, user)
                        var toBroadcastEncrypted = {
                            message: encrypted,
                            timestamp: timestamp
                        }
                        Identity.signWithKey(identity['wallet']['prv'], JSON.stringify(toBroadcastEncrypted)).then(async signature => {
                            signature['message'] = JSON.stringify(toBroadcastEncrypted)
                            signature['type'] = 'private'
                            Messages.broadcast('message', signature)
                            res.send(signature)

                            let encryptedSelf = await Encryption.encryptMessage(receiver+'*|*|*'+message, identity['rsa']['pub'])
                            var toBroadcastEncryptedSelf = {
                                message: encryptedSelf,
                                timestamp: timestamp
                            }
                            Identity.signWithKey(identity['wallet']['prv'], JSON.stringify(toBroadcastEncryptedSelf)).then(signatureSelf => {
                                signatureSelf['message'] = JSON.stringify(toBroadcastEncryptedSelf)
                                signatureSelf['type'] = 'private'
                                Messages.broadcast('message', signatureSelf)
                            })
                        })
                    } else {
                        res.send({
                            error: true,
                            message: "Can't sign message, users isn't in your contact list."
                        })
                    }
                }
            } else {
                res.send({
                    error: true,
                    message: 'Specify message and receiver'
                })
            }
        })

        api.get('/contacts', async (req, res) => {
            let contacts = []
            let identities = []
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            for (var i = 0; i < dbcheck.rows.length; i++) {
                var check = dbcheck.rows[i]
                var id = await db.get(check.id)
                delete id._id
                delete id._rev
                if (id.nickname === undefined) {
                    let nickname = id.address.substr(0, 4) + '.' + id.address.substr(-4)
                    id.nickname = nickname
                }
                if(identities.indexOf(id.address) === -1){
                    identities.push(id.address)
                    contacts.push(id)
                }
            }
            res.send(contacts)
        })

        api.post('/contacts/update', async (req, res) => {
            var body = await Utilities.body(req)
            if (body['body'].address !== undefined) {
                var db = new PouchDB('users')
                let dbcheck = await db.allDocs()
                let success = false
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if (id.address === body['body'].address) {
                        success = true
                        try {
                            await db.put({
                                _id: id._id,
                                _rev: id._rev,
                                nickname: body['body'].nickname,
                                address: id.address,
                                pubkey: id.pubkey,
                                blocked: id.blocked
                            })
                        } catch (e) {
                            console.log(e)
                        }
                    }
                }
                res.send({
                    success: success
                })
            } else {
                res.send({
                    error: true,
                    message: 'You must specify an address first.'
                })
            }
        })

        api.post('/contacts/block', async (req, res) => {
            var body = await Utilities.body(req)
            if (body['body'].address !== undefined) {
                var db = new PouchDB('users')
                let dbcheck = await db.allDocs()
                let success = false
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if (id.address === body['body'].address) {
                        success = true
                        let blocked
                        if (id.blocked === false || id.blocked === undefined) {
                            blocked = true
                        } else {
                            blocked = false
                        }
                        try {
                            await db.put({
                                _id: id._id,
                                _rev: id._rev,
                                nickname: id.nickname,
                                address: id.address,
                                pubkey: id.pubkey,
                                blocked: blocked
                            })
                        } catch (e) {
                            console.log(e)
                        }
                    }
                }
                res.send({
                    success: success
                })
            } else {
                res.send({
                    error: true,
                    message: 'You must specify an address first.'
                })
            }
        })

        api.listen(apiport, () => console.log('Api listening on port ' + apiport))
    }
}