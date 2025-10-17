(function (global) {
    'use strict';

    // 🔴 移除此處的 let player, market, gameState;
    // 經測試，此處的模組級變數是導致「決策回顧」Bug 的元兇
    // 我們將在函數中直接使用 global.GameState.player

    // --- DOM 元素快取 ---
    const $ = (sel) => document.querySelector(sel);
    let modalEl, eventTitleEl, eventDescEl, eventContentEl, eventResultEl, leaderboardModalEl, worksListEl, lbSubtitleEl, lbCloseBtn;
    // ▼▼▼【修補程式碼 2.1】新增 Replay Modal 的變數 ▼▼▼
    let replayModalEl, replayTitleEl, replayDescEl, replayContentEl, replayResultEl;

    // ── 行動版 HUD 同步工具 ──
    function updateMobileHUD() {
        try {
            // 確保 player 變數已從全域狀態更新
            if (!global.GameState || !global.GameState.player) return;
            const player = global.GameState.player;

            const m = document.getElementById('hud-money');
            const e = document.getElementById('hud-exp');
            const c = document.getElementById('hud-creative');
            if (!m || !e || !c) return;
            m.textContent = (player.money || 0).toLocaleString('zh-TW');
            e.textContent = (player.exp || 0).toLocaleString('zh-TW');
            c.textContent = (player.creativity || 0).toLocaleString('zh-TW');
        } catch (_) { }
    }

    // --- 寶石 1: 數值閃爍的工具函數 ---
    function flashStat(element, newValue, oldValue) {
        if (!element || newValue === oldValue) return;

        element.textContent = element.textContent.replace(oldValue.toLocaleString(), newValue.toLocaleString());

        const change = newValue - oldValue;
        if (change > 0) {
            element.classList.add('stat-flash-increase');
        } else if (change < 0) {
            element.classList.add('stat-flash-decrease');
        }

        // 動畫結束後移除 class，方便下次觸發
        setTimeout(() => {
            element.classList.remove('stat-flash-increase', 'stat-flash-decrease');
        }, 700);
    }
    // --- 初始化 UI 元素 ---
    function initUI() {
        modalEl = $('#modal');
        eventTitleEl = $('#event-title');
        eventDescEl = $('#event-desc');
        eventContentEl = $('#event-content');
        eventResultEl = $('#event-result');
        leaderboardModalEl = $('#leaderboard-modal');
        worksListEl = $('#works-list');
        lbSubtitleEl = $('#lb-subtitle');
        lbCloseBtn = $('#lb-close');

        // ▼▼▼【修補程式碼 2.2】快取新的 Replay Modal 元素 ▼▼▼
        replayModalEl = $('#replay-modal');
        replayTitleEl = $('#replay-title');
        replayDescEl = $('#replay-desc');
        replayContentEl = $('#replay-content');
        replayResultEl = $('#replay-result');
        // ▲▲▲ 修補結束 ▲▲▲
    }


    // --- 棋盤繪製 (修正版) ---
    function createBoard() {
        const boardEl = $('#game-board');
        if (!boardEl) return;
        boardEl.innerHTML = '<div id="player-token"></div>';

        // 我們會遍歷 boardLayout 中的「每一個」位置，包含 null
        global.GameData.boardLayout.forEach((type, index) => {
            const cell = document.createElement('div');
            cell.classList.add('board-cell');
            cell.dataset.index = index;
            let text = '';

            switch (type) {
                case 'S':
                    cell.classList.add('cell-start');
                    text = '起點';
                    break;
                case 'E':
                    cell.classList.add('cell-event');
                    text = '事件';
                    break;
                case 'M':
                    cell.classList.add('cell-market');
                    text = '市場';
                    break;
                // ▼▼▼ 這是關鍵的新增 ▼▼▼
                case null:
                    cell.classList.add('cell-empty');
                    // 空白格不需要文字
                    break;
                // ▲▲▲ 新增結束 ▲▲▲
            }
            cell.textContent = text;
            boardEl.appendChild(cell);
        });
    }

    // --- 更新玩家儀表板 ---
    function updatePlayerDashboard() {
        // 🔴【決策 Bug 修復】不再依賴此處設定模組變數
        const { player, market, gameState } = global.GameState;
        if (!player) return;

        $('#stat-money').textContent = `💰${player.money.toLocaleString()}`;
        $('#stat-exp').textContent = `⭐${player.exp}`;
        $('#stat-creativity').textContent = `📖${player.creativity}`;

        for (const attr in player.attributes) {
            const value = Math.max(0, Math.min(100, player.attributes[attr]));
            $(`#attr-${attr} .attribute-fill`).style.width = `${value}%`;
        }

        const inventoryEl = $('#inventory');
        inventoryEl.innerHTML = '';
        const flowerNames = { peony: '牡丹', lotus: '蓮', chrys: '菊' };
        for (const flower in player.inventory) {
            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.innerHTML = `<span>${flowerNames[flower]} (價: ${market.prices[flower]})</span><strong>${player.inventory[flower]}</strong>`;
            inventoryEl.appendChild(itemEl);
        }
        $('#turn-counter').textContent = `第 ${gameState.turn} / ${gameState.maxTurns} 回合`;
    }

    // --- 移動玩家棋子 ---
    function movePlayerToken(newBoardIndex) {
        const cell = $(`.board-cell[data-index='${newBoardIndex}']`);
        if (cell) {
            const playerTokenEl = $('#player-token');
            playerTokenEl.style.left = `${cell.offsetLeft + cell.offsetWidth / 2 - playerTokenEl.offsetWidth / 2}px`;
            playerTokenEl.style.top = `${cell.offsetTop + cell.offsetHeight / 2 - playerTokenEl.offsetHeight / 2}px`;
        }
    }

    // --- 通用彈出視窗 ---
    function showModal(title, desc, contentHTML, resultText = '') {
        eventTitleEl.textContent = title;
        eventDescEl.textContent = desc;
        eventContentEl.innerHTML = contentHTML;
        eventResultEl.textContent = resultText;
        modalEl.classList.add('show');
    }

    // ▼▼▼【修補程式碼 2.3】新增一個*專門*給「決策回顧」用的 showReplayModal 函數 ▼▼▼
    function showReplayModal(title, desc, contentHTML, resultText = '') {
        replayTitleEl.textContent = title;
        replayDescEl.textContent = desc;
        replayContentEl.innerHTML = contentHTML;
        replayResultEl.textContent = resultText;
        replayModalEl.classList.add('show');
    }
    // ▲▲▲ 修補結束 ▲▲▲

    // --- 事件視窗 (整合了「感官之石」、「幽靈計時器修正」與「手動關閉」三大功能) ---
    function showEventModal(card, onChoice) {
        // 🔴【決策 Bug 修復】直接從全域獲取 player
        const player = global.GameState.player;
        if (!player) {
            console.error("showEventModal 找不到 player 狀態！");
            return;
        }

        // 這一部分完全不變，負責產生選項按鈕
        let contentHTML = '';
        if (card.choices) {
            contentHTML = card.choices.map((choice, index) => {
                const costMatch = choice.text.match(/花幣-(\d+)/);
                const cost = costMatch ? parseInt(costMatch[1], 10) : 0;
                const isDisabled = cost > player.money;
                const disabledAttribute = isDisabled ? 'disabled' : '';
                return `<button data-choice-index="${index}" ${disabledAttribute}>${choice.text}</button>`;
            }).join('');
        } else {
            contentHTML = `<button data-choice-index="0">了解</button>`;
        }
        showModal(card.title, card.desc, contentHTML, card.result || '');

        // 您的新手導覽提示和典籍小注顯示功能，也完全保留，不受影響
        try {
            const turn = (global.GameState && global.GameState.gameState && global.GameState.gameState.turn) || 1;
            if (turn === 1 && !sessionStorage.getItem('guide_event_first_turn')) {
                const guide = document.createElement('div');
                guide.style.background = '#fef9f3';
                guide.style.borderLeft = '4px solid #f59e0b';
                guide.style.padding = '10px 12px';
                guide.style.margin = '0 0 10px 0';
                guide.style.fontSize = '13px';
                guide.textContent = '提示:請先讀情境,再選擇行動。每個選項會影響「榮耀(牡丹)、自守(蓮)、自在(菊)」、文思與花幣。';
                const contentWrap = document.querySelector('#event-content');
                if (contentWrap && contentWrap.parentElement) {
                    contentWrap.parentElement.insertBefore(guide, contentWrap);
                    sessionStorage.setItem('guide_event_first_turn', '1');
                }
            }
        } catch (_) { }

        try {
            const note = (global.GameData && typeof global.GameData.getEventNote === 'function')
                ? global.GameData.getEventNote(card)
                : '';
            if (note) {
                const descEl = document.querySelector('#event-desc');
                if (descEl) {
                    const tip = document.createElement('div');
                    tip.style.marginTop = '10px';
                    tip.style.fontSize = '12px';
                    tip.style.color = '#64748b';
                    tip.textContent = note;
                    descEl.appendChild(tip);
                }
            }
        } catch (_) { }

        // 點擊事件處理的核心修改在這裡
        $('#event-content').onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            $('#event-content').onclick = null;

            if (card.choices) {
                // ▼▼▼ 這是我們植入最終魔法的地方 ▼▼▼

                // 1. 宣告一個變數，用來存放我們的「自動關閉」計時器
                let autoCloseTimer = null;

                const choice = card.choices[e.target.dataset.choiceIndex];

                // 🔴【決策 Bug 修復】
                // 1. 在 history push 之前，先儲存舊狀態
                // 2. 統一對 `global.GameState.player` 進行操作
                const oldMoney = global.GameState.player.money;
                const oldExp = global.GameState.player.exp;
                const oldCreativity = global.GameState.player.creativity;
                const oldAttrs = { ...global.GameState.player.attributes };

                // 執行效果，並取得結果文字
                const resultText = choice.effect(global.GameState.player);
                // ▼▼▼【🔴 TRIGGER_EVENT 修復】▼▼▼
                // 檢查 resultText，並決定要*真正*存入紀錄的文字
                let resultToRecord = resultText;
                if (resultText === 'TRIGGER_EVENT') {
                    resultToRecord = "你動身前往，觸發了新的奇遇..."; // 或者您想顯示的其他文字
                }
                // ▲▲▲ 修復結束 ▲▲▲

                // ★★★【決策 Bug 修復】將決策記錄移到 *執行效果之後* ★★★
                try {
                    if (global.GameState.player && Array.isArray(global.GameState.player.history)) {
                        global.GameState.player.history.push({
                            turn: global.GameState.gameState.turn,
                            title: card.title,
                            desc: card.desc,
                            choice: choice.text,
                            result: resultToRecord // <--- 🔴 修改這裡！
                        });
                    }
                } catch (err) {
                    console.warn("記錄決策時發生錯誤:", err);
                }
                // ★★★ 記錄結束 ★★★

                // 2. 【暗號辨識系統】，處理「尋訪名士」的特殊情況
                if (resultText === 'TRIGGER_EVENT') {
                    modalEl.classList.remove('show');
                    setTimeout(() => global.GameData.getRandomEvent ? global.UIManager.showEventModal(global.GameData.getRandomEvent(), onChoice) : onChoice(), 300);
                    return; // 結束執行，不留下任何計時器
                }

                // 3. 如果不是暗號，就走正常的「顯示結果」流程
                // (舊狀態的儲存已移到前面)

                try { // 防呆機制
                    const clamp = v => Math.max(0, Math.min(100, v | 0));
                    if (global.GameState.player && global.GameState.player.attributes) {
                        global.GameState.player.attributes.peony = clamp(global.GameState.player.attributes.peony);
                        global.GameState.player.attributes.lotus = clamp(global.GameState.player.attributes.lotus);
                        global.GameState.player.attributes.chrys = clamp(global.GameState.player.attributes.chrys);
                    }
                    if (global.GameState.player) {
                        global.GameState.player.money = Math.max(0, global.GameState.player.money | 0);
                        global.GameState.player.creativity = Math.max(0, global.GameState.player.creativity | 0);
                        global.GameState.player.exp = Math.max(0, global.GameState.player.exp | 0);
                    }
                } catch (_) { }

                // 4. 更新結果文字，並清空選項按鈕
                eventResultEl.textContent = resultText;
                eventContentEl.innerHTML = '';

                // 5. 【新增！】創建並顯示我們的手動關閉按鈕
                const closeBtn = document.createElement('button');
                closeBtn.className = 'manual-close-btn';
                closeBtn.textContent = '關閉';
                closeBtn.onclick = () => {
                    clearTimeout(autoCloseTimer); // 【關鍵！】按下時，取消自動關閉
                    modalEl.classList.remove('show');
                    $('#dice-roll-btn').disabled = false;
                    onChoice();
                };
                eventContentEl.appendChild(closeBtn); // 將按鈕加入畫面

                // 6. 執行「感官之石」的數值閃爍動畫
                // 🔴【決策 Bug 修復】統一讀取 `global.GameState.player` 的新狀態
                flashStat($('#stat-money'), global.GameState.player.money, oldMoney);
                flashStat($('#stat-exp'), global.GameState.player.exp, oldExp);
                flashStat($('#stat-creativity'), global.GameState.player.creativity, oldCreativity);
                for (const attr in global.GameState.player.attributes) {
                    if (global.GameState.player.attributes[attr] !== oldAttrs[attr]) {
                        const value = Math.max(0, Math.min(100, global.GameState.player.attributes[attr]));
                        const fillElement = $(`#attr-${attr} .attribute-fill`);
                        if (fillElement) fillElement.style.width = `${value}%`;
                    }
                }
                updateMobileHUD();

                // 7. 將原本的「自動關閉」計時器存到我們的變數中
                autoCloseTimer = setTimeout(() => {
                    if (modalEl.classList.contains('show')) {
                        modalEl.classList.remove('show');
                        $('#dice-roll-btn').disabled = false;
                        onChoice();
                    }
                }, 2500);

                // ▲▲▲ 魔法結束 ▲▲▲

            } else {
                modalEl.classList.remove('show');
                onChoice();
            }
        };
    }
    // --- 市場視窗 ---
    function showMarketModal(onComplete) {
        // 🔴【決策 Bug 修復】直接從全域獲取
        const { player, market } = global.GameState;

        const contentHTML = `
            <table class="market-table">
                <thead><tr><th>花卉</th><th>現價</th><th>持有</th><th>買入</th><th>賣出</th></tr></thead>
                <tbody>
                    <tr><td>🌺 牡丹</td><td>${market.prices.peony}</td><td>${player.inventory.peony}</td><td><input type="number" id="buy-peony" min="0" value="0"></td><td><input type="number" id="sell-peony" min="0" max="${player.inventory.peony}" value="0"></td></tr>
                    <tr><td>🪷 蓮</td><td>${market.prices.lotus}</td><td>${player.inventory.lotus}</td><td><input type="number" id="buy-lotus" min="0" value="0"></td><td><input type="number"id="sell-lotus" min="0" max="${player.inventory.lotus}" value="0"></td></tr>
                    <tr><td>🌼 菊</td><td>${market.prices.chrys}</td><td>${player.inventory.chrys}</td><td><input type="number" id="buy-chrys" min="0" value="0"></td><td><input type="number" id="sell-chrys" min="0" max="${player.inventory.chrys}" value="0"></td></tr>
                </tbody>
            </table>
            <div class="market-summary" id="market-summary">總計花費:0</div>
            <div class="market-actions"><button id="market-cancel">離開</button><button id="market-confirm" class="special">確認交易</button></div>
        `;
        showModal(`花卉市場 (持有花幣: ${player.money.toLocaleString()})`, '自由買賣花卉,累積你的財富。', contentHTML);

        const calculateTotal = () => {
            let totalCost = 0;
            totalCost += (parseInt($('#buy-peony').value) || 0) * market.prices.peony;
            totalCost -= (parseInt($('#sell-peony').value) || 0) * market.prices.peony;
            totalCost += (parseInt($('#buy-lotus').value) || 0) * market.prices.lotus;
            totalCost -= (parseInt($('#sell-lotus').value) || 0) * market.prices.lotus;
            totalCost += (parseInt($('#buy-chrys').value) || 0) * market.prices.chrys;
            totalCost -= (parseInt($('#sell-chrys').value) || 0) * market.prices.chrys;
            $('#market-summary').textContent = totalCost >= 0 ? `總計花費:${totalCost.toLocaleString()}` : `總計收入:${(-totalCost).toLocaleString()}`;
        };

        modalEl.querySelectorAll('input').forEach(input => input.addEventListener('input', calculateTotal));

        $('#market-cancel').onclick = () => { modalEl.classList.remove('show'); onComplete(); };
        $('#market-confirm').onclick = () => {
            const buys = { peony: parseInt($('#buy-peony').value) || 0, lotus: parseInt($('#buy-lotus').value) || 0, chrys: parseInt($('#buy-chrys').value) || 0 };
            const sells = { peony: parseInt($('#sell-peony').value) || 0, lotus: parseInt($('#sell-lotus').value) || 0, chrys: parseInt($('#sell-chrys').value) || 0 };

            let cost = Object.keys(buys).reduce((sum, key) => sum + buys[key] * market.prices[key], 0);
            let income = Object.keys(sells).reduce((sum, key) => sum + sells[key] * market.prices[key], 0);

            if (player.money < (cost - income)) { eventResultEl.textContent = "花幣不足!"; return; }
            for (const key in sells) { if (player.inventory[key] < sells[key]) { eventResultEl.textContent = "花卉庫存不足!"; return; } }

            player.money += income - cost;
            for (const key in player.inventory) { player.inventory[key] += buys[key] - sells[key]; }

            eventResultEl.textContent = "交易完成!";
            setTimeout(() => {
                modalEl.classList.remove('show');
                $('#dice-roll-btn').disabled = false;
                onComplete();
            }, 1500);
        };
    }

    // --- 結算視窗 ---
    // ▼▼▼ 請用這段全新的 showEndGameModal 函數，取代掉舊的 ▼▼▼
    // --- 結算視窗 (整合了新手引導彈窗) ---
    function showEndGameModal(results, onUpload, onShowReplay) { // <-- 新增 onShowReplay
        // 🔴【決策 Bug 修復】直接從全域獲取
        const { player, gameState } = global.GameState;

        const contentHTML = `
        <div class="end-game-results">
            <div class="result-card ${results.wealthChampion ? 'earned' : ''}"><div class="icon">💰</div><h3>財富冠軍</h3><p class="desc">市場的巨擘。</p></div>
            <div class="result-card ${results.characterChampion ? 'earned' : ''}"><div class="icon">🌿</div><h3>品格冠軍</h3><p class="desc">取得完美平衡。</p></div>
            <div class="result-card ${results.creativityChampion ? 'earned' : ''}"><div class="icon">⭐</div><h3>創作冠軍</h3><p class="desc">文壇的新星。</p></div>
            <div class="result-card ${results.junziChampion ? 'earned' : ''}"><div class="icon">🏅</div><h3>君子冠軍</h3><p class="desc">最終的典範。</p></div>
        </div>
        <div class="final-stats-summary">
            <div class="summary-title">詳細數據</div>
            <div class="summary-grid">
                <div>💰 花幣: ${player.money.toLocaleString()}</div>
                <div>⭐ 經驗: ${player.exp}</div>
                <div>📖 文思: ${player.creativity}</div>
                <div>🌺 牡丹: ${player.inventory.peony}</div>
                <div>🪷 蓮花: ${player.inventory.lotus}</div>
                <div>🌼 菊花: ${player.inventory.chrys}</div>
            </div>
        </div>
        ${/* 檢查是否有解鎖成就，如果有的話才顯示這個區塊 */''}
        ${results.unlockedAchievements && results.unlockedAchievements.length > 0 ? `
        <div class="achievements-summary">
            <div class="summary-title">解鎖成就 (${results.unlockedAchievements.length})</div>
            <div class="achievements-list">
                ${/* 遍歷成就陣列，為每個成就生成一個 HTML 項目 */''}
                ${results.unlockedAchievements.map(ach => `
                    <div class="achievement-item">
                        <span class="ach-emoji">${ach.emoji}</span>
                        <span class="ach-name">${ach.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        <div class="creation-draft-box">
            <label for="creation-draft-textarea">你的創作草稿 (請在此編輯)</label>
            <textarea id="creation-draft-textarea" rows="6"></textarea>
        </div>
        <button id="upload-btn" class="special" style="width: 100%; margin-top: 20px;">上傳作品並進入雅集</button>
        <button id="replay-btn" style="width: 100%; margin-top: 10px;">查看決策回顧</button>
        <button id="restart-btn" style="width: 100%; margin-top: 10px;">重新開始一局</button>
    `;
        showModal('旅程結算', `經過 ${gameState.maxTurns} 回合的探索,你的最終成就如下:`, contentHTML, `你的最終總分: ${results.finalScore.toLocaleString()}`);

        // 【✅ 核心優化】更新文字區域的內容，使用 placeholder
        const draftTextarea = $('#creation-draft-textarea');
        if (draftTextarea) {
            draftTextarea.value = buildWorkDraftForUpload(); // 系統生成的文字，仍然填入
            draftTextarea.placeholder = "✍️ 請在這裡修改或重寫你的感悟...\n\n💡 你可以分享：\n- 你做了哪些選擇？\n- 為什麼這樣選？\n- 你對品格的想法？";
        }

        $('#upload-btn').onclick = onUpload;
        $('#replay-btn').onclick = onShowReplay; // <-- 綁定新按鈕的事件
        $('#restart-btn').onclick = () => window.location.reload();

        // 【✅ 核心優化】在結算畫面出現後，延遲一秒彈出引導提示
        setTimeout(() => {
            // 檢查是否是第一次玩 (可選，但建議)
            if (!sessionStorage.getItem('hasSeenEndGameGuide')) {
                showEndGameGuidePopup();
                sessionStorage.setItem('hasSeenEndGameGuide', 'true');
            }
        }, 1000);
    }
    // ▲▲▲ 取代結束 ▲▲▲

    // --- 生成創作草稿 ---
    function buildWorkDraftForUpload() {
        // 🔴【決策 Bug 修復】直接從全域獲取
        const p = global.GameState.player;
        const attrs = p.attributes;
        const dominantAttr = Object.keys(attrs).reduce((a, b) => attrs[a] > attrs[b] ? a : b);

        let title = "〈愛蓮說〉";
        let coreIdea = "身處複雜環境,保持原則與本心。";

        if (dominantAttr === 'peony') {
            title = "〈愛牡丹說〉";
            coreIdea = "真正的君子應如牡丹,以成就照亮世界。";
        } else if (dominantAttr === 'chrys') {
            title = "〈愛菊說〉";
            coreIdea = "順應內心,在自己的時區裡悠然綻放。";
        }

        return `標題: ${title}\n核心思想: ${coreIdea}\n\n(根據您在遊戲中的選擇,系統為您生成了此創作方向。請繼續發揮...)`;
    }

    // --- 多人競價榜單 ---
    function showLeaderboardModal(roomId, userId) {
        // 首次進入雅集時的教學提示
        if (!sessionStorage.getItem('guide_leaderboard_shown')) {
            setTimeout(() => {
                showToast('💡 提示: 閱讀作品後可以投資花幣支持, 或留言給予回饋!', 5000);
                sessionStorage.setItem('guide_leaderboard_shown', '1');
            }, 1000);
        }

        // ★★★★★【本次核心修改】★★★★★
        // 1. 檢查是否處於觀戰模式
        const isSpectating = global.GameState.isSpectator === true;
        const currentPlayer = global.GameState.player;

        // 2. 根據是否為觀戰者，顯示不同的標題
        if (isSpectating) {
            lbSubtitleEl.textContent = `雅集 #${roomId} (觀戰中...)`;
        } else if (currentPlayer && typeof currentPlayer.money !== 'undefined') {
            lbSubtitleEl.textContent = `雅集 #${roomId}｜你目前花幣:${currentPlayer.money.toLocaleString()}`;
        }
        // ★★★★★★★★★★★★★★★★★★★

        leaderboardModalEl.classList.add('show');
        let currentWorks = [];

        global.FirebaseManager.getWorksOnce(roomId).then(initialWorks => {
            if (initialWorks.length > 0) {
                renderWorksList(initialWorks, userId);
            }
        });

        if (window.unsubscribe) window.unsubscribe();
        window.unsubscribe = global.FirebaseManager.listenToWorks(roomId, (works) => {
            const myWork = works.find(w => w.authorId === userId);
            const sortedWorks = [...works].sort((a, b) => (b.votes || 0) - (a.votes || 0));
            const myRank = myWork ? sortedWorks.findIndex(w => w.id === myWork.id) + 1 : '-';

            // ★★★★★【本次核心修改】★★★★★
            // 3. 在即時更新時，也根據觀戰模式顯示不同標題
            if (isSpectating) {
                lbSubtitleEl.textContent = `雅集 #${roomId} (觀戰中)`;
            } else if (currentPlayer && typeof currentPlayer.money !== 'undefined') {
                lbSubtitleEl.textContent = `雅集 #${roomId}｜你的作品排名: #${myRank}｜剩餘花幣: ${currentPlayer.money.toLocaleString()}`;
            }
            // ★★★★★★★★★★★★★★★★★★★

            currentWorks = works;
            renderWorksList(works, userId);
        });

        if (!document.getElementById('export-report-btn')) {
            const exportBtn = document.createElement('button');
            exportBtn.id = 'export-report-btn';
            exportBtn.textContent = '📥 匯出雅集報告';
            exportBtn.style.cssText = `
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 10px;
                font-weight: 700;
                cursor: pointer;
                margin-right: 10px;
            `;

            exportBtn.onclick = () => generateReport(roomId, currentWorks);

            const actionsDiv = lbCloseBtn.parentElement;
            if (actionsDiv) {
                actionsDiv.style.display = 'flex';
                actionsDiv.style.justifyContent = 'flex-end';
                actionsDiv.insertBefore(exportBtn, lbCloseBtn);
            }
        }

        // ★★★★★【🔴 觀戰 Bug 修復】★★★★★
        // 4. 優化離開雅集的確認訊息，讓玩家更清楚後果
        lbCloseBtn.onclick = () => {
            const confirmMsg = `
確定要離開雅集嗎？

⚠️ 注意：
• 離開後，此局遊戲將會結束。
• 您將無法再看到之後其他同學上傳的新作品。
• 建議等所有人都完成後，再一起匯出報告與離開。

目前雅集中已有 ${currentWorks.length} 份作品。

真的要現在離開嗎？其他同學可能還在玩喔！
    `.trim();

            if (confirm(confirmMsg)) {
                // 🔴【觀戰 Bug 修復】在重整頁面前，先清除觀戰狀態
                if (global.GameState && global.GameState.isSpectator) {
                    localStorage.removeItem('isSpectator');
                    localStorage.removeItem('spectatingRoomId');
                    console.log('已清除觀戰狀態。');
                }

                leaderboardModalEl.classList.remove('show');
                if (window.unsubscribe) window.unsubscribe();
                window.location.reload();
            }
        };
        // ★★★★★★★★★★★★★★★★★★★
    }

    // --- 生成報告函數 (獨立出來) ---
    // --- 🔴【iPhone Bug 修復】使用最穩定、相容性最高的 Blob + <a> tag 方式 ---
    function generateReport(roomId, works) {
        if (!works || works.length === 0) {
            alert('目前沒有作品可以匯出');
            return;
        }

        const sortedWorks = [...works].sort((a, b) => (b.votes || 0) - (a.votes || 0));

        const reportHTML = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>雅集 #${roomId} - 作品集</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
            background: linear-gradient(135deg, #fef3e2 0%, #fae8d4 100%);
            padding: 40px 20px;
            line-height: 1.8;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,.1);
        }
        h1 {
            font-size: 36px;
            text-align: center;
            background: linear-gradient(135deg, #ec4899, #f59e0b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 40px;
        }
        .meta {
            text-align: center;
            color: #64748b;
            margin-bottom: 40px;
            font-size: 14px;
        }
        .work {
            border: 2px solid #e2e8f0;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            background: #fafafa;
            page-break-inside: avoid;
        }
        .work-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
        }
        .work-title {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a;
        }
        .work-rank {
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 14px;
        }
        .work-meta {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .meta-item {
            background: white;
            padding: 12px;
            border-radius: 10px;
            text-align: center;
        }
        .meta-label {
            color: #64748b;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .meta-value {
            font-weight: 700;
            font-size: 18px;
            color: #6366f1;
        }
        .work-content {
            background: white;
            padding: 20px;
            border-radius: 12px;
            white-space: pre-wrap;
            line-height: 2;
            font-size: 15px;
            margin-bottom: 20px;
        }
        
        /* 🔴【報告 Bug 修復】新增/修改成就區塊的 CSS */
        .stats-section, .achievements-section {
            background: #f0f9ff;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
        }
        .stats-title {
            font-weight: 700;
            margin-bottom: 10px;
            color: #0f172a;
        }
        .stats-grid, .ach-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            font-size: 13px;
        }
        .achievements-section {
            background: #fffbeb; /* 改成淡黃色背景 */
        }
        /* 🔴 修復結束 */

        .comments-section {
            background: #fef9f3;
            padding: 15px;
            border-radius: 10px;
        }
        .comment {
            background: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .comment-author {
            font-weight: 700;
            color: #6366f1;
            margin-right: 8px;
        }
        .no-comments {
            color: #94a3b8;
            font-style: italic;
            font-size: 13px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #f1f5f9;
            color: #64748b;
            font-size: 13px;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .work { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
<div class="container">
    <h1>🌸 花與時旅人 - 雅集作品集</h1>
    <div class="meta">
        <p>雅集編號: #${roomId}</p>
        <p>匯出時間: ${new Date().toLocaleString('zh-TW')}</p>
        <p>作品總數: ${sortedWorks.length} 篇</p>
    </div>
    
    ${sortedWorks.map((work, index) => `
        <div class="work">
            <div class="work-header">
                <div class="work-title">${work.title || '未命名作品'}</div>
                <div class="work-rank">#${index + 1} 名</div>
            </div>
            
            <div class="work-meta">
                <div class="meta-item">
                    <div class="meta-label">作者</div>
                    <div class="meta-value" style="font-size: 16px;">${work.authorName || '匿名'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">雅集賞金</div>
                    <div class="meta-value">${work.votes || 0}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">留言數</div>
                    <div class="meta-value">${work.comments?.length || 0}</div>
                </div>
            </div>
            
            <div class="work-content">${work.content || '(無內容)'}</div>
            
            ${work.finalStats ? `
                <div class="stats-section">
                    <div class="stats-title">📊 作者最終數據</div>
                    <div class="stats-grid">
                        <div>💰 花幣: ${work.finalStats.money?.toLocaleString() || 0}</div>
                        <div>⭐ 經驗: ${work.finalStats.exp || 0}</div>
                        <div>📖 文思: ${work.finalStats.creativity || 0}</div>
                        <div>🌺 榮耀: ${work.finalStats.attributes?.peony || 0}</div>
                        <div>🪷 自守: ${work.finalStats.attributes?.lotus || 0}</div>
                        <div>🌼 自在: ${work.finalStats.attributes?.chrys || 0}</div>
                    </div>
                </div>
            ` : ''}
            
            ${work.gameResults ? `
                <div class="achievements-section">
                    <div class="stats-title">🏆 獲得成就</div>
                    <div class="ach-grid">
                        ${work.gameResults.wealthChampion ? '<div>💰 財富冠軍</div>' : ''}
                        ${work.gameResults.characterChampion ? '<div>🌿 品格冠軍</div>' : ''}
                        ${work.gameResults.creativityChampion ? '<div>⭐ 創作冠軍</div>' : ''}
                        ${work.gameResults.junziChampion ? '<div>🏅 君子冠軍</div>' : ''}
                        ${(work.gameResults.unlockedAchievements && work.gameResults.unlockedAchievements.length > 0)
                    ? work.gameResults.unlockedAchievements.map(ach => `<div>${ach.emoji} ${ach.name}</div>`).join('')
                    : ''
                }
                        ${!work.gameResults.wealthChampion && !work.gameResults.characterChampion && !work.gameResults.creativityChampion && !work.gameResults.junziChampion && (!work.gameResults.unlockedAchievements || work.gameResults.unlockedAchievements.length === 0) ? '<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8;">(無)</div>' : ''}
                    </div>
                </div>
            ` : ''}
            <div class="comments-section">
                <div class="stats-title">💬 雅集回饋 (${work.comments?.length || 0} 則)</div>
                ${work.comments && work.comments.length > 0
                ? work.comments.map(c => `
                        <div class="comment">
                            <span class="comment-author">${c.authorName || '匿名'}:</span>
                            <span>${c.text}</span>
                        </div>
                    `).join('')
                : '<div class="no-comments">尚無回饋</div>'
            }
            </div>
        </div>
    `).join('')}
    
    <div class="footer">
        <p><strong>花與時旅人:文人雅集篇</strong></p>
        <p>製作:新科國中胡淨羽老師 with AI Assistants | October 2025</p>
    </div>
</div>
</body>
</html>`;

        // 🔴【iPhone Bug 關鍵修復】
        const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `雅集${roomId}_作品集_${new Date().toISOString().slice(0, 10)}.html`;

        // 檢查是否為 iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        if (isIOS) {
            // iOS：設定在新分頁開啟。Safari 會在新分頁中開啟 Blob URL
            link.target = '_blank';
            showToast('📱 iOS：正在開啟新分頁... 請在新分頁中點擊「分享」→「儲存到檔案」', 4000);
        } else {
            // 桌面版與 Android：維持原本的直接下載
            showToast('✅ 已觸發下載! 請檢查您的下載項目。');
        }

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 🔴 *不能* 立刻執行 URL.revokeObjectURL(url);
        // 執行了會導致 iOS 的新分頁內容立刻失效，變成空白頁。
        // 雖然這會導致一個微小的記憶體洩漏（直到頁面關閉），
        // 但這是確保 iOS 新分頁能成功載入 Blob 內容的唯一可靠方法。
    }

    // --- 渲染作品列表 (獨立出來) ---
    function renderWorksList(works, userId) {
        worksListEl.innerHTML = '';
        if (!works || works.length === 0) {
            worksListEl.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted);">等待其他玩家上傳作品...</div>';
            return;
        }

        works.sort((a, b) => (b.votes || 0) - (a.votes || 0));

        // ★★★★★【本次核心修改】★★★★★
        // 5. 每次渲染前，都先檢查是不是觀戰模式
        const isSpectating = global.GameState.isSpectator === true;
        // ★★★★★★★★★★★★★★★★★★★

        works.forEach(work => {
            const card = document.createElement('div');
            card.className = 'work-card';
            const isOwner = work.authorId === userId;
            const hasVoted = work.voters && work.voters.includes(userId);

            // ★★★★★【本次核心修改】★★★★★
            // 6. 如果是觀戰者，直接讓按鈕和輸入框變成 `disabled` (不可用) 狀態
            card.innerHTML = `
                <div>
                    <div style="font-size:16px; font-weight:800;">${work.title} ${isOwner ? '(你的作品)' : ''}</div>
                    <div class="work-meta">作者:${work.authorName} ｜ 雅集賞金:${work.votes || 0}</div>
                    <div style="white-space:pre-wrap; font-size:13px; color:#cbd5e1; margin-top:8px;">${work.content}</div>
                </div>
                <div class="actions-box">
                    <div class="vote-box">
                        <input type="number" min="1" step="10" value="100" id="vote-amt-${work.id}" ${isSpectating || hasVoted || isOwner ? 'disabled' : ''}>
                        <button id="vote-btn-${work.id}" ${isSpectating || hasVoted || isOwner ? 'disabled' : ''}>${hasVoted ? '已投資' : '投資'}</button>
                    </div>
                    <div class="comment-box">
                        <textarea id="comment-input-${work.id}" placeholder="留下你的回饋 (限100字)..." ${isSpectating || isOwner ? 'disabled' : ''} maxlength="100"></textarea>
                        <button id="comment-btn-${work.id}" ${isSpectating || isOwner ? 'disabled' : ''}>送出</button>
                    </div>
                </div>
                <div class="comments-display" id="comments-for-${work.id}"></div>
            `;
            // ★★★★★★★★★★★★★★★★★★★

            worksListEl.appendChild(card);

            // ★★★★★【本次核心修改】★★★★★
            // 7. 只有在「不是」觀戰模式時，才為按鈕加上點擊功能，從根本上避免錯誤
            if (!isSpectating) {
                // 留言按鈕事件
                const commentBtn = $(`#comment-btn-${work.id}`);
                if (commentBtn && !isOwner) {
                    commentBtn.onclick = async () => {
                        const commentInput = $(`#comment-input-${work.id}`);
                        const commentText = commentInput.value.trim();
                        if (!commentText) return;

                        commentBtn.disabled = true;
                        try {
                            await global.FirebaseManager.addCommentToWork(global.GameState.roomId, work.id, {
                                text: commentText,
                                authorName: global.GameState.player.name || '匿名旅人', // 🔴 使用全域 player
                                createdAt: new Date().toISOString()
                            });
                            commentInput.value = '';
                            showToast('回饋已成功送出!');
                        } catch (e) {
                            alert('回饋送出失敗,請稍後再試。');
                        } finally {
                            commentBtn.disabled = false;
                        }
                    };
                }

                // 投票按鈕事件
                const voteBtn = $(`#vote-btn-${work.id}`);
                if (voteBtn && !hasVoted && !isOwner) {
                    voteBtn.onclick = async () => {
                        const amount = parseInt($(`#vote-amt-${work.id}`).value) || 0;
                        if (amount <= 0) return;
                        if (global.GameState.player.money < amount) { showToast('花幣不足!'); return; } // 🔴 使用全域 player

                        voteBtn.disabled = true;
                        global.GameState.player.money -= amount; // 🔴 使用全域 player
                        updatePlayerDashboard();

                        try {
                            await global.FirebaseManager.voteWork(global.GameState.roomId, work.id, userId, amount);
                            showToast(`成功投資 ${amount} 花幣!`);
                        } catch (e) {
                            global.GameState.player.money += amount; // 🔴 使用全域 player
                            updatePlayerDashboard();
                            alert("投資失敗,請稍後再試。");
                            voteBtn.disabled = false;
                        }
                    };
                }
            }
            // ★★★★★★★★★★★★★★★★★★★

            // 顯示留言 (這部分不需修改，觀戰者也能看)
            const commentsDisplay = $(`#comments-for-${work.id}`);
            if (commentsDisplay && work.comments && work.comments.length > 0) {
                work.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                commentsDisplay.innerHTML = work.comments.map(comment => `
                    <div class="comment-item">
                        <strong>${comment.authorName}:</strong>
                        <span>${comment.text}</span>
                    </div>
                `).join('');
            }
        });
    }

    // --- 其他輔助函數 ---
    function showToast(msg, duration = 2500) {
        const toastEl = document.createElement('div');
        toastEl.className = 'toast';
        toastEl.textContent = msg;
        toastEl.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #1e293b;
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 9999;
            opacity: 0;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(toastEl);

        setTimeout(() => {
            toastEl.style.opacity = '1';
            toastEl.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateX(-50%) translateY(100px)';
            setTimeout(() => toastEl.remove(), 300);
        }, duration);
    }

    function updateDiceResult(text) {
        const el = $('#dice-result');
        if (el) el.textContent = text;
    }

    // --- 初始化與匯出 ---
    document.addEventListener('DOMContentLoaded', initUI);

    global.UIManager = {
        createBoard,
        updatePlayerDashboard,
        movePlayerToken,
        showEventModal,
        showMarketModal,
        showEndGameModal,
        // 🔴【決策回顧 Bug 修復】在這裡補上 showModal
        showModal,
        // ▼▼▼【修補程式碼 2.4】匯出新函數 ▼▼▼
        showReplayModal,
        // ▲▲▲ 修補結束 ▲▲▲
        buildWorkDraftForUpload,
        showLeaderboardModal,
        showToast,
        updateDiceResult,
        generateReport,
        updateMobileHUD
    };
    // ... 其他程式碼 ...

    // ▼▼▼ 遊戲結束時的引導彈窗 (這段不用動) ▼▼▼
    function showEndGameGuidePopup() {
        const guidePopup = document.createElement('div');
        guidePopup.className = 'endgame-guide-popup';

        guidePopup.innerHTML = `
        <div class="popup-content">
            <h2>🎉 恭喜完成旅程！</h2>
            <p>接下來，請發揮創意 ✍️<br>
            <strong>修改或重寫一篇屬於你的感悟</strong></p>
            <div class="popup-tip">💡 提示：下方的文字草稿「可以編輯」喔！</div>
            <button onclick="this.parentElement.parentElement.remove()">我知道了，開始創作！</button>
        </div>
    `;

        document.body.appendChild(guidePopup);
    }
    // ▲▲▲ 貼上結束 ▲▲▲
})(window);
