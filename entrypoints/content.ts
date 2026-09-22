export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== "fill-login") {
        return;
      }

      const login = String(message.login ?? "");
      const password = String(message.password ?? "");

      const passwordField = document.querySelector<HTMLInputElement>(
        'input[type="password"]:not([disabled]):not([readonly])',
      );

      if (!passwordField) {
        return {
          success: false,
          error: "Password field not found on this page.",
        };
      }

      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]):not([readonly])',
        ),
      );

      const passwordIndex = inputs.indexOf(passwordField);

      const loginField =
        inputs
          .slice(0, passwordIndex)
          .reverse()
          .find((input) =>
            ["text", "email", "tel", "username", ""].includes(input.type),
          ) ?? null;

      function setValue(input: HTMLInputElement, value: string) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;

        setter?.call(input, value);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (loginField) {
        setValue(loginField, login);
      }

      setValue(passwordField, password);
      passwordField.focus();

      return {
        success: true,
        loginFilled: loginField !== null,
      };
    });
  },
});