import { expect } from 'chai';
import * as eth from '../index';

declare const describe, it, before, after, afterEach;

describe('fmt', () => {
    it('tx 必填欄位要存在', done => {
        const tx = eth.ethTx({nonce: 0, gasPrice: 0, gasLimit: 255});
        expect(eth.fmt.tx(tx)).eql({ nonce: '0x0', gasPrice: '0x0', gasLimit: '0xff', v: '0x1c' });
        done();
    });
});
