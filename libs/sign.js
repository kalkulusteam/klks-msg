var CoinKey = require('coinkey')
const CryptoJS = require('crypto-js')
const secp256k1 = require('secp256k1')

const klksInfo = {
    private: 0xae,
    public: 0x2e,
    scripthash: 0x0d
};

module.exports = {
    signWithKey: async function(key, message){
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
    },
    returnPubKey: async function(key){
        return new Promise(response => {
            var ck = CoinKey.fromWif(key, klksInfo);
            let privKey = ck.privateKey
            const pubKey = secp256k1.publicKeyCreate(privKey)
            response(pubKey)
        })
    },
    verifySign: async function(keyhex, sighex, message){
        return new Promise(response => {
            let hash = CryptoJS.SHA256(message);
            let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
            let signature = Buffer.from(sighex,'hex')
            let pubKey = Buffer.from(keyhex,'hex')
            verified = secp256k1.verify(msg, signature, pubKey)
            response(verified)
        })
    }
};