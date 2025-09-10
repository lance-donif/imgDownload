// 在 background.js 中
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: 'hello.html' });
});
// background.js
// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request);
    if (request.action === "getRules") {
        // 从存储中获取规则并发送给内容脚本
        chrome.storage.local.get(['downloadRules'], function (result) {
            const rules = result.downloadRules || [];
            console.log('发送规则给内容脚本:', rules);
            sendResponse({ rules: rules });
        });
        return true; // 保持消息通道开放以进行异步响应
    } else if (request.action === "downloadImage") {
        // 处理图片下载请求
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            conflictAction: 'uniquify',
            saveAs: false
        }, function (downloadId) {
            if (chrome.runtime.lastError) {
                console.error('下载失败:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError });
            } else {
                console.log('下载已开始，ID:', downloadId);
                sendResponse({ success: true, downloadId: downloadId });
            }
        });
        return true; // 保持消息通道开放以进行异步响应
    }
});

// 监听规则变化并通知内容脚本
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.downloadRules) {
        const newRules = changes.downloadRules.newValue || [];
        console.log('规则发生变化，通知内容脚本:', newRules);

        // 通知所有标签页规则已更新
        chrome.tabs.query({}, function (tabs) {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: "rulesUpdated",
                    rules: newRules
                }, function (response) {
                    // 忽略响应错误
                });
            });
        });
    }
});

// 在 background.js 中
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 插件首次安装时初始化默认规则
        console.log('Extension installed, initializing default rules');
        // 如果可以访问 RuleManager，调用 initializeDefaultRules 方法
        // 或者直接设置默认规则到存储中
        const defaultRules = [
            {
                id: 1,
                buttonName: "希音按钮",
                buttonPosition: ".size-item__title",
                elementPosition: ".thumbs-picture",
                regexPattern: "_thumbnail_\\d+x\\d+",
                webKeyword: "shein",
                saveFormat: "jpg"
            }
        ];

        chrome.storage.local.set({ 'downloadRules': defaultRules }, () => {
            console.log('Default rules initialized');
        });

        // 向所有页面注入 content.js
        injectContentScriptToAllTabs();
    }
});


// 向所有标签页注入 content.js
function injectContentScriptToAllTabs() {
    // 查询所有可注入的标签页
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            // 检查标签页是否可以注入（排除特殊页面）
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                try {
                    // 使用 scripting API 注入脚本
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn(`无法向标签页 ${tab.id} 注入脚本:`, chrome.runtime.lastError.message);
                        } else {
                            console.log(`成功向标签页 ${tab.id} 注入 content.js`);
                        }
                    });
                } catch (error) {
                    console.warn(`注入脚本时出错:`, error);
                }
            }
        });
    });
}