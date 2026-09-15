/**
 * AutoPay IPC boundary.
 * Converts renderer requests into customer-report, template, contract, import,
 * and session-scoped bulk workflows without exposing credentials to the page.
 */
const path = require("node:path");
const { dialog, ipcMain } = require("electron");

const { createAutoPayBulkManager } = require("../autopay/bulk-manager.js");
const { prepareCustomerExport } = require("../autopay/customer-export.js");
const { loadAutoPayWorkbook } = require("../autopay/import.js");
const { createAutoPayService } = require("../autopay/service.js");
const { normalizeTemplateRequest } = require("../autopay/contracts.js");
const { withAutoPayStatus } = require("../autopay/status.js");
const {
  writeAutoPayWorkbook,
  writeCustomerExportWorkbook,
} = require("../autopay/workbook-template.js");
const payfabricClient = require("../payfabric/client.js");
const CHANNELS = require("../../shared/channels.js");
const AUTOPAY_WORKBOOK_NAME = "AutoPay-Contract-Template.xlsx";
const CUSTOMER_EXPORT_NAME = "AutoPay-Selected-Customers.xlsx";

function registerAutoPayHandlers(mainWindow, connectionState) {
  const service = createAutoPayService(payfabricClient);
  const send = (channel, value) => mainWindow.webContents.send(channel, value);
  const bulkManager = createAutoPayBulkManager({
    execute: ({ customer, operation, options }) => {
      if (operation === "remove") return service.remove(customer);
      const customerOptions = options.assignments?.[customer.CustomerId] ?? options;
      return service.apply(customer, customerOptions);
    },
    maxConcurrency: 3,
    onProgress: (progress) => send(CHANNELS.AUTOPAY_PROGRESS, progress),
    onResult: (result) => send(CHANNELS.AUTOPAY_RESULT, result),
  });

  ipcMain.handle(CHANNELS.GET_CONNECTION_STATUS, async () => {
    const configured = Boolean(
      connectionState.portalName &&
        connectionState.integrationKey &&
        connectionState.integrationPass,
    );
    let timezone = null;
    if (configured) {
      try {
        timezone = await payfabricClient.getPortalTimezone();
      } catch {
        // Timezone visibility is helpful but must not block AutoPay operations
        // if the portal's public timezone lookup is temporarily unavailable.
      }
    }

    return {
      configured,
      environment: connectionState.isTest ? "Sandbox" : "Production",
      portalName: connectionState.portalName,
      timezone,
    };
  });

  ipcMain.handle(CHANNELS.AUTOPAY_LIST_CUSTOMERS, async (_event, request = {}) => {
    try {
      const customers = (
        await payfabricClient.listCustomers({ filters: request.filters })
      ).map(withAutoPayStatus);
      const status = request.autoPayStatus ?? "all";
      const filtered = customers.filter((customer) => {
        return (
          status === "all" ||
          (status === "on" ? customer.HasAutoPay : !customer.HasAutoPay)
        );
      });
      return { customers: filtered, total: filtered.length };
    } catch (error) {
      return { customers: [], error: error.message, total: 0 };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_LIST_TEMPLATES, async (_event, customerId) => {
    try {
      return await payfabricClient.listAutoPayTemplates(customerId);
    } catch (error) {
      return { data: null, error: error.message, status: null };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_SAVE_TEMPLATE, async (_event, template) => {
    try {
      return await payfabricClient.saveAutoPayTemplate(
        normalizeTemplateRequest(template),
      );
    } catch (error) {
      return { data: null, error: error.message, status: null };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_GET_CONTRACT, async (_event, customerId) => {
    try {
      return await service.loadContract(customerId);
    } catch (error) {
      return { data: null, error: error.message, status: null };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_SAVE_CONTRACT, async (_event, request) => {
    try {
      return await service.saveContract(request);
    } catch (error) {
      return { data: null, error: error.message, status: null };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_DELETE_CONTRACT, async (_event, customerId) => {
    try {
      const result = await service.remove({ CustomerId: customerId });
      if (result.outcome !== "succeeded") {
        return { data: null, error: result.message, status: result.status };
      }
      return { data: true, error: null, status: result.status };
    } catch (error) {
      return { data: null, error: error.message, status: null };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_IMPORT_WORKBOOK, async () => {
    const response = await dialog.showOpenDialog(mainWindow, {
      filters: [{ extensions: ["xlsx"], name: "Excel workbook" }],
      properties: ["openFile"],
    });
    if (response.canceled) return null;

    try {
      const filePath = response.filePaths[0];
      return {
        ...(await loadAutoPayWorkbook(filePath)),
        fileName: path.basename(filePath),
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_DOWNLOAD_WORKBOOK, async () => {
    const response = await dialog.showSaveDialog(mainWindow, {
      defaultPath: AUTOPAY_WORKBOOK_NAME,
      filters: [{ extensions: ["xlsx"], name: "Excel workbook" }],
    });
    if (response.canceled || !response.filePath) return null;

    try {
      await writeAutoPayWorkbook(response.filePath);
      return { fileName: path.basename(response.filePath) };
    } catch (error) {
      return { error: `Could not save the workbook: ${error.message}` };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_EXPORT_CUSTOMERS, async (_event, customers) => {
    if (!Array.isArray(customers) || customers.length === 0) {
      return { error: "Select at least one customer to export" };
    }
    const response = await dialog.showSaveDialog(mainWindow, {
      defaultPath: CUSTOMER_EXPORT_NAME,
      filters: [{ extensions: ["xlsx"], name: "Excel workbook" }],
    });
    if (response.canceled || !response.filePath) return null;

    try {
      send(CHANNELS.AUTOPAY_EXPORT_PROGRESS, {
        completed: 0,
        total: customers.length,
      });
      const rows = await prepareCustomerExport(customers, {
        getAutoPayContract: (customerId) =>
          payfabricClient.getAutoPayContract(customerId),
        getDefaultPaymentMethod: (customerId, currencyCode) =>
          payfabricClient.getDefaultPaymentMethod(customerId, currencyCode),
        onProgress: (progress) =>
          send(CHANNELS.AUTOPAY_EXPORT_PROGRESS, progress),
      });
      await writeCustomerExportWorkbook(response.filePath, rows);
      const found = rows.filter((row) => Boolean(row.WalletGuid)).length;
      const failed = rows.filter((row) =>
        row.WalletSource === "Lookup Failed",
      ).length;
      return {
        failed,
        fileName: path.basename(response.filePath),
        found,
        missing: rows.length - found - failed,
        total: rows.length,
      };
    } catch (error) {
      return { error: `Could not export the selected customers: ${error.message}` };
    }
  });

  ipcMain.handle(CHANNELS.AUTOPAY_START_BULK, (_event, request) =>
    bulkManager.start(request),
  );
  ipcMain.handle(CHANNELS.AUTOPAY_GET_PROGRESS, () =>
    bulkManager.getSnapshot(),
  );
  ipcMain.handle(CHANNELS.AUTOPAY_CLEAR_RESULTS, () =>
    bulkManager.clearResults(),
  );
  ipcMain.on(CHANNELS.AUTOPAY_CANCEL_BULK, () => bulkManager.cancel());
  ipcMain.handle(CHANNELS.AUTOPAY_RESUME_BULK, () => bulkManager.resume());
  ipcMain.handle(CHANNELS.AUTOPAY_RETRY_BULK, () => bulkManager.retryFailed());
}

module.exports = { registerAutoPayHandlers };
