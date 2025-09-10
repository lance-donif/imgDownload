// RuleManager.js - 优化后的规则管理器
class RuleManager {
    constructor() {
        this.storageKey = 'downloadRules';
        this.currentEditingId = null;
        this.animationDelay = 100;
        this.defaultRules = [
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

        this.init();
    }

    // 初始化
    init() {
        // 检查 DOM 是否已经加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('RuleManager initialized on DOMContentLoaded');
                this.bindEvents();
                this.loadRules();
                this.animateTableRows();
            });
        } else {
            // DOM 已经加载完成，直接执行初始化
            console.log('RuleManager initialized immediately');
            this.bindEvents();
            this.loadRules();
            this.animateTableRows();
        }
    }

    // 绑定事件
    bindEvents() {
        const saveBtn = document.getElementById('saveRuleBtn');
        const modal = document.getElementById('addRuleModal');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSaveRule());
        }

        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => this.resetForm());
        }

        // 使用事件委托处理动态添加的按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('.delete-rule')) {
                const ruleId = parseInt(e.target.closest('.delete-rule').dataset.id);
                this.handleDeleteRule(ruleId);
            } else if (e.target.closest('.edit-rule')) {
                const ruleId = parseInt(e.target.closest('.edit-rule').dataset.id);
                this.handleEditRule(ruleId);
            }
        });
    }

    // 表单验证
    validateForm() {
        const requiredFields = [
            'buttonName',
            'buttonPosition',
            'elementPosition',
            'saveFormat'
        ];

        const errors = [];
        const formData = {};

        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) {
                errors.push(`字段 ${fieldId} 不存在`);
                return;
            }

            const value = field.value.trim();
            if (!value) {
                errors.push(`${field.previousElementSibling?.textContent || fieldId} 为必填项`);
            }
            formData[fieldId] = value;
        });

        // 获取可选字段
        const optionalFields = ['regexPattern', 'webKeyword'];
        optionalFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                formData[fieldId] = field.value.trim();
            }
        });

        return { isValid: errors.length === 0, errors, formData };
    }

    // 显示错误信息
    showError(message) {
        // 这里可以用更好的UI提示，比如toast
        alert(message);
    }

    // 显示成功信息
    showSuccess(message) {
        console.log('✅', message);
        // 这里可以添加成功提示UI
    }

    // 处理保存规则
    async handleSaveRule() {
        try {
            const validation = this.validateForm();

            if (!validation.isValid) {
                this.showError(validation.errors.join('\n'));
                return;
            }

            const formMode = document.getElementById('formMode')?.value || 'add';
            const ruleId = document.getElementById('ruleId')?.value;

            const rule = {
                id: formMode === 'edit' ? parseInt(ruleId) : Date.now(),
                ...validation.formData
            };

            if (formMode === 'edit') {
                await this.updateRule(rule);
                this.showSuccess('规则更新成功');
            } else {
                await this.saveRule(rule);
                this.showSuccess('规则保存成功');
            }

            this.closeModal();
        } catch (error) {
            console.error('保存规则时出错:', error);
            this.showError('保存失败，请重试');
        }
    }

    // 保存规则到存储 - 使用Promise包装
    saveRule(rule) {
        return new Promise((resolve, reject) => {
            this.getRules()
                .then(rules => {
                    rules.push(rule);
                    return this.setRules(rules);
                })
                .then(() => {
                    this.addRuleToTable(rule);
                    resolve(rule);
                })
                .catch(reject);
        });
    }

    // 更新规则
    updateRule(updatedRule) {
        return new Promise((resolve, reject) => {
            this.getRules()
                .then(rules => {
                    const updatedRules = rules.map(rule =>
                        rule.id === updatedRule.id ? updatedRule : rule
                    );
                    return this.setRules(updatedRules);
                })
                .then(() => {
                    this.loadRules(); // 重新加载显示
                    resolve(updatedRule);
                })
                .catch(reject);
        });
    }

    // 获取规则 - Promise化
    getRules() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get([this.storageKey], (result) => {
                    resolve(result[this.storageKey] || []);
                });
            } else {
                // 降级到localStorage（用于测试环境）
                const rules = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
                resolve(rules);
            }
        });
    }

    // 设置规则 - Promise化
    setRules(rules) {
        return new Promise((resolve, reject) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ [this.storageKey]: rules }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } else {
                // 降级到localStorage
                localStorage.setItem(this.storageKey, JSON.stringify(rules));
                resolve();
            }
        });
    }

    // 加载规则
    // 修改 loadRules 方法以确保默认规则正确初始化
    async loadRules() {
        try {
            let rules = await this.getRules();

            // 如果没有规则，初始化默认规则
            if (rules.length === 0) {
                console.log('No existing rules found, initializing default rules');
                rules = this.defaultRules;
                await this.setRules(rules);
            }

            this.renderRulesTable(rules);
            console.log('Rules loaded successfully, total:', rules.length);
        } catch (error) {
            console.error('Error loading rules:', error);
            this.showError('加载规则失败');
        }
    }
    // 添加一个初始化检查方法，可以在插件安装时调用
    async initializeDefaultRules() {
        try {
            const rules = await this.getRules();
            if (rules.length === 0) {
                console.log('Initializing default rules on first install');
                await this.setRules(this.defaultRules);
                this.renderRulesTable(this.defaultRules);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error initializing default rules:', error);
            return false;
        }
    }
    // 渲染规则表格
    renderRulesTable(rules) {
        const tbody = document.querySelector('.hand-drawn-table tbody');
        if (!tbody) {
            console.error('表格tbody不存在');
            return;
        }

        // 清空现有数据
        tbody.innerHTML = '';

        // 使用文档片段提高性能
        const fragment = document.createDocumentFragment();

        rules.forEach(rule => {
            const row = this.createRuleRow(rule);
            fragment.appendChild(row);
        });

        tbody.appendChild(fragment);
    }

    // 创建规则行
    createRuleRow(rule) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td title="${this.escapeHtml(rule.buttonName)}">${this.escapeHtml(rule.buttonName)}</td>
            <td title="${this.escapeHtml(rule.buttonPosition)}">${this.escapeHtml(rule.buttonPosition)}</td>
            <td title="${this.escapeHtml(rule.elementPosition)}">${this.escapeHtml(rule.elementPosition)}</td>
            <td title="${this.escapeHtml(rule.regexPattern || '')}">${this.escapeHtml(rule.regexPattern || '')}</td>
            <td title="${this.escapeHtml(rule.webKeyword || '')}">${this.escapeHtml(rule.webKeyword || '')}</td>
            <td title="${this.escapeHtml(rule.saveFormat)}">${this.escapeHtml(rule.saveFormat)}</td>
            <td>
                <button class="action-btn edit-rule" data-id="${rule.id}" title="编辑" aria-label="编辑规则">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-rule" data-id="${rule.id}" title="删除" aria-label="删除规则">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        return row;
    }

    // HTML转义防止XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 添加单个规则到表格
    addRuleToTable(rule) {
        const tbody = document.querySelector('.hand-drawn-table tbody');
        if (!tbody) return;

        const row = this.createRuleRow(rule);
        tbody.appendChild(row);

        // 添加动画效果
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        requestAnimationFrame(() => {
            row.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateX(0)';
        });
    }

    // 处理删除规则
    handleDeleteRule(ruleId) {
        if (!confirm('确定要删除这个规则吗？')) {
            return;
        }

        this.deleteRule(ruleId)
            .then(() => {
                this.showSuccess('规则删除成功');
            })
            .catch(error => {
                console.error('删除规则时出错:', error);
                this.showError('删除失败，请重试');
            });
    }

    // 删除规则
    async deleteRule(ruleId) {
        const rules = await this.getRules();
        const filteredRules = rules.filter(rule => rule.id !== ruleId);
        await this.setRules(filteredRules);
        this.loadRules(); // 重新加载显示
    }

    // 处理编辑规则
    async handleEditRule(ruleId) {
        try {
            const rules = await this.getRules();
            const rule = rules.find(r => r.id === ruleId);

            if (!rule) {
                this.showError('未找到要编辑的规则');
                return;
            }

            this.fillFormWithRule(rule);
            this.setFormMode('edit');
            this.openModal();
        } catch (error) {
            console.error('编辑规则时出错:', error);
            this.showError('加载规则失败');
        }
    }

    // 填充表单数据
    fillFormWithRule(rule) {
        const fieldMapping = {
            'ruleId': rule.id,
            'buttonName': rule.buttonName,
            'buttonPosition': rule.buttonPosition,
            'elementPosition': rule.elementPosition,
            'regexPattern': rule.regexPattern || '',
            'webKeyword': rule.webKeyword || '',
            'saveFormat': rule.saveFormat
        };

        Object.entries(fieldMapping).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
            }
        });
    }

    // 设置表单模式
    setFormMode(mode) {
        const formMode = document.getElementById('formMode');
        const modalTitle = document.getElementById('modalTitle');
        const saveBtnText = document.getElementById('saveBtnText');

        if (formMode) formMode.value = mode;

        if (mode === 'edit') {
            if (modalTitle) modalTitle.textContent = '编辑下载规则';
            if (saveBtnText) saveBtnText.textContent = '更新规则';
        } else {
            if (modalTitle) modalTitle.textContent = '新增下载规则';
            if (saveBtnText) saveBtnText.textContent = '保存规则';
        }
    }

    // 重置表单
    resetForm() {
        const form = document.getElementById('ruleForm');
        if (form) {
            form.reset();
        }

        const ruleId = document.getElementById('ruleId');
        if (ruleId) {
            ruleId.value = '';
        }

        this.setFormMode('add');
        this.currentEditingId = null;
    }

    // 打开模态框
    openModal() {
        const modalElement = document.getElementById('addRuleModal');
        if (modalElement && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }

    // 关闭模态框
    closeModal() {
        const modalElement = document.getElementById('addRuleModal');
        if (modalElement && typeof bootstrap !== 'undefined') {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
    }

    // 表格行动画
    animateTableRows() {
        // 使用 requestIdleCallback 优化性能
        const animateRows = () => {
            const tableRows = document.querySelectorAll('.hand-drawn-table tr:not(:first-child)');
            tableRows.forEach((row, index) => {
                row.style.opacity = '0';
                row.style.transform = 'translateX(-20px)';

                setTimeout(() => {
                    row.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    row.style.opacity = '1';
                    row.style.transform = 'translateX(0)';
                }, this.animationDelay * index);
            });
        };

        if (window.requestIdleCallback) {
            requestIdleCallback(animateRows);
        } else {
            setTimeout(animateRows, 0);
        }
    }
}



// 初始化规则管理器
const ruleManager = new RuleManager();