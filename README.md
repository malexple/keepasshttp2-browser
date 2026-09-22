# KeePassHttp2 Browser

A minimal Chromium browser extension for the KeePassHttp2 plugin. It connects to a local KeePassHttp2 WebSocket server, asks KeePass for credentials matching the active tab's URL, and fills the selected login and password into the page.

> Status: development / proof of concept. The extension is loaded unpacked during development and is not packaged for a browser store.

## Features

- Connects locally to KeePassHttp2 using WebSocket.
- Uses the KeePassXC-style encrypted protocol:
  `change-public-keys` → `test-associate` → `associate` → `get-logins`.
- Generates and persists a per-installation identity key pair in `browser.storage.local`.
- Shows an Allow/Deny pairing dialog in KeePass on first use.
- Requests credentials matching the active tab URL.
- Displays matching entries in the extension popup.
- Fills the selected entry's login and password into the current page.
- Does **not** submit the login form automatically.

## Requirements

- Windows with [KeePass](https://keepass.info/) installed.
- The KeePassHttp2 plugin installed and enabled in KeePass.
- Node.js and npm.
- Vivaldi, Google Chrome, Microsoft Edge, or another Chromium-based browser.

## KeePassHttp2 setup

1. Start KeePass.
2. Open and unlock the password database that contains your entries.
3. Confirm that the KeePassHttp2 plugin is enabled in `Tools` → `Plugins`.
4. Open `Tools` → `KeePassHttp2 Options...`.
5. Note the configured listen port.

The browser extension and the plugin must use the **same port**.

By default, the browser extension currently uses port `19455` in `lib/storage.ts`:

```ts
port: 19455,
```

If KeePassHttp2 is configured to listen on another port, for example `19456`, change that line before building:

```ts
port: 19456,
```

After changing the default port, remove and re-add the browser extension, or clear its extension storage, so an old saved port is not reused.

## Install dependencies

From the extension project directory:

```powershell
cd D:\project\nodejs\keepasshttp2-browser
npm install
```

## Build the extension

Create a production build:

```powershell
npm run build
```

WXT creates the unpacked extension here:

```text
.output\chrome-mv3
```

For type checking without building:

```powershell
npm run compile
```

## Load in Vivaldi

1. Open Vivaldi.
2. Enter this address in the browser address bar:

   ```text
   vivaldi://extensions/
   ```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

   ```text
   D:\project\nodejs\keepasshttp2-browser\.output\chrome-mv3
   ```

6. Pin the extension icon if desired.

After every `npm run build`, return to `vivaldi://extensions/` and click the reload button `↻` on the extension.

## Load in Microsoft Edge

1. Open Edge.
2. Enter this address in the browser address bar:

   ```text
   edge://extensions/
   ```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select:

   ```text
   D:\project\nodejs\keepasshttp2-browser\.output\chrome-mv3
   ```

## First pairing

1. Open a normal `http://` or `https://` page. Use a page with a real login form when testing autofill.
2. Click the extension icon.
3. The popup connects to KeePassHttp2.
4. On the first connection, KeePass shows a pairing dialog.
5. Enter a recognizable name, for example:

   ```text
   Vivaldi KeePassHttp2
   ```

6. Click **Allow**.

The plugin stores the browser identity key in the currently open KeePass database. Later connections use `test-associate` and should not show the dialog again.

## Use the extension

1. Navigate to a login page.
2. Click the extension icon.
3. The popup shows entries whose KeePass URL has the same hostname as the active tab.
4. Click the desired entry.
5. The extension fills the login and password fields.
6. Review the fields and click the website's login button yourself.

The extension intentionally does not auto-submit forms.

## Project structure

```text
entrypoints/
  background.ts          Protocol client and KeePassHttp2 communication
  content.ts             Code injected into the login page for autofill
  popup/
    index.html           Popup layout
    main.ts              Popup UI and entry selection
lib/
  protocol.ts            TweetNaCl crypto_box helpers
  storage.ts             Persistent browser identity, pairing ID, and port
wxt.config.ts            WXT and manifest configuration
```

## How autofill works

The popup cannot directly change the web page DOM. After you click an entry, it uses `activeTab` and `scripting` permissions to inject `entrypoints/content.ts` into the active page. The content script:

1. Finds the first enabled password input.
2. Looks for a text/email/tel input before it as the login field.
3. Sets the selected username and password.
4. Emits `input` and `change` events so common framework-based forms notice the update.

This is deliberately a basic heuristic. Some websites use multi-step login flows, iframes, Shadow DOM, custom controls, or unusual field ordering; those may need site-specific handling later.

## Permissions

The manifest requests:

| Permission | Purpose |
|---|---|
| `storage` | Stores the identity key pair, association ID, and configured port locally in the browser profile |
| `activeTab` | Grants temporary access to the current tab after the user clicks the extension |
| `scripting` | Injects the autofill content script into that active tab |

## Troubleshooting

### Popup says `connection failed - is KeePassHttp2 running?`

- KeePass is not running, the plugin failed to load, or the database is closed.
- The configured port differs between the plugin and extension.
- Check the KeePassHttp2 log next to the plugin DLL.

### Popup stays on `Connecting to KeePassHttp2...`

- Inspect the extension service worker:
    1. Open `vivaldi://extensions/` or `edge://extensions/`.
    2. Enable Developer mode.
    3. Click `service worker` / `Inspect views` for the extension.
    4. Open Console and repeat the action.
- Check `keepasshttp2.log` for protocol messages and rejected requests.

### KeePass shows `test-associate: missing id/key`

For a first connection, an empty association ID is normal. KeePassHttp2 must return an encrypted `success: "false"` response for that case, allowing the extension to proceed to `associate`. If it rejects the request without replying, update the plugin to the version that handles an empty first-run ID normally.

### Popup says `No matching entries for this site.`

The current plugin matching rule compares hostnames. For example, an entry with URL `https://example.com/login` matches `https://example.com/...`, but not automatically a different hostname such as `accounts.example.com`.

### Popup says `Password field not found on this page.`

- Make sure you are on the actual page containing the login form.
- Refresh the page after reloading the extension.
- Browser-internal pages such as `vivaldi://extensions/` cannot be filled.
- The website may use an iframe, Shadow DOM, a multi-step flow, or non-standard form fields.

### Browser still shows the WXT starter screen

The WXT popup entrypoint must be the KeePass popup implementation:

```text
entrypoints\popup\main.ts
entrypoints\popup\index.html
```

Do not edit files under `.output`; they are generated during every build.

## Development notes

`npm run dev` starts WXT development mode and normally tries to launch Google Chrome. If Chrome is not installed, WXT may build the extension successfully and then end with:

```text
No Chrome installations found.
```

Use `npm run build` and load `.output\chrome-mv3` manually in Vivaldi or Edge instead.

## Security notes

- KeePassHttp2 listens only on the local machine.
- The browser extension and plugin encrypt protocol payloads with NaCl `crypto_box` primitives after `change-public-keys`.
- New browser identities require explicit approval in KeePass.
- The pairing key is persisted by KeePass in the current database.
- Do not expose the KeePassHttp2 WebSocket port to a network interface or the public internet.
- Autofill happens only after the user explicitly selects an entry in the popup.
- The extension does not automatically submit credentials.