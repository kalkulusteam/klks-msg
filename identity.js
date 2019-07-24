"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var CoinKey = require('coinkey');
const CryptoJS = require('crypto-js');
const secp256k1 = require('secp256k1');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
const crypto = require('crypto');
const klksInfo = {
    private: 0xae,
    public: 0x2e,
    scripthash: 0x0d
};
class Identity {
    static load() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var db = new PouchDB('settings');
                let dbcheck = yield db.allDocs();
                let identity;
                if (dbcheck.rows.length === 0) {
                    identity = yield Identity.create();
                    yield db.post(identity);
                }
                else {
                    let entry = dbcheck.rows[0];
                    identity = yield db.get(entry.id);
                }
                response(identity);
            }));
        });
    }
    static store(identity) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                if (dbcheck.rows.length === 0) {
                    yield db.post(identity);
                    console.log('Saved new public key from ' + identity.address + '.');
                }
                else {
                    var found = false;
                    for (var i = 0; i < dbcheck.rows.length; i++) {
                        var check = dbcheck.rows[i];
                        var id = yield db.get(check.id);
                        if (id.address === identity.address) {
                            found = true;
                        }
                    }
                    if (found === false) {
                        yield db.post(identity);
                        console.log('Saved new public key from ' + identity.address + '.');
                    }
                    response(true);
                }
            }));
        });
    }
    static find(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                if (dbcheck.rows.length === 0) {
                    response(false);
                }
                else {
                    var found = false;
                    for (var i = 0; i < dbcheck.rows.length; i++) {
                        var check = dbcheck.rows[i];
                        var id = yield db.get(check.id);
                        if (id.address === address) {
                            found = id.pubkey;
                        }
                    }
                    response(found);
                }
            }));
        });
    }
    static isBlocked(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var db = new PouchDB('users');
                let dbcheck = yield db.allDocs();
                if (dbcheck.rows.length === 0) {
                    response(false);
                }
                else {
                    var found = false;
                    for (var i = 0; i < dbcheck.rows.length; i++) {
                        var check = dbcheck.rows[i];
                        var id = yield db.get(check.id);
                        if (id.address === address) {
                            found = id;
                        }
                    }
                    if (found['blocked'] === false || found['blocked'] === undefined) {
                        response(false);
                    }
                    else {
                        response(true);
                    }
                }
            }));
        });
    }
    static create() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                var ck = new CoinKey.createRandom(klksInfo);
                var klksprv = ck.privateWif;
                var klkskey = ck.publicKey.toString('hex');
                var klkspub = ck.publicAddress;
                console.log("CREATED PUB ADDRESS: " + klkspub);
                console.log("CREATED PUB KEY: " + klkskey);
                var wallet = {
                    prv: klksprv,
                    pub: klkspub,
                    key: klkskey
                };
                var keys = yield Identity.generateKeys();
                var rsa = {
                    pub: keys['pub'],
                    priv: keys['priv']
                };
                let identity = {
                    wallet: wallet,
                    rsa: rsa
                };
                response(identity);
            }));
        });
    }
    static signWithKey(key, message) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(response => {
                var ck = CoinKey.fromWif(key, klksInfo);
                let hash = CryptoJS.SHA256(message);
                let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
                let privKey = ck.privateKey;
                const sigObj = secp256k1.sign(msg, privKey);
                const pubKey = secp256k1.publicKeyCreate(privKey);
                response({
                    signature: sigObj.signature.toString('hex'),
                    pubKey: pubKey.toString('hex'),
                    address: ck.publicAddress
                });
            });
        });
    }
    static returnPubKey(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(response => {
                var ck = CoinKey.fromWif(key, klksInfo);
                let privKey = ck.privateKey;
                const pubKey = secp256k1.publicKeyCreate(privKey);
                response(pubKey);
            });
        });
    }
    static verifySign(keyhex, sighex, message) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(response => {
                let hash = CryptoJS.SHA256(message);
                let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
                let signature = Buffer.from(sighex, 'hex');
                let pubKey = Buffer.from(keyhex, 'hex');
                let verified = secp256k1.verify(msg, signature, pubKey);
                response(verified);
            });
        });
    }
    static generateKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(response => {
                const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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
                });
            });
        });
    }
}
exports.default = Identity;
//# sourceMappingURL=identity.js.map