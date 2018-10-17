"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = require("bignumber.js");
const crypto = require("crypto");
const secp256k1 = require("secp256k1/elliptic");
const ethUtils = require("ethereumjs-util");
const EthTx = require("ethereumjs-tx");
const settings = {
    gasPrice: '100000000000',
    gasLimit: '6000000',
};
function isEq(addr1, addr2) {
    // address 如果不算前面的 '0x'，共有 40 個字元。不管前面有沒有 '0x' 都沒關係
    return addr1.slice(-40).toLowerCase() === addr2.slice(-40).toLowerCase();
}
exports.isEq = isEq;
function defaultGasLimit() {
    return '0x' + new bignumber_js_1.BigNumber(settings.gasLimit).toString(16);
}
exports.defaultGasLimit = defaultGasLimit;
/**
 * @param web3
 * @param senderKey
 * @param to 可能是 null。如果要 deploy contract 就把 to 設為 null
 * @param value
 * @param data
 */
function makeTx(web3, senderKey, to, value, data) {
    return web3.eth.getTransactionCount('0x' + ethUtils.privateToAddress(senderKey).toString('hex'))
        .then(nonce => {
        let tx = new EthTx({
            to: to === null ? undefined : to,
            data: data,
            nonce: nonce,
            value: '0x' + new bignumber_js_1.BigNumber(value).toString(16),
            gasPrice: '0x' + new bignumber_js_1.BigNumber(settings.gasPrice).toString(16),
            gasLimit: '0x' + new bignumber_js_1.BigNumber(settings.gasLimit).toString(16),
        });
        tx.sign(senderKey);
        return tx;
    });
}
exports.makeTx = makeTx;
function sendTx(web3, senderKey, to, value, data) {
    return makeTx(web3, senderKey, to, value, data)
        .then(tx => web3.eth.sendSignedTransaction(`0x${tx.serialize().toString('hex')}`));
}
exports.sendTx = sendTx;
function deploy(web3, deployer, abi, bytecode, args) {
    return new web3.eth.Contract(abi).deploy({ data: bytecode, arguments: args })
        .send({
        from: deployer,
        gas: 2000000,
    })
        .then(res => res);
}
exports.deploy = deploy;
function deployByKey(web3, deployKey, abi, bytecode, args) {
    const data = new web3.eth.Contract(abi).deploy({ data: bytecode, arguments: args }).encodeABI();
    return makeTx(web3, deployKey, null, 0, data)
        .then(tx => web3.eth.sendSignedTransaction(`0x${tx.serialize().toString('hex')}`))
        .then(r => new web3.eth.Contract(abi, r.contractAddress));
}
exports.deployByKey = deployByKey;
function generatePrivateKey() {
    const keySize = 32;
    const key = crypto.randomBytes(keySize);
    if (!secp256k1.privateKeyVerify(key)) {
        return generatePrivateKey();
    }
    else {
        return key;
    }
}
exports.generatePrivateKey = generatePrivateKey;
