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

interface FillResult {
  success: boolean;
  error?: string;
  loginFilled?: boolean;
}

const statusEl = document.getElementById("status")!;
const entriesEl = document.getElementById("entries")!;

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function fillLogin(entry: LoginEntry): Promise<FillResult> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    return {
      success: false,
      error: "Cannot access the active tab.",
    };
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/content-scripts/content.js"],
    });

    return (await browser.tabs.sendMessage(tab.id, {
      type: "fill-login",
      login: entry.login,
      password: entry.password,
    })) as FillResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.url) {
    statusEl.textContent = "No active tab URL.";
    return;
  }

  statusEl.textContent = "Connecting to KeePassHttp2...";

  const result = (await browser.runtime.sendMessage({
    type: "get-logins-for-url",
    url: tab.url,
  })) as RunResult;

  if (!result.success) {
    statusEl.textContent = `Error: ${result.error}`;
    return;
  }

  if (!result.entries || result.entries.length === 0) {
    statusEl.textContent = "No matching entries for this site.";
    return;
  }

  statusEl.textContent =
    `${result.entries.length} entr${result.entries.length === 1 ? "y" : "ies"} found:`;

  for (const entry of result.entries) {
    const div = document.createElement("div");
    div.className = "entry";

    div.innerHTML =
      `<div>${escapeHtml(entry.name)}</div>` +
      `<div class="muted">${escapeHtml(entry.login)}</div>`;

    div.addEventListener("click", async () => {
      statusEl.textContent = "Filling login form...";

      const fillResult = await fillLogin(entry);

      if (!fillResult.success) {
        statusEl.textContent =
          `Autofill failed: ${fillResult.error ?? "unknown error"}`;
        return;
      }

      statusEl.textContent = fillResult.loginFilled
        ? "Login and password filled."
        : "Password filled. Login field was not found.";
    });

    entriesEl.appendChild(div);
  }
}

main();