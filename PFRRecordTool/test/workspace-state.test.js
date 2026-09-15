/** Verifies that each renderer keeps separate session-only state across page switches. */
const assert = require("node:assert/strict");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

test("Records and AutoPay workspace snapshots survive navigation independently", async () => {
  assert.equal(typeof CHANNELS.SET_WORKSPACE_STATE, "string");
  assert.equal(typeof CHANNELS.GET_WORKSPACE_STATE, "string");

  const { handlers } = createIPCHarness();
  const setWorkspaceState = handlers.get(CHANNELS.SET_WORKSPACE_STATE);
  const getWorkspaceState = handlers.get(CHANNELS.GET_WORKSPACE_STATE);

  await setWorkspaceState(undefined, {
    snapshot: { feed: ["CUST-1"], search: "Acme" },
    workspace: "records",
  });
  await setWorkspaceState(undefined, {
    snapshot: { customers: [{ CustomerId: "CUST-2" }], status: "off" },
    workspace: "autopay",
  });

  assert.deepEqual(await getWorkspaceState(undefined, "records"), {
    feed: ["CUST-1"],
    search: "Acme",
  });
  assert.deepEqual(await getWorkspaceState(undefined, "autopay"), {
    customers: [{ CustomerId: "CUST-2" }],
    status: "off",
  });
});

test("Workspace state starts empty in a new application session", async () => {
  const firstSession = createIPCHarness();
  await firstSession.handlers.get(CHANNELS.SET_WORKSPACE_STATE)(undefined, {
    snapshot: { query: "persist until exit" },
    workspace: "records",
  });

  const nextSession = createIPCHarness();
  assert.equal(
    await nextSession.handlers.get(CHANNELS.GET_WORKSPACE_STATE)(
      undefined,
      "records",
    ),
    null,
  );
});
