import mitt from "mitt";
import { EndpointCommon } from "./EndpointCommon";
import APIClient from "./Service/APIClient";
import MenusManager from "./Service/Menus";
import { EndpointManager, IModule, ModuleManager } from "./Service/Module";
import { ProviderListener } from "./Service/Provider";
import RouteManager, { ContextRouteManager } from "./Service/Route";
import {
  Channel,
  ChannelTypeGroup,
  ChannelTypePerson,
  WKSDK,
  Message,
  MessageContentType,
} from "wukongimjssdk";
import { IConversationProvider } from "./Service/DataSource/DataProvider";
import MessageManager from "./Service/MessageManager";
import { DefaultEmojiService, EmojiService } from "./Service/EmojiService";
import SectionManager, { Row, Section } from "./Service/Section";
import { EndpointCategory } from "./Service/Const";
import { DataSource } from "./Service/DataSource/DataSource";
import { ConnectAddrCallback } from "wukongimjssdk";

import "animate.css";
import "./App.css";
import RouteContext from "./Service/Context";
import { ConnectStatus } from "wukongimjssdk";
import { WKBaseContext } from "./Components/WKBase";
import StorageService from "./Service/StorageService";
import { ProhibitwordsService } from "./Service/ProhibitwordsService";

export enum ThemeMode {
  light,
  dark,
}
export class WKConfig {
  appName: string = "QX";
  appVersion: string = "0.0.0"; // app版本
  themeColor: string = "#E46342"; // 主题颜色
  secondColor: string = "rgba(232, 234, 237)";
  pageSize: number = 15; // 数据页大小
  pageSizeOfMessage: number = 30; // 每次请求消息数量
  fileHelperUID: string = "fileHelper"; // 文件助手UID
  systemUID: string = "u_10000"; // 系统uid

  private _themeMode: ThemeMode = ThemeMode.light; // 主题模式

  set themeMode(v: ThemeMode) {
    this._themeMode = v;
    const body = document.body;
    if (v === ThemeMode.dark) {
      if (body.hasAttribute("theme-mode")) {
        body.removeAttribute("theme-mode");
        body.setAttribute("theme-mode", "dark");
      } else {
        body.setAttribute("theme-mode", "dark");
      }
    } else {
      body.removeAttribute("theme-mode");
    }
    StorageService.shared.setItem("theme-mode", `${v}`);
    WKApp.shared.notifyListener();
  }

  get themeMode() {
    return this._themeMode;
  }
}

export class WKRemoteConfig {
  revokeSecond: number = 2 * 60; // 撤回时间
  requestSuccess: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5; // 最大重试次数

  // 全局禁言（管理后台「禁言设置」）
  disableGroupMessageOn: boolean = false; // 群聊禁言开关（含群发消息/建群/加群成员/加好友）
  disablePrivateMessageOn: boolean = false; // 私聊禁言开关
  muteTextOfGroup: string = ""; // 群聊禁言客户端展示文案
  muteTextOfPrivate: string = ""; // 私聊禁言客户端展示文案

  // 周期性同步远程配置（兜底：当 IM CMD 因网络抖动丢失时仍能恢复）
  // 实时同步主路径：管理后台保存配置后，Server 会通过 appconfigUpdate CMD 推送给所有用户
  private pollIntervalMs: number = 5 * 60 * 1000; // 5 分钟兜底拉一次
  private pollTimer?: any;
  private visibilityListenerBound: boolean = false;

  async startRequestConfig() {
    await this.requestConfig();

    if (!this.requestSuccess && this.retryCount < this.maxRetries) {
      this.retryCount++;
      // 指数退避: 3s, 6s, 12s, 24s, 48s
      const delay = 3000 * Math.pow(2, this.retryCount - 1);
      setTimeout(() => {
        this.startRequestConfig();
      }, delay);
      return;
    }

    // 首次成功后启动周期同步与可见性回调
    if (this.requestSuccess) {
      this.startPolling();
      this.bindVisibilityListenerIfNeed();
    }
  }

  // 周期同步：每 pollIntervalMs 调一次 requestConfig，覆盖管理后台配置变更
  private startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      // 页面隐藏时不发请求，避免无意义流量；可见时再轮询
      if (typeof document !== "undefined" && document.hidden) return;
      this.requestConfig().catch(() => {});
    }, this.pollIntervalMs);
  }

  // 页面从隐藏切回可见时立即拉一次配置
  private bindVisibilityListenerIfNeed() {
    if (this.visibilityListenerBound) return;
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.requestConfig().catch(() => {});
      }
    });
    this.visibilityListenerBound = true;
  }

  requestConfig() {
    return WKApp.apiClient.get("common/appconfig").then((result) => {
      this.requestSuccess = true;
      this.revokeSecond = result["revoke_second"];
      this.disableGroupMessageOn = result["disable_group_message_on"] === 1;
      this.disablePrivateMessageOn = result["disable_private_message_on"] === 1;
      this.muteTextOfGroup = result["mute_text_of_group"] || "";
      this.muteTextOfPrivate = result["mute_text_of_private"] || "";
    });
  }
}

export type MessageDeleteListener = (
  message: Message,
  preMessage?: Message
) => void;

export class LoginInfo {
  appID!: string;
  shortNo!: string; // 短号
  shortStatus!: number; // 短号是否已修改 0.未修改 1.已修改
  token?: string;
  uid?: string;
  name: string | undefined;
  role!: string;
  isWork!: boolean;
  sex!: number;

  /**
   * save 保存登录信息
   */
  public save() {
    this.setStorageItemForSID("app_id", this.appID ?? "");
    this.setStorageItemForSID("short_no", this.shortNo ?? "");
    this.setStorageItemForSID("short_status", `${this.shortStatus ?? 0}`);
    this.setStorageItemForSID("uid", this.uid ?? "");
    this.setStorageItemForSID("token", this.token ?? "");
    this.setStorageItemForSID("name", this.name ?? "");
    this.setStorageItemForSID("role", this.role ?? "");
    this.setStorageItemForSID("is_work", this.isWork ? "1" : "0");
    this.setStorageItemForSID("sex", this.sex == 1 ? "1" : "0");
  }

  // 获取查询参数
  public getQueryVariable(variable: string) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] === variable) {
        return pair[1];
      }
    }
    return false;
  }

  public setStorageItemForSID(key: string, value: string) {
    let sid = this.getSID();

    this.setStorageItem(key + sid, value);
  }

  public getStorageItemForSID(key: string): string | null {
    let sid = this.getSID();
    return this.getStorageItem(key + sid);
  }

  public removeStorageItemForSID(key: string) {
    let sid = this.getSID();
    this.removeStorageItem(key + sid);
  }

  public getSID(): string {
    let sid = this.getQueryVariable("sid") || "";
    return sid;
  }

  public setStorageItem(key: string, value: string) {
    StorageService.shared.setItem(key, value);
  }
  public getStorageItem(key: string): string | null {
    return StorageService.shared.getItem(key);
  }
  public removeStorageItem(key: string) {
    StorageService.shared.removeItem(key);
  }

  /**
   * load 加载登录信息
   */
  public load() {
    this.uid = this.getStorageItemForSID("uid") || "";
    this.shortNo = this.getStorageItemForSID("short_no") || "";
    const shortStatusStr = this.getStorageItemForSID("short_status");
    this.shortStatus = shortStatusStr ? parseInt(shortStatusStr) : 0;
    this.token = this.getStorageItemForSID("token") || "";
    this.name = this.getStorageItemForSID("name") || "";
    this.appID = this.getStorageItemForSID("app_id") || "";
    this.role = this.getStorageItemForSID("role") || "";
    const isWorkStr = this.getStorageItemForSID("is_work");
    if (isWorkStr === "1") {
      this.isWork = true;
    } else {
      this.isWork = false;
    }

    const sexStr = this.getStorageItemForSID("sex");
    if (sexStr === "1") {
      this.sex = 1;
    } else {
      this.sex = 0;
    }
  }
  // 是否登录
  isLogined() {
    if (!this.token || this.token === "") {
      return false;
    }
    return true;
  }
  logout() {
    this.token = undefined;
    this.appID = "";
    this.role = "";
    this.removeStorageItemForSID("token");
    this.removeStorageItemForSID("app_id");
    this.removeStorageItemForSID("role");
    this.removeStorageItemForSID("is_work");
  }
}

export default class WKApp extends ProviderListener {
  private constructor() {
    super();
  }
  public static shared = new WKApp();
  static route = RouteManager.shared; // 路由管理
  static routeLeft = new ContextRouteManager(); // 左边页面路由
  static routeRight = new ContextRouteManager(); // 右边（main）页面路由
  static menus = MenusManager.shared; // 菜单
  static apiClient = APIClient.shared; // api客户端
  static config: WKConfig = new WKConfig(); // app配置
  static remoteConfig: WKRemoteConfig = new WKRemoteConfig(); // 远程配置
  static loginInfo: LoginInfo = new LoginInfo(); // 登录信息
  static endpoints: EndpointCommon = new EndpointCommon(); // 常用端点
  static conversationProvider: IConversationProvider; // 最近会话相关数据源
  static messageManager: MessageManager = new MessageManager(); // 消息管理
  static emojiService: EmojiService = DefaultEmojiService.shared; // emoji
  static sectionManager: SectionManager = new SectionManager(); // section管理
  static dataSource: DataSource = new DataSource(); // 数据源
  static endpointManager: EndpointManager = EndpointManager.shared; // 端点管理
  static mittBus = mitt();
  private messageDeleteListeners: MessageDeleteListener[] =
    new Array<MessageDeleteListener>(); // 消息删除监听

  supportFavorites = [MessageContentType.text, MessageContentType.image]; // 注册收藏的消息
  supportEdit = [MessageContentType.text]; // 注册编辑的消息
  notSupportForward: number[] = []; // 不支持转发的消息

  openChannel?: Channel; // 当前打开的会话频道
  content?: JSX.Element;

  baseContext!: WKBaseContext; // QX基础上下文

  private _notificationIsClose: boolean = false; // 通知是否关闭

  private wsaddrs = new Array<string>(); // ws的连接地址
  private addrUsed = false; // 地址是否被使用

  isPC = false; // 是否是PC端
  deviceId: string = ""; // 设备ID
  deviceName: string = ""; // 设备名称
  deviceModel: string = ""; // 设备型号

  set notificationIsClose(v: boolean) {
    this._notificationIsClose = v;
    StorageService.shared.setItem("NotificationIsClose", v ? "1" : "");
  }

  get notificationIsClose() {
    return this._notificationIsClose;
  }

  // app启动
  startup() {
    WKApp.loginInfo.load(); // 加载登录信息

    // 是否是PC端
    if ((window as any)?.__POWERED_ELECTRON__ || (window as any).__TAURI_IPC__) {
      this.isPC = true;
      console.log("PC端")
    }
    this.deviceId = this.getDeviceIdFromStorage();
    this.deviceName = this.getOSAndVersion();
    this.deviceModel = this.getBrandsFromUserAgent();

    console.log("设备信息--->", this.deviceId, this.deviceName, this.deviceModel);

    const themeMode = StorageService.shared.getItem("theme-mode");
    if (themeMode === "1") {
      WKApp.config.themeMode = ThemeMode.dark;
    }

    WKSDK.shared().config.provider.connectAddrCallback = async (
      callback: ConnectAddrCallback
    ) => {
      if (!this.wsaddrs || this.wsaddrs.length == 0) {
        this.wsaddrs = await WKApp.dataSource.commonDataSource.imConnectAddrs();
      }
      if (this.wsaddrs.length > 0) {
        this.addrUsed = true;
        callback(this.wsaddrs[0]);
      }
    };

    WKApp.endpoints.addOnLogin(() => {
      this.startMain();
    });

    if (WKApp.loginInfo.isLogined()) {
      this.startMain();
    }

    WKSDK.shared().connectManager.addConnectStatusListener(
      (status: ConnectStatus, reasonCode?: number) => {
        if (status === ConnectStatus.ConnectKick) {
          console.log("被踢--->", reasonCode);
          WKApp.shared.logout();
        } else if (reasonCode == 2) {
          // 认证失败！
          WKApp.shared.logout();
        } else if (status === ConnectStatus.Disconnect) {
          if (this.addrUsed && this.wsaddrs.length > 1) {
            const oldwsAddr = this.wsaddrs[0];
            this.wsaddrs.splice(0, 1);
            this.wsaddrs.push(oldwsAddr);
            this.addrUsed = false;
            console.log("连接失败！切换地址->", this.wsaddrs);
          }
        }
      }
    );

    // 通知设置
    const notificationIsClose = StorageService.shared.getItem(
      "NotificationIsClose"
    );
    if (notificationIsClose === "1") {
      this._notificationIsClose = true;
    } else {
      this._notificationIsClose = false;
    }

    WKApp.remoteConfig.startRequestConfig();

    // 已登录态下，启动 + 标签页可见时兜底检查一次封禁状态。
    // 防止 forceLogout CMD 因浏览器关闭 / 后台被冻结未送达，导致客户端继续以已登录状态运行
    if (WKApp.loginInfo.isLogined()) {
      // 启动延迟 2s，等待 IM 连接和路由就绪，避免在登录跳转过程中弹窗
      setTimeout(() => this.checkBanStatusAndHandle(), 2000);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && WKApp.loginInfo.isLogined()) {
        this.checkBanStatusAndHandle();
      }
    });
  }

  /**
   * 主动检查当前登录态是否被管理后台封禁（uid / IP / device 任意维度命中即弹窗并退出）。
   * 与 forceLogout CMD 处理共用 window.__force_logout_triggered__ 去重标志，避免双弹窗。
   */
  async checkBanStatusAndHandle() {
    if (!WKApp.loginInfo.isLogined()) return;
    if ((window as any).__force_logout_triggered__) return;
    try {
      const result: any = await WKApp.apiClient.get("user/checkstatus", {
        param: { device_id: WKApp.shared.deviceId },
      });
      if (!result || !result.banned) return;
      if ((window as any).__force_logout_triggered__) return;
      (window as any).__force_logout_triggered__ = true;
      const reason: string = result.reason || "您的账号已被管理员封禁";
      try {
        // eslint-disable-next-line no-alert
        window.alert(reason);
      } catch (_) { }
      try {
        WKApp.shared.logout();
      } catch (_) {
        window.location.reload();
      }
    } catch (_) {
      // 失败静默：下一次切回前台还会再试，避免误打扰用户
    }
  }

  getDeviceIdFromStorage() {
    let deviceId = StorageService.shared.getItem("deviceId");
    if (!deviceId || deviceId === "") {
      deviceId = this.generateUUID();
      StorageService.shared.setItem("deviceId", deviceId);
    }
    return deviceId;
  }

  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (
      c
    ) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getOSAndVersion() {
    const userAgent: string = navigator.userAgent;
    if (/Windows NT (\d+\.\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Windows NT (\d+\.\d+)/i)?.[1];
      return `Windows ${version}`;
    } else if (/Mac OS X (\d+_\d+(_\d+)?)/i.test(userAgent)) {
      const version = userAgent.match(/Mac OS X (\d+_\d+(_\d+)?)/i)?.[1]?.replace(/_/g, ".");
      return `MacOS ${version}`;
    } else if (/Android (\d+(\.\d+)?)/i.test(userAgent)) {
      const version = userAgent.match(/Android (\d+(\.\d+)?)/i)?.[1];
      return `Android ${version}`;
    } else if (/CPU (iPhone )?OS (\d+_\d+(_\d+)?)/i.test(userAgent)) {
      const version = userAgent.match(/CPU (iPhone )?OS (\d+_\d+(_\d+)?)/i)?.[2]?.replace(/_/g, ".");
      return `iOS ${version}`;
    } else if (/Linux/i.test(userAgent)) {
      return "Linux (version not available)";
    } else {
      return "Unknown OS and version";
    }
  }

  getBrandsFromUserAgent(): string {
    const userAgent: string = navigator.userAgent;

    if (/Chrome\/(\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Chrome\/(\d+)/i)?.[1];
      return `Chrome ${version}`;
    } else if (/Firefox\/(\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Firefox\/(\d+)/i)?.[1];
      return `Firefox ${version}`;
    } else if (/Safari\/(\d+)/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
      const version = userAgent.match(/Version\/(\d+)/i)?.[1];
      return `Safari ${version}`;
    } else if (/Edge\/(\d+)/i.test(userAgent)) {
      const version = userAgent.match(/Edge\/(\d+)/i)?.[1];
      return `Edge ${version}`;
    } else {
      return "Unknown browser";
    }
  }

  startMain() {
    this.connectIM();
    WKApp.dataSource.contactsSync(); // 同步通讯录
    ProhibitwordsService.shared.sync(); // 同步敏感词

    WKApp.apiClient.get(`/user/devices/${WKApp.shared.deviceId}`).then((res) => {
      if (res.id) {
        WKSDK.shared().config.clientMsgDeviceId = res.id;
      }
    })
  }

  connectIM() {
    WKSDK.shared().config.uid = WKApp.loginInfo.uid;
    WKSDK.shared().config.token = WKApp.loginInfo.token;
    WKSDK.shared().connect();
  }

  registerModule(module: IModule) {
    ModuleManager.shared.register(module);
  }

  restContent(content: JSX.Element) {
    this.content = content;
    this.notifyListener();
  }



  // 是否登录
  isLogined() {
    return WKApp.loginInfo.isLogined();
  }
  // 登出
  logout() {
    WKApp.loginInfo.logout();
    window.location.reload();
  }

  avatarChannel(channel: Channel) {
    if (!channel) {
      return "";
    }
    let avatarTag = this.getChannelAvatarTag(channel);
    const channelInfo = WKSDK.shared().channelManager.getChannelInfo(channel);
    if (channelInfo && channelInfo.logo && channelInfo.logo !== "") {
      let logo = channelInfo.logo;
      if (logo.indexOf("?") != -1) {
        logo += "&v=" + avatarTag;
      } else {
        logo += "?v=" + avatarTag;
      }
      return WKApp.dataSource.commonDataSource.getImageURL(logo);
    }
    const baseURl = WKApp.apiClient.config.apiURL;
    if (channel.channelType === ChannelTypePerson) {
      return `${baseURl}users/${channel.channelID}/avatar?v=${avatarTag}`;
    } else if (channel.channelType == ChannelTypeGroup) {
      return `${baseURl}groups/${channel.channelID}/avatar?v=${avatarTag}`;
    }
    return "";
  }

  avatarUser(uid: string) {
    const c = new Channel(uid, ChannelTypePerson);
    return this.avatarChannel(c);
  }

  avatarOrg(orgID: string) {
    const baseURl = WKApp.apiClient.config.apiURL;
    return `${baseURl}organizations/${orgID}/logo`;
  }

  // 我的用户头像发送改变
  myUserAvatarChange() {
    this.changeChannelAvatarTag(new Channel(WKApp.loginInfo.uid || "", ChannelTypePerson));
  }

  changeChannelAvatarTag(channel: Channel) {
    let myAvatarTag = "channelAvatarTag";
    if (channel) {
      myAvatarTag = `channelAvatarTag:${channel.channelType}${channel.channelID}`;
    }
    const t = new Date().getTime();
    WKApp.loginInfo.setStorageItem(myAvatarTag, `${t}`);
  }
  getChannelAvatarTag(channel?: Channel) {
    let myAvatarTag = "channelAvatarTag";
    if (channel) {
      myAvatarTag = `channelAvatarTag:${channel.channelType}${channel.channelID}`;
    }
    const tag = WKApp.loginInfo.getStorageItem(myAvatarTag);
    if (!tag) {
      return "";
    }
    return tag;
  }

  avatarGroup(groupNo: string) {
    const channel = new Channel(groupNo, ChannelTypeGroup);
    return this.avatarChannel(channel);
  }

  // 注册频道设置
  channelSettingRegister(
    sectionID: string,
    sectionFnc: (context: RouteContext<any>) => Section | undefined,
    sort?: number
  ) {
    WKApp.sectionManager.register(
      EndpointCategory.channelSetting,
      sectionID,
      sectionFnc,
      sort
    );
  }

  // 获取频道设置
  channelSettings(context: RouteContext<any>): Section[] {
    return WKApp.sectionManager.sections(
      EndpointCategory.channelSetting,
      context
    );
  }

  // 注册管理设置
  channelManageRegister(
    sectionID: string,
    sectionFnc: (context: RouteContext<any>) => Section | undefined
  ) {
    WKApp.sectionManager.register(
      EndpointCategory.channelManage,
      sectionID,
      sectionFnc
    );
  }

  // 获取频道管理
  channelManages(context: RouteContext<any>): Section[] {
    return WKApp.sectionManager.sections(
      EndpointCategory.channelManage,
      context
    );
  }

  chatMenusRegister(sid: string, f: (param: any) => ChatMenus, sort?: number) {
    WKApp.endpointManager.setMethod(
      sid,
      (param) => {
        return f(param);
      },
      {
        category: EndpointCategory.chatMenusPopover,
        sort: sort,
      }
    );
  }
  chatMenus(param?: any): ChatMenus[] {
    return WKApp.endpointManager.invokes<ChatMenus>(
      EndpointCategory.chatMenusPopover,
      param
    );
  }

  sectionAddRow(sectionID: string, row: Row, context: RouteContext<any>) {
    const section = WKApp.sectionManager.section(sectionID, context);
    if (section) {
      if (!section.rows) {
        section.rows = [];
      }
      section.rows.push(row);
    }
  }

  // 注册用户信息
  userInfoRegister(
    sectionID: string,
    sectionFnc: (context: RouteContext<any>) => Section | undefined,
    sort?: number
  ) {
    WKApp.sectionManager.register(
      EndpointCategory.userInfo,
      sectionID,
      sectionFnc
    );
  }

  // 获取用户信息
  userInfos(context: RouteContext<any>): Section[] {
    return WKApp.sectionManager.sections(EndpointCategory.userInfo, context);
  }

  private getFriendApplysKey() {
    return `${WKApp.loginInfo.uid}friendApplys`;
  }

  public getFriendApplys(): Array<FriendApply> {
    var friendApplys = new Array<FriendApply>();
    const value = WKApp.loginInfo.getStorageItem(this.getFriendApplysKey());
    if (!value || value === "") {
      return friendApplys;
    }
    const friendApplyObjs = JSON.parse(value);

    if (friendApplyObjs && friendApplyObjs.length > 0) {
      for (const friendApplyObj of friendApplyObjs) {
        const f = new FriendApply();
        f.uid = friendApplyObj.uid;
        f.to_name = friendApplyObj.to_name;
        f.remark = friendApplyObj.remark;
        f.status = friendApplyObj.status;
        f.token = friendApplyObj.token;
        f.unread = friendApplyObj.unread;
        f.createdAt = friendApplyObj.createdAt;
        friendApplys.push(f);
      }
    }
    friendApplys.sort((a, b) => {
      return b.createdAt - a.createdAt;
    });
    return friendApplys;
  }

  public setFriendApplysUnreadCount() {
    if (WKApp.loginInfo.isLogined()) {
      WKApp.apiClient.get(`/user/reddot/friendApply`).then(res => {
        WKApp.mittBus.emit('friend-applys-unread-count', res.count)
        WKApp.loginInfo.setStorageItem(`${WKApp.loginInfo.uid}-friend-applys-unread-count`, res.count);
        WKApp.menus.refresh();
      })
    }
  }

  public getFriendApplysUnreadCount() {
    // const friendApplys = this.getFriendApplys();
    let unreadCount = 0;
    // if (friendApplys && friendApplys.length > 0) {
    //   for (const friendApply of friendApplys) {
    //     if (friendApply.unread) {
    //       unreadCount++;
    //     }
    //   }
    // }
    if (WKApp.loginInfo.isLogined()) {
      const num = WKApp.loginInfo.getStorageItem(`${WKApp.loginInfo.uid}-friend-applys-unread-count`)
      unreadCount = Number(num);
    }
    return unreadCount;
  }

  public async friendApplyMarkAllReaded(): Promise<void> {
    // let friendApplys = this.getFriendApplys();
    // if (!friendApplys) {
    //   friendApplys = new Array<FriendApply>();
    // }
    // var change = false;
    // for (const friendApply of friendApplys) {
    //   if (friendApply.unread) {
    //     friendApply.unread = false;
    //     change = true;
    //   }
    // }
    // if (change) {
    //   WKApp.loginInfo.setStorageItem(
    //     this.getFriendApplysKey(),
    //     JSON.stringify(friendApplys)
    //   );
    //   WKApp.endpointManager.invokes(EndpointCategory.friendApplyDataChange);
    // }
    if (WKApp.loginInfo.isLogined()) {
      WKApp.loginInfo.setStorageItem(`${WKApp.loginInfo.uid}-friend-applys-unread-count`, '0')
    }
    await WKApp.apiClient.delete(`/user/reddot/friendApply`);
  }

  public addFriendApply(friendApply: FriendApply) {
    let friendApplys = this.getFriendApplys();
    if (!friendApplys) {
      friendApplys = new Array<FriendApply>();
    }

    var exist = false;
    for (let index = 0; index < friendApplys.length; index++) {
      const friendAy = friendApplys[index];
      if (friendAy.uid === friendApply.uid) {
        friendApplys[index] = friendApply;
        exist = true;
        break;
      }
    }
    if (!exist) {
      friendApplys.push(friendApply);
    }
    WKApp.loginInfo.setStorageItem(
      this.getFriendApplysKey(),
      JSON.stringify(friendApplys)
    );
    WKApp.endpointManager.invokes(EndpointCategory.friendApplyDataChange);
  }

  public updateFriendApply(friendApply: FriendApply) {
    let friendApplys = this.getFriendApplys();
    if (!friendApplys) {
      friendApplys = new Array<FriendApply>();
    }
    var exist = false;
    for (let index = 0; index < friendApplys.length; index++) {
      const friendAy = friendApplys[index];
      if (friendAy.uid === friendApply.uid) {
        friendApplys[index] = friendApply;
        exist = true;
        break;
      }
    }
    if (exist) {
      WKApp.loginInfo.setStorageItem(
        this.getFriendApplysKey(),
        JSON.stringify(friendApplys)
      );
    }
  }

  public addMessageDeleteListener(listener: MessageDeleteListener) {
    this.messageDeleteListeners.push(listener);
  }
  public removeMessageDeleteListener(listener: MessageDeleteListener) {
    const len = this.messageDeleteListeners.length;
    for (let i = 0; i < len; i++) {
      if (listener === this.messageDeleteListeners[i]) {
        this.messageDeleteListeners.splice(i, 1);
        return;
      }
    }
  }
  public notifyMessageDeleteListener(message: Message, preMessage?: Message) {
    const len = this.messageDeleteListeners.length;
    for (let i = 0; i < len; i++) {
      this.messageDeleteListeners[i](message, preMessage);
    }
  }
}

export enum FriendApplyState {
  apply,
  accepted,
}
// 好友申请
export class FriendApply {
  uid!: string;
  to_uid!: string;
  to_name!: string;
  remark?: string;
  token?: string;
  status!: FriendApplyState;
  unread: boolean = false; // 是否未读
  createdAt!: number; // 创建时间
}

export class ChatMenus {
  icon!: string;
  title!: string;
  sort?: number = 0;
  onClick?: () => void;
}
