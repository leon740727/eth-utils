/** 每一個 string 都是 0x 開頭的 */
interface RawTxData {
    to: string,
    value: string,
    data: string,
    nonce: string | number,
    gasPrice: string,
    gasLimit: string,
}

interface TxData extends RawTxData {
    r: string,
    s: string,
    v: number,
}

declare class EthTx {
    constructor (rawTx: RawTxData)

    raw: Buffer[]
    _fields: string[]

    sign (key: Buffer): void
    hash (includeSignature?: boolean): Buffer
    serialize (): Buffer
}

declare module "ethereumjs-tx" {
    export = EthTx
}
