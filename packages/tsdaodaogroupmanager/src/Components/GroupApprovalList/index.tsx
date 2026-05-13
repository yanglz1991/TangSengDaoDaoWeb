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
    constructor(props: GroupApprovalListProps) {
        super(props);
        this.state = {
            loading: true,
            invites: [],
        };
    }

    componentDidMount() {
        this.fetchInvites();
    }

    fetchInvites = async () => {
        const { routeContext } = this.props;
        const channel = routeContext.routeData().channel;
        if (!channel) {
            this.setState({ loading: false });
            return;
        }
        try {
            const resp = await WKApp.apiClient.get(`groups/${channel.channelID}/member/invites`);
            const list: InviteRecord[] = Array.isArray(resp) ? resp : [];
            this.setState({ loading: false, invites: list });
        } catch (err: any) {
            this.setState({ loading: false });
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
                window.open(url, "_blank");
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
