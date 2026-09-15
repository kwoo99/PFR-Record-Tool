/**
 * Electron packaging configuration.
 * Controls platform installers, bundled-file rules, native dependency handling,
 * and production security fuses. Application behavior does not belong here.
 */
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const path = require("path");

const appIcon = path.join(__dirname, "public", "Windows");
const windowsIcon = `${appIcon}.ico`;
const macSigningEnabled = process.env.PFR_MACOS_SIGN === "true";
const macNotarizationReady =
  macSigningEnabled &&
  process.env.APPLE_ID &&
  process.env.APPLE_ID_PASSWORD &&
  process.env.APPLE_TEAM_ID;

const windowsSigningConfig =
  process.env.PFR_WINDOWS_CERTIFICATE_FILE &&
  process.env.PFR_WINDOWS_CERTIFICATE_PASSWORD
    ? {
        certificateFile: process.env.PFR_WINDOWS_CERTIFICATE_FILE,
        certificatePassword: process.env.PFR_WINDOWS_CERTIFICATE_PASSWORD,
        description: "PFR Record Tool",
        timestampServer: "http://timestamp.digicert.com",
      }
    : null;

module.exports = {
  // Files and archive settings shared by every platform package.
  packagerConfig: {
    asar: true,
    appBundleId: "com.kwoo99.pfrrecordtool",
    appCategoryType: "public.app-category.business",
    icon: appIcon,
    ignore: [/\/[^/]+ 2\.[^/]+$/],
    // Sign the packaged EXE and bundled native executables before making an archive.
    ...(windowsSigningConfig ? { windowsSign: windowsSigningConfig } : {}),
    ...(macSigningEnabled ? { osxSign: {} } : {}),
    ...(macNotarizationReady
      ? {
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          },
        }
      : {}),
  },
  rebuildConfig: {},
  // Platform-specific installer formats and metadata.
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "PFRRecordTool",
        authors: "Kyle Woo",
        description:
          "This app is used to manage and modify records of a PayFabric Receivables Portal created by the Nodus Technologies division of Global Payments.",
        setupIcon: windowsIcon,
        iconUrl:
          "https://raw.githubusercontent.com/kwoo99/PFR-Record-Tool/main/PFRRecordTool/public/Windows.ico",
        // Keep the original Squirrel installer filename for a controlled comparison.
        setupExe: "PFRRecordTool.exe",
        // Squirrel separately signs the installer and update package.
        ...(windowsSigningConfig ? { windowsSign: windowsSigningConfig } : {}),
      },
    },
    {
      name: "@electron-forge/maker-zip",
      // ZIP also provides a portable Windows build that can be created on macOS.
      platforms: ["darwin", "win32"],
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
