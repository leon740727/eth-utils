/// <reference types="node" />
import Web3 = require('web3');
import { Log } from 'web3/types';
import { ABIDefinition } from 'web3/eth/abi';
import Contract from 'web3/eth/contract';
import EthTx = require("ethereumjs-tx");
/** Num could be (15 or '15' or '0xf') */
declare type Num = number | string;
export declare type Tx = {
    nonce?: Num;
    gasPrice?: Num;
    gasLimit?: Num;
    to?: string;
    value?: Num;
    data?: string;
    v?: string;
    r?: string;
    s?: string;
};
export declare const fmt: {
    num: (value: string | number) => string;
    hex: (value: string) => string;
    tx: (tx: EthTx) => Tx;
};
export declare function sign(key: Buffer, tx: Tx): Tx;
export declare function serialize(tx: Tx): string;
export declare function deploy(web3: Web3, key: Buffer, abi: ABIDefinition[], bytecode: string, args: any[], gasPrice: Num, gasLimit: Num): Promise<Contract>;
export declare function generatePrivateKey(): Buffer;
export declare function decodeSignedTx(signTx: string): Tx;
declare type DecodeFunctionCallResult = {
    abi: ABIDefinition;
    parameters: object;
};
export declare function decodeFunctionCall(web3: Web3, data: string, abis: ABIDefinition[]): DecodeFunctionCallResult;
/**
 * @param abis: 所有已知的 abi，會試著自動配對
 * @returns 可能回傳 null (當沒有找到適合的 abi 時)
 */
export declare function decodeLog(web3: Web3, log: Log, abis: ABIDefinition[]): DecodeFunctionCallResult;
export {};
