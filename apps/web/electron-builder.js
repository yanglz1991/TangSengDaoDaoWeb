module.exports = {
  productName: "QX", //项目名
  appId: "com.im.qx",
  copyright: "Copyright © QX", //版权
  directories: {
    output: "dist-ele", // 输出文件夹
  },
  npmRebuild: false,
  asar: true,
  compression: "normal",
  asarUnpack: [
    "node_modules/node-screenshots-darwin-x64/**/*",
    "node_modules/node-screenshots-darwin-arm64/**/*",
    "node_modules/electron-screenshots/**/*",
    "**/*.node"
  ],
  buildDependenciesFromSource: true,
  electronDownload: {
    mirror: "https://registry.npmmirror.com/-/binary/electron/",
  },
  // Electron Fuses —— 写入 Electron 二进制的运行时开关
  //
  // embeddedAsarIntegrityValidation 默认开启会让 Electron 启动 renderer 前校验
  // app.asar 的 SHA-256 与 exe 内置哈希是否一致，一旦客户机器上 AV / EDR / 系统优化
  // 工具对 asar 做过任何修改（即便只动了一个 .node 文件），哈希失配 → renderer
  // launch-failed, exitCode: 18，主进程随即退出，表现为"窗口闪一下白屏后消失"。
  // 关闭后渲染进程不再做完整性校验，能容忍 asar 被三方安全软件改动。
  electronFuses: {
    enableEmbeddedAsarIntegrityValidation: false,
    onlyLoadAppFromAsar: false,
  },
  files: ["resources/**/*", "out-election/**/*", "build/**/*"], // 需要打包的文件
  extraMetadata: {
    main: "out-election/main/index.js",
  },
  publish: [{
    provider: "generic",
    url: "https://qx.qhfhasina.com/api/v1/common/pcupdater/"
  }],
  mac: {
    extendInfo: {
      NSMicrophoneUsageDescription: "授权访问麦克风",
      NSCameraUsageDescription: "授权访问摄像头",
    },
    hardenedRuntime: true,
    entitlements: "resources/mac/entitlements.mac.plist",
    entitlementsInherit: "resources/mac/entitlements.mac.plist",
    category: "public.app-category.instant-messaging",
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      },
    ],
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}-${arch}.${ext}',
    icon: "resources/icons/icon.icns",
  },
  dmg: {
    // background: 'build/appdmg.png', // dmg安装窗口背景图
    icon: "resources/icons/icon.icns", // 客户端图标
    iconSize: 100, // 安装图标大小
    // 安装窗口中包含的项目和配置
    contents: [
      { x: 380, y: 280, type: "link", path: "/Applications" },
      { x: 110, y: 280, type: "file" },
    ],
    window: { width: 500, height: 500 }, // 安装窗口大小
  },
  win: {
    icon: "resources/icons/icon.ico",
    verifyUpdateCodeSignature: false,
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "zip", arch: ["x64"] }
    ],
    requestedExecutionLevel: "requireAdministrator",
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: "${productName}-Setup-${version}.${ext}"
  },
  nsis: {
    oneClick: false, // 是否一键安装
    perMachine: true, // 全机安装到 Program Files，而非 AppData，降低 Win10 Defender 隔离概率
    differentialPackage: false, // 关闭差分包 blockmap，降低启发式误报命中率
    allowElevation: true, // 允许请求提升。 如果为false，则用户必须使用提升的权限重新启动安装程序。
    allowToChangeInstallationDirectory: true, // 允许修改安装目录
    // installerIcon: "./build/icon.ico",// 安装图标
    // uninstallerIcon: "./build/icons/bbb.ico",//卸载图标
    // installerHeaderIcon: "./build/icon.ico", // 安装时头部图标
    createDesktopShortcut: true, // 创建桌面图标
    createStartMenuShortcut: true, // 创建开始菜单图标
    shortcutName: "QX", // 图标名称
  },
  linux: {
    target: ["AppImage", "deb"],
    icon: "resources/icons/icon.icns",
  },
};
