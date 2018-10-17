declare module "secp256k1" {
    export function publicKeyCreate (privateKey: Buffer, compressed?: boolean): Buffer;
    export function sign (message: Buffer, privateKey: Buffer, options?: {}): {signature: Buffer, recovery: number};
    export function recover (message: Buffer, signature: Buffer, recovery: number, compressed?: boolean): Buffer;
    export function verify (message: Buffer, signature: Buffer, publicKey: Buffer): boolean;
}
