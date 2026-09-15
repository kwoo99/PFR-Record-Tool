/** Locks the Records feed to its workspace so long lists scroll internally. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function ruleBody(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("the Records feed stays bounded and scrolls inside its own box", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "../src/renderer/main/index.css"),
    "utf8",
  );
  const workspaceRule = ruleBody(css, "#feedAndBulkContainer");
  const activityRule = ruleBody(css, ".activity-panel");
  const feedRule = ruleBody(css, "#feedBox");

  assert.match(workspaceRule, /height\s*:\s*clamp\([^;]+\)\s*;/);
  assert.match(activityRule, /min-height\s*:\s*0\s*;/);
  assert.match(activityRule, /overflow\s*:\s*hidden\s*;/);
  assert.match(feedRule, /overflow-y\s*:\s*auto\s*;/);
  assert.match(feedRule, /min-height\s*:\s*0\s*;/);
  assert.match(feedRule, /max-height\s*:\s*100%\s*;/);
});
