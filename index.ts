import * as r from 'ramda';
import { BigNumber } from 'bignumber.js';
import * as crypto from 'crypto';
import * as secp256k1 from 'secp256k1/elliptic';
import Web3 = require('web3');
import Contract from 'web3/eth/contract';
import { Log, TransactionReceipt } from 'web3/types';
import { ABIDefinition  } from 'web3/eth/abi';
import * as ethUtils from 'ethereumjs-util';
import EthTx = require("ethereumjs-tx");
import rlp = require('rlp');

const settings = {
    gasPrice: '100000000000',
    gasLimit: '6000000',
}

export function isEq(addr1: string, addr2: string): boolean {
    // address 如果不算前面的 '0x'，共有 40 個字元。不管前面有沒有 '0x' 都沒關係
    return addr1.slice(-40).toLowerCase() === addr2.slice(-40).toLowerCase();
}

export function defaultGasLimit () {
    return '0x' + new BigNumber(settings.gasLimit).toString(16);
}

/**
 * @param web3 
 * @param senderKey 
 * @param to 可能是 null。如果要 deploy contract 就把 to 設為 null
 * @param value 
 * @param data 
 */
export function makeTx (web3: Web3, senderKey: Buffer, to: string, value: number|string, data: string) {
    return web3.eth.getTransactionCount('0x' + ethUtils.privateToAddress(senderKey).toString('hex'))
    .then(nonce => {
        let tx = new EthTx({
            to: to === null ? undefined : to,
            data: data,
            nonce: nonce,
            value: '0x' + new BigNumber(value).toString(16),
            gasPrice: '0x' + new BigNumber(settings.gasPrice).toString(16),
            gasLimit: '0x' + new BigNumber(settings.gasLimit).toString(16),
        });
        tx.sign(senderKey);
        return tx;
    });
}

export function sendTx (web3: Web3, senderKey: Buffer, to: string, value: number|string, data: string): Promise<TransactionReceipt> {
    return makeTx(web3, senderKey, to, value, data)
    .then(tx => web3.eth.sendSignedTransaction(`0x${tx.serialize().toString('hex')}`));
}

export function deploy (web3: Web3, deployer: string, abi: any[], bytecode: string, args: any[]): Promise<Contract> {
    return new web3.eth.Contract(abi).deploy({data: bytecode, arguments: args})
    .send({
        from: deployer,
        gas: 2000000,
    })
    .then(res => res as any as Contract)
}

export function deployByKey (web3: Web3, deployKey: Buffer, abi: any[], bytecode: string, args: any[]): Promise<Contract> {
    const data = new web3.eth.Contract(abi).deploy({data: bytecode, arguments: args}).encodeABI();
    return makeTx(web3, deployKey, null, 0, data)
    .then(tx => web3.eth.sendSignedTransaction(`0x${tx.serialize().toString('hex')}`))
    .then(r => new web3.eth.Contract(abi, r.contractAddress));
}

export function generatePrivateKey (): Buffer {
    const keySize = 32;
    const key = crypto.randomBytes(keySize);
    if (! secp256k1.privateKeyVerify(key)) {
        return generatePrivateKey();
    } else {
        return key;
    }
}

type Tx = {
    nonce: string,
    gasPrice: string,
    gasLimit: string,
    to: string,
    value: string,
    data: string,
    v: string,
    r: string,
    s: string,
}
export function decodeSignedTx (signTx: string): Tx {
    function buf2num (buf: Buffer): string {
        if (buf.toString('hex') === '') {
            return '0';
        } else {
            return new BigNumber(`0x${buf.toString('hex')}`).toString();
        }
    }
    function buf2str (buf: Buffer): string {
        return '0x' + buf.toString('hex');
    }
    type Field = {
        name: string,
        data: (hex: Buffer) => string,
    }
    /** come from ethereumjs-tx */
    const fields: Field[] = [
        {name: 'nonce', data: buf2num},
        {name: 'gasPrice', data: buf2num},
        {name: 'gasLimit', data: buf2num},
        {name: 'to', data: buf2str},
        {name: 'value', data: buf2num},
        {name: 'data', data: buf2str},
        {name: 'v', data: buf2str},
        {name: 'r', data: buf2str},
        {name: 's', data: buf2str},
    ];
    const bufs = rlp.decode(signTx.match(/^0x/) ? signTx : '0x' + signTx) as any as Buffer[];
    const results = r.zip(fields, bufs)
    .map(([field, data]) => r.objOf(field.name, field.data(data)));
    return r.mergeAll(results);
}

type DecodeFunctionCallResult = {
    abi: ABIDefinition,
    parameters: object,
}
export function decodeFunctionCall (web3: Web3, data: string, abis: ABIDefinition[]): DecodeFunctionCallResult {
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
    } else {
        return null;
    }
}

/**
 * @param abis: 所有已知的 abi，會試著自動配對
 * @returns 可能回傳 null (當沒有找到適合的 abi 時)
 */
export function decodeLog (web3: Web3, log: Log, abis: ABIDefinition[]): object {
    function eventSig1 (log: Log) {
        return log.topics ? log.topics[0] : null;
    }
    const eventSig2 = (abi: ABIDefinition) => {
        return web3.eth.abi.encodeEventSignature(r.pick(['name','type','inputs'], abi));
    }

    const abi = abis.filter(abi => eventSig2(abi) === eventSig1(log))[0];
    if (abi) {
        const result = web3.eth.abi.decodeLog(abi.inputs, log.data, log.topics);
        return r.pick(abi.inputs.map(i => i.name), result);
    } else {
        return null;
    }
}
