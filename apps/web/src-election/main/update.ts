import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import logger from "electron-log";
import path from "path";
import TSDD_FONFIG from "./confing";
const feedUrl = `${TSDD_FONFIG.updataUrl}v1/common/pcupdater/`;

let mainWindow: BrowserWindow;
// 封装更新相关的进程通信方法
const sendUpdateMessage = (opt: { cmd: string; data: any }) => {
  mainWindow.webContents.send(opt.cmd, opt.data);
};

function checkUpdate(win: BrowserWindow) {
  autoUpdater.logger = logger;
  autoUpdater.disableWebInstaller = false;
  // 用于本地调试
  if (!app.isPackaged) {
    Object.defineProperty(app, "isPackaged", {
      get: () => true,
    });
    autoUpdater.updateConfigPath = path.join(
      app.getAppPath(),
      "./resources/app-update.yml"
    );
    // autoUpdater.forceDevUpdateConfig = true;
  }

  mainWindow = win;
  // 关闭自动更新
  autoUpdater.autoDownload = false;
  autoUpdater.setFeedURL(feedUrl);

  // 监听升级失败事件
  autoUpdater.on("error", (error) => {
    logger.info(error);
    sendUpdateMessage({
      cmd: "update-error",
      data: error,
    });
  });

  // 监听发现可用更新事件
  autoUpdater.on("update-available", (message) => {
    logger.info('检查到有更新');
    logger.info(message);
    // 显式提取 isForce —— electron-updater 解析 yml 时会保留服务端响应里的自定义字段，
    // 但 IPC structured clone 偶发会丢非标准字段，这里显式合并到一份纯 object 透传给 renderer。
    const isForce = Number((message as any)?.isForce || 0);
    sendUpdateMessage({
      cmd: "update-available",
      data: {
        version: (message as any)?.version,
        releaseNotes: (message as any)?.releaseNotes,
        releaseName: (message as any)?.releaseName,
        releaseDate: (message as any)?.releaseDate,
        isForce,
      },
    });
  });

  // 监听没有可用更新事件
  autoUpdater.on("update-not-available", (message) => {
    sendUpdateMessage({
      cmd: "update-not-available",
      data: message,
    });
  });

  // 更新下载进度事件
  autoUpdater.on("download-progress", (progress) => {
    logger.info(progress);
    // 计算下载百分比
    const downloadPercent = parseInt(`${progress.percent}`);
    sendUpdateMessage({
      cmd: "download-progress",
      data: downloadPercent,
    });
  });

  // 监听下载完成事件
  autoUpdater.on("update-downloaded", (releaseObj) => {
    logger.info('下载完毕！提示安装更新');
    sendUpdateMessage({
      cmd: "update-downloaded",
      data: releaseObj,
    });
  });

  // 接收渲染进程消息，开始检查更新
  ipcMain.on("check-update", () => {
    //执行自动更新检查
    logger.info("开始检查更新");
    autoUpdater.checkForUpdates();
  });

  // 触发更新
  ipcMain.on("update-app", () => {
    autoUpdater.downloadUpdate();
  });
  // 退出并安装更新包
  // quitAndInstall(isSilent, isForceRunAfter)
  //   - isSilent=true：Win NSIS 安装包静默执行（不弹安装向导界面），强制更新场景下用户无法中断
  //   - isForceRunAfter=true：安装结束后强制启动新版本，避免某些 NSIS 配置下不自动启动
  // 兜底：1.5s 内若 quitAndInstall 未触发进程退出（极个别签名/权限/AV 拦截场景），强制 app.exit(0)
  ipcMain.on("install-update", () => {
    logger.info('[install-update] quitAndInstall(true, true)');
    try {
      autoUpdater.quitAndInstall(true, true);
    } catch (err) {
      logger.error('[install-update] quitAndInstall threw', err);
    }
    setTimeout(() => {
      logger.warn('[install-update] fallback app.exit(0) after 1500ms');
      try {
        app.exit(0);
      } catch (e) {
        logger.error('[install-update] app.exit failed', e);
      }
    }, 1500);
  });
}

export default checkUpdate;
