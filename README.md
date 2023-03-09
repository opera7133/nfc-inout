# nfc-inout

FelicaとElectronで入退室管理

## ビルド

### 1. 効果音の用意

効果音を `src` フォルダに `success.mp3` と `error.mp3` という名前で保存します。

### 2. .envを設定

`.env.sample`を参考に`.env`を設定します。

### 3. パッケージのインストール

`npm i`を実行してパッケージをインストールします。

### 4. ビルド

ビルド前に必ず`electron-rebuild`を実行してください！

```bash
# Windowsの場合
./node_modules/.bin/electron-rebuild.cmd
# Linuxの場合
./node_modules/.bin/electron-rebuild
```

windows向けにビルドする場合は`npm run build:win`、linux向けは`npm run build:linux`を実行します。

## License

[MIT License](https://github.com/opera7133/nfc-inout/blob/main/LICENSE)
