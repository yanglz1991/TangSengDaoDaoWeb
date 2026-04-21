import { Toast } from "@douyinfe/semi-ui";
import React from "react";
import { Component, ReactNode } from "react";
import { WKApp, GroupRole, SubscriberStatus, FinishButtonContext, IndexTableItem } from "@tsdaodao/base";
import RouteContext from "@tsdaodao/base/src/Service/Context";
import { ChannelSettingRouteData } from "@tsdaodao/base/src/Components/ChannelSetting/context";
import SmallTableEdit from "@tsdaodao/base/src/Components/SmallTableEdit";
import UserSelect from "@tsdaodao/base/src/Components/UserSelect";

import "./index.css";

export interface ChannelManagerListProps {
    routeContext: RouteContext<ChannelSettingRouteData>
}

export default class ChannelManagerList extends Component<ChannelManagerListProps> {

    render(): ReactNode {
        const { routeContext } = this.props
        const data = routeContext.routeData()

        return <div className="wk-channelmanagerlist">
            <SmallTableEdit 
                addTitle="添加管理员" 
                items={data.subscribers.filter((s) => {
                    return s.role === GroupRole.manager || s.role === GroupRole.owner
                }).map((subscriber) => {
                    return {
                        id: subscriber.uid,
                        icon: WKApp.shared.avatarUser(subscriber.uid),
                        name: subscriber.remark || subscriber.name,
                        showAction: subscriber.role !== GroupRole.owner,
                        onAction: () => {
                            WKApp.shared.baseContext.showAlert({
                                content: "确定要移除此管理员权限吗？",
                                onOk: () => {
                                    WKApp.dataSource.channelDataSource.managerRemove(data.channel, [subscriber.uid])
                                        .then(() => {
                                            Toast.success("已移除管理员权限")
                                        })
                                        .catch((err: any) => {
                                            Toast.error(err.msg || "移除管理员失败")
                                        })
                                }
                            })
                        }
                    }
                })} 
                onAdd={() => {
                    var btnContext: FinishButtonContext
                    var selectItems: IndexTableItem[] = []
                    routeContext.push(<UserSelect onSelect={(items: any) => {
                        if (items.length === 0) {
                            btnContext.disable(true)
                        } else {
                            btnContext.disable(false)
                        }
                        selectItems = items
                    }} users={data.subscribers.filter((subscriber) => 
                        subscriber.role !== GroupRole.manager && 
                        subscriber.role !== GroupRole.owner && 
                        subscriber.status === SubscriberStatus.normal
                    ).map((item) => {
                        return new IndexTableItem(item.uid, item.name, item.avatar)
                    })}></UserSelect>, {
                        title: "选择管理员",
                        showFinishButton: true,
                        onFinish: async () => {
                            btnContext.loading(true)
                            try {
                                await WKApp.dataSource.channelDataSource.managerAdd(data.channel, selectItems.map((item) => {
                                    return item.id
                                }))
                                Toast.success("已添加为管理员")
                                btnContext.loading(false)
                                routeContext.pop()
                            } catch (err: any) {
                                btnContext.loading(false)
                                Toast.error(err.msg || "添加管理员失败")
                            }
                        },
                        onFinishContext: (context: any) => {
                            btnContext = context
                            btnContext.disable(true)
                        }
                    })
                }}
            />
        </div>
    }
} 