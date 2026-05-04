import { ConversationContext, FileHelper, ImageContent, VideoContent, WKApp } from "@tsdaodao/base";
import axios from "axios";
import React from "react";
import { Component, ReactNode } from "react";
import { FileContent } from "../Messages/File";

import "./index.css"


interface FileToolbarProps {
    conversationContext: ConversationContext
    icon: string
}

interface FileToolbarState {
    showDialog: boolean
    file?: any
    fileType?: string
    previewUrl?: any,
    fileIconInfo?: any,
    canSend?: boolean
    width?: number
    height?: number
    videoSecond?: number
    videoCoverDataUrl?: string
}

export default class FileToolbar extends Component<FileToolbarProps, FileToolbarState>{
    pasteListen!:(event:any)=>void
    constructor(props:any) {
        super(props)
        this.state = {
            showDialog: false,
        }
    }

    componentDidMount() {
        let self = this;

        const { conversationContext } = this.props

        this.pasteListen = function (event:any) { // 监听粘贴里的文件
            let files = event.clipboardData.files;
            if (files.length > 0) {
                self.showFile(files[0]);
            }
        }
        document.addEventListener('paste',this.pasteListen )

        conversationContext.setDragFileCallback((file)=>{
            self.showFile(file);
        })
    }

    componentWillUnmount() {
        document.removeEventListener("paste",this.pasteListen)
    }

    $fileInput: any
    onFileClick = (event: any) => {
        event.target.value = '' // 防止选中一个文件取消后不能再选中同一个文件
    }
    onFileChange() {
        let file = this.$fileInput.files[0];
        this.showFile(file);
    }
    chooseFile = () => {
        this.$fileInput.click();
    }
    showFile(file: any) {
        const self = this
        if (file.type && file.type.startsWith('image/')) {
            var reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = function (e: any) {
                self.setState({
                    file: file,
                    fileType: "image",
                    previewUrl: reader.result,
                    showDialog: true,
                });
            };
        } else if ((file.type && file.type.startsWith('video/')) || FileHelper.isVideoFile(file.name || "")) {
            // 视频文件：读取宽高/时长并截取首帧作为封面，按视频形式发送
            this.extractVideoMeta(file).then((meta) => {
                self.setState({
                    file: file,
                    fileType: "video",
                    previewUrl: meta.coverDataUrl,
                    width: meta.width,
                    height: meta.height,
                    videoSecond: meta.second,
                    videoCoverDataUrl: meta.coverDataUrl,
                    showDialog: true,
                    canSend: true,
                })
            }).catch(() => {
                // 解析失败则按文件发送
                const fileIconInfo = FileHelper.getFileIconInfo(file.name);
                self.setState({
                    fileType: 'file',
                    fileIconInfo: fileIconInfo,
                    file: file,
                    showDialog: true,
                    canSend: true,
                })
            })
        } else {
            const fileIconInfo = FileHelper.getFileIconInfo(file.name);
            this.setState({
                fileType: 'file',
                fileIconInfo: fileIconInfo,
                file: file,
                showDialog: true,
                canSend: true,
            });
        }

    }

    // 读取视频元数据并截取首帧作为封面
    extractVideoMeta(file: File): Promise<{ width: number, height: number, second: number, coverDataUrl: string }> {
        return new Promise((resolve, reject) => {
            try {
                const url = URL.createObjectURL(file)
                const video = document.createElement("video")
                video.preload = "metadata"
                video.muted = true
                video.playsInline = true
                video.src = url
                video.onloadedmetadata = () => {
                    // 跳到 0.1s 处再截图，避免首帧黑屏
                    try {
                        video.currentTime = Math.min(0.1, (video.duration || 0) / 2)
                    } catch (e) {
                        // ignore
                    }
                }
                video.onseeked = () => {
                    try {
                        const canvas = document.createElement("canvas")
                        canvas.width = video.videoWidth
                        canvas.height = video.videoHeight
                        const ctx = canvas.getContext("2d")
                        if (ctx) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                        }
                        const coverDataUrl = canvas.toDataURL("image/jpeg", 0.8)
                        URL.revokeObjectURL(url)
                        resolve({
                            width: video.videoWidth,
                            height: video.videoHeight,
                            second: Math.floor(video.duration || 0),
                            coverDataUrl,
                        })
                    } catch (err) {
                        URL.revokeObjectURL(url)
                        reject(err)
                    }
                }
                video.onerror = () => {
                    URL.revokeObjectURL(url)
                    reject(new Error("video load failed"))
                }
            } catch (err) {
                reject(err)
            }
        })
    }

    // 将 dataURL 转换为 Blob/File
    dataURLToBlob(dataURL: string): Blob {
        const arr = dataURL.split(",")
        const m = arr[0].match(/:(.*?);/)
        const mime = m ? m[1] : "image/jpeg"
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8 = new Uint8Array(n)
        while (n--) {
            u8[n] = bstr.charCodeAt(n)
        }
        return new Blob([u8], { type: mime })
    }

    // 上传视频封面，返回服务器路径
    async uploadCover(coverDataUrl: string): Promise<string | undefined> {
        try {
            const conversationContext = this.props.conversationContext
            const channel = conversationContext.channel()
            const blob = this.dataURLToBlob(coverDataUrl)
            const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
            const path = `/${channel.channelType}/${channel.channelID}/${fileName}`
            const result: any = await WKApp.apiClient.get(`file/upload?path=${path}&type=chat`)
            const uploadURL = result?.url
            if (!uploadURL) return undefined
            const form = new FormData()
            form.append("file", blob, fileName)
            const resp = await axios.post(uploadURL, form, { headers: { "Content-Type": "multipart/form-data" } })
            return resp?.data?.path
        } catch (err) {
            console.warn("upload video cover failed", err)
            return undefined
        }
    }

    async onSend() {
        const { conversationContext } = this.props
        const { file, previewUrl, width, height, fileType, videoSecond, videoCoverDataUrl } = this.state
        if (fileType === "image") {
            conversationContext.sendMessage(new ImageContent(file, previewUrl, width, height))
        } else if (fileType === "video") {
            // 先关闭对话框，避免阻塞
            this.setState({ showDialog: false })
            let coverPath = ""
            if (videoCoverDataUrl) {
                coverPath = (await this.uploadCover(videoCoverDataUrl)) || ""
            }
            conversationContext.sendMessage(new VideoContent(file, coverPath, width || 0, height || 0, videoSecond || 0))
            return
        } else {
            conversationContext.sendMessage(new FileContent(file))
        }

        this.setState({
            showDialog: false,
        });
    }
    onPreviewLoad(e: any) {
        let img = e.target;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        this.setState({
            width: width,
            height: height,
            canSend: true,
        });
    }
    render(): ReactNode {
        const { icon } = this.props
        const { showDialog, canSend, fileIconInfo, file, fileType, previewUrl } = this.state
        return <div className="wk-filetoolbar" >
            <div className="wk-filetoolbar-content" onClick={() => {
            this.chooseFile()
        }}>
                <div className="wk-filetoolbar-content-icon">
                    <img src={icon}></img>
                    <input onClick={this.onFileClick} onChange={this.onFileChange.bind(this)} ref={(ref) => { this.$fileInput = ref }} type="file" multiple={false} accept="*" style={{ display: 'none' }} />
                </div>
            </div>
            {
                showDialog ? (
                    <ImageDialog onSend={this.onSend.bind(this)} onLoad={this.onPreviewLoad.bind(this)} canSend={canSend} fileIconInfo={fileIconInfo} file={file} fileType={fileType} previewUrl={previewUrl} onClose={() => {
                        this.setState({
                            showDialog: !showDialog
                        })
                    }} />
                ) : null
            }
        </div>
    }
}


interface ImageDialogProps {
    onClose: () => void
    onSend?: () => void
    fileType?: string // image, file
    previewUrl?: string
    file?: any
    fileIconInfo?: any,
    canSend?: boolean
    onLoad: (e: any) => void
}

class ImageDialog extends Component<ImageDialogProps> {


    // 格式化文件大小
    getFileSizeFormat(size: number) {
        if (size < 1024) {
            return `${size} B`
        }
        if (size > 1024 && size < 1024 * 1024) {
            return `${(size / 1024).toFixed(2)} KB`
        }
        if (size > 1024 * 1024 && size < 1024 * 1024 * 1024) {
            return `${(size / 1024 / 1024).toFixed(2)} M`
        }
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)}G`
    }

    render() {
        const { onClose, onSend, fileType, previewUrl, file, canSend, fileIconInfo, onLoad } = this.props
        return <div className="wk-imagedialog">
            <div className="wk-imagedialog-mask" onClick={onClose}></div>
            <div className="wk-imagedialog-content">
                <div className="wk-imagedialog-content-close" onClick={onClose}>
                    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2683" ><path d="M568.92178541 508.23169412l299.36805789-299.42461715a39.13899415 39.13899415 0 0 0 0-55.1452591L866.64962537 152.02159989a39.13899415 39.13899415 0 0 0-55.08869988 0L512.19286756 451.84213173 212.76825042 151.90848141a39.13899415 39.13899415 0 0 0-55.0886999 0L155.98277331 153.54869938a38.46028327 38.46028327 0 0 0 0 55.08869987L455.46394971 508.23169412 156.03933259 807.71287052a39.13899415 39.13899415 0 0 0 0 55.08869986l1.64021795 1.6967772a39.13899415 39.13899415 0 0 0 55.08869988 0l299.42461714-299.48117638 299.36805793 299.42461714a39.13899415 39.13899415 0 0 0 55.08869984 0l1.6967772-1.64021796a39.13899415 39.13899415 0 0 0 0-55.08869987L568.86522614 508.17513487z" p-id="2684"></path></svg>
                </div>
                <div className="wk-imagedialog-content-title">发送{fileType === 'image' ? '图片' : (fileType === 'video' ? '视频' : '文件')}</div>
                <div className="wk-imagedialog-content-body">
                    {
                        fileType === 'image' ? (
                            <div className="wk-imagedialog-content-preview">
                                <img alt="" className="wk-imagedialog-content-previewImg" src={previewUrl} onLoad={onLoad} />
                            </div>
                        ) : fileType === 'video' ? (
                            <div className="wk-imagedialog-content-preview">
                                <img alt="" className="wk-imagedialog-content-previewImg" src={previewUrl} />
                            </div>
                        ) : (
                            <div className="wk-imagedialog-content-preview">
                                <div className="wk-imagedialog-content-preview-file">
                                    <div className="wk-imagedialog-content-preview-file-icon" style={{ backgroundColor: fileIconInfo?.color }}>
                                        <img alt="" className="wk-imagedialog-content-preview-file-thumbnail" src={fileIconInfo?.icon} />
                                    </div>
                                    <div className="wk-imagedialog-content-preview--filecontent">
                                        <div className="wk-imagedialog-content-preview--filecontent-name">{file?.name}</div>
                                        <div className="wk-imagedialog-content-preview--filecontent-size">{this.getFileSizeFormat(file?.size)}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    <div className="wk-imagedialog-footer" >
                        <button onClick={onClose}>取消</button>
                        <button onClick={onSend} className="wk-imagedialog-footer-okbtn" disabled={!canSend} style={{ backgroundColor: canSend ? WKApp.config.themeColor : 'gray' }}>发送</button>
                    </div>
                </div>

            </div>
        </div>
    }
}