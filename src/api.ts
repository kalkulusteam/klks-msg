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
                messages.push(message)
            }
            res.send(messages)
        })

        //api.get('/connections', (req, res) => res.send(sw.connected))
        api.post('/messages/send', async (req,res) => {
            var body = await Utilities.body(req)
            if(body['body'].message !== undefined && body['body'].receiver !== undefined){
                var message = body['body'].message
                var receiver = body['body'].receiver
                let identity = await Identity.load()
                if(receiver === 'private'){
                    //SEND PRIVATE MESSAGE
                }else if(receiver === 'group'){
                    //SEND GROUP MESSAGE
                }else{
                    Identity.signWithKey(identity['wallet']['prv'], message).then(signature => {
                        signature['message'] = message
                        Messages.broadcast(JSON.stringify(signature))
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
}