"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CoinKey = require('coinkey');
const klksInfo = {
    private: 0xae,
    public: 0x2e,
    scripthash: 0x0d
};
class Api {
    static create() {
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
        console.log(wallet);
    }
}
exports.default = Api;
//# sourceMappingURL=identity.js.map