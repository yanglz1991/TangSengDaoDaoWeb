import { IModule, WKApp, MessageContentTypeConst, ChannelSettingRouteData, GroupRole, Row, ListItem, Section, ListItemSwitch, ListItemSwitchContext, EndpointCategory, IndexTableItem, FinishButtonContext } from "@tsdaodao/base";
import { ChannelTypeGroup, WKSDK } from "wukongimjssdk";
import React from "react";
import ChannelManage from "./ChannelSetting/manage";
import { RouteContextConfig } from "@tsdaodao/base/src/Service/Context";
import { Toast } from "@douyinfe/semi-ui";
import { ChannelSettingManager } from "@tsdaodao/base/src/Service/ChannelSetting";
import UserSelect from "@tsdaodao/base/src/Components/UserSelect";
import ChannelBlacklist from "./Components/ChannelBlacklist";
import ChannelManagerList from "./Components/ChannelManagerList";

export default class GroupManagerModule implements IModule {
    id(): string {
        return "GroupManagerModule"
    }
    init(): void {
        console.log("【GroupManagerModule】初始化")

        // 群管理
        WKApp.shared.channelSettingRegister("channel.setting.groupmanager", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channelInfo = data.channelInfo
            const channel = data.channel
            if (channel.channelType !== ChannelTypeGroup) {
                return undefined
            }
            const rows = new Array()
            const subscriberOfMe = data.subscriberOfMe
            if (subscriberOfMe?.role === GroupRole.owner || subscriberOfMe?.role === GroupRole.manager) {
                rows.push(new Row({
                    cell: ListItem,
                    properties: {
                        title: "群管理",
                        onClick: () => {
                            context.push(<ChannelManage channel={channel} context={context}></ChannelManage>, new RouteContextConfig({
                                title: "群管理",
                            }))
                        }
                    },
                }))
            }
            if(rows.length === 0) {
                return undefined
            }
            return new Section({
                rows: rows,
            })
        },2000)

        // 注册群管理功能
        this.registerGroupManageFunctions()
    }

    registerGroupManageFunctions() {
        // 群聊邀请确认
        WKApp.shared.channelManageRegister("channel.setting.manage.invite", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channel = data.channel
            const channelInfo = data.channelInfo
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner && subscriberOfMe?.role !== GroupRole.manager) {
                return undefined
            }

            return new Section({
                subtitle: "启用后，群成员需要群主或管理员确认才能邀请朋友进群。扫描二维码进群将同时停用。",
                rows: [
                    new Row({
                        cell: ListItemSwitch,
                        properties: {
                            title: "群聊邀请确认",
                            checked: channelInfo?.orgData?.invite === 1,
                            onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                                ctx.loading = true
                                ChannelSettingManager.shared.invite(v, channel)
                                    .then(() => {
                                        ctx.loading = false
                                        data.refresh()
                                    })
                                    .catch((err: any) => {
                                        ctx.loading = false
                                        Toast.error(err.msg)
                                    })
                            }
                        }
                    })
                ]
            })
        })

        // 群主管理权转让
        WKApp.shared.channelManageRegister("channel.setting.manage.transfer", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channel = data.channel
            const subscriberOfMe = data.subscriberOfMe
            
            if (!subscriberOfMe || subscriberOfMe.role !== GroupRole.owner) {
                return undefined
            }

            return new Section({
                rows: [
                    new Row({
                        cell: ListItem,
                        properties: {
                            title: "群主管理权转让",
                            onClick: () => {
                                context.push(
                                    <UserSelect
                                        cantMulit={true}
                                        onSelect={(items: any) => {
                                            const item = items[0]
                                            WKApp.shared.baseContext.showAlert({
                                                content: "你将自动放弃群主身份",
                                                onOk: () => {
                                                    WKApp.dataSource.channelDataSource.channelTransferOwner(channel, item.id)
                                                        .then(() => {
                                                            context.popToRoot()
                                                        })
                                                        .catch((err: any) => {
                                                            Toast.error(err.msg)
                                                        })
                                                }
                                            })
                                        }}
                                        users={data.subscribers
                                            .filter(subscriber => 
                                                !(subscriber.uid === WKApp.loginInfo.uid ||
                                                  subscriber.uid === WKApp.config.fileHelperUID ||
                                                  subscriber.uid === WKApp.config.systemUID)
                                            )
                                            .map(item => new IndexTableItem(item.uid, item.name, item.avatar))
                                        }
                                    />,
                                    {
                                        title: "选择新的群主",
                                        showFinishButton: false,
                                        onFinish: async () => {
                                            context.pop()
                                        },
                                        onFinishContext: (context: any) => {}
                                    }
                                )
                            }
                        }
                    })
                ]
            })
        })

        // 成员设置 - 全员禁言
        WKApp.shared.channelManageRegister("channel.setting.manage.mute", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channel = data.channel
            const channelInfo = data.channelInfo
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner && subscriberOfMe?.role !== GroupRole.manager) {
                return undefined
            }

            return new Section({
                title: "成员设置",
                subtitle: "全员禁言启用后，只允许群主和管理员发言。",
                rows: [
                    new Row({
                        cell: ListItemSwitch,
                        properties: {
                            title: "全员禁言",
                            checked: channelInfo?.orgData?.forbidden === 1,
                            onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                                ctx.loading = true
                                ChannelSettingManager.shared.forbidden(v, channel)
                                    .then(() => {
                                        ctx.loading = false
                                        data.refresh()
                                    })
                                    .catch((err: any) => {
                                        ctx.loading = false
                                        Toast.error(err.msg)
                                    })
                            }
                        }
                    })
                ]
            })
        })

        // 禁止群成员互加好友
        WKApp.shared.channelManageRegister("channel.setting.manage.prohibitAddFriend", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channel = data.channel
            const channelInfo = data.channelInfo
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner && subscriberOfMe?.role !== GroupRole.manager) {
                return undefined
            }

            return new Section({
                rows: [
                    new Row({
                        cell: ListItemSwitch,
                        properties: {
                            title: "禁止群成员互加好友",
                            checked: channelInfo?.orgData?.forbidden_add_friend === 1,
                            onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                                ctx.loading = true
                                ChannelSettingManager.shared.forbiddenAddFriend(v, channel)
                                    .then(() => {
                                        ctx.loading = false
                                        data.refresh()
                                    })
                                    .catch((err: any) => {
                                        ctx.loading = false
                                        Toast.error(err.msg)
                                    })
                            }
                        }
                    })
                ]
            })
        })

        // 群历史消息设置
        WKApp.shared.channelManageRegister("channel.setting.manage.historyMsg", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channel = data.channel
            const channelInfo = data.channelInfo
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner && subscriberOfMe?.role !== GroupRole.manager) {
                return undefined
            }

            return new Section({
                title: "消息设置",
                rows: [
                    new Row({
                        cell: ListItemSwitch,
                        properties: {
                            title: "允许新成员查看历史消息",
                            checked: channelInfo?.orgData?.allow_view_history_msg === 1,
                            onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                                ctx.loading = true
                                ChannelSettingManager.shared.allowViewHistoryMsg(v, channel)
                                    .then(() => {
                                        ctx.loading = false
                                        data.refresh()
                                    })
                                    .catch((err: any) => {
                                        ctx.loading = false
                                        Toast.error(err.msg)
                                    })
                            }
                        }
                    }),
                    new Row({
                        cell: ListItemSwitch,
                        properties: {
                            title: "允许群成员置顶消息",
                            checked: channelInfo?.orgData?.allow_member_pinned_message === 1,
                            onCheck: (v: boolean, ctx: ListItemSwitchContext) => {
                                ctx.loading = true
                                ChannelSettingManager.shared.allowMemberPinnedMessage(v, channel)
                                    .then(() => {
                                        ctx.loading = false
                                        data.refresh()
                                    })
                                    .catch((err: any) => {
                                        ctx.loading = false
                                        Toast.error(err.msg)
                                    })
                            }
                        }
                    })
                ]
            })
        })

        // 群黑名单
        WKApp.shared.channelManageRegister("channel.setting.manage.blacklist", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner && subscriberOfMe?.role !== GroupRole.manager) {
                return undefined
            }

            return new Section({
                rows: [
                    new Row({
                        cell: ListItem,
                        properties: {
                            title: "群黑名单",
                            onClick: () => {
                                context.push(
                                    <ChannelBlacklist routeContext={context} />,
                                    { title: "群黑名单" }
                                )
                            }
                        }
                    })
                ]
            })
        })

        // 群主、管理员
        WKApp.shared.channelManageRegister("channel.setting.manage.managerlist", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner) {
                return undefined
            }

            return new Section({
                title: "群主、管理员",
                rows: [
                    new Row({
                        cell: ListItem,
                        properties: {
                            title: "管理员设置",
                            onClick: () => {
                                context.push(
                                    <ChannelManagerList routeContext={context} />,
                                    { title: "管理员设置" }
                                )
                            }
                        }
                    })
                ]
            })
        })

        // 危险操作区域
        WKApp.shared.channelManageRegister("channel.setting.manage.danger", (context) => {
            const data = context.routeData() as ChannelSettingRouteData
            const channel = data.channel
            const subscriberOfMe = data.subscriberOfMe
            
            if (subscriberOfMe?.role !== GroupRole.owner) {
                return undefined
            }

            return new Section({
                title: "危险操作",
                rows: [
                    new Row({
                        cell: ListItem,
                        properties: {
                            title: "解散群聊",
                            style: { color: "#f65835" },
                            onClick: () => {
                                WKApp.shared.baseContext.showAlert({
                                    content: "解散后，所有成员将被移出群聊，且聊天记录将被清空，此操作不可恢复",
                                    onOk: () => {
                                        WKApp.dataSource.channelDataSource.exitChannel(channel)
                                            .then(() => {
                                                Toast.success("群聊已解散")
                                                context.popToRoot()
                                            })
                                            .catch((err: any) => {
                                                Toast.error(err.msg)
                                            })
                                    }
                                })
                            }
                        }
                    })
                ]
            })
        })
    }
}