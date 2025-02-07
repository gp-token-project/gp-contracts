# GP（Gear Point）トークン概要

[![en](https://img.shields.io/badge/lang-en-red.svg)](./README.md)
[![jp](https://img.shields.io/badge/lang-jp-green.svg)](./README_jp.md)

GP トークンプロジェクトのコントラクトです。
本リポジトリは ERC1155 を元にしたトークン実装です。さらに ERC20 のふるまい、有効期限による自動償却、ホワイトリストによる転送制限を搭載しています。
なお、自動償却つきトークンのコントラクトは HardHat を使って開発しています。

## 特徴

- ERC20 のようなインターフェースの ERC1155
- トークンに有効期限を設定可能
- ロールベースのアクセス制御（Mint、Transfer）が可能
- ERC1155 と ERC20 の両方に互換性がある

# API 概要

コントラクトをコンパイルし、フロントエンドのインテグレーション用 ABI を取得する方法は以下を参照してください。

## コンセプト

- GP トークンは有効期限付きトークンのインスタンスです。
- GP トークンには発行上限がありません
- GP トークンは minter role が付与されたサービスアカウントによって発行されます。
  - 基本的なユースケースとしては、別の（非 EVM 互換）チェーンで発行された NFT のイベントによってトリガーすることが想定されています。
- GP トークン保有者はトークンの転送を自由に行うことができません。
  - 転送を許可するには宛先のアカウントに OPERATOR role の付与が必要です。
- 通常のアカウントをホワイトリストに登録することは可能ですが、GP を自分のサービスで使う一番簡単な方法は、このリポジトリ内にある別のコントラクト（TokenReceiver）を利用することです。
- Token Receiver コントラクトは GP トークンを受信したときに特定のイベントを発行します。
- Web2 プロジェクト向け
  - ユーザーがサービスに GP を送信した際に任意のコード実行をトリガーする最も簡単な方法となります。
- Web3 プロジェクト向け
  - 独自のレシーバーコントラクトを構築するか、Keeper ネットワーク（例：Chainlink Keeper）と組み合わせてコントラクト同士の連携をするために、サービス用にデプロイした既存のインスタンスを使用することができます。

## 便利な機能

- `balanceOf(address)` (ERC20-style)
  - address が保有する有効なトークンの量が返却されます。
- `transfer(address to, uint256 amount)` もしくは `safeTransferFrom(address from, address to,uint256 amount, bytes data)` (ERC20-style)
  - 最も古い有効な GP から順番に転送します。
- Token Receiver コントラクトにトークンが送信された際の通知を受け取るには、`TokensReceived`イベントを監視してください。
  - Token Receiver コントラクトは、SQEX が発行した GP を受信した場合のみ、イベントが発行されるように設定されています。

## インスタンス

```
Polygon Mainnet instance: 0xc250E8753b4dE090BC19573CB97903a10D423B64
```

# コントラクト実装要件

## 前提

- Node.js (v20+ recommended)
- Hardhat

## コンパイル

Hardhat を使用してスマートコントラクトをコンパイルします：

```
npx hardhat compile

```

## テスト

テストケースを実行：

```
npx hardhat test

```

ガスレポートを取得するには、以下を実行してください：

```
REPORT_GAS=true npx hardhat test

```

## デプロイ

ローカルの Hardhat ネットワークにコントラクトをデプロイする手順：

1. Start a local node:

   ```
   npx hardhat node

   ```

2. Deploy the contract:

   ```
   npx hardhat run scripts/deploy.js --network localhost

   ```

## 検証

```
# For the implementation
npx hardhat verify --network sandverse 0x66aA7745ed8133BaD2b2aE20dcdEFf8b9f50F687
# For the proxy
npx hardhat verify --network sandverse 0xa9C4DA65419cD08871544989ce342dC87eFbeA41 AutoExpTkn EXP <https://myapi.com/metadata/\\{id\\}.json> 180
# For the token receiver factory
npx hardhat verify --network sandverse 0x91A2D4D6a29Ac0d76514A316239D26ff803C9C48

```

# まとめ

`ExpiringToken`コントラクトの主な機能は以下の通り

- 自動的に有効期限が設定される新規トークンの発行
- 異なる「トークンクラス（＝発行日時）」間でのトークン残高の計測
- 有効なトークンのみを転送
- 有効なトークンと進行したトークンの残高の照会

# コントリビュート

私たちはコントリビューションを歓迎しています！プルリクエストはいつでも送付してください。

# ライセンス

このプロジェクトは Apache License, Version 2.0 の下で提供されています。
