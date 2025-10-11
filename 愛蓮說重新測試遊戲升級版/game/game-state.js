(function (global) {
    'use strict';

    // --- Player State ---
    let player = {
        name: "花市旅人",
        position: 0,
        money: 1000,
        exp: 0,
        creativity: 0, // 新增文思屬性
        attributes: {
            peony: 50, // 榮耀
            lotus: 50, // 自守
            chrys: 50  // 自在
        },
        inventory: {
            peony: 10,
            lotus: 10,
            chrys: 10
        }
    };

    // --- Market State ---
    let market = {
        prices: {
            peony: 100,
            lotus: 80,
            chrys: 70
        }
    };

    // --- Game State ---
    let gameState = {
        turn: 1,
        maxTurns: 20,
        isPlayerTurn: true,
        usedEventTitles: [] // <-- 新增這一行
    };

    // Expose states to the global scope
    global.GameState = { player, market, gameState };
})(window);

