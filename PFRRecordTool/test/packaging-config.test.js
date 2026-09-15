const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const forgeConfig = require("../forge.config.js");
const packageJson = require("../package.json");

test("desktop packages use stable product metadata and platform icons", () => {
  assert.equal(packageJson.productName, "PFR Record Tool");
  assert.equal(forgeConfig.packagerConfig.appBundleId, "com.kwoo99.pfrrecordtool");
  assert.equal(
    forgeConfig.packagerConfig.appCategoryType,
    "public.app-category.business",
  );

  assert.ok(fs.existsSync(`${forgeConfig.packagerConfig.icon}.icns`));
  assert.ok(fs.existsSync(`${forgeConfig.packagerConfig.icon}.ico`));
});

test("Forge creates a Windows installer and macOS ZIP releases", () => {
  const squirrelMaker = forgeConfig.makers.find(
    (maker) => maker.name === "@electron-forge/maker-squirrel",
  );
  const zipMaker = forgeConfig.makers.find(
    (maker) => maker.name === "@electron-forge/maker-zip",
  );

  assert.deepEqual(squirrelMaker.platforms, ["win32"]);
  assert.equal(squirrelMaker.config.setupExe, "PFRRecordTool.exe");
  assert.match(squirrelMaker.config.iconUrl, /^https:\/\//);
  assert.deepEqual(zipMaker.platforms, ["darwin", "win32"]);
  assert.match(packageJson.scripts["make:windows"], /--platform=win32/);
  assert.match(
    packageJson.scripts["make:windows:portable"],
    /@electron-forge\/maker-zip/,
  );
  assert.match(packageJson.scripts["make:windows:signed"], /Build-SignedWindows/);
  assert.match(packageJson.scripts["make:mac"], /--platform=darwin/);
});

test("internal signing helpers exist without storing private keys", () => {
  const scriptsDirectory = path.join(__dirname, "../scripts/windows");

  assert.ok(
    fs.existsSync(
      path.join(scriptsDirectory, "New-InternalCodeSigningCertificate.ps1"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(scriptsDirectory, "Install-InternalPublisherCertificate.ps1"),
    ),
  );
  assert.ok(
    fs.existsSync(path.join(scriptsDirectory, "Build-SignedWindows.ps1")),
  );

  const rootGitignore = fs.readFileSync(
    path.join(__dirname, "../../.gitignore"),
    "utf8",
  );
  assert.match(rootGitignore, /PFRRecordTool\/certificates\//);
});

test("desktop workflow builds every supported desktop architecture", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "../../.github/workflows/build.yml"),
    "utf8",
  );

  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-15-intel/);
  assert.match(workflow, /arch: arm64/);
  assert.match(workflow, /arch: x64/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
