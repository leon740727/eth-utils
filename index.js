"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const r = require("ramda");
const bignumber_js_1 = require("bignumber.js");
const crypto = require("crypto");
const secp256k1 = require("secp256k1/elliptic");
const ethUtils = require("ethereumjs-util");
const EthTx = require("ethereumjs-tx");
const rlp = require("rlp");
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
function decodeSignedTx(signTx) {
    function buf2num(buf) {
        if (buf.toString('hex') === '') {
            return '0';
        }
        else {
            return new bignumber_js_1.BigNumber(`0x${buf.toString('hex')}`).toString();
        }
    }
    function buf2str(buf) {
        return '0x' + buf.toString('hex');
    }
    /** come from ethereumjs-tx */
    const fields = [
        { name: 'nonce', data: buf2num },
        { name: 'gasPrice', data: buf2num },
        { name: 'gasLimit', data: buf2num },
        { name: 'to', data: buf2str },
        { name: 'value', data: buf2num },
        { name: 'data', data: buf2str },
        { name: 'v', data: buf2str },
        { name: 'r', data: buf2str },
        { name: 's', data: buf2str },
    ];
    const bufs = rlp.decode(signTx.match(/^0x/) ? signTx : '0x' + signTx);
    const results = r.zip(fields, bufs)
        .map(([field, data]) => r.objOf(field.name, field.data(data)));
    return r.mergeAll(results);
}
exports.decodeSignedTx = decodeSignedTx;
function decodeFunctionCall(web3, data, abis) {
    const func = abis
        .filter(abi => abi.type === 'function')
        .filter(func => data.startsWith(web3.eth.abi.encodeFunctionSignature(func)))[0];
    if (func) {
        const sig = web3.eth.abi.encodeFunctionSignature(func);
        const params = web3.eth.abi.decodeParameters(func.inputs, data.slice(sig.length));
        return {
            abi: func,
            parameters: r.pick(func.inputs.map(i => i.name), params),
        };
    }
    else {
        return null;
    }
}
exports.decodeFunctionCall = decodeFunctionCall;
/**
 * @param abis: 所有已知的 abi，會試著自動配對
 * @returns 可能回傳 null (當沒有找到適合的 abi 時)
 */
function decodeLog(web3, log, abis) {
    function eventSig1(log) {
        return log.topics ? log.topics[0] : null;
    }
    const eventSig2 = (abi) => {
        return web3.eth.abi.encodeEventSignature(r.pick(['name', 'type', 'inputs'], abi));
    };
    const abi = abis.filter(abi => eventSig2(abi) === eventSig1(log))[0];
    if (abi) {
        const result = web3.eth.abi.decodeLog(abi.inputs, log.data, log.topics);
        return r.pick(abi.inputs.map(i => i.name), result);
    }
    else {
        return null;
    }
}
exports.decodeLog = decodeLog;
