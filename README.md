# nfc-inout

FelicaとElectronで入退室管理

## ビルド

### 1. パッケージのインストール

`npm i`を実行してパッケージをインストールします。

また、`pip3 install nfcpy`（Windowsの場合はpip）でnfcpyをインストールします。

> [!NOTE]
> RC-S300を利用している場合、nfcpyではなくpyscardを使用します。
> インストール方法は[こちら](https://github.com/LudovicRousseau/pyscard/blob/master/INSTALL.md)
>
> また、起動時に設定からRC-S300を有効化してください。

### 2. 効果音の用意

効果音を `src` フォルダに `success.mp3` と `error.mp3` という名前で保存します。

`node scripts/download-effects`を実行するとサンプルの効果音が保存されます。

### 3. .envを設定

`.env.sample`を参考に`.env`を設定します。

### 4. ビルド

windows向けにビルドする場合は`npm run build:win`、linux向けは`npm run build:linux`を実行します。

## License

[MIT License](https://github.com/opera7133/nfc-inout/blob/main/LICENSE)
