var CoinKey = require('coinkey')
const CryptoJS = require('crypto-js')
const secp256k1 = require('secp256k1')

const klksInfo = {
    private: 0xae,
    public: 0x2e,
    scripthash: 0x0d
};

export default class Api {
    static async create() {
        return new Promise(response => {
            var ck = new CoinKey.createRandom(klksInfo)
            
            var klksprv = ck.privateWif;
            var klkskey = ck.publicKey.toString('hex');
            var klkspub = ck.publicAddress;

            console.log("CREATED PUB ADDRESS: " + klkspub);
            console.log("CREATED PUB KEY: " + klkskey);
            
            var wallet = {
                prv: klksprv,
                pub: klkspub,
                key: klkskey
            }

            response(wallet)
        })
    }

    static async signWithKey(key, message){
        return new Promise(response => {
            var ck = CoinKey.fromWif(key, klksInfo);
            let hash = CryptoJS.SHA256(message);
            let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
            let privKey = ck.privateKey
            const sigObj = secp256k1.sign(msg, privKey)
            const pubKey = secp256k1.publicKeyCreate(privKey)
            response({
                signature: sigObj.signature.toString('hex'),
                pubKey: pubKey.toString('hex')
            })
        })
    }

    static async returnPubKey(key){
        return new Promise(response => {
            var ck = CoinKey.fromWif(key, klksInfo);
            let privKey = ck.privateKey
            const pubKey = secp256k1.publicKeyCreate(privKey)
            response(pubKey)
        })
    }
    
    static async verifySign(keyhex, sighex, message){
        return new Promise(response => {
            let hash = CryptoJS.SHA256(message);
            let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
            let signature = Buffer.from(sighex,'hex')
            let pubKey = Buffer.from(keyhex,'hex')
            let verified = secp256k1.verify(msg, signature, pubKey)
            response(verified)
        })
    }
}