// crypto_box helpers (X25519 + XSalsa20-Poly1305) via tweetnacl, matching
// exactly what NaClBox.cs / test_orchestrator_client.py already do and
// have been verified against in the C# test suite and real end-to-end
// runs. Keep the semantics identical to those two references if you
// change anything here.

import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  return nacl.box.keyPair();
}

export function randomNonce(): Uint8Array {
  return nacl.randomBytes(nacl.box.nonceLength);
}

export function randomClientId(): string {
  return b64(nacl.randomBytes(16));
}

export function b64(bytes: Uint8Array): string {
  return naclUtil.encodeBase64(bytes);
}

export function unb64(s: string): Uint8Array {
  return naclUtil.decodeBase64(s);
}

export function encryptJson(
  payload: unknown,
  nonce: Uint8Array,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): string {
  const message = naclUtil.decodeUTF8(JSON.stringify(payload));
  const ciphertext = nacl.box(message, nonce, theirPublicKey, mySecretKey);
  return b64(ciphertext);
}

// Throws if authentication fails - matches NaClBox.Open's behavior
// (CryptoException) rather than silently returning something falsy that
// could be mistaken for a valid-but-empty response.
export function decryptJson<T = unknown>(
  ciphertextB64: string,
  nonce: Uint8Array,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): T {
  const ciphertext = unb64(ciphertextB64);
  const plaintext = nacl.box.open(ciphertext, nonce, theirPublicKey, mySecretKey);
  if (!plaintext) throw new Error("decryption failed (authentication tag mismatch)");
  return JSON.parse(naclUtil.encodeUTF8(plaintext));
}