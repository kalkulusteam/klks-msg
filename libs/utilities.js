const getPort = require('get-port')
const isPortAvailable = require('is-port-available')

module.exports = {
    freeport: async function(){
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
};