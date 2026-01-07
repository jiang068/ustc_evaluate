// ==UserScript==
// @name         中科大教学质量评价自动填写
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动填写中科大教学质量管理平台评教问卷
// @author       jiang068
// @match        https://tqm.ustc.edu.cn/index.html*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置区 ====================
    const CONFIG = {
        // 自动提交延迟(毫秒)
        submitDelay: 500,
        
        // 填写模式: 'best' | 'worst' | 'normal' | 'random'
        // best: 全选最好选项
        // worst: 全选最差选项
        // normal: 全选一般选项
        // random: 随机选择
        fillMode: 'best',
        
        // 每次切换问卷后是否随机切换模式
        randomMode: false,
        
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

    // ==================== 工具函数 ====================
    
    /**
     * 等待指定时间
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 等待元素出现
     */
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(timer);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(timer);
                    reject(new Error(`等待元素超时: ${selector}`));
                }
            }, 100);
        });
    }

    /**
     * 随机延迟
     */
    function randomDelay(min = 50, max = 200) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return sleep(delay);
    }

    // ==================== 核心功能函数 ====================

    /**
     * 根据模式获取答案值
     */
    function getAnswerByMode(mode, optionsCount) {
        switch(mode) {
            case 'best':
                return 1; // 第一个选项通常是最好的
            case 'worst':
                return optionsCount; // 最后一个选项通常是最差的
            case 'normal':
                return Math.ceil(optionsCount / 2); // 中间选项
            case 'random':
                return Math.floor(Math.random() * optionsCount) + 1;
            default:
                return 1;
        }
    }
    
    /**
     * 随机选择一个填写模式
     */
    function getRandomMode() {
        const modes = ['best', 'worst', 'normal', 'random'];
        return modes[Math.floor(Math.random() * modes.length)];
    }

    /**
     * 填写单选题
     */
    async function fillRadioQuestions() {
        console.log('开始填写单选题...');
        
        // 如果启用随机模式,每次随机选择填写方式
        const currentMode = CONFIG.randomMode ? getRandomMode() : CONFIG.fillMode;
        console.log(`当前填写模式: ${currentMode}`);
        
        const radioGroups = document.querySelectorAll('.index__selectGroup--Z1yeL');
        console.log(`找到 ${radioGroups.length} 道单选题`);
        
        for (let i = 0; i < radioGroups.length; i++) {
            // 检查是否暂停
            if (isPaused) {
                console.log('⏸ 已暂停');
                return false;
            }
            
            try {
                // 等待随机延迟,模拟人工操作
                await randomDelay(100, 300);
                
                const radioGroup = radioGroups[i];
                const radios = radioGroup.querySelectorAll('input[type="radio"]');
                
                if (radios.length > 0) {
                    const answerValue = getAnswerByMode(currentMode, radios.length);
                    
                    if (answerValue <= radios.length) {
                        const targetRadio = radios[answerValue - 1];
                        targetRadio.click();
                        console.log(`✓ 第${i + 1}题已选择: 选项${answerValue}/${radios.length}`);
                    }
                } else {
                    console.warn(`⚠ 第${i + 1}题没有找到选项`);
                }
                
            } catch (error) {
                console.error(`✗ 填写第${i + 1}题失败:`, error);
            }
        }
        
        console.log('单选题填写完成!');
        return true;
    }

    /**
     * 填写文本题
     */
    async function fillTextQuestions() {
        console.log('开始填写文本题...');
        
        // 检查是否暂停
        if (isPaused) {
            console.log('⏸ 已暂停');
            return false;
        }
        
        try {
            await randomDelay(200, 500);
            
            // 查找textarea
            const textareas = document.querySelectorAll('textarea.index__UEditoTextarea--yga85');
            
            if (textareas.length > 0) {
                // 从答案库中随机选择一个
                const randomAnswer = CONFIG.textAnswerPool[
                    Math.floor(Math.random() * CONFIG.textAnswerPool.length)
                ];
                
                const textarea = textareas[0];
                textarea.value = randomAnswer;
                
                // 触发input事件以更新字数统计
                const inputEvent = new Event('input', { bubbles: true });
                textarea.dispatchEvent(inputEvent);
                
                const changeEvent = new Event('change', { bubbles: true });
                textarea.dispatchEvent(changeEvent);
                
                console.log(`✓ 文本题已填写: ${randomAnswer.substring(0, 20)}...`);
            } else {
                console.log('ℹ 未找到文本题(可能没有文本题)');
            }
            
        } catch (error) {
            console.error(`✗ 填写文本题失败:`, error);
        }
        
        console.log('文本题填写完成!');
        return true;
    }

    /**
     * 提交问卷
     */
    async function submitQuestionnaire() {
        console.log('准备提交问卷...');
        
        // 检查是否暂停
        if (isPaused) {
            console.log('⏸ 已暂停');
            return false;
        }
        
        try {
            await sleep(CONFIG.submitDelay);
            
            // 多种方式查找提交按钮
            let submitButton = document.querySelector('button.index__submit--jiKIA');
            
            // 如果第一种方式没找到,尝试通过文本查找
            if (!submitButton) {
                submitButton = Array.from(document.querySelectorAll('button'))
                    .find(btn => btn.textContent.includes('提 交') || btn.textContent.includes('提交'));
            }
            
            // 如果还是没找到,尝试在提交容器中查找
            if (!submitButton) {
                const submitContext = document.querySelector('.index__submitContext--xZR4w');
                if (submitContext) {
                    submitButton = submitContext.querySelector('button');
                }
            }
            
            if (submitButton) {
                console.log('✓ 找到提交按钮,准备点击...');
                await sleep(300);
                submitButton.click();
                console.log('✓ 问卷已提交!');
                
                // 等待弹窗出现
                await sleep(800);
                
                // 查找并点击"下一位教师"或"下一门课程"按钮
                let nextButton = Array.from(document.querySelectorAll('.ant-modal-content button'))
                    .find(btn => btn.textContent.includes('下一位教师'));
                
                if (!nextButton) {
                    nextButton = Array.from(document.querySelectorAll('.ant-modal-content button'))
                        .find(btn => btn.textContent.includes('下一门课程'));
                }
                
                if (nextButton) {
                    const buttonText = nextButton.textContent.trim();
                    console.log(`✓ 找到"${buttonText}"按钮,准备点击...`);
                    await sleep(300);
                    nextButton.click();
                    console.log(`✓ 已点击"${buttonText}"`);
                    currentTeacher++; // 成功提交一位教师
                    console.log(`📊 已完成 ${currentTeacher} 位教师的评价`);
                    await sleep(600); // 等待切换
                } else {
                    console.log('ℹ 未找到"下一位教师"或"下一门课程"按钮');
                    // 尝试点击"确定"按钮关闭弹窗
                    const confirmButton = Array.from(document.querySelectorAll('.ant-modal-content button'))
                        .find(btn => btn.textContent.includes('确 定') || btn.textContent.includes('确定'));
                    if (confirmButton) {
                        await sleep(300);
                        confirmButton.click();
                        console.log('✓ 已点击"确定"关闭弹窗');
                        currentTeacher++; // 成功提交一位教师
                        console.log(`📊 已完成 ${currentTeacher} 位教师的评价`);
                        console.log('🎉 所有评教已完成!');
                        await sleep(600);
                    }
                }
                
                return true;
            } else {
                console.error('✗ 未找到提交按钮!');
                console.log('提示: 请检查页面是否已填写完整');
                return false;
            }
        } catch (error) {
            console.error('✗ 提交失败:', error);
            return false;
        }
    }

    /**
     * 点击"下一课程"按钮
     */
    async function clickNextCourse() {
        console.log('查找"下一课程"按钮...');
        
        // 检查是否暂停
        if (isPaused) {
            console.log('⏸ 已暂停');
            return false;
        }
        
        try {
            await sleep(800); // 等待页面更新
            
            // 查找"下一课程"按钮
            const nextButton = Array.from(document.querySelectorAll('button.ant-btn'))
                .find(btn => btn.textContent.includes('下一课程'));
            
            if (nextButton) {
                console.log('✓ 找到"下一课程"按钮');
                await sleep(300);
                nextButton.click();
                console.log('✓ 已点击"下一课程"');
                await sleep(1000); // 等待新问卷加载
                return true;
            } else {
                console.log('ℹ 没有找到"下一课程"按钮,可能已完成所有问卷');
                return false;
            }
        } catch (error) {
            console.error('✗ 点击"下一课程"失败:', error);
            return false;
        }
    }

    /**
     * 处理所有标签页(教师)
     */
    async function processAllTabs() {
        console.log('开始处理当前问卷的所有标签页...');
        
        const tabs = document.querySelectorAll('.ant-tabs-tab');
        console.log(`找到 ${tabs.length} 个标签页(教师)`);
        
        // 找到当前激活的标签页索引
        let startIndex = 0;
        for (let i = 0; i < tabs.length; i++) {
            if (tabs[i].classList.contains('ant-tabs-tab-active')) {
                startIndex = i;
                console.log(`从第 ${i + 1} 个标签页开始(当前激活)`);
                break;
            }
        }
        
        for (let i = startIndex; i < tabs.length; i++) {
            // 检查是否暂停
            if (isPaused) {
                console.log('⏸ 已暂停');
                return false;
            }
            
            console.log(`\n${'─'.repeat(40)}`);
            console.log(`👨‍🏫 处理第 ${i + 1}/${tabs.length} 个标签页(教师)`);
            console.log('─'.repeat(40));
            
            // 如果不是当前激活的标签页,需要点击切换
            if (i !== startIndex) {
                tabs[i].click();
                await sleep(500); // 等待标签页切换
            } else {
                console.log('ℹ 当前标签页已激活,直接开始填写');
            }
            
            // 填写问卷
            const radioSuccess = await fillRadioQuestions();
            if (!radioSuccess) {
                console.error('✗ 单选题填写失败或被暂停');
                return false;
            }
            
            const textSuccess = await fillTextQuestions();
            if (!textSuccess) {
                console.error('✗ 文本题填写失败或被暂停');
                return false;
            }
            
            console.log(`✅ 第 ${i + 1} 个标签页填写完成`);
            
            // 每个标签页填写完成后都要提交
            const submitted = await submitQuestionnaire();
            if (!submitted) {
                console.error('✗ 提交失败');
                return false;
            }
            
            await sleep(200);
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ 所有标签页处理完成!');
        console.log('='.repeat(50));
        return true;
    }

    /**
     * 处理单份问卷
     */
    async function processSingleQuestionnaire() {
        console.log('\n' + '='.repeat(50));
        console.log(`📝 开始处理当前问卷`);
        console.log('='.repeat(50));
        
        // 处理所有标签页(每个标签页是一个教师,每个都会自动提交)
        const success = await processAllTabs();
        if (!success) {
            console.warn('⚠ 标签页处理未完成');
            return false;
        }
        
        console.log(`✅ 当前问卷处理完成!\n`);
        
        // 检查是否还有更多课程
        await sleep(800);
        
        // 先检查是否有弹窗中的"下一门课程"按钮
        let hasMoreInModal = Array.from(document.querySelectorAll('.ant-modal-content button'))
            .some(btn => btn.textContent.includes('下一门课程'));
        
        if (hasMoreInModal) {
            console.log('ℹ 在弹窗中发现"下一门课程"按钮,将在提交时自动点击');
            return true;
        }
        
        // 如果弹窗中没有,检查页面上是否有"下一课程"按钮
        const nextCourseBtn = Array.from(document.querySelectorAll('button.ant-btn'))
            .find(btn => btn.textContent.includes('下一课程'));
        
        return !!nextCourseBtn; // 有按钮返回true,没有返回false
    }

    /**
     * 主循环 - 持续处理问卷
     */
    async function mainLoop() {
        console.log('🚀 开始自动评教');
        console.log('配置:', {
            fillMode: CONFIG.fillMode,
            randomMode: CONFIG.randomMode,
            submitDelay: CONFIG.submitDelay
        });
        
        let hasMore = true;
        
        while (hasMore && !isPaused) {
            // 处理当前问卷
            const success = await processSingleQuestionnaire();
            
            if (!success) {
                console.log('⏸ 处理中断或已完成所有评教');
                console.log('🎉 所有问卷已处理完成!');
                updateButton('✅ 全部完成', '#52c41a', false);
                break;
            }
            
            // 点击"下一课程"(如果页面上有的话)
            hasMore = await clickNextCourse();
            
            if (!hasMore) {
                console.log('🎉 所有问卷已处理完成!');
                updateButton('✅ 全部完成', '#52c41a', false);
                break;
            }
            
            // 检查是否暂停
            if (isPaused) {
                console.log('⏸ 已暂停');
                break;
            }
        }
        
        if (isPaused) {
            console.log('⏸ 已暂停,点击"继续"可恢复');
        }
    }

    // ==================== UI控制 ====================

    let controlButton = null;

    /**
     * 更新按钮状态
     */
    function updateButton(text, bgColor, disabled) {
        if (controlButton) {
            controlButton.textContent = text;
            controlButton.style.background = bgColor;
            controlButton.disabled = disabled;
        }
    }

    /**
     * 添加控制面板
     */
    function addControlPanel() {
        // 创建控制面板容器
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
        `;
        
        // 添加拖动功能
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        panel.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            // 如果点击的是按钮或选择框,不触发拖动
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
                return;
            }
            
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
                
                setTranslate(currentX, currentY, panel);
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate(${xPos}px, ${yPos}px)`;
        }
        
        // 标题
        const title = document.createElement('div');
        title.textContent = '🤖 自动评教助手';
        title.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            color: #333;
            cursor: move;
        `;
        panel.appendChild(title);
        
        // 状态显示
        const status = document.createElement('div');
        status.id = 'auto-eval-status';
        status.textContent = '准备就绪';
        status.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-bottom: 12px;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
        `;
        panel.appendChild(status);
        
        // 模式选择
        const modeLabel = document.createElement('div');
        modeLabel.textContent = '填写模式:';
        modeLabel.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        `;
        panel.appendChild(modeLabel);
        
        const modeSelect = document.createElement('select');
        modeSelect.style.cssText = `
            width: 100%;
            padding: 6px;
            margin-bottom: 10px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        `;
        modeSelect.innerHTML = `
            <option value="random">随机模式</option>
            <option value="best">全选最好</option>
            <option value="worst">全选最差</option>
            <option value="normal">全选一般</option>
        `;
        modeSelect.value = CONFIG.fillMode;
        modeSelect.addEventListener('change', (e) => {
            CONFIG.fillMode = e.target.value;
            console.log('填写模式已更改为:', CONFIG.fillMode);
        });
        panel.appendChild(modeSelect);
        
        // 随机模式开关
        const randomModeDiv = document.createElement('div');
        randomModeDiv.style.cssText = `
            font-size: 12px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        `;
        
        const randomModeCheckbox = document.createElement('input');
        randomModeCheckbox.type = 'checkbox';
        randomModeCheckbox.checked = CONFIG.randomMode;
        randomModeCheckbox.style.cssText = `
            margin-right: 5px;
        `;
        randomModeCheckbox.addEventListener('change', (e) => {
            CONFIG.randomMode = e.target.checked;
            console.log('每份随机模式:', CONFIG.randomMode);
        });
        
        const randomModeLabel = document.createElement('span');
        randomModeLabel.textContent = '每份问卷随机模式';
        randomModeLabel.style.color = '#666';
        
        randomModeDiv.appendChild(randomModeCheckbox);
        randomModeDiv.appendChild(randomModeLabel);
        panel.appendChild(randomModeDiv);
        
        // 开始/暂停按钮
        controlButton = document.createElement('button');
        controlButton.textContent = '▶️ 开始填写';
        controlButton.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #1890ff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
        `;
        
        controlButton.addEventListener('click', async () => {
            if (isPaused || currentTeacher === 0) {
                // 开始或继续
                isPaused = false;
                updateButton('⏸ 暂停', '#ff9800', false);
                status.textContent = '运行中...';
                status.style.background = '#e6f7ff';
                
                if (currentTeacher === 0) {
                    // 首次开始
                    await mainLoop();
                } else {
                    // 继续
                    await mainLoop();
                }
            } else {
                // 暂停
                isPaused = true;
                updateButton('▶️ 继续', '#52c41a', false);
                status.textContent = '已暂停';
                status.style.background = '#fff7e6';
            }
        });
        panel.appendChild(controlButton);
        
        // 重置按钮
        const resetButton = document.createElement('button');
        resetButton.textContent = '🔄 重置';
        resetButton.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #f5f5f5;
            color: #666;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        resetButton.addEventListener('click', () => {
            isPaused = true;
            currentTeacher = 0;
            updateButton('▶️ 开始填写', '#1890ff', false);
            status.textContent = '准备就绪';
            status.style.background = '#f5f5f5';
            console.log('已重置');
        });
        panel.appendChild(resetButton);
        
        // 添加到页面
        document.body.appendChild(panel);
        
        // 更新状态显示
        setInterval(() => {
            if (!isPaused && currentTeacher > 0) {
                status.textContent = `已完成 ${currentTeacher} 位教师`;
            }
        }, 1000);
    }

    // ==================== 主程序 ====================

    /**
     * 主函数
     */
    async function main() {
        try {
            // 等待页面加载完成
            await waitForElement('.index__answer--p1aNv');
            
            console.log('✓ 页面加载完成');
            console.log('当前配置:', CONFIG);
            
            // 添加控制面板
            addControlPanel();
            
            console.log('✓ 控制面板已添加,点击"开始填写"按钮开始自动评教');
            
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
