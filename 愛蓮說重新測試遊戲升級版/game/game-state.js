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
        },
        history: [] // <-- 新增：用於儲存決策歷程
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
// --- Achievement System ---
const achievements = [
    { id: 'peony_master', name: '牡丹冠軍', emoji: '🌺', condition: (p) => p.attributes.peony >= 80 },
    { id: 'lotus_sage', name: '蓮花君子', emoji: '🪷', condition: (p) => p.attributes.lotus >= 80 },
    { id: 'chrys_hermit', name: '菊花隱士', emoji: '🌼', condition: (p) => p.attributes.chrys >= 80 },
    { id: 'millionaire', name: '花市鉅子', emoji: '💰', condition: (p) => p.money >= 5000 },
    { id: 'balanced', name: '三才具備', emoji: '⚖️', condition: (p) => 
        Math.abs(p.attributes.peony - p.attributes.lotus) < 10 &&
        Math.abs(p.attributes.lotus - p.attributes.chrys) < 10
    },
    { id: 'creative_genius', name: '文思泉湧', emoji: '📖', condition: (p) => p.creativity >= 100 },
    { id: 'experienced', name: '閱歷豐富', emoji: '⭐', condition: (p) => p.exp >= 150 }
];

// Expose to global
global.GameState = { player, market, gameState, achievements };
   
})(window);
