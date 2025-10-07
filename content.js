// content.js
let currentRules = [];
let observer = null;
const insertedButtons = new WeakSet(); // 使用WeakSet避免内存泄漏

// 页面加载时获取规则
chrome.runtime.sendMessage({ action: "getRules" }, function (response) {
  if (chrome.runtime.lastError) {
    console.error("获取规则时出错:", chrome.runtime.lastError);
    // 即使出错也尝试添加交互监听器
    addInteractionListeners();
    return;
  }

  console.log("获取规则：", response.rules);
  if (response && response.rules) {
    currentRules = response.rules;
    checkAndInsertButtons();
    // 在获取规则后添加交互监听器
    addInteractionListeners();
  } else {
    addInteractionListeners();
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "rulesUpdated") {
    // 规则更新时重新获取规则并检查是否需要插入按钮
    currentRules = request.rules;
    checkAndInsertButtons();
  }
});

// 检查并插入按钮
function checkAndInsertButtons() {
  // 获取当前页面的域名
  const currentDomain = window.location.hostname;

  // 过滤匹配的规则
  const matchingRules = currentRules.filter(
    (rule) => rule.webKeyword && currentDomain.includes(rule.webKeyword)
  );

  if (matchingRules.length === 0) {
    console.log("没有匹配规则，不插入按钮");
    return; // 没有匹配规则，直接返回
  }

  matchingRules.forEach((rule) => {
    const container = document.querySelector(rule.buttonPosition);
    if (container) {
      console.log("找到目标容器，插入按钮:", rule.buttonName);
      insertDownloadButton(rule, container);
    }
  });
}

// 插入下载按钮
function insertDownloadButton(rule, container) {
  // 使用WeakSet检查是否已插入
  if (insertedButtons.has(container)) {
    const existingButton = container.querySelector(
      `[data-rule-id="${rule.id}"]`
    );
    if (existingButton) {
      return; // 已经存在，不重复插入
    }
  }

  // 创建下载按钮
  const button = document.createElement("button");
  button.setAttribute("data-rule-id", rule.id);
  button.type = "button"; // 防止表单提交

  // 创建图标元素
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icon-128.png");
  icon.style.cssText = `
    width: 28px;
    height: 28px;
    margin-right: 12px;
    flex-shrink: 0;
`;

  // 创建文本节点
  const textNode = document.createTextNode(rule.buttonName);

  // 将图标和文本添加到按钮中
  button.appendChild(icon);
  button.appendChild(textNode);
  // 设置样式
  button.style.cssText = `
    position: absolute;
    left: 100px;
    z-index: 2147483647;
    padding: 8px 20px;
    background-color: #fff;
    color: #000;
    border: 2px solid #000;
    border-radius: 10px;
    cursor: pointer;
    font-family: 'Gochi Hand', cursive;
    font-size: 18px;
    box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    white-space: nowrap;
`;

  // 添加悬停效果
  button.addEventListener("mouseenter", function () {
    this.style.backgroundColor = "#000";
    this.style.color = "#fff";
    this.style.transform = "translateY(-2px)";
    this.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });

  button.addEventListener("mouseleave", function () {
    this.style.backgroundColor = "#fff";
    this.style.color = "#000";
    this.style.transform = "translateY(0)";
    this.style.boxShadow = "3px 3px 0 rgba(0, 0, 0, 0.1)";
  });

  // 添加点击效果
  button.addEventListener("mousedown", function () {
    this.style.transform = "translateY(0)";
    this.style.boxShadow = "2px 2px 0 rgba(0, 0, 0, 0.1)";
  });

  button.addEventListener("mouseup", function () {
    this.style.backgroundColor = "#000";
    this.style.color = "#fff";
    this.style.transform = "translateY(-2px)";
    this.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
  });

  // 添加点击事件
  button.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    handleDownload(rule);
  });

  // 将按钮添加到容器中
  container.appendChild(button);
  insertedButtons.add(container);
}

// 处理下载逻辑
function handleDownload(rule) {
  // 获取图片信息
  const result = getImageCountA(rule.elementPosition);
  console.log("获取图片信息:", result);
  if (!result) {
    return;
  }

  if (result.count > 0) {
    // 批量下载图片
    downloadImages(
      result.images,
      rule.buttonName,
      rule.saveFormat,
      rule.regexPattern
    );
  } else {
    alert("未找到图片");
  }
}

// 批量下载图片函数
function downloadImages(
  images,
  prefix = "image",
  format = "jpg",
  regexPattern
) {
  console.log("开始下载图片，数量:", images.length);
  if (images.length === 0) {
    console.log("没有图片需要下载");
    return;
  }

  // 处理正则表达式
  let regexObj = null;
  if (regexPattern) {
    try {
      if (regexPattern.startsWith("/") && regexPattern.lastIndexOf("/") > 0) {
        const lastSlashIndex = regexPattern.lastIndexOf("/");
        const pattern = regexPattern.substring(1, lastSlashIndex);
        const flags = regexPattern.substring(lastSlashIndex + 1);
        regexObj = new RegExp(pattern, flags);
      } else {
        regexObj = new RegExp(regexPattern, "g");
      }
    } catch (e) {
      console.error("正则表达式处理出错:", e);
    }
  }

  // 遍历下载
  images.forEach((image, index) => {
    let imageUrl = image.src;
    if (!imageUrl) {
      console.log("图片URL为空，跳过:", image);
      return;
    }

    // 使用正则表达式处理URL
    if (regexObj) {
      try {
        const originalUrl = imageUrl;
        imageUrl = imageUrl.replace(regexObj, "");

        if (imageUrl === originalUrl) {
          console.log("正则表达式处理失败，未找到匹配项:", originalUrl);
        }
      } catch (e) {
        console.error("正则表达式替换出错:", e);
      }
    }

    if (imageUrl.startsWith("//")) {
      imageUrl = `https:${imageUrl}`;
    }

    const fileExtension =
      format && (format === "jpg" || format === "png") ? format : "jpg";
    const filename = `${prefix}_${index + 1}.jpg`; // 直接指定.jpg后缀
    // 使用 Chrome 下载 API
    // 使用 Chrome 下载 API
    setTimeout(() => {
      chrome.runtime.sendMessage(
        {
          action: "downloadImage",
          url: imageUrl,
          filename: filename, // 将带.jpg后缀的文件名发送给后台
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("下载请求失败:", chrome.runtime.lastError);
          } else if (response && response.status === "failed") {
            console.error("后台处理失败:", response.error);
          } else {
            console.log("下载请求已成功发送至后台处理:", response);
          }
        }
      );
    }, index * 200); // 每张图片间隔200ms
  });
}

// 获取类元素下的图片数量
function getImageCountA(className) {
  const imagesInfo = [];

  try {
    const container = document.querySelector(className);
    console.log("使用简单选择器:", className);

    if (container) {
      const images = container.getElementsByTagName("img");
      console.log("找到的图片数量:", images.length);

      const imagesArray = Array.from(images);

      for (let i = 0; i < imagesArray.length; i++) {
        const img = imagesArray[i];
        let src = img.src;

        if (src.startsWith("//")) {
          src = `https:${src}`;
        }

        imagesInfo.push({
          index: i,
          src: src,
          alt: img.alt || "",
          className: img.className || "",
        });
      }

      return {
        count: images.length,
        images: imagesInfo,
      };
    }

    return {
      count: 0,
      images: [],
    };
  } catch (error) {
    console.error("获取图片数量时出错:", error);
    return {
      count: 0,
      images: [],
    };
  }
}

// 启动观察器
if (document.body) {
  startObserver();
  // 立即检查一次
  checkAndInsertButtons();
} else {
  // 如果body还没加载，等待它加载完成
  const bodyObserver = new MutationObserver((mutations, obs) => {
    if (document.body) {
      startObserver();
      checkAndInsertButtons();
      obs.disconnect(); // 停止观察
    }
  });

  // 观察 document 而不是 document.documentElement
  bodyObserver.observe(document.documentElement, {
    childList: true,
    subtree: false,
  });
}

function startObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    // 检查变化
    const relevantChange = mutations.some((mutation) => {
      return mutation.type === "childList" && mutation.addedNodes.length > 0;
    });

    if (relevantChange) {
      checkAndInsertButtons();
    }
  });

  // 观察body变化
  observer.observe(document.body, {
    childList: true,
    subtree: false,
  });
}

function addInteractionListeners() {
  ["click", "scroll"].forEach((eventType) => {
    document.addEventListener(
      eventType,
      function (event) {
        console.log(`${eventType} 事件触发`);
        // 确保规则已经加载且DOM已准备好
        if (currentRules && currentRules.length > 0 && document.body) {
          console.log("事件触发，规则已加载且DOM已准备好，开始检查按钮");
          checkAndInsertButtons();
        } else {
          console.log("事件触发，但条件不满足：", {
            rulesLoaded: !!(currentRules && currentRules.length > 0),
            domReady: !!document.body,
          });
        }
      },
      true
    );
  });
}

// 页面卸载时清理
window.addEventListener("unload", () => {
  if (observer) {
    observer.disconnect();
  }
});
