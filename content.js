// content.js - 性能优化版本
let currentRules = [];
let checkInterval = null;
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 2000; // 最小检查间隔
const insertedButtons = new WeakSet(); // 使用WeakSet避免内存泄漏

// 页面加载时获取规则
chrome.runtime.sendMessage({ action: "getRules" }, function (response) {
    console.log("获取规则：", response.rules)
    if (response && response.rules) {

        currentRules = response.rules;
        checkAndInsertButtons();
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

// 性能优化：添加防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 性能优化：添加节流函数
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        const result = arguments.length ? func.apply(this, args) : func.call(this);
        if (!inThrottle) {
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
        return result;
    };
}

// 检查并插入按钮 - 优化版本
function checkAndInsertButtons() {
    // 性能优化：避免频繁检查
    const now = Date.now();
    if (now - lastCheckTime < MIN_CHECK_INTERVAL) {
        return;
    }
    lastCheckTime = now;

    // 获取当前页面的域名
    const currentDomain = window.location.hostname;

    // 性能优化：提前过滤匹配的规则
    const matchingRules = currentRules.filter(rule =>
        rule.webKeyword && currentDomain.includes(rule.webKeyword)
    );

    if (matchingRules.length === 0) {
        return; // 没有匹配规则，直接返回
    }

    // 使用 requestAnimationFrame 优化DOM操作
    requestAnimationFrame(() => {
        matchingRules.forEach(rule => {
            const container = document.querySelector(rule.buttonPosition);
            if (container) {
                console.log('找到目标容器，插入按钮:', rule.buttonName);
                insertDownloadButton(rule, container);
            }
        });
    });
}

// 插入下载按钮 - 优化版本
function insertDownloadButton(rule, container) {
    // 使用WeakSet检查是否已插入
    if (insertedButtons.has(container)) {
        const existingButton = container.querySelector(`[data-rule-id="${rule.id}"]`);
        if (existingButton) {
            return; // 已经存在，不重复插入
        }
    }

    // 创建下载按钮
    const button = document.createElement('button');
    button.setAttribute('data-rule-id', rule.id);
    button.type = 'button'; // 防止表单提交

    // 创建图标元素
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon-128.png');
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
    // 性能优化：一次性设置所有样式
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

    // 性能优化：只在需要时修改容器样式
    // if (getComputedStyle(container).position === 'static') {
    //     container.style.position = 'relative';
    // }
    // container.style.overflow = 'visible';

    // 性能优化：使用事件委托和缓存样式
    const hoverStyles = {
        backgroundColor: '#000',
        color: '#fff',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
    };

    const defaultStyles = {
        backgroundColor: '#fff',
        color: '#000',
        transform: 'translateY(0)',
        boxShadow: '3px 3px 0 rgba(0, 0, 0, 0.1)'
    };

    const activeStyles = {
        transform: 'translateY(0)',
        boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.1)'
    };

    // 添加悬停效果
    button.addEventListener('mouseenter', function () {
        Object.assign(this.style, hoverStyles);
    });

    button.addEventListener('mouseleave', function () {
        Object.assign(this.style, defaultStyles);
    });

    // 添加点击效果
    button.addEventListener('mousedown', function () {
        Object.assign(this.style, activeStyles);
    });

    button.addEventListener('mouseup', function () {
        Object.assign(this.style, hoverStyles);
    });

    // 添加点击事件 - 使用防抖避免重复点击
    const debouncedHandleDownload = debounce(() => handleDownload(rule), 300);
    button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        debouncedHandleDownload();
    });

    // 将按钮添加到容器中
    container.appendChild(button);
    insertedButtons.add(container);
}

// 处理下载逻辑
function handleDownload(rule) {
    // 获取图片信息
    const result = getImageCountA(rule.elementPosition);
    console.log('获取图片信息:', result);
    if (!result) {
        return;
    }

    if (result.count > 0) {
        // 批量下载图片
        downloadImages(result.images, rule.buttonName, rule.saveFormat, rule.regexPattern);
    } else {
        alert('未找到图片');
    }
}

// 批量下载图片函数 - 恢复原始逻辑，优化性能
function downloadImages(images, prefix = 'image', format = 'jpg', regexPattern) {
    console.log('开始下载图片，数量:', images.length);
    if (images.length === 0) {
        console.log('没有图片需要下载');
        return;
    }

    // 性能优化：预编译正则表达式
    let regexObj = null;
    if (regexPattern) {
        try {
            if (regexPattern.startsWith('/') && regexPattern.lastIndexOf('/') > 0) {
                const lastSlashIndex = regexPattern.lastIndexOf('/');
                const pattern = regexPattern.substring(1, lastSlashIndex);
                const flags = regexPattern.substring(lastSlashIndex + 1);
                regexObj = new RegExp(pattern, flags);
            } else {
                regexObj = new RegExp(regexPattern, 'g');
            }
        } catch (e) {
            console.error('正则表达式处理出错:', e);
        }
    }

    // 直接遍历下载，保持原有逻辑
    images.forEach((image, index) => {
        let imageUrl = image.src;
        if (!imageUrl) {
            console.log('图片URL为空，跳过:', image);
            return;
        }

        // 使用预编译的正则表达式
        if (regexObj) {
            try {
                const originalUrl = imageUrl;
                imageUrl = imageUrl.replace(regexObj, "");

                if (imageUrl === originalUrl) {
                    console.log('正则表达式处理失败，未找到匹配项:', originalUrl);
                }
            } catch (e) {
                console.error('正则表达式替换出错:', e);
            }
        }

        if (imageUrl.startsWith('//')) {
            imageUrl = `https:${imageUrl}`;
        }

        const fileExtension = format && (format === 'jpg' || format === 'png') ? format : 'jpg';
        const filename = `${prefix}_${index + 1}.${fileExtension}`;

        // 使用 Chrome 下载 API - 添加小延迟避免触发浏览器限制
        setTimeout(() => {
            chrome.runtime.sendMessage({
                action: "downloadImage",
                url: imageUrl,
                // filename: filename
            }, function (response) {
                if (chrome.runtime.lastError) {
                    console.error('下载失败:', chrome.runtime.lastError);
                } else {
                    console.log('下载请求已发送:', response);
                }
            });
        }, index * 200); // 每张图片间隔200ms，避免触发浏览器下载限制
    });
}

// 获取类元素下的图片数量 - 优化版本
function getImageCountA(className) {
    const imagesInfo = [];

    try {
        const container = document.querySelector(className);
        console.log('使用简单选择器:', className);

        if (container) {
            // 性能优化：使用 getElementsByTagName 更快
            const images = container.getElementsByTagName('img');
            console.log('找到的图片数量:', images.length);

            // 性能优化：预分配数组大小
            const imagesArray = Array.from(images);

            for (let i = 0; i < imagesArray.length; i++) {
                const img = imagesArray[i];
                let src = img.src;

                if (src.startsWith('//')) {
                    src = `https:${src}`;
                }

                imagesInfo.push({
                    index: i,
                    src: src,
                    alt: img.alt || '',
                    className: img.className || ''
                });
            }

            return {
                count: images.length,
                images: imagesInfo
            };
        }

        return {
            count: 0,
            images: []
        };
    } catch (error) {
        console.error('获取图片数量时出错:', error);
        return {
            count: 0,
            images: []
        };
    }
}

// 页面加载完成后检查插入按钮
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', checkAndInsertButtons);
// } else {
//     // DOM已经加载完成
//     checkAndInsertButtons();
// }

// 修改为立即启动观察器
if (document.body) {
    startObserver();
    // 立即检查一次，防止元素已经存在
    checkAndInsertButtons();
} else {
    // 如果body还没加载，等待它加载完成
    const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
            startObserver();
            checkAndInsertButtons();
            obs.disconnect(); // 停止观察
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// 性能优化：使用 MutationObserver 替代定时器
let observer = null;

function startObserver() {
    if (observer) {
        observer.disconnect();
    }

    // 使用节流的检查函数
    const throttledCheck = throttle(checkAndInsertButtons, 1000);

    observer = new MutationObserver((mutations) => {
        // 只在有相关变化时检查
        const relevantChange = mutations.some(mutation => {
            return mutation.type === 'childList' &&
                mutation.addedNodes.length > 0;
        });

        if (relevantChange) {
            throttledCheck();
        }
    });

    // 只观察body的直接子元素变化
    observer.observe(document.body, {
        childList: true,
        subtree: false // 不观察所有后代，提高性能
    });
}

// 启动观察器
if (document.body) {
    startObserver();
} else {
    document.addEventListener('DOMContentLoaded', startObserver);
}

// 性能优化：页面卸载时清理
window.addEventListener('unload', () => {
    if (observer) {
        observer.disconnect();
    }
    if (checkInterval) {
        clearInterval(checkInterval);
    }
});