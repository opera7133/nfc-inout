/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.sook.nfcinout',
  productName: 'nfcinout',
  copyright: 'Copyright © 2023 ${author}',
  asar: true,
  directories: {
    output: 'release/${version}',
    buildResources: 'resources',
  },
  files: [
    '!.git',
    '!.dist',
    'node_modules',
    'src',
    'main.js',
    '.env',
    'package-lock.json',
    'package.json',
  ],
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64'],
      },
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'src/assets/img/icon.png',
    artifactName: '${productName}_setup.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
    uninstallDisplayName: 'NFC入退室管理システム',
  },
  portable: {
    artifactName: '${productName}_portable.${ext}',
  },
  linux: {
    icon: 'src/assets/img/nfc-inout.icns',
    target: [{ target: 'appImage', arch: ['x64'] }],
  },
  appImage: {
    artifactName: '${productName}.${ext}',
    category: 'Utility',
    synopsis: 'nfc-inout ${version}',
  },
}
