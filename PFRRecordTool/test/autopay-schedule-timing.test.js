/** Verifies schedule previews preserve PayFabric process days without local shifts. */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  dateInputValue,
  describeProcessDay,
  formatProcessDay,
  formatTimezone,
  portalMidnightValue,
} = require("../src/renderer/autopay/schedule-timing.js");

test("formats the selected calendar day independently of the computer timezone", () => {
  assert.equal(
    formatProcessDay("2026-10-15", "en-US"),
    "Thursday, October 15, 2026",
  );
  assert.equal(
    formatProcessDay("2026-10-15T23:30:00-11:00", "en-US"),
    "Thursday, October 15, 2026",
  );
});

test("describes the midnight start in the contract's portal timezone", () => {
  assert.deepEqual(describeProcessDay("", { bulk: true }), {
    detail:
      "Each contract starts at 12:00 AM (00:00) in its PayFabric portal time zone on the date supplied by its selected source.",
    headline: "No date override selected",
  });

  const description = describeProcessDay("2026-10-15", {
    timezone: {
      displayName: "Pacific Time",
      name: "America/Los_Angeles",
    },
  });
  assert.match(description.headline, /Scheduled start: Thursday, October 15, 2026/);
  assert.match(description.detail, /12:00 AM \(00:00\)/);
  assert.match(description.detail, /Pacific Time/);
});

test("uses the portal timezone display name with a name fallback", () => {
  assert.equal(
    formatTimezone({ displayName: "Pacific Time", name: "America/Los_Angeles" }),
    "Pacific Time",
  );
  assert.equal(formatTimezone({ name: "America/New_York" }), "America/New_York");
});

test("date fields send portal-local midnight without a computer timezone shift", () => {
  assert.equal(portalMidnightValue("2026-10-15"), "2026-10-15T00:00:00");
  assert.equal(
    dateInputValue("2026-10-15T23:30:00-11:00"),
    "2026-10-15",
  );
  assert.equal(portalMidnightValue("not-a-date"), undefined);
});
