// QQ 式独立多开 —— 进程级槽位分配
//
// 必须在 ./logger（即 electron-log）import 之前执行，因为 electron-log 在
// initialize() 时会缓存 app.getPath('userData') 的结果。如果在缓存之后才
// 切换 userData，日志会写到默认槽位的目录而不是当前实例的目录，导致
// "路径分裂"（与之前 productName/name 踩坑同理）。
//
// 槽位策略：
//   slot 0 → 默认 userData（如 %APPDATA%\QX）
//   slot N → `${userData}-${N+1}` 兄弟目录
//
// 启动时依次尝试每个槽位的 requestSingleInstanceLock，第一个成功占用的
// 槽位即为本实例的数据目录。这样：
//   - 多个实例同时存在时，互相占用不同槽位，userData 互不冲突
//   - 单个槽位关闭后再次启动，会被新实例复用，登录态/会话得以持久化
//   - 同一个 productName/AUMID 仍保持，Win 任务栏会把多实例图标分组在一起

import { app } from "electron";
import path from "path";
import fs from "fs";

const MAX_INSTANCES = 40;

const baseUserData = app.getPath("userData");
const baseDirName = path.basename(baseUserData);
const parentDir = path.dirname(baseUserData);

let allocatedSlot = -1;

for (let slot = 0; slot < MAX_INSTANCES; slot++) {
  const dir =
    slot === 0 ? baseUserData : path.join(parentDir, `${baseDirName}-${slot + 1}`);

  if (slot !== 0) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // 目录创建失败就跳过当前槽位
      continue;
    }
    app.setPath("userData", dir);
  }

  if (app.requestSingleInstanceLock()) {
    allocatedSlot = slot;
    break;
  }
}

if (allocatedSlot < 0) {
  // 已达到最大实例数，静默退出，不让用户陷入"双击没反应"的困惑也不至于无限开
  // 注意此时 logger 还没初始化，只能用原生 console
  console.warn(
    `[multi-instance] reached max instances (${MAX_INSTANCES}), exiting`
  );
  app.exit(0);
  // 兜底：app.exit 在 ready 之前不一定立刻终止
  process.exit(0);
}

export const instanceSlot = allocatedSlot;
export const instanceUserDataDir = app.getPath("userData");

// 给后续 logger / 业务代码暴露当前槽位，方便日志区分
console.info(
  `[multi-instance] slot=${instanceSlot} userData=${instanceUserDataDir}`
);
