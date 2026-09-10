/**
 * A minimal Chrome DevTools Protocol driver: launch, navigate, evaluate,
 * measure, screenshot.
 *
 * The write path is only proven if it is exercised the way a person exercises
 * it -- a real browser, the real form, the real server action. Everything in
 * this directory drives the portal through this, and reads the database
 * separately to see what actually landed.
 *
 * No dependency: Node 24 has a global WebSocket, and CDP is a JSON protocol.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/**
 * Submits the form and waits for the portal to answer.
 *
 * The click is retried while nothing has come back and the button is still
 * enabled. Before React has hydrated, a click on a server-action form does
 * nothing at all, and a fixed sleep long enough to cover a cold browser on a
 * slow machine would be guesswork in the other direction. The button disables
 * itself while a save is in flight, so a retry can never double-submit.
 */
export async function submit(page, timeoutMs = 20000) {
  try {
    return await submitOnce(page, timeoutMs);
  } catch (error) {
    if (!String(error.message).includes("navigated or closed")) throw error;

    /* The page went out from under the evaluation. Two different things do
       that: a server action that redirects, and a form that posted as a real
       navigation because React had not hydrated yet — which is the framework
       working as intended, and which happens readily on a dev server.
       Assuming success here reported refusals as saves. So rather than guess
       from the fact of the navigation, read whatever page came back. */
    await new Promise((r) => setTimeout(r, 1500));
    return readOutcome(page);
  }
}

/**
 * Signs in through the real form, and hands back the session cookie.
 *
 * The portal is closed now, so every suite in this directory has to get past
 * /login before it can drive anything. It is done through the form rather than
 * by minting a cookie from CLD_SESSION_SECRET directly, deliberately: a
 * harness that forges its own session would keep passing on the day sign-in
 * breaks, and sign-in is now the thing standing in front of the database.
 *
 * The returned `cookie` header is for the suites' own `fetch` calls — they
 * read rendered HTML straight from the server, outside the browser, and those
 * requests need the session too.
 */
export async function signIn(page, appUrl) {
  const passphrase = process.env.CLD_PORTAL_PASSWORD;
  if (!passphrase) {
    throw new Error(
      "CLD_PORTAL_PASSWORD is not set, so this suite cannot sign in. " +
        "Add it to .env.local — see .env.example.",
    );
  }

  await page.goto(appUrl + "/login");
  await waitFor(page, "#passphrase");

  let outcome;
  try {
    outcome = await page.evaluate(`
      const deadline = Date.now() + 30000;
      let lastClick = 0;
      while (Date.now() < deadline) {
        if (location.pathname !== "/login") return "signed in, now at " + location.pathname;

        const input = document.querySelector("#passphrase");
        const button = document.querySelector("main form button[type=submit]");
        if (!input || !button) return "the sign-in form is gone";

        if (!button.disabled && Date.now() - lastClick > 2000) {
          /* Written again on every attempt, through the prototype's own
             setter so React sees the change. React resets an uncontrolled
             input when it hydrates, so a value typed into the DOM before
             hydration finishes is silently discarded — which submitted an
             empty passphrase and read as a wrong one. */
          const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, "value",
          ).set;
          setValue.call(input, ${JSON.stringify(passphrase)});
          input.dispatchEvent(new Event("input", { bubbles: true }));
          button.click();
          lastClick = Date.now();
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      return "TIMED OUT still at " + location.pathname;
    `);
  } catch (error) {
    /* Signing in redirects, which tears the evaluation out from under itself.
       That is the success case; the cookie check below is what confirms it. */
    if (!String(error.message).includes("navigated or closed")) throw error;
    outcome = "signed in and redirected";
    await new Promise((r) => setTimeout(r, 1200));
  }

  const cookie = await page.cookieHeader();
  if (!cookie.includes("cld_session=")) {
    throw new Error("did not get past /login — " + outcome);
  }
  return { outcome, cookie };
}

/** What the page currently says about the last save. */
function readOutcome(page) {
  return page.evaluate(`
    const field = document.querySelector('[id$="-error"]');
    if (field) return "REJECTED: " + field.id + " — " + field.textContent.trim();
    const alert = document.querySelector('[role=alert]');
    if (alert) return "ALERT: " + alert.textContent.trim();
    const status = document.querySelector('[role=status]');
    if (status && status.textContent.trim()) return "OK: " + status.textContent.trim();
    return "OK: the form completed and the page is now " + location.pathname;
  `);
}

function submitOnce(page, timeoutMs) {
  return page.evaluate(`
    const deadline = Date.now() + ${timeoutMs};
    let lastClick = 0;
    while (Date.now() < deadline) {
      /* Scoped to <main>: the sidebar carries a sign-out form, and it comes
         first in the document — an unscoped query for the first submit button
         on the page clicks that instead, which signs the suite out mid-run and
         reads as a mysterious bounce to /login.

         Looked up every pass, never captured once. React replaces the button's
         DOM node when the form re-renders — which is exactly what happens when
         a save comes back with an error — and a held reference then looks
         detached. Reading that as "the page moved on" reported refusals as
         successes, which is the opposite of what they were. */
      const button = document.querySelector('main form button[type=submit]');
      /* Errors are read before the status line, and deliberately so: a save
         can partly succeed — the record written, one field refused — and it
         then shows both at once. Reading the happy line first would report
         that as a clean save and hide the half that failed. */
      const field = document.querySelector('[id$="-error"]');
      if (field) return "REJECTED: " + field.id + " — " + field.textContent.trim();
      const alert = document.querySelector('[role=alert]');
      if (alert) return "ALERT: " + alert.textContent.trim();
      const status = document.querySelector('[role=status]');
      if (status && status.textContent.trim()) return "OK: " + status.textContent.trim();
      /* A form that redirects or is replaced by what it created has no
         status line to show — its own disappearance is the confirmation. */
      if (!button) return "OK: the form completed and the page moved on";
      if (!button.disabled && Date.now() - lastClick > 2500) {
        button.click();
        lastClick = Date.now();
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return "TIMED OUT";
  `);
}

/** Waits for an element to exist, for forms that arrive after a navigation. */
export async function waitFor(page, selector, timeoutMs = 15000) {
  const found = await page.evaluate(`
    const deadline = Date.now() + ${timeoutMs};
    while (Date.now() < deadline) {
      if (document.querySelector(${JSON.stringify(selector)})) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  `);
  if (!found) throw new Error(`waited ${timeoutMs}ms and never saw ${selector}`);
  return found;
}

/** Sets an uncontrolled form control the way a person would leave it. */
export async function fill(page, selector, value) {
  return page.evaluate(`
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error("no " + ${JSON.stringify(selector)});
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value;
  `);
}

export async function launch(port = 9333) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cld-cdp-"));
  const proc = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + profile,
    "about:blank",
  ], { stdio: "ignore" });

  let version;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!version) throw new Error("Chrome did not come up");

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else {
      for (const fn of listeners) fn(msg);
    }
  };

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });

  const cmd = (method, params) => send(method, params, sessionId);
  await cmd("Page.enable");
  await cmd("Runtime.enable");

  /**
   * Collects client-side errors, in the page, from before the first line of
   * application code runs.
   *
   * A form whose buttons do nothing is almost always a hydration failure, and
   * a hydration failure is silent from the outside — the markup is there, it
   * just is not wired to anything. Without this the only symptom is a click
   * that has no effect, which is indistinguishable from a slow machine.
   */
  /**
   * Every request the page makes, and how it ended.
   *
   * Reading `<script src>` out of the DOM only shows what the HTML asked for.
   * A chunk fetched by webpack's own loader, or one that was requested and
   * failed, never appears there — so a page that is missing its client code
   * looks identical to one that never wanted any. This records what actually
   * went over the wire, which is the difference.
   */
  const network = [];
  const consoleLog = [];
  await cmd("Network.enable");
  await cmd("Log.enable");
  listeners.push((m) => {
    if (m.sessionId !== sessionId) return;

    /* Read from the protocol rather than by patching console in the page: an
       exception thrown while a chunk is being evaluated can happen before any
       in-page hook is reachable, and is exactly the case worth seeing. */
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      consoleLog.push(
        "exception: " + (d.exception?.description ?? d.text ?? "").split("\n").slice(0, 3).join(" | "),
      );
    }
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) {
      consoleLog.push(
        m.params.type + ": " + m.params.args.map((a) => a.description ?? a.value ?? a.type).join(" ").slice(0, 300),
      );
    }
    if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) {
      consoleLog.push("log." + m.params.entry.level + ": " + String(m.params.entry.text).slice(0, 300));
    }
    if (m.method === "Network.responseReceived") {
      network.push({
        url: m.params.response.url,
        status: m.params.response.status,
        type: m.params.type,
      });
    }
    if (m.method === "Network.loadingFailed") {
      network.push({ url: "(failed)", status: 0, type: m.params.type, error: m.params.errorText });
    }
  });

  await cmd("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__cldErrors = [];
      addEventListener("error", (e) => {
        window.__cldErrors.push("error: " + (e.message || e.error));
      });
      addEventListener("unhandledrejection", (e) => {
        window.__cldErrors.push("unhandled rejection: " + (e.reason && (e.reason.message || e.reason)));
      });
      const realError = console.error;
      console.error = (...args) => {
        window.__cldErrors.push("console.error: " + args.map(String).join(" "));
        realError(...args);
      };
    `,
  });

  const page = {
    async goto(url) {
      const loaded = new Promise((resolve) => {
        const fn = (m) => {
          if (m.sessionId === sessionId && m.method === "Page.loadEventFired") {
            listeners.splice(listeners.indexOf(fn), 1);
            resolve();
          }
        };
        listeners.push(fn);
      });
      await cmd("Page.navigate", { url });
      await loaded;
      /* Give hydration a beat; the form's submit handler is React's. */
      await new Promise((r) => setTimeout(r, 1500));
    },
    async evaluate(expression) {
      const { result, exceptionDetails } = await cmd("Runtime.evaluate", {
        expression: `(async () => { ${expression} })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.text + " " + (exceptionDetails.exception?.description ?? ""));
      return result.value;
    },
    /**
     * Puts a real file into a file input, the way the operating system's
     * picker does.
     *
     * A file input cannot be filled by script — `value` is read-only for
     * exactly the reason you would want it to be — so the only honest way to
     * test an upload is to have the browser itself attach the file. CDP's
     * DOM.setFileInputFiles is what the picker would have done, which keeps
     * this a test of the portal rather than a test of a bypass.
     */
    async attachFile(selector, filePath) {
      await cmd("DOM.enable");
      const { root } = await cmd("DOM.getDocument", { depth: -1 });
      const { nodeId } = await cmd("DOM.querySelector", {
        nodeId: root.nodeId,
        selector,
      });
      if (!nodeId) throw new Error("no file input at " + selector);
      await cmd("DOM.setFileInputFiles", {
        nodeId,
        files: [path.resolve(filePath)],
      });
      /* React's onChange runs off the input event the browser raises for the
         attachment; give it a beat to render the preview. */
      await new Promise((r) => setTimeout(r, 400));
    },
    /** The session cookie, formatted for a `cookie:` request header. */
    async cookieHeader() {
      const { cookies } = await cmd("Network.getCookies");
      return cookies.map((c) => c.name + "=" + c.value).join("; ");
    },
    /** Everything requested since the last clearRequests(), with outcomes. */
    requests() {
      return network.slice();
    },
    clearRequests() {
      network.length = 0;
      consoleLog.length = 0;
    },
    /** Console errors, warnings and thrown exceptions, from the protocol. */
    console() {
      return consoleLog.slice();
    },
    /** Whatever the page has complained about since it loaded. */
    async errors() {
      return page.evaluate("return window.__cldErrors ?? [];");
    },
    async metrics() {
      return page.evaluate(
        "return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth };",
      );
    },
    async setViewport(width, height, mobile) {
      await cmd("Emulation.setDeviceMetricsOverride", {
        width, height, deviceScaleFactor: 1, mobile: mobile === undefined ? width < 500 : mobile,
      });
    },
    async screenshot(file) {
      const { data } = await cmd("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      fs.writeFileSync(file, Buffer.from(data, "base64"));
    },
    close() {
      ws.close();
      proc.kill();
    },
  };
  return page;
}
