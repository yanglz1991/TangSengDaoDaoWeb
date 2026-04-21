import { IModule, WKApp, MessageContentTypeConst } from "@tsdaodao/base";
import { WKSDK } from "wukongimjssdk";
import React from "react";
import { ElementType } from "react";
import FileToolbar from "./FileToolbar";
import { FileCell, FileContent } from "./Messages/File";



export default class FileModule implements IModule {
    id(): string {
        return "FileModule"
    }
    init(): void {
        console.log("【FileModule】初始化")

        WKSDK.shared().register(MessageContentTypeConst.file, () => new FileContent()) // 文件

        WKApp.messageManager.registerCell(MessageContentTypeConst.file, (): ElementType => {
            return FileCell
        })

        WKApp.endpoints.registerChatToolbar("chattoolbar.image",(ctx)=>{
            return <FileToolbar icon={require("./assets/func_file_normal.svg").default} conversationContext={ctx}></FileToolbar>
        })
    }


}