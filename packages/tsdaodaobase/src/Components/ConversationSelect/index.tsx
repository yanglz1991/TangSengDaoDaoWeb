import { WKSDK,Channel, ChannelInfo, ChannelTypeGroup } from "wukongimjssdk";
import { Component } from "react";
import Checkbox from "../Checkbox";
import { animateScroll } from 'react-scroll';
import { ConversationWrap } from "../../Service/Model";
import WKApp from "../../App";
import  { IconSearchStroked } from '@douyinfe/semi-icons';
import "./index.css"
import React from "react";
import WKAvatar from "../WKAvatar";

type ConversationSelectTab = 'recent' | 'group' | 'friend';

interface ConversationSelectProps {
    onFinished?: (channels: Channel[]) => void
    title?:string
}

interface ConversationSelectState {
    conversationWraps: ConversationWrap[]
    groups: ChannelInfo[]
    friends: ChannelInfo[]
    selectChannels: Channel[] // 被选中的频道(跨 Tab 累积)
    keyword?:string
    activeTab: ConversationSelectTab
}


export default class ConversationSelect extends Component<ConversationSelectProps, ConversationSelectState> {

    constructor(porps: any) {
        super(porps);
        this.state = {
            conversationWraps: [],
            groups: [],
            selectChannels: [],
            friends: [],
            activeTab: 'recent',
        }
    }

    async requestConversation() {
        const conversations =  WKSDK.shared().conversationManager.conversations
        const conversationWraps = new Array<ConversationWrap>()
        if (conversations) {
            for (const conversation of conversations) {
                const channelInfo = WKSDK.shared().channelManager.getChannelInfo(conversation.channel)
                if (!channelInfo) {
                    WKSDK.shared().channelManager.fetchChannelInfo(conversation.channel)
                }
                conversationWraps.push(new ConversationWrap(conversation))
            }
        }
        this.setState({
            conversationWraps: conversationWraps,
        })
    }

    async requestContacts(keyword?:string) {
        const friends = await WKApp.dataSource.commonDataSource.searchFriends(keyword)
        this.setState({
            friends: friends!,
        })
    }

    async requestGroups() {
        // 后端 /group/my 只返回 save=1 的群,无「我加入的所有群」接口。
        // 因此融合本地会话中的群组(用户最近聊过的) + 接口返回的群,以 channelID 去重。
        const merged: ChannelInfo[] = []
        const seen = new Set<string>()

        // 1. 先收集本地会话里的群组(已按最近活跃排序)
        const conversations = WKSDK.shared().conversationManager.conversations || []
        for (const conv of conversations) {
            if (conv.channel.channelType !== ChannelTypeGroup) continue
            if (seen.has(conv.channel.channelID)) continue
            let info = WKSDK.shared().channelManager.getChannelInfo(conv.channel)
            if (!info) {
                // 占位:用 channelID 临时命名,异步拉取
                info = new ChannelInfo()
                info.channel = conv.channel
                info.title = conv.channel.channelID
                WKSDK.shared().channelManager.fetchChannelInfo(conv.channel)
            }
            seen.add(conv.channel.channelID)
            merged.push(info)
        }

        // 2. 再拉接口里的"已保存"群,补充未在会话中的
        try {
            const remoteGroups = await WKApp.dataSource.channelDataSource.groupSaveList()
            if (remoteGroups) {
                for (const g of remoteGroups) {
                    if (seen.has(g.channel.channelID)) continue
                    seen.add(g.channel.channelID)
                    merged.push(g)
                }
            }
        } catch (e) {
            // 接口失败时仅展示本地会话中的群
        }

        this.setState({ groups: merged })
    }
    // 排序最近会话列表
    sortConversations(conversations: Array<ConversationWrap>) {
        let newConversations = conversations;
        if (!newConversations || newConversations.length <= 0) {
            return [];
        }
        let sortAfter = newConversations.sort((a, b) => {
            let aScore = a.timestamp;
            let bScore = b.timestamp;
            if (a.channelInfo && a.channelInfo.top) {
                aScore += 1000000;
            }
            if (b.channelInfo && b.channelInfo.top) {
                bScore += 1000000;
            }
            return bScore - aScore;
        });
        return sortAfter
    }

    componentDidMount() {
        this.requestConversation()
        this.requestContacts()
        this.requestGroups()
    }

    select(channel: Channel) {
        const { selectChannels } = this.state
        let newChannels = new Array()
        var unselected: boolean = false
        if (selectChannels && selectChannels.length > 0) {
            for (const selectChannel of selectChannels) {
                if (channel.isEqual(selectChannel)) {
                    unselected = true
                    continue
                } else {
                    newChannels.push(selectChannel)
                }
            }
        }
        if (!unselected) {
            newChannels.push(channel)
        }

        this.setState({
            selectChannels: newChannels,
        }, () => {
            this.scrollToBottom()
        })
    }

    // 取得当前 Tab 经搜索过滤后的可选频道列表(用于全选/取消全选)
    getCurrentVisibleChannels(): Channel[] {
        const { activeTab, conversationWraps, groups, friends, keyword } = this.state
        const kw = keyword || ""
        if (activeTab === 'recent') {
            return this.sortConversations(conversationWraps)
                .filter(v => kw === "" || (v.channelInfo?.title || "").indexOf(kw) !== -1)
                .map(v => v.channel)
        }
        const list = activeTab === 'group' ? groups : friends
        return list
            .filter(v => kw === "" || (v.orgData?.displayName || v.title || "").indexOf(kw) !== -1)
            .map(v => v.channel)
    }

    // 当前 Tab 是否全部已选
    isCurrentTabAllSelected(): boolean {
        const list = this.getCurrentVisibleChannels()
        if (list.length === 0) return false
        for (const ch of list) {
            if (!this.hasSelected(ch)) return false
        }
        return true
    }

    // 当前 Tab 已选数量
    currentTabSelectedCount(): number {
        const list = this.getCurrentVisibleChannels()
        let n = 0
        for (const ch of list) {
            if (this.hasSelected(ch)) n++
        }
        return n
    }

    // 全选/取消全选当前 Tab
    toggleSelectAllCurrentTab() {
        const visible = this.getCurrentVisibleChannels()
        if (visible.length === 0) return
        const allSelected = this.isCurrentTabAllSelected()
        const { selectChannels } = this.state
        if (allSelected) {
            // 移除当前可见列表里的所有 channel
            const remaining = selectChannels.filter(sc => !visible.some(v => v.isEqual(sc)))
            this.setState({ selectChannels: remaining }, () => this.scrollToBottom())
        } else {
            // 把当前可见列表里未选的 channel 追加(去重)
            const next = [...selectChannels]
            for (const ch of visible) {
                if (!next.some(sc => sc.isEqual(ch))) {
                    next.push(ch)
                }
            }
            this.setState({ selectChannels: next }, () => this.scrollToBottom())
        }
    }

    hasSelected(channel: Channel) {
        const { selectChannels } = this.state
        if (selectChannels && selectChannels.length > 0) {
            for (const selectChannel of selectChannels) {
                if (channel.isEqual(selectChannel)) {
                    return true
                }
            }
        }
        return false
    }
    scrollToBottom(): void {
        animateScroll.scrollToBottom({
            containerId: "conversationSelectSearchBox",
            "duration": 0,
        });
    }

    onSelect(value:any) {
        this.setState({
            keyword: value,
        })
    }

    setActiveTab(tab: ConversationSelectTab) {
        this.setState({ activeTab: tab })
    }

    // 渲染单个选项行(频道+复选框+头像+名称)
    renderItem(channel: Channel, displayName: string, key: string) {
        return (
            <div key={key} className="wk-conversationselect-content" onClick={() => {
                this.select(channel)
            }}>
                <div>
                    <Checkbox checked={this.hasSelected(channel)} onCheck={() => {
                        this.select(channel)
                    }} />
                </div>
                <div className="wk-conversationselect-content-box-data">
                    <div>
                        <WKAvatar channel={channel} style={{ width: "48px", height: "48px", borderRadius: "48px" }} />
                    </div>
                    <div className="wk-conversationselect-content-box-name">
                        {displayName}
                    </div>
                </div>
            </div>
        )
    }

    renderEmpty(text: string) {
        return (
            <div className="wk-conversationselect-empty">{text}</div>
        )
    }

    renderRecentTab() {
        const { conversationWraps, keyword } = this.state
        const sortedConversations = this.sortConversations(conversationWraps)
        const list = sortedConversations.filter((v) => {
            if (!keyword || keyword === "") return true
            return (v.channelInfo?.title || "").indexOf(keyword) !== -1
        })
        if (list.length === 0) return this.renderEmpty("暂无最近聊天")
        return list.map((conversationWrap: ConversationWrap) => {
            const name = conversationWrap.channelInfo?.orgData?.displayName || conversationWrap.channelInfo?.title || ""
            return this.renderItem(
                conversationWrap.channel,
                name,
                `${conversationWrap.channel.channelID}-${conversationWrap.channel.channelType}-recent`
            )
        })
    }

    renderGroupTab() {
        const { groups, keyword } = this.state
        const list = groups.filter((v) => {
            if (!keyword || keyword === "") return true
            return (v.orgData?.displayName || v.title || "").indexOf(keyword) !== -1
        })
        if (list.length === 0) return this.renderEmpty("暂无群组")
        return list.map((channelInfo: ChannelInfo) => {
            const name = channelInfo.orgData?.displayName || channelInfo.title || ""
            return this.renderItem(
                channelInfo.channel,
                name,
                `${channelInfo.channel.channelID}-group`
            )
        })
    }

    renderFriendTab() {
        const { friends, keyword } = this.state
        const list = friends.filter((v) => {
            if (!keyword || keyword === "") return true
            return (v.orgData?.displayName || v.title || "").indexOf(keyword) !== -1
        })
        if (list.length === 0) return this.renderEmpty("暂无好友")
        return list.map((channelInfo: ChannelInfo) => {
            const name = channelInfo.orgData?.displayName || channelInfo.title || ""
            return this.renderItem(
                channelInfo.channel,
                name,
                `${channelInfo.channel.channelID}-friend`
            )
        })
    }

    // 渲染当前 Tab 下的全选工具行
    renderSelectAllBar() {
        const visible = this.getCurrentVisibleChannels()
        if (visible.length === 0) return null
        const allSelected = this.isCurrentTabAllSelected()
        const selectedCount = this.currentTabSelectedCount()
        return (
            <div className="wk-conversationselect-selectall">
                <div className="wk-conversationselect-selectall-btn" onClick={() => this.toggleSelectAllCurrentTab()}>
                    {allSelected ? "取消全选" : "全选"}
                </div>
                <div className="wk-conversationselect-selectall-count">
                    已选 {selectedCount} / {visible.length}
                </div>
            </div>
        )
    }

    renderTabBar() {
        const { activeTab } = this.state
        const tabs: Array<{ key: ConversationSelectTab, label: string }> = [
            { key: 'recent', label: '最近聊天' },
            { key: 'group', label: '群组' },
            { key: 'friend', label: '好友' },
        ]
        return (
            <div className="wk-conversationselect-tabbar">
                {tabs.map(t => (
                    <div
                        key={t.key}
                        className={`wk-conversationselect-tab${activeTab === t.key ? ' active' : ''}`}
                        onClick={() => this.setActiveTab(t.key)}
                    >
                        <span>{t.label}</span>
                        <div className="wk-conversationselect-tab-indicator" />
                    </div>
                ))}
            </div>
        )
    }

    render() {
        const { selectChannels, activeTab } = this.state
        const { onFinished, title } = this.props
        return <div className="wk-conversationselect">
            <div className="wk-conversationselect-body">
                <div className="wk-conversationselect-content-title">{title || "转发"}</div>
                <div id="conversationSelectSearchBox" className="wk-conversationselect-content-searchBox">
                    <div className="wk-conversationselect-content-selectedChannel">
                        {
                            selectChannels.map((channel: Channel) => {
                                return <div key={`${channel.channelID}-${channel.channelType}-selected`} className="wk-conversationselect-content-selectedAvatar" onClick={() => {
                                    this.select(channel)
                                }}>
                                    <WKAvatar channel={channel} style={{ width: "48px", height: "48px", borderRadius: "48px" }}></WKAvatar>
                                </div>
                            })
                        }
                        <div className="wk-conversationselect-content-searchContent">
                            <div className="wk-conversationselect-content-searchIcon">
                                <IconSearchStroked style={{ color: '#bbbfc4', fontSize: '20px' }} />
                            </div>
                            <div className="wk-conversationselect-content-searchInput">
                                <input placeholder="搜索" type="text" style={{ fontSize: '17px' }} onChange={(v) => {
                                    this.onSelect(v.target.value)
                                }} />
                            </div>
                        </div>
                    </div>

                </div>
                {this.renderTabBar()}
                {this.renderSelectAllBar()}
                <div className="wk-conversationselect-content-box">
                    <div className="wk-conversationselect-content-list">
                        {activeTab === 'recent' && this.renderRecentTab()}
                        {activeTab === 'group' && this.renderGroupTab()}
                        {activeTab === 'friend' && this.renderFriendTab()}
                    </div>
                </div>
            </div>
            <div className="wk-conversationselect-footer">
                <div className="wk-conversationselect-okBtn" onClick={() => {
                    if (onFinished) {
                        onFinished(selectChannels)
                    }
                }}>
                    确认{selectChannels.length > 0 ? `(${selectChannels.length})` : ""}
                </div>
            </div>
        </div>
    }
}