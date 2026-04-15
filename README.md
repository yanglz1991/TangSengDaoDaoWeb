# QX PC 端

## 简介

QX PC 端支持 Web 端、Mac 端、Windows 端、Linux 端，是一款高颜值 IM 即时通讯聊天软件，让企业轻松拥有自己的即时通讯软件。由[悟空 IM](https://githubim.com/)提供动力。

## Web 版本运行

> [!TIP]
> 本地开发建议`node v22.12.0`、 `yarn 1.22.19`

1. 安装依赖

```shell
yarn install 或者 yarn bootstrap
```

2. 本地开发调试

```shell
yarn dev
```

3. 编译

```shell
yarn build
```

4.  发布镜像

> [!TIP]
> 修改 api 地址 packages/tsdaodaoweb/src/index.tsx 修改 WKApp.apiClient.config.apiURL = "/api/v1/"

```shell
make deploy
```

5. 清除缓存

```sh
yarn clean
```

## Electron 版本运行

支持打包 Mac、Windows、Linux 操作系统桌面应用。

1. 安装依赖

```shell
yarn install
```

2. 本地开发调试

```shell
yarn dev-ele
```

3. 编译

```shell
yarn build
```

4. Mac APP 打包

> [!TIP]
> 注意先运行`yarn build`编译

```shell
yarn build-ele:mac
```

5. Windows APP 打包

> [!TIP]
> 注意先运行`yarn build`编译

```shell
yarn build-ele:win
```

`注意，此命令需要在apps/web下执行`

5. Linux APP 打包

> [!TIP]
> 注意先运行`yarn build`编译

```shell
yarn build-ele:linux
```
