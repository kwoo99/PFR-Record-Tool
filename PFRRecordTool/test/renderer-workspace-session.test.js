/** Verifies that renderer navigation saves and restores page-local UI state. */
const assert = require("node:assert/strict");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");
const {
  createWorkspaceSession,
} = require("../src/renderer/shared/workspace-session.js");

test("navigation waits for a workspace snapshot before changing pages", async () => {
  const calls = [];
  const link = {
    href: "app://autopay",
    addEventListener(type, listener) {
      this.listeners ??= {};
      this.listeners[type] = listener;
    },
  };
  const location = {
    assign(value) {
      calls.push(["navigate", value]);
    },
  };
  const restored = [];
  const comm = {
    CHANNELS,
    async invoke(channel, value) {
      calls.push([channel, value]);
      if (channel === CHANNELS.GET_WORKSPACE_STATE) {
        return { recordId: "CUST-1" };
      }
      return true;
    },
  };
  const session = createWorkspaceSession({
    capture: () => ({ recordId: "CUST-2" }),
    comm,
    links: [link],
    location,
    restore: (snapshot) => restored.push(snapshot),
    workspace: "records",
  });

  await session.start();
  assert.deepEqual(restored, [{ recordId: "CUST-1" }]);

  let prevented = false;
  await link.listeners.click({
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.deepEqual(calls.at(-2), [
    CHANNELS.SET_WORKSPACE_STATE,
    { snapshot: { recordId: "CUST-2" }, workspace: "records" },
  ]);
  assert.deepEqual(calls.at(-1), ["navigate", "app://autopay"]);
});
