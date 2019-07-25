import Utilities from "./utilities";

var CoinKey = require('coinkey')
const CryptoJS = require('crypto-js')
const secp256k1 = require('secp256k1')
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-find'))
const crypto = require('crypto')

const klksInfo = {
    private: 0xae,
    public: 0x2e,
    scripthash: 0x0d
};

export default class Identity {
    static async load() {
        return new Promise(async response => {
            var db = new PouchDB('settings');
            let dbcheck = await db.allDocs()
            let identity
            if (dbcheck.rows.length === 0) {
                identity = await Identity.create()
                await db.post(identity)
            } else {
                let entry = dbcheck.rows[0]
                identity = await db.get(entry.id)
            }
            response(identity)
        })
    }

    static async store(identity) {
        return new Promise(async response => {
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            identity._id = identity.address
            if (dbcheck.rows.length === 0) {
                await db.put(identity)
                console.log('Saved new public key from ' + identity.address + '.')
            } else {
                var found = false
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if (id.address === identity.address) {
                        found = true
                    }
                }
                if (found === false) {
                    try{
                    await db.put(identity)
                        Utilities.log('Saved new public key from ' + identity.address + '.')
                    }catch(e){
                        Utilities.log('Identity for '+identity.address+' exsists yet')
                    }
                }
                response(true)
            }
        })
    }

    static async contacts(){
        return new Promise(async response => {
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
            response(contacts)
        })
    }

    static async find(address) {
        return new Promise(async response => {
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            if (dbcheck.rows.length === 0) {
                response(false)
            } else {
                var found = false
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if (id.address === address) {
                        found = id.pubkey
                    }
                }
                response(found)
            }
        })
    }

    static async isBlocked(address) {
        return new Promise(async response => {
            var db = new PouchDB('users')
            let dbcheck = await db.allDocs()
            if (dbcheck.rows.length === 0) {
                response(false)
            } else {
                var found = false
                for (var i = 0; i < dbcheck.rows.length; i++) {
                    var check = dbcheck.rows[i]
                    var id = await db.get(check.id)
                    if (id.address === address) {
                        found = id
                    }
                }
                if (found['blocked'] === false || found['blocked'] === undefined) {
                    response(false)
                } else {
                    response(true)
                }
            }
        })
    }

    static async create() {
        return new Promise(async response => {
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

            var keys = await Identity.generateKeys()
            var rsa = {
                pub: keys['pub'],
                priv: keys['priv']
            }

            let identity = {
                wallet: wallet,
                rsa: rsa
            }

            response(identity)
        })
    }

    static async signWithKey(key, message) {
        return new Promise(response => {
            var ck = CoinKey.fromWif(key, klksInfo);
            let hash = CryptoJS.SHA256(message);
            let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
            let privKey = ck.privateKey
            const sigObj = secp256k1.sign(msg, privKey)
            const pubKey = secp256k1.publicKeyCreate(privKey)
            response({
                signature: sigObj.signature.toString('hex'),
                pubKey: pubKey.toString('hex'),
                address: ck.publicAddress
            })
        })
    }

    static async returnPubKey(key) {
        return new Promise(response => {
            var ck = CoinKey.fromWif(key, klksInfo);
            let privKey = ck.privateKey
            const pubKey = secp256k1.publicKeyCreate(privKey)
            response(pubKey)
        })
    }

    static async verifySign(keyhex, sighex, message) {
        return new Promise(response => {
            let hash = CryptoJS.SHA256(message);
            let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
            let signature = Buffer.from(sighex, 'hex')
            let pubKey = Buffer.from(keyhex, 'hex')
            let verified = secp256k1.verify(msg, signature, pubKey)
            response(verified)
        })
    }

    static async generateKeys() {
        return new Promise(response => {
            const { publicKey, privateKey } =
                crypto.generateKeyPairSync('rsa',
                    {
                        modulusLength: 4096,
                        namedCurve: 'secp256k1',
                        publicKeyEncoding: {
                            type: 'spki',
                            format: 'pem'
                        },
                        privateKeyEncoding: {
                            type: 'pkcs8',
                            format: 'pem'
                        }
                    });
            response({
                pub: publicKey,
                priv: privateKey
            })
        })
    }
}