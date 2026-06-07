// ==UserScript==
// @name         中科大教学质量评价自动填写
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  自动填写中科大教学质量管理平台评教问卷，支持新版单选、多选、文本题
// @author       Your Name
// @match        https://tqm.ustc.edu.cn/index.html*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置区 ====================
    const CONFIG = {
        // 自动提交延迟(毫秒)
        submitDelay: 300,

        // 填写模式: 'best' | 'worst' | 'normal' | 'random'
        // best: 全选最好选项(多选题选前两项)
        // worst: 全选最差选项(多选题选最后一项)
        // normal: 全选一般选项(多选题选中等项)
        // random: 随机选择(多选题随机选1-3项)
        fillMode: 'best',

        // 【关键修复】默认关闭，避免覆盖用户的下拉框选择
        randomMode: false,

        // 文本评价开关：开启才自动填写预设文本，关闭则保持文本题为空
        enableTextEvaluation: false,

        // 文本题答案库(随机选择一个)
        textAnswerPool: [
            '老师授课认真负责,讲解清晰,课堂氛围良好。建议增加更多实践案例。',
            '课程内容丰富,教学方法得当,受益匪浅。希望能增加一些课堂互动。',
            '教师备课充分,讲解深入浅出,很好地激发了学习兴趣。',
            '课程设计合理,教学效果显著,建议适当增加课后练习。',
            '老师教学态度认真,能够耐心解答问题,希望能提供更多学习资料。'
        ]
    };

    // 全局状态
    let isPaused = false;
    let currentTeacher = 0; // 已处理的教师数量

    const SELECTORS = {
        answerRoot: '.index__answer--p1aNv',
        choiceGroup: '.index__selectGroup--Z1yeL',
        textArea: 'textarea.index__UEditoTextarea--yga85',
        submitButton: 'button.index__submit--jiKIA',
        submitContext: '.index__submitContext--xZR4w',
        tab: '.ant-tabs-tab',
        modalButton: '.ant-modal-content button',
        antButton: 'button.ant-btn'
    };

    // ==================== 工具函数 ====================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const target = document.querySelector(selector);
                if (target) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(target);
                }
            });

            const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素超时: ${selector}`));
            }, timeout);

            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }

    function randomDelay(min = 30, max = 120) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return sleep(delay);
    }

    // ==================== 核心功能函数 ====================

    function getAnswerByMode(mode, optionsCount) {
        switch(mode) {
            case 'best':
                return 1;
            case 'worst':
                return optionsCount;
            case 'normal':
                return Math.ceil(optionsCount / 2);
            case 'random':
                return Math.floor(Math.random() * optionsCount) + 1;
            default:
                return 1;
        }
    }

    function getRandomMode() {
        const modes = ['best', 'worst', 'normal', 'random'];
        return modes[Math.floor(Math.random() * modes.length)];
    }

    function getRandomIndices(length, count) {
        const indices = Array.from({ length }, (_, idx) => idx);
        const limit = Math.min(count, length);

        for (let i = 0; i < limit; i++) {
            const j = i + Math.floor(Math.random() * (length - i));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        return indices.slice(0, limit);
    }

    function dispatchTextareaEvents(textarea) {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function fillChoiceQuestions() {
        console.log('开始填写选择题(单选/多选)...');

        // 逻辑修复：只有开启了randomMode，才每次随机切模式；否则严格使用下拉框的值
        const currentMode = CONFIG.randomMode ? getRandomMode() : CONFIG.fillMode;
        console.log(`当前填写模式: ${currentMode}`);

        const choiceGroups = document.querySelectorAll(SELECTORS.choiceGroup);
        console.log(`找到 ${choiceGroups.length} 道选择题`);

        for (let i = 0; i < choiceGroups.length; i++) {
            if (isPaused) {
                console.log('⏸ 已暂停');
                return false;
            }

            try {
                await randomDelay();

                const group = choiceGroups[i];
                const radios = group.querySelectorAll('input[type="radio"]');
                const checkboxes = group.querySelectorAll('input[type="checkbox"]');

                if (radios.length > 0) {
                    const answerValue = getAnswerByMode(currentMode, radios.length);
                    if (answerValue <= radios.length) {
                        const targetRadio = radios[answerValue - 1];
                        if (!targetRadio.checked) targetRadio.click();
                        console.log(`✓ 第${i + 1}题(单选)已选择: 选项${answerValue}/${radios.length}`);
                    }
                } else if (checkboxes.length > 0) {
                    let targetIndices = [];
                    let maxSelect = Math.min(3, checkboxes.length);

                    switch(currentMode) {
                        case 'best':
                            targetIndices = [0, 1]; // 选前两项
                            break;
                        case 'worst':
                            targetIndices = [checkboxes.length - 1]; // 选最后一项
                            break;
                        case 'normal':
                            targetIndices = [Math.floor(checkboxes.length / 2)]; // 选中等
                            break;
                        case 'random':
                        default:
                            const selectCount = Math.floor(Math.random() * maxSelect) + 1;
                            targetIndices = getRandomIndices(checkboxes.length, selectCount);
                            break;
                    }

                    targetIndices.forEach(idx => {
                        if (checkboxes[idx] && !checkboxes[idx].checked) {
                            checkboxes[idx].click();
                        }
                    });
                    console.log(`✓ 第${i + 1}题(多选)已选择: ${targetIndices.length}个选项`);
                } else {
                    console.warn(`⚠ 第${i + 1}题没有找到选项(可能不是选择题)`);
                }

            } catch (error) {
                console.error(`✗ 填写第${i + 1}题失败:`, error);
            }
        }

        console.log('选择题填写完成!');
        return true;
    }

    async function fillTextQuestions() {
        console.log('开始填写文本题...');

        if (isPaused) return false;

        try {
            const textareas = document.querySelectorAll(SELECTORS.textArea);

            if (!CONFIG.enableTextEvaluation) {
                textareas.forEach(textarea => {
                    if (textarea.value) {
                        textarea.value = '';
                        dispatchTextareaEvents(textarea);
                    }
                });
                console.log(`文本评价开关关闭，已保持 ${textareas.length} 个文本题为空`);
                return true;
            }

            await randomDelay();

            if (textareas.length > 0) {
                for(let i = 0; i < textareas.length; i++) {
                    const randomAnswer = CONFIG.textAnswerPool[
                        Math.floor(Math.random() * CONFIG.textAnswerPool.length)
                    ];

                    const textarea = textareas[i];
                    textarea.value = randomAnswer;
                    dispatchTextareaEvents(textarea);

                    console.log(`✓ 第${i + 1}个文本题已填写: ${randomAnswer.substring(0, 15)}...`);
                }
            }
        } catch (error) {
            console.error(`✗ 填写文本题失败:`, error);
        }
        return true;
    }

    async function submitQuestionnaire() {
        console.log('准备提交问卷...');

        if (isPaused) return false;

        try {
            await sleep(CONFIG.submitDelay);

            let submitButton = document.querySelector(SELECTORS.submitButton) ||
                               Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('提 交') || btn.textContent.includes('提交'));

            if (!submitButton) {
                const submitContext = document.querySelector(SELECTORS.submitContext);
                if (submitContext) submitButton = submitContext.querySelector('button');
            }

            if (submitButton) {
                console.log('✓ 找到提交按钮,准备点击...');
                await sleep(150);
                submitButton.click();
                console.log('✓ 问卷已提交!');

                await sleep(500);

                const nextTeacherButton = Array.from(document.querySelectorAll(SELECTORS.modalButton))
                    .find(btn => btn.textContent.includes('下一位教师'));

                if (nextTeacherButton) {
                    await sleep(150);
                    nextTeacherButton.click();
                    currentTeacher++;
                    console.log(`📊 已完成 ${currentTeacher} 位教师的评价`);
                    await sleep(350);
                } else {
                    const confirmButton = Array.from(document.querySelectorAll(SELECTORS.modalButton))
                        .find(btn => btn.textContent.includes('确 定') || btn.textContent.includes('确定'));
                    if (confirmButton) {
                        await sleep(150);
                        confirmButton.click();
                        currentTeacher++;
                        console.log(`📊 已完成 ${currentTeacher} 位教师的评价`);
                        await sleep(350);
                    }
                }
                return true;
            } else {
                console.error('✗ 未找到提交按钮!');
                return false;
            }
        } catch (error) {
            console.error('✗ 提交失败:', error);
            return false;
        }
    }

    async function clickNextCourse() {
        console.log('查找"下一课程"按钮...');
        if (isPaused) return false;

        try {
            await sleep(500);
            const nextButton = Array.from(document.querySelectorAll(SELECTORS.antButton))
                .find(btn => btn.textContent.includes('下一课程'));

            if (nextButton) {
                await sleep(150);
                nextButton.click();
                await sleep(650);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async function processAllTabs() {
        const tabs = document.querySelectorAll(SELECTORS.tab);
        let startIndex = 0;
        for (let i = 0; i < tabs.length; i++) {
            if (tabs[i].classList.contains('ant-tabs-tab-active')) {
                startIndex = i;
                break;
            }
        }

        for (let i = startIndex; i < tabs.length; i++) {
            if (isPaused) return false;

            if (i !== startIndex) {
                tabs[i].click();
                await sleep(300);
            }

            const choiceSuccess = await fillChoiceQuestions();
            if (!choiceSuccess) return false;

            const textSuccess = await fillTextQuestions();
            if (!textSuccess) return false;

            const submitted = await submitQuestionnaire();
            if (!submitted) return false;

            await sleep(100);
        }
        return true;
    }

    async function processSingleQuestionnaire() {
        const success = await processAllTabs();
        if (!success) return false;
        return true;
    }

    async function mainLoop() {
        let hasMore = true;
        while (hasMore && !isPaused) {
            const success = await processSingleQuestionnaire();
            if (!success) break;

            hasMore = await clickNextCourse();
            if (!hasMore) {
                updateButton('✅ 全部完成', '#52c41a', true);
                break;
            }
        }
    }

    // ==================== UI控制 ====================

    let controlButton = null;

    function updateButton(text, bgColor, disabled) {
        if (controlButton) {
            controlButton.textContent = text;
            controlButton.style.background = bgColor;
            controlButton.disabled = disabled;
        }
    }

    function addControlPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 200px;
            cursor: move;
            user-select: none;
            color: #333;
        `;

        let isDragging = false;
        let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

        panel.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.closest('button, select, input, label')) return;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }

        function dragEnd() {
            isDragging = false;
        }

        const title = document.createElement('div');
        title.textContent = '🤖 自动评教助手';
        title.style.cssText = `font-size: 16px; font-weight: bold; margin-bottom: 12px; cursor: move;`;
        panel.appendChild(title);

        const status = document.createElement('div');
        status.id = 'auto-eval-status';
        status.textContent = '准备就绪';
        status.style.cssText = `font-size: 12px; color: #666; margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px;`;
        panel.appendChild(status);

        const modeLabel = document.createElement('div');
        modeLabel.textContent = '填写模式:';
        modeLabel.style.cssText = `font-size: 12px; color: #666; margin-bottom: 5px;`;
        panel.appendChild(modeLabel);

        const modeSelect = document.createElement('select');
        modeSelect.style.cssText = `width: 100%; padding: 6px; margin-bottom: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 12px; cursor: pointer; color: #333;`;
        modeSelect.innerHTML = `
            <option value="best">全选最好</option>
            <option value="normal">全选一般</option>
            <option value="worst">全选最差</option>
            <option value="random">随机模式</option>
        `;
        modeSelect.value = CONFIG.fillMode;

        const randomModeDiv = document.createElement('div');
        randomModeDiv.style.cssText = `font-size: 12px; margin-bottom: 12px; display: flex; align-items: center;`;

        const randomModeCheckbox = document.createElement('input');
        randomModeCheckbox.type = 'checkbox';
        randomModeCheckbox.checked = CONFIG.randomMode;
        randomModeCheckbox.style.cssText = `margin-right: 5px;`;

        // 【关键修复】下拉框和复选框联动逻辑
        modeSelect.addEventListener('change', (e) => {
            CONFIG.fillMode = e.target.value;
            if (CONFIG.randomMode) {
                CONFIG.randomMode = false;
                randomModeCheckbox.checked = false;
            }
            console.log('填写模式已更改为:', CONFIG.fillMode);
        });

        randomModeCheckbox.addEventListener('change', (e) => {
            CONFIG.randomMode = e.target.checked;
            console.log('每份随机模式:', CONFIG.randomMode);
        });

        const randomModeLabel = document.createElement('span');
        randomModeLabel.textContent = '每份问卷随机模式';
        randomModeLabel.style.color = '#666';

        panel.appendChild(modeSelect);
        randomModeDiv.appendChild(randomModeCheckbox);
        randomModeDiv.appendChild(randomModeLabel);
        panel.appendChild(randomModeDiv);

        const textEvalDiv = document.createElement('label');
        textEvalDiv.style.cssText = `font-size: 12px; margin-bottom: 12px; display: flex; align-items: center; cursor: pointer; color: #666;`;

        const textEvalCheckbox = document.createElement('input');
        textEvalCheckbox.type = 'checkbox';
        textEvalCheckbox.checked = CONFIG.enableTextEvaluation;
        textEvalCheckbox.style.cssText = `margin-right: 5px;`;

        textEvalCheckbox.addEventListener('change', (e) => {
            CONFIG.enableTextEvaluation = e.target.checked;
            console.log('文本评价自动填写:', CONFIG.enableTextEvaluation);
        });

        const textEvalLabel = document.createElement('span');
        textEvalLabel.textContent = '文本评价';

        textEvalDiv.appendChild(textEvalCheckbox);
        textEvalDiv.appendChild(textEvalLabel);
        panel.appendChild(textEvalDiv);

        controlButton = document.createElement('button');
        controlButton.textContent = '▶️ 开始填写';
        controlButton.style.cssText = `width: 100%; padding: 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; margin-bottom: 8px;`;

        controlButton.addEventListener('click', async () => {
            if (isPaused || currentTeacher === 0) {
                isPaused = false;
                updateButton('⏸ 暂停', '#ff9800', false);
                status.textContent = '运行中...';
                status.style.background = '#e6f7ff';
                await mainLoop();
            } else {
                isPaused = true;
                updateButton('▶️ 继续', '#52c41a', false);
                status.textContent = '已暂停';
                status.style.background = '#fff7e6';
            }
        });
        panel.appendChild(controlButton);

        const resetButton = document.createElement('button');
        resetButton.textContent = '🔄 重置';
        resetButton.style.cssText = `width: 100%; padding: 8px; background: #f5f5f5; color: #666; border: 1px solid #d9d9d9; border-radius: 4px; cursor: pointer; font-size: 12px;`;
        resetButton.addEventListener('click', () => {
            isPaused = true;
            currentTeacher = 0;
            updateButton('▶️ 开始填写', '#1890ff', false);
            status.textContent = '准备就绪';
            status.style.background = '#f5f5f5';
        });
        panel.appendChild(resetButton);

        document.body.appendChild(panel);

        setInterval(() => {
            if (!isPaused && currentTeacher > 0) {
                status.textContent = `已完成 ${currentTeacher} 位教师`;
            }
        }, 1000);
    }

    // ==================== 主程序 ====================

    async function main() {
        try {
            await waitForElement(SELECTORS.answerRoot);
            addControlPanel();
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
