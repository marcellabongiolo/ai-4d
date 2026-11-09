import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("the data app starts and parses CRLF data into historical windows", () => {
  const control = { addEventListener() {} };
  const initial = new Set(["#csvInput", "#sampleBtn", "#status", "#dashboard", "#apiUrl", "#apiBtn"]);
  const context = vm.createContext({
    document: { querySelector: selector => initial.has(selector) ? control : null, addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: { getItem: () => null },
  });
  vm.runInContext(readFileSync(new URL("../app/app.js", import.meta.url), "utf8"), context);
  const csv = "timestamp,signal\r\n" + Array.from({ length: 12 }, (_, index) => `${index + 1},${index + 10}`).join("\r\n");
  const parsed = context.parseTemporalDataset(csv);
  assert.equal(parsed.timestamps.length, 12);
  assert.equal(parsed.signals[0].values.length, 12);
  const result = context.compareHistoricalWindows(csv);
  assert.equal(result.previousValues.length, 6);
  assert.equal(result.currentValues.length, 6);
  assert.equal(result.previous.mean, 12.5);
  assert.equal(result.current.mean, 18.5);
  assert.equal(result.meanChange, "aumentou");
});
