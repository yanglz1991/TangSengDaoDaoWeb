import { Toast } from "@douyinfe/semi-ui";
import { Channel, ChannelTypePerson } from "wukongimjssdk";
import React, { Component, ReactNode } from "react";
import { WKApp } from "@tsdaodao/base";
import RouteContext from "@tsdaodao/base/src/Service/Context";
import { ChannelSettingRouteData } from "@tsdaodao/base/src/Components/ChannelSetting/context";

import "./index.css";

export interface GroupApprovalListProps {
    routeContext: RouteContext<ChannelSettingRouteData>;
}

interface InviteItem {
    uid: string;
    name: string;
}

interface InviteRecord {
    invite_no: string;
    group_no: string;
    inviter: string;
    inviter_name: string;
    remark: string;
    status: number;
    created_at: string;
    items: InviteItem[];
}

interface GroupApprovalListState {
    loading: boolean;
    invites: InviteRecord[];
}

export default class GroupApprovalList extends Component<GroupApprovalListProps, GroupApprovalListState> {
    // 跟踪正在打开的审批 H5 窗口的轮询定时器，组件卸载时清理
    private pendingCloseTimers: number[] = [];
    private isUnmounted = false;

    constructor(props: GroupApprovalListProps) {
        super(props);
        this.state = {
            loading: true,
            invites: [],
        };
    }

    componentDidMount() {
        this.fetchInvites();
        // 兜底：用户从其它途径完成审批后切回本 tab 时刷新一次
        window.addEventListener("focus", this.handleWindowFocus);
    }

    componentWillUnmount() {
        this.isUnmounted = true;
        window.removeEventListener("focus", this.handleWindowFocus);
        this.pendingCloseTimers.forEach((t) => window.clearInterval(t));
        this.pendingCloseTimers = [];
    }

    handleWindowFocus = () => {
        // 只在还存在未关闭的审批窗口轮询时刷新（说明用户刚操作完审批回到本页）
        if (this.pendingCloseTimers.length > 0) {
            this.fetchInvites();
        }
    };

    fetchInvites = async () => {
        const { routeContext } = this.props;
        const channel = routeContext.routeData().channel;
        if (!channel) {
            if (!this.isUnmounted) this.setState({ loading: false });
            return;
        }
        try {
            const resp = await WKApp.apiClient.get(`groups/${channel.channelID}/member/invites`);
            const list: InviteRecord[] = Array.isArray(resp) ? resp : [];
            if (!this.isUnmounted) this.setState({ loading: false, invites: list });
        } catch (err: any) {
            if (!this.isUnmounted) this.setState({ loading: false });
            Toast.error(err?.msg || "加载失败");
        }
    };

    goApproval = async (record: InviteRecord) => {
        const { routeContext } = this.props;
        const channel = routeContext.routeData().channel;
        if (!channel) return;
        try {
            const resp = await WKApp.apiClient.get(`groups/${channel.channelID}/member/h5confirm`, {
                param: { invite_no: record.invite_no || "" },
            });
            const url = resp?.url;
            if (url) {
                const w = window.open(url, "_blank");
                if (w) {
                    // 轮询审批 H5 窗口的关闭状态，关闭后刷新列表
                    const timer = window.setInterval(() => {
                        if (w.closed) {
                            window.clearInterval(timer);
                            this.pendingCloseTimers = this.pendingCloseTimers.filter((t) => t !== timer);
                            if (!this.isUnmounted) this.fetchInvites();
                        }
                    }, 800);
                    this.pendingCloseTimers.push(timer);
                }
            }
        } catch (err: any) {
            Toast.error(err?.msg || "操作失败");
        }
    };

    render(): ReactNode {
        const { loading, invites } = this.state;
        if (loading) {
            return <div className="wk-group-approval-list"><div className="wk-approval-empty">加载中...</div></div>;
        }
        if (invites.length === 0) {
            return <div className="wk-group-approval-list"><div className="wk-approval-empty">暂无待审批的入群邀请</div></div>;
        }
        return (
            <div className="wk-group-approval-list">
                {invites.map((record) => {
                    const inviterChannel = new Channel(record.inviter, ChannelTypePerson);
                    const memberNames = (record.items || []).map((i) => i.name).join("、");
                    const content = `邀请 ${record.items?.length || 0} 位朋友进群：${memberNames}`;
                    return (
                        <div key={record.invite_no} className="wk-approval-item" onClick={() => this.goApproval(record)}>
                            <div className="wk-approval-header">
                                <img className="wk-approval-avatar" src={WKApp.shared.avatarChannel(inviterChannel)} />
                                <div className="wk-approval-meta">
                                    <div className="wk-approval-inviter">{record.inviter_name || record.inviter}</div>
                                    <div className="wk-approval-time">{record.created_at}</div>
                                </div>
                                <div className="wk-approval-status">待审批</div>
                            </div>
                            <div className="wk-approval-content">{content}</div>
                            {record.remark ? <div className="wk-approval-remark">{`"${record.remark}"`}</div> : null}
                        </div>
                    );
                })}
            </div>
        );
    }
}
