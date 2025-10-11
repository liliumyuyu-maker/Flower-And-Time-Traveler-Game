(function (global) {
    'use strict';

    let player, market, gameState;

    // --- DOM 元素快取 ---
    const $ = (sel) => document.querySelector(sel);
    let modalEl, eventTitleEl, eventDescEl, eventContentEl, eventResultEl, leaderboardModalEl, worksListEl, lbSubtitleEl, lbCloseBtn;

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
        ({ player, market, gameState } = global.GameState);
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

    // --- 事件視窗 ---
    function showEventModal(card, onChoice) {
        let contentHTML = '';
        if (card.choices) {
            contentHTML = card.choices.map((choice, index) => `<button data-choice-index="${index}">${choice.text}</button>`).join('');
        } else {
            contentHTML = `<button data-choice-index="0">了解</button>`;
        }
        showModal(card.title, card.desc, contentHTML, card.result || '');

        // 新手導覽提示
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

        // 事件典籍小注顯示
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

        $('#event-content').onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            $('#event-content').onclick = null;

            if (card.choices) {
                const choice = card.choices[e.target.dataset.choiceIndex];
                const resultText = choice.effect(player);

                // 防呆:把屬性夾在 0~100、金錢/文思/經驗不為負
                try {
                    const clamp = v => Math.max(0, Math.min(100, v | 0));
                    if (player && player.attributes) {
                        player.attributes.peony = clamp(player.attributes.peony);
                        player.attributes.lotus = clamp(player.attributes.lotus);
                        player.attributes.chrys = clamp(player.attributes.chrys);
                    }
                    if (player) {
                        player.money = Math.max(0, player.money | 0);
                        player.creativity = Math.max(0, player.creativity | 0);
                        player.exp = Math.max(0, player.exp | 0);
                    }
                } catch (_) { }

                eventResultEl.textContent = resultText;
                eventContentEl.innerHTML = '';
                setTimeout(() => {
                    modalEl.classList.remove('show');
                    $('#dice-roll-btn').disabled = false;
                    onChoice();
                }, 2500);
            } else {
                modalEl.classList.remove('show');
                onChoice();
            }
        };
    }

    // --- 市場視窗 ---
    function showMarketModal(onComplete) {
        const contentHTML = `
            <table class="market-table">
                <thead><tr><th>花卉</th><th>現價</th><th>持有</th><th>買入</th><th>賣出</th></tr></thead>
                <tbody>
                    <tr><td>🌺 牡丹</td><td>${market.prices.peony}</td><td>${player.inventory.peony}</td><td><input type="number" id="buy-peony" min="0" value="0"></td><td><input type="number" id="sell-peony" min="0" max="${player.inventory.peony}" value="0"></td></tr>
                    <tr><td>🪷 蓮</td><td>${market.prices.lotus}</td><td>${player.inventory.lotus}</td><td><input type="number" id="buy-lotus" min="0" value="0"></td><td><input type="number" id="sell-lotus" min="0" max="${player.inventory.lotus}" value="0"></td></tr>
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
    function showEndGameModal(results, onUpload) {
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
            <div class="creation-draft-box">
                <label for="creation-draft-textarea">你的創作草稿 (可編輯)</label>
                <textarea id="creation-draft-textarea">${buildWorkDraftForUpload()}</textarea>
            </div>
            <button id="upload-btn" class="special" style="width: 100%; margin-top: 20px;">上傳作品並進入雅集</button>
            <button id="restart-btn" style="width: 100%; margin-top: 10px;">重新開始一局</button>
        `;
        showModal('旅程結算', `經過 ${gameState.maxTurns} 回合的探索,你的最終成就如下:`, contentHTML, `你的最終總分: ${results.finalScore.toLocaleString()}`);

        $('#upload-btn').onclick = onUpload;
        $('#restart-btn').onclick = () => window.location.reload();
    }

    // --- 生成創作草稿 ---
    function buildWorkDraftForUpload() {
        const p = player;
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

        // ★★★★★【本次核心修改】★★★★★
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
                leaderboardModalEl.classList.remove('show');
                if (window.unsubscribe) window.unsubscribe();
                window.location.reload();
            }
        };
        // ★★★★★★★★★★★★★★★★★★★
    }

    // --- 生成報告函數 (獨立出來) ---
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
        .stats-section {
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
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            font-size: 13px;
        }
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
                    <div class="meta-label">總投資</div>
                    <div class="meta-value">${work.votes || 0}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">留言數</div>
                    <div class="meta-value">${work.comments?.length || 0}</div>
                </div>
            </div>
            
            <div class="work-content">${work.content || '(無內容)'}</div>
            
            ${/* ▼▼▼ 這裡是本次修正的核心 ▼▼▼ */ ''}
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
                ${/* ▲▲▲ 修正結束 ▲▲▲ */ ''}
            
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

        const blob = new Blob([reportHTML], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `雅集${roomId}_作品集_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('✅ 已觸發下載！請檢查您的下載項目。');
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
                    <div class="work-meta">作者:${work.authorName} ｜ 總投資:${work.votes || 0}</div>
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
                                authorName: player.name || '匿名旅人',
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
                        if (player.money < amount) { showToast('花幣不足!'); return; }

                        voteBtn.disabled = true;
                        player.money -= amount;
                        updatePlayerDashboard();

                        try {
                            await global.FirebaseManager.voteWork(global.GameState.roomId, work.id, userId, amount);
                            showToast(`成功投資 ${amount} 花幣!`);
                        } catch (e) {
                            player.money += amount;
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
        buildWorkDraftForUpload,
        showLeaderboardModal,
        showToast,
        updateDiceResult,
        generateReport
    };

})(window);