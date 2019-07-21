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

var messages = []
var relayed = []

export default class Api {
    static init() {
        var frontendPort = 11673; //TEST PORT
        api.get('/avatar/:hash', (req, res) => {
            var data = new Identicon(req.params.hash, 420).toString();
            var img = Buffer.from(data, 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': img.length
            });
            res.end(img); 
        })

        api.get('/messages/public', async (req,res) => {
            var db = new PouchDB('messages')
            let dbstore = await db.allDocs()
            var messages = []
            for(var i = 0; i < dbstore.rows.length; i++){
                var check = dbstore.rows[i]
                var message = await db.get(check.id)
                
                if(message.type === 'public'){
                    delete message._id
                    delete message._rev
                    messages.push(message)
                }
            }
            messages.sort(function(a, b) {
                return parseFloat(a.timestamp) - parseFloat(b.timestamp);
            });
            res.send(messages)
        })

        api.get('/messages/address/:address', async (req,res) => {
            var db = new PouchDB('messages')
            let dbstore = await db.allDocs()
            var messages = []
            for(var i = 0; i < dbstore.rows.length; i++){
                var check = dbstore.rows[i]
                var message = await db.get(check.id)
                
                if(message.type === 'private' && message.address === req.params.address){
                    delete message._id
                    delete message._rev
                    let decrypted = await Encryption.decryptMessage( message.message)
                    message.message = decrypted
                    messages.push(message)
                }
            }
            messages.sort(function(a, b) {
                return parseFloat(a.timestamp) - parseFloat(b.timestamp);
            });
            res.send(messages)
        })

        api.get('/connections', (req, res) => res.send(global['peers']))
        api.post('/message', async (req,res) => {
            var body = await Utilities.body(req)
            if(body['body'].message !== undefined && body['body'].receiver !== undefined){
                var message = body['body'].message
                var receiver = body['body'].receiver
                let identity = await Identity.load()
                if(receiver === 'public'){
                    Identity.signWithKey(identity['wallet']['prv'], message).then(signature => {
                        signature['message'] = message
                        signature['type'] = message
                        Messages.broadcast(JSON.stringify(signature))
                        res.send(signature)
                    })
                }else if(receiver === 'group'){
                    //SEND GROUP MESSAGE
                }else{
                    let user = await Identity.find(receiver)
                    if(user !== false && user !== undefined){
                        let encrypted = await Encryption.encryptMessage(message, user)
                        Identity.signWithKey(identity['wallet']['prv'], encrypted).then(signature => {
                            signature['message'] = encrypted
                            signature['type'] = 'SAFU'
                            Messages.broadcast(JSON.stringify(signature))
                            res.send(signature)
                        })
                    }else{
                        res.send({
                            error: true,
                            message: "Can't sign message, users isn't in your contact list."
                        })
                    }
                }
            }else{
                res.send({
                    error: true,
                    message: 'Specify message and receiver'
                })
            }
        })
        
        api.get('/contacts', async (req,res) => {
            let contacts = []
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            for(var i = 0; i < dbcheck.rows.length; i++){
                var check = dbcheck.rows[i]
                var id = await db.get(check.id)
                contacts.push(id)
            }
            res.send(contacts)
        })

        api.post('/contacts/update', async (req,res) => {
            var body = await Utilities.body(req)
            if(body['body'].address !== undefined){
                var db = new PouchDB('users')
                let dbcheck = await db.allDocs()
                let success = false
                for(var i = 0; i < dbcheck.rows.length; i++){
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if(id.address === body['body'].address){
                        success = true
                        try{
                            await db.put({
                                _id: id._id,
                                _rev: id._rev,
                                nickname: body['body'].nickname,
                                address: id.address,
                                pubkey: id.pubkey,
                                blocked: id.blocked
                            })
                        }catch(e){
                            console.log(e)
                        }
                    }
                }
                res.send({
                    success: success
                })
            }else{
                res.send({
                    error: true,
                    message: 'You must specify an address first.'
                })
            }
        })

        api.post('/contacts/block', async (req,res) => {
            var body = await Utilities.body(req)
            if(body['body'].address !== undefined){
                var db = new PouchDB('users')
                let dbcheck = await db.allDocs()
                let success = false
                for(var i = 0; i < dbcheck.rows.length; i++){
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if(id.address === body['body'].address){
                        success = true
                        let blocked
                        if(id.blocked === false || id.blocked === undefined){
                            blocked = true
                        }else{
                            blocked = false
                        }
                        try{
                            await db.put({
                                _id: id._id,
                                _rev: id._rev,
                                nickname: id.nickname,
                                address: id.address,
                                pubkey: id.pubkey,
                                blocked: blocked
                            })
                        }catch(e){
                            console.log(e)
                        }
                    }
                }
                res.send({
                    success: success
                })
            }else{
                res.send({
                    error: true,
                    message: 'You must specify an address first.'
                })
            }
        })

        api.listen(frontendPort, () => console.log(`Engine listening on port ${frontendPort}!`))
    }
}