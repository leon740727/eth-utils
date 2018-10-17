/// <reference types="node" />
import Web3 = require('web3');
import Contract from 'web3/eth/contract';
import { TransactionReceipt } from 'web3/types';
import EthTx = require("ethereumjs-tx");
export declare function isEq(addr1: string, addr2: string): boolean;
export declare function defaultGasLimit(): string;
/**
 * @param web3
 * @param senderKey
 * @param to 可能是 null。如果要 deploy contract 就把 to 設為 null
 * @param value
 * @param data
 */
export declare function makeTx(web3: Web3, senderKey: Buffer, to: string, value: number | string, data: string): Promise<EthTx>;
export declare function sendTx(web3: Web3, senderKey: Buffer, to: string, value: number | string, data: string): Promise<TransactionReceipt>;
export declare function deploy(web3: Web3, deployer: string, abi: any[], bytecode: string, args: any[]): Promise<Contract>;
export declare function deployByKey(web3: Web3, deployKey: Buffer, abi: any[], bytecode: string, args: any[]): Promise<Contract>;
export declare function generatePrivateKey(): Buffer;