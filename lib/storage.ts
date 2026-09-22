// Persistent per-installation state: the permanent identification
// keypair (generated once, kept forever - this is what "associate"
// registers with KeePassHttp2 and "test-associate" proves possession
// of), the association name the server assigned us, and the port to
// connect to. Uses browser.storage.local, not localStorage - required in
// a service-worker background context (MV3 has no window/localStorage).
//
// `browser` is a WXT auto-import (v0.20+) - no explicit import needed or
// possible from "wxt/browser" in this version.

import nacl from "tweetnacl";
import { b64 } from "./protocol";

const STORAGE_KEY = "keepasshttp2";

interface StoredIdentity {
  idPublicKey: string; // base64
  idSecretKey: string; // base64
  associationId: string | null; // name the server assigned on associate, or null if never paired
  port: number;
}

export async function loadIdentity(): Promise<StoredIdentity> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const existing = stored[STORAGE_KEY] as StoredIdentity | undefined;
  if (existing) return existing;

  // First run: generate the permanent identification keypair exactly
  // once. Never regenerate this for an existing install - doing so would
  // silently invalidate every prior pairing.
  const idKeyPair = nacl.box.keyPair();
  const identity: StoredIdentity = {
    idPublicKey: b64(idKeyPair.publicKey),
    idSecretKey: b64(idKeyPair.secretKey),
    associationId: null,
    port: 19455,
  };
  await browser.storage.local.set({ [STORAGE_KEY]: identity });
  return identity;
}

export async function saveAssociationId(associationId: string): Promise<void> {
  const identity = await loadIdentity();
  identity.associationId = associationId;
  await browser.storage.local.set({ [STORAGE_KEY]: identity });
}

export async function savePort(port: number): Promise<void> {
  const identity = await loadIdentity();
  identity.port = port;
  await browser.storage.local.set({ [STORAGE_KEY]: identity });
}