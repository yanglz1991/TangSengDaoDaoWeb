import { MediaMessageContent } from "wukongimjssdk"
import React from "react"
import { MessageContentTypeConst,FileHelper, MessageCell, MessageBaseCellProps, MessageBase, WKApp } from "@tsdaodao/base"
import "./index.css"

export class FileContent extends MediaMessageContent {
    size?: number
    name?: string
    constructor(file?: File) {
        super()
        if(file) {
            this.file = file
            this.size = file.size
            this.name = file.name
            this.extension = FileHelper.getFileExt(file.name)
        }
       
    }
    decodeJSON(content: any) {
        this.size = content["size"] || 0
        this.name = content["name"] || ""
        this.url = content["url"] || ''
        this.remoteUrl = this.url
    }
    encodeJSON() {
        return { "size": this.size || 0, "name": this.name || "", "url": this.remoteUrl || "" }
    }
    get contentType() {
        return MessageContentTypeConst.file
    }
    get conversationDigest() {
        // 根据文件名后缀区分显示摘要，图片/视频文件显示对应类型
        if (FileHelper.isImageFile(this.name || "")) {
            return "[图片]"
        }
        if (FileHelper.isVideoFile(this.name || "")) {
            return "[视频]"
        }
        return "[文件]"
    }

    public set url(url:string) {
        this.remoteUrl = url
    }
    public get url() {
        return this.remoteUrl
    }
}


export class FileCell extends MessageCell<MessageBaseCellProps> {
    fileIconInfo: any
    constructor(props: any) {
        super(props)
        const { message } = this.props
        const content = message.content as FileContent
        this.fileIconInfo = FileHelper.getFileIconInfo(content.name || "")
    }

    // 构造下载/预览URL，带上原始文件名
    buildDownloadURL(content: FileContent) {
        let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(content.url || '')
        if (downloadURL.indexOf("?") != -1) {
            downloadURL += "&filename=" + content.name
        } else {
            downloadURL += "?filename=" + content.name
        }
        return downloadURL
    }

    // 渲染图片形式
    renderImage(content: FileContent) {
        const { message, context } = this.props
        const imageURL = this.buildDownloadURL(content)
        return <MessageBase context={context} message={message} hiddeBubble={true} bubbleStyle={{ padding: '0px' }}>
            <div className="wk-message-file-media" onClick={() => {
                window.open(imageURL, '_blank')
            }}>
                <img alt={content.name} src={imageURL} style={{ maxWidth: 250, maxHeight: 250, borderRadius: 5, display: 'block', cursor: 'pointer' }} />
            </div>
        </MessageBase>
    }

    // 渲染视频形式
    renderVideo(content: FileContent) {
        const { message, context } = this.props
        const videoURL = WKApp.dataSource.commonDataSource.getFileURL(content.url || '')
        return <MessageBase context={context} message={message} hiddeBubble={true} bubbleStyle={{ padding: '0px' }}>
            <div className="wk-message-file-media">
                <video controls src={videoURL} style={{ maxWidth: 380, maxHeight: 380, borderRadius: 5, display: 'block', background: '#000' }} />
            </div>
        </MessageBase>
    }

    render() {
        const { message, context } = this.props
        const content = message.content as FileContent
        const isSend = message.send;
        const fileName = content.name || ""

        // 手机端将图片/视频作为文件发送时，网页端按图片/视频直接显示
        if (FileHelper.isImageFile(fileName)) {
            return this.renderImage(content)
        }
        if (FileHelper.isVideoFile(fileName)) {
            return this.renderVideo(content)
        }

        // 其它类型维持原有文件展示形式
        const downloadURL = this.buildDownloadURL(content)
        return <MessageBase context={context} message={message} bubbleStyle={{ padding: '0px' }}>
            <div className="wk-message-file" onClick={() => {
                window.open(`${downloadURL}`, 'top');
            }}>
                <div className="fileHeader" style={{ backgroundColor: this.fileIconInfo?.color, borderRadius: isSend ? "4px 0px 0px 4px" : "0px 4px 4px 0px" }}>
                    <img alt="" src={this.fileIconInfo?.icon} style={{ width: '48px', height: '48px' }} />
                </div>
                <div className="fileContent">
                    <div className="name">{content.name}</div>
                    <div className="size">{FileHelper.getFileSizeFormat(content.size || 0)}</div>
                </div>
            </div>

        </MessageBase>
    }
}