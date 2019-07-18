const getPort = require('get-port')
const isPortAvailable = require('is-port-available')

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
}