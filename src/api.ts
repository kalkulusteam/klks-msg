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
const axios = require('axios')
var argv = require('minimist')(process.argv.slice(2))

var messages = []
var relayed = []

export default class Api {
    static async init() {
        //CHECK FOR LOCK FILES
        var lockfiles = ['./settings/LOCK', './messages/LOCK', './messages/LOCK']
        for (var l in lockfiles) {
            if (fs.existsSync(lockfiles[l])) {
                fs.unlinkSync(lockfiles[l])
            }
        }

        //CHECK FOR LOG FILE TOO BIG
        if (fs.existsSync("./log")) {
            const stats = fs.statSync("./log");
            const fileSizeInBytes = stats.size;
            const fileSizeInMegabytes = fileSizeInBytes / 1000000.0;
            if(fileSizeInMegabytes > 25){
                fs.unlinkSync('./log')
            }
        }

        let apiport = await getPort({ port: config.API_PORT })

        if (!argv.server) {
            api.get('/identity', async (req, res) => {
                let identity = await Identity.load()
                delete identity['_id']
                delete identity['_rev']
                res.send(identity)
            })
            api.delete('/identity', async (req, res) => {
                await Identity.renew()
                res.send(true)
            })
        }

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

            let contacts = await Identity.contacts()

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
                    let parsed = JSON.parse(message.message)
                    let decrypted = await Encryption.decryptMessage(parsed.message)
                    message.message = decrypted
                    messages.push(message)
                }
            }
            messages.sort(function (a, b) {
                return parseFloat(b.timestamp) - parseFloat(a.timestamp);
            });
            for (var k in messages) {
                var message = messages[k]
                let user
                let checkreceiver = message.message.toString().split('*|*|*')
                if(checkreceiver[1] === undefined){
                    user = message.address
                }else{
                    user = checkreceiver[0]
                }

                if (ids.indexOf(user) === -1) {
                    ids.push(user)
                    var d = new Date(message.timestamp)
                    discussions.push({
                        address: user,
                        nickname: contacts[user],
                        last_message: d.toLocaleString()
                    })
                }
            }
            res.send(discussions)
        })

        api.get('/messages/public', async (req, res) => {

            let contacts = await Identity.contacts()
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

        api.get('/info/:address', async (req, res) => {
            let info = {}
            let contacts = await Identity.contacts()
            info['nickname'] = contacts[req.params.address]
            let identity = await Identity.user(req.params.address)
            info['identity'] = identity['pubkey']
            info['blocked'] = identity['blocked']
            info['address'] = req.params.address
            let balance = await axios.get('https://chainz.cryptoid.info/klks/api.dws?q=getbalance&a=' + req.params.address)
            info['balance'] = balance.data
            res.send(info)
        })

        api.get('/messages/address/:address', async (req, res) => {
            var db = new PouchDB('messages')
            let dbstore = await db.allDocs()
            var messages = []
            let contacts = await Identity.contacts()
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
                    if (message.address === global['identity']['wallet']['pub']) {
                        message.is_mine = true
                    } else {
                        message.is_mine = false
                    }
                    message.nickname = contacts[message.address]
                    if(checkreceiver[1] === undefined){
                        parsed.message = decrypted
                        message.message = parsed
                        messages.push(message)
                    }else{
                        if(checkreceiver[0] === req.params.address){
                            parsed.message = checkreceiver[1]
                            message.message = parsed
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
                if(identities.indexOf(id.address) === -1 && id.address !== global['identity']['wallet']['pub']){
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
                var blocked
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if (id.address === body['body'].address) {
                        success = true
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
                    success: success,
                    state: blocked
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