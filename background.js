// background.js
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: "hello.html" });
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("收到消息:", request);
  if (request.action === "getRules") {
    // 从存储中获取规则并发送给内容脚本
    chrome.storage.local.get(["downloadRules"], function (result) {
      const rules = result.downloadRules || [];
      console.log("发送规则给内容脚本:", rules);
      sendResponse({ rules: rules });
    });
    return true; // 保持消息通道开放以进行异步响应
  } else if (request.action === "downloadImage") {
    // 使用 async 函数处理异步操作
    (async () => {
      try {
        // 1. 获取原始图片数据
        const response = await fetch(request.url);
        if (!response.ok) {
          throw new Error(`无法获取图片: ${response.statusText}`);
        }
        const imageBlob = await response.blob();

        // 2. 将 Blob 数据转换为 ImageBitmap，这是一种高效的图片表示
        const imageBitmap = await createImageBitmap(imageBlob);

        // 3. 创建一个离屏 Canvas 用于转换
        // OffscreenCanvas 在 background script 中性能更好
        const canvas = new OffscreenCanvas(
          imageBitmap.width,
          imageBitmap.height
        );
        const ctx = canvas.getContext("2d");

        // 4. 将图片绘制到 Canvas 上
        // 如果原始图片是透明的（如PNG），设置一个白色背景
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageBitmap, 0, 0);

        // 5. 将 Canvas 内容转换为 JPG 格式的 Blob
        // 第二个参数是图片质量 (0.0 to 1.0)
        const jpgBlob = await canvas.convertToBlob({
          type: "image/jpeg",
          quality: 0.9,
        });

        // 6. 将 Blob 转换为 ArrayBuffer 然后转为 base64 字符串
        const arrayBuffer = await jpgBlob.arrayBuffer();
        const base64String = arrayBufferToBase64(arrayBuffer);

        // 7. 构造 data URL
        const dataUrl = `data:image/jpeg;base64,${base64String}`;

        // 8. 使用 chrome.downloads.download API 下载
        chrome.downloads.download(
          {
            url: dataUrl,
            filename: request.filename,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("下载失败:", chrome.runtime.lastError.message);
              sendResponse({
                status: "failed",
                error: chrome.runtime.lastError.message,
              });
            } else {
              console.log(`下载任务已开始, ID: ${downloadId}`);
              sendResponse({ status: "success", downloadId: downloadId });
            }
          }
        );
      } catch (error) {
        console.error("图片转换或下载过程中出错:", error);
        sendResponse({ status: "failed", error: error.message });
      }
    })();

    // 返回 true 表示我们将异步地发送响应
    return true;
  }
});

// 添加辅助函数将 ArrayBuffer 转换为 Base64 字符串
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 监听规则变化并通知内容脚本
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.downloadRules) {
    const newRules = changes.downloadRules.newValue || [];
    console.log("规则发生变化，通知内容脚本:", newRules);

    // 通知所有标签页规则已更新
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "rulesUpdated",
            rules: newRules,
          },
          function (response) {
            // 忽略响应错误
          }
        );
      });
    });
  }
});

// 在 background.js 中
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 插件首次安装时初始化默认规则
    console.log("Extension installed, initializing default rules");
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
        saveFormat: "jpg",
      },
    ];

    chrome.storage.local.set({ downloadRules: defaultRules }, () => {
      console.log("Default rules initialized");
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
      if (
        tab.url &&
        (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
      ) {
        try {
          // 使用 scripting API 注入脚本
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              files: ["content.js"],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.warn(
                  `无法向标签页 ${tab.id} 注入脚本:`,
                  chrome.runtime.lastError.message
                );
              } else {
                console.log(`成功向标签页 ${tab.id} 注入 content.js`);
              }
            }
          );
        } catch (error) {
          console.warn(`注入脚本时出错:`, error);
        }
      }
    });
  });
}
