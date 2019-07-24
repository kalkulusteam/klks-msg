const getPort = require('get-port')
const isPortAvailable = require('is-port-available')
var formidable = require('formidable')
const fs = require('fs')
const config = require('./config.json')

export default class Utilities {

    static async freeport(){
        return new Promise(async response => {
            let port
            if(process.env.EXPRESS_PORT !== undefined){
                port = process.env.EXPRESS_PORT
            }else{
                port = await getPort()
            }
            var available = await isPortAvailable(port)
            while(!available){
                port = await getPort()
                available = await isPortAvailable(port)
            }
            response(port)
        })
    }

    static async body(req){
        return new Promise(async response => {
            var jsonEmpty = true
            for (var key in req.body) {
                if(key !== undefined){
                    jsonEmpty = false
                }
            }
            if(jsonEmpty === true){
                var form = new formidable.IncomingForm()
                form.parse(req, function(err, fields, files) {
                    response ({
                        body: fields,
                        files: files
                    })
                })
                setTimeout(function(){
                    response(false)
                },200)
            } else {
                response ({
                    body: req.body,
                    files: []
                })
            }
        })
    }

    static log(toLog){
        console.log(toLog)
        if(config.DEBUG === true){
            var d = new Date().toLocaleString();
            fs.appendFileSync('log', '[' + d + '] ' + toLog + '\n');
        }
    }
}