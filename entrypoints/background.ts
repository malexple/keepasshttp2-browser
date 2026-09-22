// Runs the full protocol on demand (see file header note on why: MV3
// service workers can be killed mid-idle, so we don't keep a persistent
// WebSocket open - each request opens a fresh connection, does the
// handshake, gets an answer, closes). Mirrors test_orchestrator_client.py
// exactly: change-public-keys -> test-associate -> associate (only if
// test-associate failed) -> get-logins.
//
// `browser` and `defineBackground` are WXT auto-imports (v0.20+) - do
// NOT add explicit imports for these from "wxt/browser"/"wxt/sandbox";
// those paths don't exist anymore and will fail to resolve.

import {
  generateKeyPair,
  randomNonce,
  randomClientId,
  b64,
  unb64,
  encryptJson,
  decryptJson,
} from "../lib/protocol";
import { loadIdentity, saveAssociationId } from "../lib/storage";

interface LoginEntry {
  login: string;
  password: string;
  name: string;
  uuid: string;
}

interface RunResult {
  success: boolean;
  error?: string;
  entries?: LoginEntry[];
}

const TIMEOUT_MS = 15000;

function runProtocol(url: string): Promise<RunResult> {
  return new Promise((resolve) => {
    loadIdentity().then((identity) => {
      const idPublicKeyB64 = identity.idPublicKey;
      const ws = new WebSocket(`ws://127.0.0.1:${identity.port}/`);
      const session = generateKeyPair();
      const clientId = randomClientId();
      let hostPublicKey: Uint8Array | null = null;
      let settled = false;

      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        try {
          ws.close();
        } catch {
          // Already closed - fine.
        }
        resolve(result);
      };

      const timeoutHandle = setTimeout(() => finish({ success: false, error: "timeout" }), TIMEOUT_MS);

      function sendEncrypted(action: string, innerPayload: unknown) {
        const nonce = randomNonce();
        const message = encryptJson(innerPayload, nonce, hostPublicKey!, session.secretKey);
        ws.send(JSON.stringify({ action, message, nonce: b64(nonce), clientID: clientId }));
      }

      ws.onopen = () => {
        const nonce = randomNonce();
        ws.send(
          JSON.stringify({
            action: "change-public-keys",
            publicKey: b64(session.publicKey),
            nonce: b64(nonce),
            clientID: clientId,
          }),
        );
      };

      ws.onerror = () => finish({ success: false, error: "connection failed - is KeePassHttp2 running?" });

      ws.onmessage = (event) => {
        try {
          const outer = JSON.parse(event.data as string);

          if (outer.action === "change-public-keys") {
            hostPublicKey = unb64(outer.publicKey);
            console.log("KeePassHttp2 debug test-associate payload", {
              id: identity.associationId ?? "",
              key: idPublicKeyB64,
              idType: typeof idPublicKeyB64,
            });
            sendEncrypted("test-associate", {
              action: "test-associate",
              id: identity.associationId ?? "",
              key: idPublicKeyB64,
            });
            return;
          }

          const nonce = unb64(outer.nonce);
          const inner = decryptJson<any>(outer.message, nonce, hostPublicKey!, session.secretKey);

          if (outer.action === "test-associate") {
            if (inner.success === "true") {
              sendEncrypted("get-logins", { action: "get-logins", url });
            } else {
              sendEncrypted("associate", {
                action: "associate",
                key: b64(session.publicKey),
                idKey: idPublicKeyB64,
              });
            }
            return;
          }

          if (outer.action === "associate") {
            if (inner.success !== "true") {
              finish({ success: false, error: "pairing was declined in KeePass" });
              return;
            }
            saveAssociationId(inner.id);
            sendEncrypted("get-logins", { action: "get-logins", url });
            return;
          }

          if (outer.action === "get-logins") {
            finish({ success: true, entries: inner.entries as LoginEntry[] });
            return;
          }
        } catch (err) {
          finish({ success: false, error: err instanceof Error ? err.message : "unknown error" });
        }
      };
    });
  });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response: RunResult) => void) => {
    if (message?.type === "get-logins-for-url") {
      runProtocol(message.url).then(sendResponse);
      return true; // keep the message channel open for the async response
    }
    return undefined;
  });
});