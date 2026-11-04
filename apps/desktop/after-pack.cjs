const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Linux cross-builds cannot use Apple's codesign. Replace the Electron bundle's
// invalidated signatures with ad-hoc signatures after renaming its bundle and
// Info.plist. Developer ID signing/notarization is a separate macOS release step.
module.exports = async context => {
  if (context.electronPlatformName !== 'darwin' || process.platform === 'darwin') return;
  const signer = process.env.RCODESIGN;
  if (!signer) throw new Error('Cross-building macOS requires RCODESIGN pointing to the official apple-codesign executable.');
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync(signer, ['sign', '--entitlements-xml-file', `main:${path.join(__dirname, 'mac-entitlements.plist')}`, app], { stdio: 'inherit' });
};
