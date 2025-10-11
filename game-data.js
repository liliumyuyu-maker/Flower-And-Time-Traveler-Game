(function (global) {
    'use strict';

    // --- 遊戲棋盤佈局 (7x7 環狀新版本) ---
    const boardLayout = [
        'S', 'E', 'M', 'E', 'M', 'E', 'S',
        'E', null, null, null, null, null, 'M',
        'M', null, null, null, null, null, 'E',
        'E', null, null, null, null, null, 'M',
        'M', null, null, null, null, null, 'E',
        'E', null, null, null, null, null, 'M',
        'S', 'E', 'M', 'E', 'M', 'E', 'S'
    ];
    // 棋盤的路徑順序（完整外圈 24 格，依序繞一圈）
    const boardPath = [
        // 底邊（左→右）
        42, 43, 44, 45, 46, 47, 48,
        // 右邊（下→上，不含角 48，含右上角 6）
        41, 34, 27, 20, 13, 6,
        // 上邊（右→左，不含角 6）
        5, 4, 3, 2, 1, 0,
        // 左邊（上→下，不含角 0、42）
        7, 14, 21, 28, 35
    ];
    const TOTAL_CELLS = boardPath.length;

    // --- 擴充後的事件牌庫 ---
    const eventDeck = [
        // --- 市場事件 ---
        {
            type: 'market', title: '【現代】科技奇蹟', desc: '輝達(NVIDIA)執行長黃仁勳穿著蓮葉仿生皮衣開發布會，宣布高價收購蓮葉作為AI晶片散熱材料。', result: '蓮花概念股一飛衝天！蓮花價格飆漲 50%！', action: (market) => {
                market.prices.lotus = Math.max(1, Math.round(market.prices.lotus * 1.5));
            }
        },
        { type: 'market', title: '【現代】文化潮流', desc: '宮廷劇《國色天香》成為年度爆款，劇中「唯有牡丹真國色」台詞爆紅，全國掀起牡丹熱潮。', result: '牡丹買氣大增，價格上漲 30%！', action: (market) => { market.prices.peony = Math.max(1, Math.round(market.prices.peony * 1.3)); } },
        { type: 'market', title: '【古代】杯酒釋兵權', desc: '你穿越到宋代一場宴會，趙匡胤暗示將領們告老還鄉，並賞賜菊花酒。「晚節」與「隱退」的象徵意義深入人心。', result: '菊花價值被重新定義，價格暴漲 40%！', action: (market) => { market.prices.chrys = Math.max(1, Math.round(market.prices.chrys * 1.4)); } },
        { type: 'market', title: '【古代】南方大旱', desc: '時值宋仁宗明道二年，南方大旱，蓮花池乾涸見底，產量銳減。然而，耐儲藏的蓮子卻因饑荒而成為珍貴食糧。', result: '蓮花供給銳減，價格飆漲 60%！', action: (market) => { market.prices.lotus = Math.max(1, Math.round(market.prices.lotus * 1.6)); } },
        { type: 'market', title: '【現代】時節需求', desc: '重陽節將至，登高、賞菊、飲菊花酒成為熱門活動，各大養生茶品牌紛紛推出菊花相關產品。', result: '菊花需求大增，價格上漲 25%！', action: (market) => { market.prices.chrys = Math.max(1, Math.round(market.prices.chrys * 1.25)); } },
        { type: 'market', title: '【市場】供應過剩', desc: '今年氣候極佳，牡丹花產量創下歷史新高，市場上供過於求。', result: '牡丹價格下跌 20%。', action: (market) => { market.prices.peony = Math.max(1, Math.round(market.prices.peony * 0.8)); } },
        { type: 'market', title: '【古代】后妃生日', desc: '宮中為貴妃慶生，下令採購大量牡丹裝飾宮殿，一時之間「洛陽紙貴，長安花貴」。', result: '牡丹需求激增，價格上漲 35%！', action: (market) => { market.prices.peony = Math.max(1, Math.round(market.prices.peony * 1.35)); } },
        { type: 'market', title: '【古代】瘟疫秘方', desc: '宋真宗年間兩浙出現瘟疫，安樂坊發現蓮子芯有奇效，將其加入「聖散子」秘方中，朝廷下令大量收購。', result: '蓮花因其藥用價值被追捧，價格大漲 40%！', action: (market) => { market.prices.lotus = Math.max(1, Math.round(market.prices.lotus * 1.4)); } },
        { type: 'market', title: '【市場】泡沫破裂', desc: '前陣子被炒作到天價的「鬱金香」泡沫突然破裂，恐慌情緒蔓延到整個花卉市場。', result: '所有花卉價格恐慌性下跌 15%。', action: (market) => { for (const flower in market.prices) { market.prices[flower] = Math.max(1, Math.round(market.prices[flower] * 0.85)); } } },

        // --- 非市場事件 ---
        { type: 'knowledge', title: '【奇遇】遇見陶淵明', desc: '在東籬下，你遇見一位採菊的隱士，他問你：「花中君子固然可敬，但若能悠然自得，不也是一種人生嗎？」', choices: [{ text: '「先生說的是，自在最難得。」', effect: (player) => { player.attributes.chrys += 15; player.exp += 10; player.creativity += 5; return "自在+15, 經驗+10, 文思+5"; } }, { text: '「但我認為入世改變更重要。」', effect: (player) => { player.attributes.lotus += 10; player.attributes.chrys -= 5; player.exp += 5; return "自守+10, 自在-5, 經驗+5"; } },] },
        { type: 'interpersonal', title: '【人際】朋友的炫耀', desc: '你的朋友買了最新的名牌包，興奮地向你展示，並說：「人還是要懂得犒賞自己，活出光彩！」', choices: [{ text: '「太棒了！這完全是你的風格！」', effect: (player) => { player.attributes.peony += 10; player.money -= 50; return "你請他喝了杯飲料慶祝。榮耀+10, 花幣-50"; } }, { text: '「很美，但我覺得內在充實更快樂。」', effect: (player) => { player.attributes.lotus += 10; player.attributes.peony -= 5; player.exp += 5; return "自守+10, 榮耀-5, 經驗+5"; } }, { text: '「只要你開心就好。」', effect: (player) => { player.attributes.chrys += 5; return "自在+5"; } }] },
        { type: 'creation', title: '【創作】靈光一閃', desc: '你漫步湖邊，看到蓮花亭亭淨植的模樣，心中湧現一股創作的衝動。你想記下什麼？', choices: [{ text: '描寫它的形態：「中通外直，不蔓不枝」', effect: (player) => { player.creativity += 15; player.exp += 5; return "文思+15, 經驗+5"; } }, { text: '抒發它的品格：「香遠益清，可遠觀而不可褻玩」', effect: (player) => { player.creativity += 10; player.attributes.lotus += 5; return "文思+10, 自守+5"; } }] },
        { type: 'character', title: '【品格】清廉風潮', desc: '朝中御史發起節儉運動，提倡清廉，以佩戴蓮花為風尚，奢華的牡丹則受到冷落。', choices: [{ text: '響應號召，拋售牡丹，買入蓮花。', effect: (player) => { player.attributes.lotus += 15; player.attributes.peony -= 5; player.exp += 10; return "自守+15, 榮耀-5, 經驗+10"; } }, { text: '認為這只是一時風潮，不為所動。', effect: (player) => { player.attributes.chrys += 10; return "自在+10"; } }] },
        { type: 'interpersonal', title: '【人際】同儕的壓力', desc: '同學們都在討論最新的流行趨勢，並嘲笑你的風格有些過時。', choices: [{ text: '花錢跟上潮流，融入大家。', effect: (player) => { player.money -= 100; player.attributes.peony += 10; return "花幣-100, 榮耀+10"; } }, { text: '堅持自己的風格，不予理會。', effect: (player) => { player.attributes.lotus += 10; player.exp += 5; return "自守+10, 經驗+5"; } }] },
        { type: 'knowledge', title: '【奇遇】遇見周敦頤', desc: '你在濂溪書院旁看到一位先生正在凝視池中蓮花，他感嘆道：「菊，花之隱逸者也；牡丹，花之富貴者也；蓮，花之君子者也。」', choices: [{ text: '上前行禮，並贈上一束蓮花。', effect: (player) => { player.creativity += 15; player.exp += 15; player.attributes.lotus += 10; return "與先賢交流，文思+15, 經驗+15, 自守+10"; } }, { text: '默默離開，不去打擾。', effect: (player) => { player.attributes.chrys += 5; return "自在+5"; } }] },
        { type: 'creation', title: '【創作】立意不明', desc: '你正在構思一篇「愛Ｏ說」，但對於要讚頌的主題品格感到迷惘。', choices: [{ text: '選擇一個大眾討喜的主題來寫。', effect: (player) => { player.attributes.peony += 5; player.creativity -= 5; return "榮耀+5, 但文思-5"; } }, { text: '忠於內心，選擇一個冷門但自己真正喜愛的主題。', effect: (player) => { player.creativity += 10; player.attributes.lotus += 5; return "文思+10, 自守+5"; } }] }
    ];

    // === ⬇️ 新增：擴充事件牌庫（完全不改你的原本 eventDeck） ===
    const extraEvents = [
        // —— 下列事件皆為新增，且不與你現有 title 重名 ——
        {
            type: 'interpersonal', title: '花市盛會', desc: '花市鼎沸，貴族重金收牡丹，邀你展示栽培成果。', choices: [
                {
                    text: '抓住機會，賣出所有牡丹！', effect: (p) => {
                        const gain = 300 + Math.floor(Math.random() * 200);
                        p.money = (p.money | 0) + gain;
                        p.attributes.peony = Math.min(100, (p.attributes.peony | 0) + 5);
                        p.exp = (p.exp | 0) + 1;
                        p.inventory.peony = 0;
                        return `你果斷出手，賺得 ${gain} 花幣，眾人稱你眼光獨到。`;
                    }
                },
                {
                    text: '拒絕炫耀，留給真正懂花的人。', effect: (p) => {
                        p.attributes.lotus = Math.min(100, (p.attributes.lotus | 0) + 5);
                        p.creativity = (p.creativity | 0) + 2;
                        return '你不為利益所動，貴族微笑離開，但你心中更篤定了。';
                    }
                },
            ]
        },

        {
            type: 'interpersonal', title: '虛名之宴', desc: '名流宴上，人人誇耀花園之盛，少人談花之性。有人要你誇口以博掌聲。', choices: [
                {
                    text: '順勢而為，說出最動人的詞句。', effect: (p) => {
                        p.exp = (p.exp | 0) + 2;
                        p.attributes.peony = Math.min(100, (p.attributes.peony | 0) + 3);
                        p.creativity = (p.creativity | 0) + 1;
                        return '滿堂喝采，但你感到些許空洞。';
                    }
                },
                {
                    text: '保持沉默，讓花自己說話。', effect: (p) => {
                        p.attributes.lotus = Math.min(100, (p.attributes.lotus | 0) + 4);
                        return '你的靜默比千言更深，幾人開始重新審視手中的花。';
                    }
                },
            ]
        },

        {
            type: 'character', title: '濁水之池', desc: '連日陰雨，蓮池混濁。園丁請你協力清理雜草。', choices: [
                {
                    text: '挽袖同工，維護蓮池之清。', effect: (p) => {
                        p.exp = (p.exp | 0) + 3;
                        p.attributes.lotus = Math.min(100, (p.attributes.lotus | 0) + 5);
                        p.money = Math.max(0, (p.money | 0) - 50);
                        return '你不計酬勞，清出滿池新綠。衣袖染泥，卻也染上光。';
                    }
                },
                {
                    text: '婉拒幫忙，這不是你的責任。', effect: (p) => {
                        p.attributes.peony = Math.min(100, (p.attributes.peony | 0) + 2);
                        return '你選擇保留力量，但旁人投來複雜的目光。';
                    }
                },
            ]
        },

        {
            type: 'character', title: '清風難留', desc: '有人抄襲你的詩句而得名，你該揭發嗎？', choices: [
                {
                    text: '揭發真相，維護公道。', effect: (p) => {
                        p.attributes.peony = Math.min(100, (p.attributes.peony | 0) + 4);
                        p.exp = (p.exp | 0) + 1;
                        return '你勇於直言，真相漸明，但也多了一個敵人。';
                    }
                },
                {
                    text: '選擇沉默，讓時間說話。', effect: (p) => {
                        p.attributes.lotus = Math.min(100, (p.attributes.lotus | 0) + 5);
                        p.creativity = (p.creativity | 0) + 3;
                        return '你轉身離去，在新的詩篇裡找回了自己。';
                    }
                },
            ]
        },

        {
            type: 'knowledge', title: '秋山邀約', desc: '友人邀你入山賞菊，路遠且費時。是否前往？', choices: [
                {
                    text: '前往山中尋芳。', effect: (p) => {
                        p.attributes.chrys = Math.min(100, (p.attributes.chrys | 0) + 5);
                        p.creativity = (p.creativity | 0) + 4;
                        return '山風拂面，你在寂靜中領悟時間的緩慢。';
                    }
                },
                {
                    text: '婉拒邀請，留守市場。', effect: (p) => {
                        p.money = (p.money | 0) + 100;
                        p.attributes.peony = Math.min(100, (p.attributes.peony | 0) + 3);
                        return '你選擇務實，賺得一些錢，但錯過一場心靈旅行。';
                    }
                },
            ]
        },

        {
            type: 'creation', title: '落花不歸', desc: '一夜秋雨，花瓣滿地。你是否要重新種下它們？', choices: [
                {
                    text: '重植希望。', effect: (p) => {
                        p.exp = (p.exp | 0) + 2;
                        p.creativity = (p.creativity | 0) + 2;
                        return '你拾花播種。新生的力量悄悄萌芽。';
                    }
                },
                {
                    text: '靜觀自然之道。', effect: (p) => {
                        p.attributes.chrys = Math.min(100, (p.attributes.chrys | 0) + 5);
                        return '你明白凋零亦是風景。心境更寬。';
                    }
                },
            ]
        },

        {
            type: 'knowledge', title: '濂溪一問', desc: '書院旁，先生凝視池中蓮花：「菊，花之隱逸者也；牡丹，花之富貴者也；蓮，花之君子者也。」', choices: [
                {
                    text: '上前致意，贈一束蓮花。', effect: (p) => {
                        p.creativity = (p.creativity | 0) + 15;
                        p.exp = (p.exp | 0) + 15;
                        p.attributes.lotus = Math.min(100, (p.attributes.lotus | 0) + 10);
                        return '與先賢論道，文思+15、經驗+15、自守+10。';
                    }
                },
                {
                    text: '默默離開，不去打擾。', effect: (p) => {
                        p.attributes.chrys = Math.min(100, (p.attributes.chrys | 0) + 5);
                        return '你尊重靜默。自在+5。';
                    }
                },
            ]
        },

        {
            type: 'creation', title: '靈光一閃', desc: '你漫步湖邊，見蓮亭亭淨植，心生創作衝動。', choices: [
                {
                    text: '寫其形：「中通外直，不蔓不枝」', effect: (p) => {
                        p.creativity = (p.creativity | 0) + 15;
                        p.exp = (p.exp | 0) + 5;
                        return '文思+15、經驗+5。';
                    }
                },
                {
                    text: '寫其德：「香遠益清，可遠觀而不可褻玩」', effect: (p) => {
                        p.creativity = (p.creativity | 0) + 10;
                        p.attributes.lotus = Math.min(100, (p.attributes.lotus | 0) + 5);
                        return '文思+10、自守+5。';
                    }
                },
            ]
        },
    ];

    // === ⬇️ 新增：典籍小注（UI 端用，不改事件文案本體） ===
    function getEventNote(card) {
        const t = (card?.title || '') + (card?.desc || '');
        if (t.includes('周敦頤') || t.includes('濂溪') || t.includes('蓮')) {
            return '小注：〈愛蓮說〉—「中通外直，不蔓不枝；香遠益清，可遠觀而不可褻玩焉。」';
        }
        if (t.includes('陶淵明') || t.includes('東籬') || t.includes('菊')) {
            return '小注：陶潛〈飲酒〉其五—「採菊東籬下，悠然見南山。」';
        }
        if (t.includes('牡丹') || t.includes('國色')) {
            return '小注：歷來以牡丹象徵富貴榮耀，「唯有牡丹真國色」遂成典。';
        }
        return '';
    }

    // === ⬇️ 合併：保留你原本 eventDeck，追加 extraEvents（避免重名） ===
    const mergedEventDeck = Array.isArray(eventDeck)
        ? [...eventDeck, ...extraEvents.filter(e => !eventDeck.some(x => x.title === e.title))]
        : extraEvents;
    const _origGetRandomEvent = typeof getRandomEvent === 'function' ? getRandomEvent : null;
    
    // ▼▼▼ 請用這段完整的 _fallbackGetRandomEvent 函數，取代掉舊的 ▼▼▼
    function _fallbackGetRandomEvent() {
        if (!global.GameState.gameState.usedEventTitles) {
            global.GameState.gameState.usedEventTitles = [];
        }
        const usedTitles = global.GameState.gameState.usedEventTitles;

        let availableCards = mergedEventDeck.filter(card => !usedTitles.includes(card.title));

        if (availableCards.length === 0) {
            console.log("事件牌庫已用完，正在重置和洗牌...");
            // 【✅ 核心修正】確保我們重置的是正確路徑下的陣列
            global.GameState.gameState.usedEventTitles = []; 
            availableCards = mergedEventDeck;
            
            // Fisher–Yates 洗牌，確保下一輪順序不同
            for (let i = availableCards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
            }
            console.log("事件牌庫已重置！");
        }

        // 從剩餘的可抽卡中抽一張
        return availableCards[Math.floor(Math.random() * availableCards.length)];
    }
// ▲▲▲ 取代結束 ▲▲▲
    const finalGetRandomEvent = _origGetRandomEvent || _fallbackGetRandomEvent;



    // === ⬇️ 重新輸出，保持你原有匯出鍵名 ===
    global.GameData = {
        ...(global.GameData || {}),
        boardLayout,
        boardPath,
        TOTAL_CELLS,
        eventDeck: mergedEventDeck,
        getRandomEvent: finalGetRandomEvent,
        getEventNote
    };

})(window);

