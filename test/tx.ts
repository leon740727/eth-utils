import * as r from 'ramda';
import { expect } from 'chai';
import { BigNumber } from 'bignumber.js';
import EthTx = require("ethereumjs-tx");
import { sign, serialize } from '../index';
import { privateToAddress } from 'ethereumjs-util';

declare const describe, it, before, after, afterEach;

function makeTx (nonce: number, to: string, value: number|string, data: string, gasPrice: number, gasLimit: number) {
    return new EthTx({
        to: to === null ? undefined : to,
        data: data,
        nonce: nonce,
        value: '0x' + new BigNumber(value).toString(16),
        gasPrice: '0x' + new BigNumber(gasPrice).toString(16),
        gasLimit: '0x' + new BigNumber(gasLimit).toString(16),
    });
}

function isEq (tx1: EthTx, tx2: EthTx): boolean {
    return r.zip(tx1.raw, tx2.raw).every(([b1, b2]) => b1.toString('hex') === b2.toString('hex'));
}

describe('交易', () => {
    const key = Buffer.from('ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f', 'hex');
    const addr = privateToAddress(key).toString('hex');

    it('一般交易', done => {
        const tx1 = makeTx(1, '0x' + addr, 1027, '', 1000, 2000);
        tx1.sign(key);
        const tx2 = sign(key, {nonce: 1, to: addr, value: 1027, gasPrice: 1000, gasLimit: 2000});
        expect('0x' + tx1.serialize().toString('hex')).eql(serialize(tx2));
        done();
    });

    it('佈署合約', done => {
        const tx1 = makeTx(1, null, 0, '0xaaa', 1000, 2000);
        tx1.sign(key);
        const tx2 = sign(key, {nonce: 1, data: 'aaa', gasPrice: 1000, gasLimit: 2000});
        expect('0x' + tx1.serialize().toString('hex')).eql(serialize(tx2));
        done();
    });

    it('執行合約', done => {
        const tx1 = makeTx(1, '0x' + addr, 0, '0xaaa', 1000, 2000);
        tx1.sign(key);
        const tx2 = sign(key, {nonce: 1, to: addr, data: 'aaa', gasPrice: 1000, gasLimit: 2000});
        expect('0x' + tx1.serialize().toString('hex')).eql(serialize(tx2));
        done();
    });

    it('空交易', done => {
        const tx1 = makeTx(0, null, 0, '', 0, 0);
        tx1.sign(key);
        const tx2 = sign(key, {});
        expect('0x' + tx1.serialize().toString('hex')).eql(serialize(tx2));
        done();
    });
});
