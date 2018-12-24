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
const assert = require("assert");
const r = require("ramda");
const bignumber_js_1 = require("bignumber.js");
const crypto = require("crypto");
const secp256k1 = require("secp256k1/elliptic");
const EthTx = require("ethereumjs-tx");
const rlp = require("rlp");
const txNumFields = ['nonce', 'gasPrice', 'gasLimit', 'value'];
exports.fmt = {
    num: (value) => {
        assert.ok(!new bignumber_js_1.BigNumber(value).isNaN(), `'${value}' not a number`);
        return '0x' + new bignumber_js_1.BigNumber(value).toString(16);
    },
    hex: (value) => {
        return '0x' + value.replace(/^0x/, '').toLowerCase();
    },
    tx: (tx) => {
        const values = tx.raw.map(v => '0x' + v.toString('hex'));
        return r.fromPairs(r.zip(tx._fields, values).filter(([f, v]) => v !== '0x'));
    },
};
function _ethTx(tx) {
    // 傳給 EthTx 的所有欄位都必須是 0x 開頭 (包括 to, data 等字串欄位)
    const numFields = r.intersection(r.keys(tx), txNumFields);
    const strFields = r.difference(r.keys(tx), txNumFields);
    const numValues = numFields.map(f => exports.fmt.num(tx[f]));
    const strValues = strFields.map(f => exports.fmt.hex(tx[f]));
    return new EthTx(r.fromPairs(r.zip(numFields, numValues).concat(r.zip(strFields, strValues))));
}
function sign(key, tx) {
    const t = _ethTx(tx);
    t.sign(key);
    return exports.fmt.tx(t);
}
exports.sign = sign;
function serialize(tx) {
    return `0x${_ethTx(tx).serialize().toString('hex')}`;
}
exports.serialize = serialize;
function deploy(web3, key, abi, bytecode, args, nonce, gasPrice, gasLimit) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = new web3.eth.Contract(abi).deploy({ data: bytecode, arguments: args }).encodeABI();
        const tx = sign(key, { nonce, data, gasPrice, gasLimit });
        const receipt = yield web3.eth.sendSignedTransaction(serialize(tx));
        return new web3.eth.Contract(abi, receipt.contractAddress);
    });
}
exports.deploy = deploy;
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
        return {
            abi: abi,
            parameters: r.pick(abi.inputs.map(i => i.name), result),
        };
    }
    else {
        return null;
    }
}
exports.decodeLog = decodeLog;
