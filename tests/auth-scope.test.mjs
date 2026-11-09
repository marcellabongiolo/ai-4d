import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../app/auth.js", import.meta.url), "utf8");
function fixture(base = "https://api.example.com/v1/") {
  const saved = new Map([["ai4d_api_url", base]]);
  const calls = [];
  const input = { value: base };
  let status = 200;
  const context = vm.createContext({
    URL, Headers, Request, Event,
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: key => saved.delete(key) },
    document: { querySelector: selector => selector === "#apiUrl" ? input : null, addEventListener() {} },
    window: { location: { href: "https://portfolio.example.com/app/" }, dispatchEvent() {}, fetch: async (url, init) => { calls.push({ url, init }); return { status, ok: status === 200, json: async () => ({ access_token: "account-token", user_id: 12 }) }; } },
  });
  context.fetch = (...args) => context.window.fetch(...args);
  vm.runInContext(source, context);
  return { context, saved, calls, input, setStatus: value => { status = value; }, signIn: async () => { context.setAuthSession(await context.authRequest("/auth/login", { password: "test" })); calls.length = 0; } };
}

test("credentials are sent only to private routes on the issuing API base", async () => {
  const f = fixture(); await f.signIn();
  for (const url of ["https://api.example.com/v1/sessions", "https://api.example.com/v1/sessions?limit=5", new Request("https://api.example.com/v1/sessions/12"), "https://api.example.com/v1/projects", "https://api.example.com/v1/datasets?project_id=12", "https://api.example.com/v1/datasets/4"]) {
    await f.context.window.fetch(url);
    assert.equal(new Headers(f.calls.at(-1).init.headers).get("Authorization"), "Bearer account-token");
  }
  for (const url of ["https://other.example.com/v1/sessions", "https://api.example.com/sessions", "https://api.example.com/v1/sessions-public", "https://api.example.com/v1/health", "https://api.example.com/v1/auth/login", "https://api.example.com/v1/projects-public"]) {
    await f.context.window.fetch(url);
    assert.equal(new Headers(f.calls.at(-1).init.headers).get("Authorization"), null);
  }
});
test("switching APIs does not forward the previous account token", async () => {
  const f = fixture(); await f.signIn();
  f.input.value = "https://other.example.com";
  assert.equal(f.context.getAuthToken(), null);
  await f.context.window.fetch("https://other.example.com/sessions");
  assert.equal(new Headers(f.calls.at(-1).init.headers).get("Authorization"), null);
});
test("login response is bound to the requested API even if the input changes", async () => {
  const f = fixture();
  const data = await f.context.authRequest("/auth/login", {});
  f.input.value = "https://other.example.com";
  f.context.setAuthSession(data);
  assert.equal(f.saved.get("ai4d_token_api"), "https://api.example.com/v1");
  assert.equal(f.context.getAuthToken(), null);
});
test("old unbound tokens require a new login", () => {
  const f = fixture(); f.saved.set("ai4d_access_token", "legacy-token");
  assert.equal(f.context.getAuthToken(), null);
});
test("authentication rejects insecure remote origins and permits local HTTP", async () => {
  const f = fixture("http://remote.example.com");
  await assert.rejects(f.context.authRequest("/auth/login", {}), /HTTPS/);
  assert.equal(f.calls.length, 0);
  f.input.value = "http://localhost:8000/";
  await f.signIn();
  assert.equal(f.context.getAuthToken(), "account-token");
});
test("unrelated failures preserve the session; the issuing API's 401 clears it", async () => {
  const f = fixture(); await f.signIn(); f.setStatus(401);
  await f.context.window.fetch("https://other.example.com/sessions");
  assert.equal(f.context.getAuthToken(), "account-token");
  await f.context.window.fetch("https://api.example.com/v1/sessions");
  assert.equal(f.context.getAuthToken(), null);
  assert.equal(f.saved.has("ai4d_token_api"), false);
});
