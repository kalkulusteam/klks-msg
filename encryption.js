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
const PouchDB = require('pouchdb');
const crypto = require('crypto');
const identity_1 = require("./identity");
class Identity {
    static encryptMessage(toEncrypt) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                let identity = yield identity_1.default.load();
                var publicKey = identity['rsa']['pub'];
                var buffer = Buffer.from(toEncrypt);
                var encrypted = crypto.publicEncrypt(publicKey, buffer);
                response(encrypted.toString("base64"));
            }));
        });
    }
    static decryptMessage(toDecrypt) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let identity = yield identity_1.default.load();
                    var privateKey = identity['rsa']['priv'];
                    var buffer = Buffer.from(toDecrypt, "base64");
                    const decrypted = crypto.privateDecrypt({
                        key: privateKey.toString()
                    }, buffer);
                    response(decrypted.toString("utf8"));
                }
                catch (e) {
                    response(false);
                }
            }));
        });
    }
}
exports.default = Identity;
//# sourceMappingURL=encryption.js.map