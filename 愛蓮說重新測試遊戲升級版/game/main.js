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
        if (!gameState.isPlayerTurn) return;
        gameState.isPlayerTurn = false;
        diceBtn.disabled = true;
        const roll = Math.floor(Math.random() * 6) + 1;
        UIManager.updateDiceResult(`你擲出了 ${roll} 點！`);

        setTimeout(() => {
            const newPosition = (player.position + roll) % GameData.TOTAL_CELLS;
            player.position = newPosition;
            const newBoardIndex = GameData.boardPath[newPosition];
            UIManager.movePlayerToken(newBoardIndex);
            setTimeout(() => handleCellAction(newBoardIndex), 600);
        }, 1000);
    }

    function handleCellAction(boardIndex) {
        const cellType = GameData.boardLayout[boardIndex];
        switch (cellType) {
            case 'E': triggerRandomEvent(); break;
            case 'M': UIManager.showMarketModal(nextTurn); break;
            default: nextTurn();
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
    // ── 新增：行動版 HUD 同步工具 ──
    function updateMobileHUD() {
        try {
            const m = document.getElementById('hud-money');
            const e = document.getElementById('hud-exp');
            const c = document.getElementById('hud-creative');
            if (!m || !e || !c || !player) return;
            m.textContent = (player.money || 0).toLocaleString('zh-TW');
            e.textContent = (player.exp || 0).toLocaleString('zh-TW');
            c.textContent = (player.creativity || 0).toLocaleString('zh-TW');
        } catch (_) { }
    }

    // ── 新增：包一層，讓每次更新面板時也順便更新 HUD（不改動原本 UIManager） ──
    function wrapUpdatePlayerDashboard() {
        if (!UIManager || typeof UIManager.updatePlayerDashboard !== 'function') return;
        const _orig = UIManager.updatePlayerDashboard.bind(UIManager);
        UIManager.updatePlayerDashboard = function () {
            _orig();
            updateMobileHUD();
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


    function nextTurn() {
        // 1. 先完成所有數據的計算與狀態變更
        if (gameState.turn >= gameState.maxTurns) {
            endGame();
            return;
        }
        gameState.turn++;

        for (const k in market.prices) {
            const r = (Math.random() * 0.10 - 0.05); // -5% ~ +5%
            market.prices[k] = Math.max(1, Math.round(market.prices[k] * (1 + r)));
        }

        if ((gameState.turn % 3) === 1) {
            UIManager.showToast("市場微幅波動，花價有變化。");
        }

        gameState.isPlayerTurn = true;

        // 2. 所有數據都確定後，最後再統一更新所有畫面
        UIManager.updateDiceResult('你的回合，請擲骰子。');
        UIManager.updatePlayerDashboard(); // 包含更新桌面儀表板與手機HUD
        diceBtn.disabled = false;
    }

    // --- 遊戲結束與多人模式啟動 ---
    async function endGame() {
        diceBtn.disabled = true;
        UIManager.updateDiceResult("遊戲結束！正在生成創作...");
        const results = calculateResults();

        // 顯示個人結算畫面，並傳入一個「上傳回呼函數 (onUpload)」
        UIManager.showEndGameModal(results, async () => {
            // 這個函數會在玩家點擊「上傳作品並進入雅集」按鈕後被觸發
            try {
                UIManager.showToast("正在上傳你的創作靈感...");

                // 1. 呼叫 UI 管理員產生個人化的創作草稿

                const creationDraft = document.getElementById('creation-draft-textarea').value; // <-- 改成這一行，從編輯區讀取最新內容

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
                    }
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
        });
    }

    // --- 結算分數邏輯 ---
    function calculateResults() {
        const WEALTH_THRESHOLD = 2000;
        const CREATIVITY_THRESHOLD = 50;
        const BALANCE_THRESHOLD = 75; // 品格平衡分數門檻

        const attrs = Object.values(player.attributes);
        const maxAttr = Math.max(...attrs);
        const minAttr = Math.min(...attrs);
        const balanceScore = Math.round(100 - (maxAttr - minAttr));

        const wealthChampion = getNetWorth() >= WEALTH_THRESHOLD;
        const characterChampion = balanceScore >= BALANCE_THRESHOLD;
        const creativityChampion = player.creativity >= CREATIVITY_THRESHOLD;
        const junziChampion = wealthChampion && characterChampion && creativityChampion;

        const finalScore = getNetWorth() + (player.exp * 10) + (player.creativity * 5) + (junziChampion ? 500 : 0);
        return { finalScore, wealthChampion, characterChampion, creativityChampion, junziChampion };
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
        setTimeout(() => UIManager.movePlayerToken(GameData.boardPath[player.position]), 100);
        diceBtn.addEventListener('click', rollDice);
        // ★ 新增：包裝面板更新＋初始化 HUD 與市場按鈕
        wrapUpdatePlayerDashboard();
        updateMobileHUD();
        bindMobileHudActions();
        // 新增：監聽視窗大小變化事件，自動校準棋子位置
        window.addEventListener('resize', () => {
            if (global.GameData && global.UIManager) {
                const currentBoardIndex = global.GameData.boardPath[global.GameState.player.position];
                global.UIManager.movePlayerToken(currentBoardIndex);
            }
        });
    }

    // --- 主程式入口 (Main Function) ---
    async function main() {
        // 等待所有模組都準備好
        ({ GameData, UIManager, FirebaseManager } = global);
        // ▼▼▼ 在這裡新增下面這段程式碼 ▼▼▼
        // 遊戲一開始就檢查 sessionStorage，恢復觀戰狀態
        if (sessionStorage.getItem('isSpectator') === 'true') {
            global.GameState.isSpectator = true;
        }
        // ▲▲▲ 新增結束 ▲▲▲
        ({ player, market, gameState } = global.GameState);
        // ▼▼▼ 請將這段「通關密語」偵測邏輯貼在這裡 ▼▼▼
        // --- 老師專用「觀戰模式」彩蛋 ---
        const TEACHER_KEY = "momohu"; // 您可以自己修改這個密語
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
        // ▲▲▲ 貼上結束 ▲▲▲

        try {
            // 步驟 1: 連接 Firebase 並取得使用者 ID
            const { userId } = await FirebaseManager.initFirebase();
            currentUserId = userId; // 將使用者 ID 存起來
            document.getElementById('user-id-display').textContent = `你的專屬ID: ${userId}`;

            // 步驟 2: 為大廳的「創建雅集」按鈕綁定事件
            createRoomBtn.addEventListener('click', async () => {
                const playerName = document.getElementById('player-name-input').value.trim();
                if (!playerName) { alert("請先輸入你的名號！"); return; }

                createRoomBtn.textContent = "創建中..."; createRoomBtn.disabled = true;
                const room = await FirebaseManager.createRoom(playerName);
                if (room) {
                    startGame(playerName, room.id); // 成功創建後，啟動遊戲
                } else {
                    createRoomBtn.textContent = "創建雅集"; createRoomBtn.disabled = false;
                }
            });

            // 步驟 3: 為大廳的「加入雅集」按鈕綁定事件
            joinRoomBtn.addEventListener('click', async () => {
                const playerName = document.getElementById('player-name-input').value.trim();
                const roomId = document.getElementById('room-id-input').value.trim();
                if (!playerName || !roomId) { alert("請輸入名號與雅集編號！"); return; }

                joinRoomBtn.textContent = "加入中..."; joinRoomBtn.disabled = true;
                const room = await FirebaseManager.joinRoom(roomId, playerName);
                if (room) {
                    startGame(playerName, room.id); // 成功加入後，啟動遊戲
                } else {
                    joinRoomBtn.textContent = "加入雅集"; joinRoomBtn.disabled = false;
                }
            });
            // 步驟 4: 為大廳的「觀戰雅集」按鈕綁定事件
            const spectateRoomBtn = document.getElementById('spectate-room-btn');
            spectateRoomBtn.addEventListener('click', async () => {
                const playerName = document.getElementById('player-name-input').value.trim() || '觀察員';
                const roomId = document.getElementById('room-id-input').value.trim();
                if (!roomId) { alert("請輸入您想觀戰的雅集編號！"); return; }

                spectateRoomBtn.textContent = "進入中...";
                spectateRoomBtn.disabled = true;

                // 觀戰也需要先「加入」房間，讓您的名字出現在玩家列表
                const room = await FirebaseManager.joinRoom(roomId, playerName);

                if (room) {
                    // 成功加入後，隱藏大廳
                    lobbyContainer.style.display = 'none';
                    global.GameState.player.name = playerName;
                    currentRoomId = roomId; // 記錄當前房間ID

                    // ★★★★★【本次核心修改】★★★★★
                    // 在這裡設定一個全域的觀戰旗標，讓其他檔案知道現在是觀戰模式
                    global.GameState.isSpectator = true;
                    // ▼▼▼ 在這裡新增下面這一行 ▼▼▼
                    sessionStorage.setItem('isSpectator', 'true');
                    // ★★★★★★★★★★★★★★★★★★★

                    // ✨ 關鍵：不呼叫 startGame()，而是直接打開雅集排行榜！
                    UIManager.showLeaderboardModal(roomId, currentUserId);

                } else {
                    // 如果加入失敗，恢復按鈕狀態
                    spectateRoomBtn.textContent = "觀戰雅集";
                    spectateRoomBtn.disabled = false;
                }
            });

        } catch (error) {
            console.error("遊戲初始化失敗:", error);
            alert("錯誤：遊戲初始化失敗，請檢查主控台訊息。");
        }
    }

    // 啟動主程式
    main();

})(window);