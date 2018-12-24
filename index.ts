import * as assert from 'assert';
import * as r from 'ramda';
import { BigNumber } from 'bignumber.js';
import * as crypto from 'crypto';
import * as secp256k1 from 'secp256k1/elliptic';
import Web3 = require('web3');
import { Log } from 'web3/types';
import { ABIDefinition  } from 'web3/eth/abi';
import Contract from 'web3/eth/contract';
import EthTx = require("ethereumjs-tx");
import rlp = require('rlp');

/** Num could be (15 or '15' or '0xf') */
type Num = number | string;

export type Tx = {
    nonce?: Num,
    gasPrice?: Num,
    gasLimit?: Num,
    to?: string,
    value?: Num,
    data?: string,
    v?: string,
    r?: string,
    s?: string,
}

const txNumFields = ['nonce', 'gasPrice', 'gasLimit', 'value'];

export const fmt = {
    num: (value: Num): string => {
        assert.ok(! new BigNumber(value).isNaN(), `'${value}' not a number`);
        return '0x' + new BigNumber(value).toString(16);
    },

    hex: (value: string): string => {
        return '0x' + value.replace(/^0x/, '').toLowerCase();
    },

    tx: (tx: EthTx): Tx => {
        const values = tx.raw.map(v => '0x' + v.toString('hex'))
        return r.fromPairs(r.zip(tx._fields, values).filter(([f, v]) => v !== '0x'));
    },
}

function _ethTx (tx: Tx): EthTx {
    // 傳給 EthTx 的所有欄位都必須是 0x 開頭 (包括 to, data 等字串欄位)
    const numFields = r.intersection(r.keys(tx), txNumFields);
    const strFields = r.difference(r.keys(tx), txNumFields);
    const numValues = numFields.map(f => fmt.num(tx[f]));
    const strValues = strFields.map(f => fmt.hex(tx[f]));
    return new EthTx(r.fromPairs(r.zip(numFields, numValues).concat(r.zip(strFields, strValues))) as any);
}

export function sign (key: Buffer, tx: Tx): Tx {
    const t = _ethTx(tx);
    t.sign(key);
    return fmt.tx(t);
}

export function serialize (tx: Tx): string {
    return `0x${_ethTx(tx).serialize().toString('hex')}`;
}

export async function deploy (web3: Web3, key: Buffer, abi: ABIDefinition[], bytecode: string, args: any[]): Promise<Contract> {
    const data = new web3.eth.Contract(abi).deploy({data: bytecode, arguments: args}).encodeABI();
    const tx = sign(key, { data });
    const receipt = await web3.eth.sendSignedTransaction(serialize(tx));
    return new web3.eth.Contract(abi, receipt.contractAddress);
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
export function decodeLog (web3: Web3, log: Log, abis: ABIDefinition[]): DecodeFunctionCallResult {
    function eventSig1 (log: Log) {
        return log.topics ? log.topics[0] : null;
    }
    const eventSig2 = (abi: ABIDefinition) => {
        return web3.eth.abi.encodeEventSignature(r.pick(['name','type','inputs'], abi));
    }

    const abi = abis.filter(abi => eventSig2(abi) === eventSig1(log))[0];
    if (abi) {
        const result = web3.eth.abi.decodeLog(abi.inputs, log.data, log.topics);
        return {
            abi: abi,
            parameters: r.pick(abi.inputs.map(i => i.name), result),
        };
    } else {
        return null;
    }
}
