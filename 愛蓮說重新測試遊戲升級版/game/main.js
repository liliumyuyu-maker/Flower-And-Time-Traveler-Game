(function (global) {
    'use strict';

    // --- 依賴注入 ---
    // 延遲解構，確保其他檔案的 global 物件已準備好
    let player, market, gameState;
    let GameData, UIManager, FirebaseManager;

    // --- DOM 元素快取 ---
    const diceBtn = document.getElementById('dice-roll-btn');
    const lobbyContainer = document.getElementById('lobby-container');
    const gameContainer = document.getElementById('game-container');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');

    // --- 遊戲狀態變數 ---
    let currentRoomId = null;
    let currentUserId = null;

    // --- 輔助函數：計算總資產 ---
    function getNetWorth() {
        if (!player) return 0;
        const cash = player.money;
        const invValue = Object.keys(player.inventory).reduce((sum, key) => sum + player.inventory[key] * market.prices[key], 0);
        return cash + invValue;
    }

    // --- 遊戲核心循環 ---
    function rollDice() {
        // ▼▼▼ 在這裡加上一行，停止發光 ▼▼▼
        diceBtn.classList.remove('is-active-turn');
        if (!gameState.isPlayerTurn) return;
        gameState.isPlayerTurn = false;
        diceBtn.disabled = true;
        const roll = Math.floor(Math.random() * 6) + 1;
        UIManager.updateDiceResult(`你擲出了 ${roll} 點！`);

        setTimeout(() => {
            // 呼叫新的逐格移動函數
            // 1. 傳入擲出的點數 (roll)
            // 2. 傳入一個「全部走完才執行」的回呼函數
            UIManager.movePlayerStepByStep(roll, () => {
                // 這個函數會在棋子走完最後一格後才被觸發
                const finalBoardIndex = GameData.boardPath[player.position];
                handleCellAction(finalBoardIndex);
            });
        }, 1000); // 擲骰子 1 秒後，開始移動
    }

    // 【最終修正版】 handleCellAction 函數
    function handleCellAction(boardIndex) {
        const cellType = GameData.boardLayout[boardIndex];
        switch (cellType) {
            case 'E':
                triggerRandomEvent();
                break;
            case 'M':
                UIManager.showMarketModal(nextTurn);
                break;

            case 'S':
                const startEventCard = {
                    title: '【驛站小憩】',
                    desc: '回到起點，你獲得了片刻的喘息。是要整理行囊、休養生息，還是要把握機會，外出尋訪靈感？',
                    choices: [
                        {
                            text: '「休養生息，穩固根基。」',
                            effect: (player) => {
                                player.money += 50;
                                player.exp += 5;
                                return "你整理了財務與心得，恢復了些許精力。花幣+50, 經驗+5";
                            }
                        },
                        {
                            text: '「把握時機，再歷奇遇。」',
                            // ▼▼▼ 這是我們的核心修正 ▼▼▼
                            // 我們不再回傳文字，而是回傳一個特殊的「暗號」
                            effect: (player) => 'TRIGGER_EVENT'
                            // ▲▲▲ 修正結束 ▲▲▲
                        }
                    ]
                };
                UIManager.showEventModal(startEventCard, nextTurn);
                break;

            default:
                nextTurn();
        }
    }

    function triggerRandomEvent() {
        const eventCard = GameData.getRandomEvent();
        if (!eventCard) {
            console.warn('No event card returned');
            return nextTurn();
        }

        // ▼▼▼ 這是關鍵修正：我們也直接將紀錄，寫到那本唯一的「全域筆記本」中 ▼▼▼
        if (eventCard.title) {
            if (!global.GameState.gameState.usedEventTitles) {
                global.GameState.gameState.usedEventTitles = [];
            }
            global.GameState.gameState.usedEventTitles.push(eventCard.title);
        }
        // ▲▲▲ 修正結束 ▲▲▲

        let deltaText = '';
        if (eventCard.type === 'market') {
            const before = getNetWorth();
            if (typeof eventCard.action === 'function') {
                eventCard.action(market);
            }
            const after = getNetWorth();
            const delta = after - before;
            if (delta !== 0) {
                deltaText = `（你的總資產${delta > 0 ? '增加' : '減少'} ${Math.abs(delta).toLocaleString()}）`;
            }
            eventCard.result = (eventCard.result || '') + ' ' + deltaText;
        }

        UIManager.showEventModal(eventCard, nextTurn);
    }


    // ── 新增：包一層，讓每次更新面板時也順便更新 HUD（不改動原本 UIManager） ──
    function wrapUpdatePlayerDashboard() {
        if (!UIManager || typeof UIManager.updatePlayerDashboard !== 'function') return;
        const _orig = UIManager.updatePlayerDashboard.bind(UIManager);
        UIManager.updatePlayerDashboard = function () {
            _orig();
            UIManager.updateMobileHUD(); // <-- 在這裡加上 UIManager.
        };
    }

    // ── 優化版：綁定 HUD 上的所有按鈕 ──
    function bindMobileHudActions() {
        const marketBtn = document.getElementById('hud-market-btn');
        const muteBtn = document.getElementById('hud-mute-btn');
        const bgm = document.getElementById('bgm');

        // 綁定市場按鈕
        if (marketBtn) {
            marketBtn.addEventListener('click', () => {
                if (UIManager && typeof UIManager.showMarketModal === 'function') {
                    UIManager.showMarketModal(nextTurn);
                } else {
                    alert('市場功能尚未載入');
                }
            });
        }

        // 綁定靜音按鈕
        if (muteBtn && bgm) {
            muteBtn.addEventListener('click', () => {
                bgm.muted = !bgm.muted; // 切換靜音狀態
                muteBtn.textContent = bgm.muted ? '🔇' : '🔊'; // 更新按鈕圖示
            });
        }
    }


    function nextTurn(animationDelay = 100) {
        // 1. 先完成所有數據的計算與狀態變更
        if (gameState.turn >= gameState.maxTurns) {
            endGame();
            return;
        }
        gameState.turn++;

        // ▼▼▼ 這是我們的修改 ▼▼▼
        // 1.1 先儲存舊價格
        const oldPrices = { ...global.GameState.market.prices };
        const changes = {}; // 用來存放變化
        // ▲▲▲ 修改結束 ▲▲▲

        for (const k in market.prices) {
            const r = (Math.random() * 0.10 - 0.05); // -5% ~ +5%
            const newPrice = Math.max(1, Math.round(market.prices[k] * (1 + r)));

            // ▼▼▼ 這是我們的修改 ▼▼▼
            // 1.2 儲存變化
            if (newPrice !== oldPrices[k]) {
                changes[k] = newPrice - oldPrices[k];
            }
            market.prices[k] = newPrice;
            // ▲▲▲ 修改結束 ▲▲▲
        }

        if (Object.keys(changes).length > 0) { // 檢查是否真的有變化
            UIManager.showToast("市場微幅波動，花價有變化。");
        }

        gameState.isPlayerTurn = true;

        // 2. 所有數據都確定後，最後再統一更新所有畫面
        UIManager.updateDiceResult('你的回合，請擲骰子。');
        UIManager.updatePlayerDashboard(); // 儀表板(包含庫存)會在這裡全部重繪

        // ▼▼▼ 這是我們的修改 ▼▼▼
        // 2.1 儀表板重繪後，我們手動為變化的價格加上動畫
        setTimeout(() => { // 根據傳入的 animationDelay 延遲
            for (const flower in changes) {
                const changeAmount = changes[flower];
                // 用我們在步驟 1 新增的 ID 找到元素
                const priceEl = document.getElementById(`inv-price-${flower}`);

                if (priceEl) {
                    // 1. 手動添加閃爍動畫 (借用您方案 3 的 CSS)
                    if (changeAmount > 0) {
                        priceEl.classList.add('stat-flash-increase');
                    } else {
                        priceEl.classList.add('stat-flash-decrease');
                    }

                    // 2. 手動創建浮動提示 (借用您方案 3 的邏輯)
                    const changeIndicator = document.createElement('div');
                    changeIndicator.className = 'stat-change-indicator';
                    changeIndicator.textContent = changeAmount > 0 ? `+${changeAmount}` : `${changeAmount}`; // 負號會自帶
                    changeIndicator.classList.add(changeAmount > 0 ? 'positive' : 'negative');

                    priceEl.style.position = 'relative'; // 確保定位正確
                    priceEl.appendChild(changeIndicator);

                    // 3. 清理動畫
                    setTimeout(() => {
                        priceEl.classList.remove('stat-flash-increase', 'stat-flash-decrease');
                        if (changeIndicator.parentElement) {
                            changeIndicator.remove();
                        }
                    }, 1500); // 配合 CSS 的 1.5s
                }
            }
        }, animationDelay); // 使用變數
        // ▲▲▲ 修改結束 ▲▲▲

        diceBtn.disabled = false;
        // ▼▼▼ 在這裡加上一行，開始發光 ▼▼▼
        diceBtn.classList.add('is-active-turn');
    }
    // --- 遊戲結束與多人模式啟動 ---
    // main.js
    async function endGame() {
        diceBtn.disabled = true;
        UIManager.updateDiceResult("遊戲結束！正在生成創作...");
        const results = calculateResults(); // 'results' 變數包含了所有成就資料

        // 顯示個人結算畫面，傳入「上傳回呼函數 (onUpload)」與「決策回顧函數 (onShowReplay)」
        // 備註：第三個參數傳入 showDecisionTimeline，讓結算視窗中的「查看決策回顧」按鈕可以正常使用
        UIManager.showEndGameModal(
            results,
            async () => {
                // 這個函數會在玩家點擊「上傳作品並進入雅集」按鈕後被觸發
                try {
                    UIManager.showToast("正在上傳你的創作靈感...");

                    // 1. 直接從結算視窗的編輯區讀取最新內容
                    const creationDraft = document.getElementById('creation-draft-textarea').value;

                    // 2. 呼叫 Firebase 管理員將創作上傳到雲端
                    const workId = await FirebaseManager.uploadWork(currentRoomId, {
                        authorId: currentUserId,
                        authorName: player.name || '匿名玩家',
                        title: `《${player.name}的感悟》`,
                        content: creationDraft,
                        finalStats: { // 附上最終數據供他人參考
                            money: player.money,
                            exp: player.exp,
                            creativity: player.creativity,
                            attributes: player.attributes
                        },

                        // 🔴【報告 Bug 修復】將完整的 'results' 物件上傳
                        gameResults: results
                    });

                    if (workId) {
                        UIManager.showToast("上傳成功！進入雅集。");
                        document.getElementById('modal').classList.remove('show'); // 關閉個人結算視窗
                        // 3. 上傳成功後，打開多人競價的榜單畫面
                        UIManager.showLeaderboardModal(currentRoomId, currentUserId);
                    } else {
                        alert("作品上傳失敗，無法進入競價。");
                    }
                } catch (error) {
                    console.error("進入競價模式失敗:", error);
                    alert("進入競價模式時發生錯誤。");
                }
            },
            showDecisionTimeline // ← 新增：讓「查看決策回顧」按鈕有對應的行為
        );
    }


    // --- 結算分數邏輯 ---
    function calculateResults() {
        const WEALTH_THRESHOLD = 2000;
        const CREATIVITY_THRESHOLD = 50;
        const BALANCE_THRESHOLD = 75; // 品格平衡分數門檻

        // 🔴【上傳 Bug 修復】我們在這裡仍然需要 'player' 變數
        const player = global.GameState.player;

        const attrs = Object.values(player.attributes);
        const maxAttr = Math.max(...attrs);
        const minAttr = Math.min(...attrs);
        const balanceScore = Math.round(100 - (maxAttr - minAttr));

        const wealthChampion = getNetWorth() >= WEALTH_THRESHOLD;
        const characterChampion = balanceScore >= BALANCE_THRESHOLD;
        const creativityChampion = player.creativity >= CREATIVITY_THRESHOLD;
        const junziChampion = wealthChampion && characterChampion && creativityChampion;
        // === ⬇️ 新增：成就檢查邏輯 ⬇️ ===
        // 1. 從 global 狀態讀取成就定義
        const allAchievements = global.GameState.achievements || [];

        // 2. 🔴【上傳 Bug 修復】
        // 舊的程式碼會複製到函式：const unlockedAchievements = allAchievements.filter(ach => ach.condition(player));
        // 新的程式碼：我們使用 .filter() 篩選，然後 .map() 來建立一個*新的、乾淨的*物件陣列，
        // 裡面只包含 Firebase 允許的資料 (字串)。
        const unlockedAchievements = allAchievements
            .filter(ach => ach.condition(player))
            .map(ach => ({
                id: ach.id,
                name: ach.name,
                emoji: ach.emoji
                // 故意排除 ach.condition 函式
            }));
        // === ⬆️ 新增結束 ⬆️ ===


        // (可選) 讓每個成就也增加分數
        const achievementBonus = unlockedAchievements.length * 50; // 每個成就加 50 分
        const finalScore = getNetWorth() + (player.exp * 10) + (player.creativity * 5) + (junziChampion ? 500 : 0) + achievementBonus;

        // === ⬇️ 修改 return 內容 ⬇️ ===
        return {
            finalScore,
            wealthChampion,
            characterChampion,
            creativityChampion,
            junziChampion,
            unlockedAchievements // <-- 3. 將解鎖的成就列表加入到 results 物件
        };
        // === ⬆️ 修改結束 ⬆️ ===
    }

    // 在結算畫面加入
    // ★★★ 🔴【決策 Bug 修復】★★★
    function showDecisionTimeline() {
        // 步驟 1: 安全檢查
        // 🔴【決策 Bug 修復】直接從全域獲取 player
        const player = global.GameState.player;

        // 🔴【決策 Bug 修復】改用 alert 強制提示，確保您能看到
        if (!player || !player.history || player.history.length === 0) {
            alert("您尚未做出任何可回顧的決策！\n\n（在 `ui-manager.js` 修復後，請重新玩一局，之前的決策已遺失。）");
            return;
        }

        // 步驟 2: 遍歷紀錄並轉換成 HTML (最關鍵的一步)
        // .map() 就像一個加工廠，會一條一條地處理 history 陣列中的每一筆紀錄 (entry)。
        // 對於每一筆紀錄，它都會回傳一段格式化好的 HTML 字串。
        const timelineHTML = player.history.map(entry => `
        <div class="timeline-item">
            <div class="timeline-turn">第 ${entry.turn} 回合</div>
            <div class="timeline-content">
                <h4 class="timeline-title">${entry.title}</h4>
                <p class="timeline-desc">${entry.desc}</p>
                <div class="timeline-choice">
                    <strong>你的選擇：</strong>
                    <span>${entry.choice}</span>
                </div>
                <div class="timeline-result">
                    <strong>帶來的影響：</strong>
                    <span>${entry.result}</span>
                </div>
            </div>
        </div>
    `).join(''); // .join('') 會把所有加工好的 HTML 字串拼接成一個完整的長字串。

        // 步驟 3: 包裝與顯示
        // ▼▼▼【修補程式碼 3.1】修改 fullContent ▼▼▼
        // 1. 關閉按鈕的 onclick 改為關閉 'replay-modal'
        // 2. 整個內容都放到 timeline-container 裡
        const fullContent = `
            <div class="timeline-container">${timelineHTML}</div>
            <button class="manual-close-btn" 
                    onclick="document.getElementById('replay-modal').classList.remove('show')">
                關閉
            </button>
        `;
        // ▲▲▲ 修補結束 ▲▲▲

        // 最後，呼叫我們的好幫手 UIManager，請它用 showModal 函數
        // 把標題、描述和我們精心製作的 HTML 內容，顯示在一個彈出視窗中。

        // ▼▼▼【修補程式碼 3.2】呼叫 UIManager.showReplayModal ▼▼▼
        UIManager.showReplayModal('決策回顧', '你在旅程中的每一步選擇：', fullContent);
        // ▲▲▲ 修補結束 ▲▲▲
    }

    // --- 遊戲啟動流程 ---
    function startGame(playerName, roomId) {
        document.getElementById('bgm').play().catch(e => console.warn("音樂自動播放失敗，需等待使用者再次互動。"));
        lobbyContainer.style.display = 'none';
        gameContainer.classList.remove('hidden');
        player.name = playerName;
        currentRoomId = roomId; // 將房間號存到本檔案的變數中
        global.GameState.roomId = roomId; // 也存一份到全域狀態，讓 ui-manager 能讀取

        document.getElementById('player-name-display').textContent = `${playerName} @ 雅集 #${roomId}`;
        document.getElementById('player-name-sidebar').textContent = `${playerName}的儀表板`;

        UIManager.createBoard();
        UIManager.updatePlayerDashboard();
        setTimeout(() => UIManager.movePlayerToken(GameData.boardPath[player.position], 0), 100);
        diceBtn.addEventListener('click', rollDice);
        // ★ 新增：包裝面板更新＋初始化 HUD 與市場按鈕
        wrapUpdatePlayerDashboard();
        UIManager.updateMobileHUD(); // <-- 在這裡加上 UIManager.
        bindMobileHudActions();
        // 新增：監聽視窗大小變化事件，自動校準棋子位置
        window.addEventListener('resize', () => {
            if (global.GameData && global.UIManager) {
                const currentBoardIndex = global.GameData.boardPath[global.GameState.player.position];
                global.UIManager.movePlayerToken(currentBoardIndex, 0);
            }
        });
    }
    // 教師專用頁面（需要密碼）
    async function getTeacherDashboard(roomId) {
        const works = await FirebaseManager.getWorksOnce(roomId);

        const stats = {
            totalPlayers: works.length,
            avgPeony: works.reduce((sum, w) => sum + w.finalStats.attributes.peony, 0) / works.length,
            avgLotus: works.reduce((sum, w) => sum + w.finalStats.attributes.lotus, 0) / works.length,
            avgChrys: works.reduce((sum, w) => sum + w.finalStats.attributes.chrys, 0) / works.length
        };

        return stats;
    }
    // --- 主程式入口 (Main Function) ---
    async function main() {
        ({ GameData, UIManager, FirebaseManager } = global);
        ({ player, market, gameState } = global.GameState);

        const TEACHER_KEY = "momohu";
        const playerNameInputForTeacher = document.getElementById('player-name-input');
        const spectateBtnForTeacher = document.getElementById('spectate-room-btn');

        if (playerNameInputForTeacher && spectateBtnForTeacher) {
            playerNameInputForTeacher.addEventListener('input', (e) => {
                if (e.target.value === TEACHER_KEY) {
                    spectateBtnForTeacher.classList.add('visible');
                } else {
                    spectateBtnForTeacher.classList.remove('visible');
                }
            });
        }

        try {
            const { userId } = await FirebaseManager.initFirebase();
            currentUserId = userId;
            document.getElementById('user-id-display').textContent = `你的專屬ID: ${userId}`;

            // ✅ 【觀戰模式優化】: 檢查 Local Storage，如果處於觀戰模式，直接跳轉
            const isSpectating = localStorage.getItem('isSpectator') === 'true';
            const spectatingRoomId = localStorage.getItem('spectatingRoomId');

            if (isSpectating && spectatingRoomId) {
                console.log(`偵測到觀戰模式，正在重新進入房間 #${spectatingRoomId}`);
                global.GameState.isSpectator = true;
                lobbyContainer.style.display = 'none';
                // 開發者提示：若要完美退出觀戰，ui-manager.js 中的離開按鈕應在重整頁面前
                // 執行 localStorage.removeItem('isSpectator'); 和 localStorage.removeItem('spectatingRoomId');
                UIManager.showLeaderboardModal(spectatingRoomId, currentUserId);
                return; // 提前結束函數，不綁定大廳的遊戲按鈕
            }

            // --- 正常遊戲流程：綁定大廳按鈕 ---
            createRoomBtn.addEventListener('click', async () => {
                const playerName = document.getElementById('player-name-input').value.trim();
                if (!playerName) { alert("請先輸入你的名號！"); return; }
                createRoomBtn.disabled = true;
                createRoomBtn.textContent = "創建中...";
                const room = await FirebaseManager.createRoom(playerName);
                if (room) {
                    startGame(playerName, room.id);
                } else {
                    createRoomBtn.disabled = false;
                    createRoomBtn.textContent = "創建雅集";
                }
            });

            joinRoomBtn.addEventListener('click', async () => {
                const playerName = document.getElementById('player-name-input').value.trim();
                const roomId = document.getElementById('room-id-input').value.trim();
                if (!playerName || !roomId) { alert("請輸入名號與雅集編號！"); return; }
                joinRoomBtn.disabled = true;
                joinRoomBtn.textContent = "加入中...";
                const room = await FirebaseManager.joinRoom(roomId, playerName);
                if (room) {
                    startGame(playerName, room.id);
                } else {
                    joinRoomBtn.disabled = false;
                    joinRoomBtn.textContent = "加入雅集";
                }
            });

            const spectateRoomBtn = document.getElementById('spectate-room-btn');
            spectateRoomBtn.addEventListener('click', async () => {
                const playerName = document.getElementById('player-name-input').value.trim() || '觀察員';
                const roomId = document.getElementById('room-id-input').value.trim();
                if (!roomId) { alert("請輸入您想觀戰的雅集編號！"); return; }

                spectateRoomBtn.disabled = true;
                spectateRoomBtn.textContent = "進入中...";
                const room = await FirebaseManager.joinRoom(roomId, playerName);

                if (room) {
                    lobbyContainer.style.display = 'none';
                    global.GameState.player.name = playerName;
                    currentRoomId = roomId;

                    // ✅ 【觀戰模式優化】: 統一使用 localStorage 儲存狀態
                    global.GameState.isSpectator = true;
                    localStorage.setItem('isSpectator', 'true');
                    localStorage.setItem('spectatingRoomId', roomId);

                    UIManager.showLeaderboardModal(roomId, currentUserId);
                } else {
                    spectateRoomBtn.disabled = false;
                    spectateRoomBtn.textContent = "觀戰雅集";
                }
            });

        } catch (error) {
            console.error("遊戲初始化失敗:", error);
            alert("錯誤：遊戲初始化失敗, 請檢查主控台訊息。");
        }
    }

    // 啟動主程式
    main();

})(window);
