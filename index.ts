import { BigNumber } from 'bignumber.js';
import * as crypto from 'crypto';
import * as secp256k1 from 'secp256k1/elliptic';
import Web3 = require('web3');
import Contract from 'web3/eth/contract';
import { TransactionReceipt } from 'web3/types';
import * as ethUtils from 'ethereumjs-util';
import EthTx = require("ethereumjs-tx");

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
