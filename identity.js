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
const klksInfo = {
    private: 0xae,
    public: 0x2e,
    scripthash: 0x0d
};
var db = new PouchDB('settings');
class Identity {
    static load() {
        return __awaiter(this, void 0, void 0, function* () {
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
            console.log('Identity loaded: ' + identity.pub);
        });
    }
    static create() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(response => {
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
                response(wallet);
            });
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
                    pubKey: pubKey.toString('hex')
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
}
exports.default = Identity;
//# sourceMappingURL=identity.js.map