import log from "electron-log/main";
import { app } from "electron";

// 初始化日志系统
// Windows 默认路径: %APPDATA%\QX\logs\main.log
// macOS 默认路径:  ~/Library/Logs/QX/main.log
log.initialize();
log.transports.file.level = "info";
log.transports.console.level = "info";
log.transports.file.maxSize = 10 * 1024 * 1024; // 单个日志文件 10MB

// 把 console.log / console.error 重定向到日志文件
Object.assign(console, log.functions);

log.info("========================================");
log.info(
  `[boot] QX ${app.getVersion()} starting`,
  "pid=", process.pid,
  "electron=", process.versions.electron,
  "chrome=", process.versions.chrome,
  "node=", process.versions.node,
  "platform=", process.platform,
  "arch=", process.arch,
  "osRelease=", process.getSystemVersion?.() ?? "unknown"
);
log.info(`[boot] logFile=${log.transports.file.getFile().path}`);

// 全局未捕获异常与 Promise rejection
process.on("uncaughtException", (err) => {
  log.error("[uncaughtException]", err?.stack || err);
});

process.on("unhandledRejection", (reason: any) => {
  log.error("[unhandledRejection]", reason?.stack || reason);
});

// Electron 进程级崩溃事件
app.on("render-process-gone", (_event, webContents, details) => {
  log.error("[render-process-gone]", {
    url: webContents?.getURL?.(),
    ...details,
  });
});

app.on("child-process-gone", (_event, details) => {
  log.error("[child-process-gone]", details);
});

app.on("gpu-info-update", () => {
  // no-op, 仅占位保证 GPU 模块初始化
});

// GPU 进程崩溃（Electron 28+ 推荐用 child-process-gone，此处为兼容保留）
// @ts-ignore - 旧 API 兜底
app.on("gpu-process-crashed", (_event: any, killed: boolean) => {
  log.error("[gpu-process-crashed] killed=", killed);
});

export default log;
