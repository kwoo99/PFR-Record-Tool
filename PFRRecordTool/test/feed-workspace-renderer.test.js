/** Reproduces large-list rendering and complete-list search in the real UI code. */
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");

function fakeElement(value = "") {
  const element = {
    children: [],
    dataset: {},
    listeners: {},
    style: {},
    textContent: "",
    value,
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    append(...children) {
      children.forEach((child) => this.appendChild(child));
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    get childElementCount() {
      return this.children.length;
    },
    get firstElementChild() {
      return this.children[0];
    },
    replaceChildren(...children) {
      this.children = children.flatMap((child) => child.children ?? [child]);
    },
    remove() {
      if (this.parentElement) {
        const index = this.parentElement.children.indexOf(this);
        this.parentElement.children.splice(index, 1);
      }
    },
  };
  return element;
}

test("a 10,000-record feed stays bounded and searches every loaded record", () => {
  const elements = {
    bulkStatus: fakeElement(),
    deleteRecordOptions: fakeElement(),
    "deleteType-Label": fakeElement(),
    "deleteType-Switch": fakeElement(),
    feedBox: fakeElement(),
    feedDisplaySummary: fakeElement(),
    feedSourceBadge: fakeElement(),
    feedSourceDetail: fakeElement(),
    fetchPortalCustomersButton: fakeElement(),
    fileCount: fakeElement(),
    filesDisplayed: fakeElement(),
    portalCustomerFetchStatus: fakeElement(),
    searchBar: fakeElement(),
    selectFileButton: fakeElement(),
    selectedFile: fakeElement(),
  };
  const receivers = new Map();
  const originalDocument = global.document;
  const originalWindow = global.window;
  global.document = {
    createDocumentFragment: () => fakeElement(),
    createElement: () => fakeElement(),
    getElementById: (id) => elements[id],
  };
  global.window = {
    api: {
      comm: {
        CHANNELS,
        invoke: async () => undefined,
        receive: (channel, callback) => receivers.set(channel, callback),
      },
      dialog: { openFileSelect: async () => undefined },
    },
  };

  try {
    const feedPath = path.join(
      __dirname,
      "../src/renderer/main/feed-workspace.js",
    );
    const deletionPath = path.join(
      __dirname,
      "../src/renderer/main/csv-deletion.js",
    );
    delete require.cache[feedPath];
    delete require.cache[deletionPath];
    require(feedPath);
    require(deletionPath);

    const records = Array.from(
      { length: 10_000 },
      (_, index) => `CUST-${String(index).padStart(5, "0")}`,
    );
    receivers.get(CHANNELS.FEED_RECORDS_REPLACE)(records);
    receivers.get(CHANNELS.SELECTED_FILE_COUNT)(records.length);

    assert.equal(elements.feedBox.childElementCount, 500);
    const largeListSummary = elements.feedDisplaySummary.textContent;

    elements.searchBar.value = "CUST-05000";
    assert.doesNotThrow(() => elements.searchBar.listeners.input());

    assert.match(largeListSummary, /500 of 10,000/);
    assert.equal(elements.feedBox.childElementCount, 1);
    assert.equal(elements.feedBox.children[0].textContent, "CUST-05000");
    assert.equal(elements.filesDisplayed.textContent, "Showing 1 of 10,000");
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }
});
