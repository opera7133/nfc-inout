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
    ],
    artifactName: '${productName}.${ext}',
  },
  linux: {
    icon: 'src/assets/images/logo.icns',
    target: [{ target: 'appImage', arch: ['x64'] }],
  },
  appImage: {
    artifactName: '${productName}.${ext}',
    category: 'Utility',
    synopsis: 'nfc-inout ${version}',
  },
}
