/**
 * Electron packaging configuration.
 * Controls platform installers, bundled-file rules, native dependency handling,
 * and production security fuses. Application behavior does not belong here.
 */
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");

module.exports = {
  // Files and archive settings shared by every platform package.
  packagerConfig: {
    asar: true,
    ignore: [/\/[^/]+ 2\.[^/]+$/],
  },
  rebuildConfig: {},
  // Platform-specific installer formats and metadata.
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "PFRRecordTool",
        authors: "Kyle Woo",
        description:
          "This app is used to manage and modify records of a PayFabric Receivables Portal created by the Nodus Technologies division of Global Payments.",
        setupIcon: "./public/Windows.ico",
        iconURL:
          "https://raw.githubusercontent.com/kwoo99/PFR-Record-Tool/main/PFRRecordTool/public/Windows.ico",
        setupExe: "PFRRecordTool.exe",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  // Packaging-time native-module handling and Electron hardening.
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
