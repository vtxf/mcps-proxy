/**
 * 通知管理器
 * 处理MCP协议中的各种通知
 */

import {
    ProgressNotification,
    CancelledNotification,
    LoggingMessageNotification,
    ResourceUpdatedNotification,
    ResourceListChangedNotification,
    ToolListChangedNotification,
    PromptListChangedNotification,
    RootsListChangedNotification,
    ProgressToken,
    ContentBlock
} from "../types/MCPTypes";
import { logger } from "../utils/Logger";
import { Response } from "express";

export interface NotificationCallback {
    (notification: any): void;
}

export class NotificationManager {
    private progressCallbacks: Map<ProgressToken, NotificationCallback> = new Map();
    private globalNotificationCallbacks: NotificationCallback[] = [];
    private subscribedResources: Set<string> = new Set();

    /**
     * 注册进度通知回调
     */
    public registerProgressCallback(progressToken: ProgressToken, callback: NotificationCallback): void {
        this.progressCallbacks.set(progressToken, callback);
        logger.debug(`Registered progress callback for token: ${progressToken}`);
    }

    /**
     * 注销进度通知回调
     */
    public unregisterProgressCallback(progressToken: ProgressToken): void {
        this.progressCallbacks.delete(progressToken);
        logger.debug(`Unregistered progress callback for token: ${progressToken}`);
    }

    /**
     * 注册全局通知回调
     */
    public registerGlobalNotificationCallback(callback: NotificationCallback): void {
        this.globalNotificationCallbacks.push(callback);
    }

    /**
     * 注销全局通知回调
     */
    public unregisterGlobalNotificationCallback(callback: NotificationCallback): void {
        const index = this.globalNotificationCallbacks.indexOf(callback);
        if (index > -1) {
            this.globalNotificationCallbacks.splice(index, 1);
        }
    }

    /**
     * 发送进度通知
     */
    public sendProgressNotification(
        progressToken: ProgressToken,
        progress: number,
        total?: number,
        message?: string
    ): void {
        const notification: ProgressNotification = {
            jsonrpc: "2.0",
            method: "notifications/progress",
            params: {
                progressToken,
                progress,
                total,
                message
            }
        };

        this.deliverNotification(notification);

        // 发送给特定的进度回调
        const callback = this.progressCallbacks.get(progressToken);
        if (callback) {
            callback(notification);
        }
    }

    /**
     * 发送取消通知
     */
    public sendCancelledNotification(requestId: string | number, reason?: string): void {
        const notification: CancelledNotification = {
            jsonrpc: "2.0",
            method: "notifications/cancelled",
            params: {
                requestId,
                reason
            }
        };

        this.deliverNotification(notification);
    }

    /**
     * 发送日志消息通知
     */
    public sendLoggingMessageNotification(
        level: "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency",
        data: any,
        loggerName?: string
    ): void {
        const notification: LoggingMessageNotification = {
            jsonrpc: "2.0",
            method: "notifications/message",
            params: {
                level,
                logger: loggerName,
                data
            }
        };

        this.deliverNotification(notification);
    }

    /**
     * 发送资源更新通知
     */
    public sendResourceUpdatedNotification(uri: string, contents?: ContentBlock[]): void {
        // 只有当资源被订阅时才发送通知
        if (this.subscribedResources.has(uri) || this.subscribedResources.has("*")) {
            const notification: ResourceUpdatedNotification = {
                jsonrpc: "2.0",
                method: "notifications/resources/updated",
                params: {
                    uri,
                    contents
                }
            };

            this.deliverNotification(notification);
        }
    }

    /**
     * 发送资源列表变化通知
     */
    public sendResourceListChangedNotification(): void {
        const notification: ResourceListChangedNotification = {
            jsonrpc: "2.0",
            method: "notifications/resources/list_changed"
        };

        this.deliverNotification(notification);
    }

    /**
     * 发送工具列表变化通知
     */
    public sendToolListChangedNotification(): void {
        const notification: ToolListChangedNotification = {
            jsonrpc: "2.0",
            method: "notifications/tools/list_changed"
        };

        this.deliverNotification(notification);
    }

    /**
     * 发送提示列表变化通知
     */
    public sendPromptListChangedNotification(): void {
        const notification: PromptListChangedNotification = {
            jsonrpc: "2.0",
            method: "notifications/prompts/list_changed"
        };

        this.deliverNotification(notification);
    }

    /**
     * 发送根目录列表变化通知
     */
    public sendRootsListChangedNotification(): void {
        const notification: RootsListChangedNotification = {
            jsonrpc: "2.0",
            method: "notifications/roots/list_changed"
        };

        this.deliverNotification(notification);
    }

    /**
     * 订阅资源
     */
    public subscribeResource(uri: string): boolean {
        try {
            this.subscribedResources.add(uri);
            logger.info(`Subscribed to resource: ${uri}`);
            return true;
        } catch (error) {
            logger.error(`Failed to subscribe to resource ${uri}:`, error);
            return false;
        }
    }

    /**
     * 取消订阅资源
     */
    public unsubscribeResource(uri: string): boolean {
        try {
            this.subscribedResources.delete(uri);
            logger.info(`Unsubscribed from resource: ${uri}`);
            return true;
        } catch (error) {
            logger.error(`Failed to unsubscribe from resource ${uri}:`, error);
            return false;
        }
    }

    /**
     * 获取已订阅的资源列表
     */
    public getSubscribedResources(): string[] {
        return Array.from(this.subscribedResources);
    }

    /**
     * 检查资源是否被订阅
     */
    public isResourceSubscribed(uri: string): boolean {
        return this.subscribedResources.has(uri) || this.subscribedResources.has("*");
    }

    /**
     * 通知投递
     */
    private deliverNotification(notification: any): void {
        // 发送给所有全局通知回调
        for (const callback of this.globalNotificationCallbacks) {
            try {
                callback(notification);
            } catch (error) {
                logger.error("Error in notification callback:", error);
            }
        }

        // 记录通知
        logger.debug(`Delivered notification: ${notification.method}`, {
            params: notification.params
        });
    }

    /**
     * 清理所有回调
     */
    public cleanup(): void {
        this.progressCallbacks.clear();
        this.globalNotificationCallbacks.length = 0;
        this.subscribedResources.clear();
        logger.info("Notification manager cleaned up");
    }

    /**
     * 获取通知管理器统计信息
     */
    public getStats(): any {
        return {
            activeProgressCallbacks: this.progressCallbacks.size,
            globalNotificationCallbacks: this.globalNotificationCallbacks.length,
            subscribedResources: this.subscribedResources.size,
            subscribedResourceList: Array.from(this.subscribedResources)
        };
    }
}

// 全局通知管理器实例
export const notificationManager = new NotificationManager();