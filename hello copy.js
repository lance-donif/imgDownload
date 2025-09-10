// hello.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded event triggered');

    // 页面加载时读取已保存的规则
    loadRules();

    // 保存规则按钮点击事件
    document.getElementById('saveRuleBtn').addEventListener('click', function () {
        saveOrUpdateRule();
    });

    // 模态框关闭时重置表单
    document.getElementById('addRuleModal').addEventListener('hidden.bs.modal', function () {
        resetForm();
    });

    // 模拟添加一些动画效果
    const tableRows = document.querySelectorAll('.hand-drawn-table tr');
    tableRows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            row.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateX(0)';
        }, 100 * index);
    });
});

// 保存或更新规则
function saveOrUpdateRule() {
    // 获取表单数据
    const ruleId = document.getElementById('ruleId').value;
    const buttonName = document.getElementById('buttonName').value;
    const classSelector = document.getElementById('classSelector').value;
    const buttonPosition = document.getElementById('buttonPosition').value;
    const elementPosition = document.getElementById('elementPosition').value;

    const regexPattern = document.getElementById('regexPattern').value;
    const webKeyword = document.getElementById('webKeyword').value;
    const saveFormat = document.getElementById('saveFormat').value;
    const formMode = document.getElementById('formMode').value;

    // 简单验证

    if (!buttonName || !classSelector || !buttonPosition || !elementPosition || !saveFormat) {
        alert('请填写必填字段！');
        return;
    }

    // 创建规则对象
    const rule = {
        id: formMode === 'edit' ? parseInt(ruleId) : Date.now(),
        buttonName,
        classSelector,
        buttonPosition,
        elementPosition,

        regexPattern,
        webKeyword,
        saveFormat
    };

    if (formMode === 'edit') {
        updateRule(rule);
    } else {
        saveRule(rule);
    }

    // 关闭模态框
    const modal = bootstrap.Modal.getInstance(document.getElementById('addRuleModal'));
    modal.hide();
}

// 保存规则到存储
function saveRule(rule) {
    // 从存储中获取现有规则
    chrome.storage.local.get(['downloadRules'], function (result) {
        let rules = result.downloadRules || [];
        rules.push(rule);

        // 保存更新后的规则列表
        chrome.storage.local.set({ downloadRules: rules }, function () {
            console.log('规则已保存:', rule);
            // 更新表格显示
            addRuleToTable(rule);
        });
    });
}

// 更新规则
function updateRule(updatedRule) {
    chrome.storage.local.get(['downloadRules'], function (result) {
        let rules = result.downloadRules || [];
        // 找到并替换现有规则
        rules = rules.map(rule => rule.id === updatedRule.id ? updatedRule : rule);

        // 保存更新后的规则列表
        chrome.storage.local.set({ downloadRules: rules }, function () {
            console.log('规则已更新:', updatedRule);
            // 重新加载规则显示
            loadRules();
        });
    });
}

// 加载规则
function loadRules() {
    chrome.storage.local.get(['downloadRules'], function (result) {
        let rules = result.downloadRules || [];
        const tbody = document.querySelector('.hand-drawn-table tbody');

        // 如果没有规则，则初始化默认规则
        if (rules.length === 0) {
            rules = getDefaultRules();
            // 保存默认规则到存储
            chrome.storage.local.set({ downloadRules: rules }, function () {
                console.log('默认规则已初始化');
            });
        }

        // 清空现有数据
        tbody.innerHTML = '';

        // 添加所有规则（包括默认规则）
        rules.forEach(rule => {
            addRuleToTable(rule);
        });
    });
}

// 获取默认规则
function getDefaultRules() {
    return [
        {
            id: 1,
            buttonName: "希音按钮",
            classSelector: "product-image",
            buttonPosition: ".crop-image-container__mask .not-fsp-element",
            elementPosition: "thumbs-picture",
            regexPattern: "_thumbnail_\\d+x\\d+",
            webKeyword: "shein",
            saveFormat: "jpg"
        },
        {
            id: 2,
            buttonName: "亚马逊图片",
            classSelector: "product-image",
            buttonPosition: ".product-title",
            elementPosition: ".image-block",
            regexPattern: "/images/.*\\.(jpg|png|jpeg)/",
            webKeyword: "amazon",
            saveFormat: "png"
        }
    ];
}

// 将规则添加到表格中
function addRuleToTable(rule) {
    const tbody = document.querySelector('.hand-drawn-table tbody');
    const row = document.createElement('tr');

    row.innerHTML = `
        <td>${rule.buttonName}</td>
        <td>${rule.classSelector}</td>
        <td>${rule.buttonPosition}</td>
                <td>${rule.elementPosition}</td>

        <td>${rule.regexPattern || ''}</td>
        <td>${rule.webKeyword || ''}</td>
        <td>${rule.saveFormat}</td>
        <td>
            <button class="action-btn edit-rule" data-id="${rule.id}" title="编辑">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-rule" data-id="${rule.id}" title="删除">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);

    // 为新添加的按钮绑定事件
    row.querySelector('.delete-rule').addEventListener('click', function () {
        // 添加确认对话框
        if (confirm('确定要删除这个规则吗？')) {
            deleteRule(rule.id);
        }
    });

    row.querySelector('.edit-rule').addEventListener('click', function () {
        editRule(rule.id);
    });
}

// 删除规则
function deleteRule(ruleId) {
    chrome.storage.local.get(['downloadRules'], function (result) {
        let rules = result.downloadRules || [];
        rules = rules.filter(rule => rule.id !== ruleId);

        chrome.storage.local.set({ downloadRules: rules }, function () {
            console.log('规则已删除:', ruleId);
            // 重新加载规则显示
            loadRules();
        });
    });
}

// 编辑规则
function editRule(ruleId) {
    chrome.storage.local.get(['downloadRules'], function (result) {
        const rules = result.downloadRules || [];
        const rule = rules.find(r => r.id === ruleId);

        if (rule) {
            fillFormWithRule(rule);
            // 设置表单为编辑模式
            document.getElementById('formMode').value = 'edit';
            document.getElementById('modalTitle').textContent = '编辑下载规则';
            document.getElementById('saveBtnText').textContent = '更新规则';

            // 打开模态框
            const modal = new bootstrap.Modal(document.getElementById('addRuleModal'));
            modal.show();
        }
    });
}

// 填充表单数据
function fillFormWithRule(rule) {
    document.getElementById('ruleId').value = rule.id;
    document.getElementById('buttonName').value = rule.buttonName;
    document.getElementById('classSelector').value = rule.classSelector;
    document.getElementById('buttonPosition').value = rule.buttonPosition;
    document.getElementById('elementPosition').value = rule.elementPosition;

    document.getElementById('regexPattern').value = rule.regexPattern || '';
    document.getElementById('webKeyword').value = rule.webKeyword || '';
    document.getElementById('saveFormat').value = rule.saveFormat;
}

// 重置表单
function resetForm() {
    document.getElementById('ruleForm').reset();
    document.getElementById('ruleId').value = '';
    document.getElementById('formMode').value = 'add';
    document.getElementById('modalTitle').textContent = '新增下载规则';
    document.getElementById('saveBtnText').textContent = '保存规则';
}