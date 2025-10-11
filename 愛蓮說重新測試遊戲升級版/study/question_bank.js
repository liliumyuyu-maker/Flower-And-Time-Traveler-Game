/* question_bank.js — Momo〈愛蓮說〉題庫 v1.1
 * 載入後提供：window.QuestionBank（listBanks/getBank），並自動回填 window.QUIZ / window.MINI_ITEMS（相容舊版）
 */
(function (global) {
  'use strict';

  var BANKS = {
    "default": {
      meta: {
        id: "default",
        title: "預設題庫（完整版）",
        version: "1.1",
        updatedAt: "2025-10-05",
        notes: "含五題人格快測與三題小測驗"
      },
      quiz: [
        { t: "小組報告時，你傾向扮演什麼角色？",
          opts: [
            { k: "peony", txt: "領導者，帶隊衝刺拿高分。" },
            { k: "lotus", txt: "協調者，顧全和諧與公平。" },
            { k: "chrys", txt: "獨立者，安靜完成擅長部分。" }
          ] },
        { t: "拿到一筆獎學金，你會優先用來…",
          opts: [
            { k: "peony", txt: "升級裝備（手機／球鞋），犒賞努力。" },
            { k: "lotus", txt: "進修課程或買書，投資內在。" },
            { k: "chrys", txt: "存起來，或投入靜態興趣。" }
          ] },
        { t: "遇到紛爭，你多半會…",
          opts: [
            { k: "chrys", txt: "退一步，讓風暴過去。" },
            { k: "lotus", txt: "嘗試調停，讓各方被看見。" },
            { k: "peony", txt: "正面迎戰，追求清楚結論。" }
          ] },
        { t: "被眾人注目時，你的直覺是…",
          opts: [
            { k: "peony", txt: "把握舞台，讓表現最大化。" },
            { k: "lotus", txt: "保持真誠，別讓自己失真。" },
            { k: "chrys", txt: "低調一點，我喜歡邊緣位。" }
          ] },
        { t: "對於「成功」的想像，你更看重…",
          opts: [
            { k: "lotus", txt: "過程與品格；像誰都沒關係。" },
            { k: "peony", txt: "影響力與成果，能被看見。" },
            { k: "chrys", txt: "自由與節氣，合拍最重要。" }
          ] }
      ],
      mini: [
        { q: "〈愛蓮說〉的文體「說」主要功能是？",
          opts: ["抒情記敘為主", "說明與評斷、借物明志", "議論時事、諷喻當世", "描寫景物、鋪排聲色"],
          ans: 1,
          why: "「說」偏向說理短文，本篇以蓮明志，兼描寫與評斷。" },
        { q: "句中「濯清漣而不妖」的「妖」較貼近哪個意思？",
          opts: ["妖怪神祕", "花色豔麗", "逢迎作假、矯飾失真", "魅惑他人"],
          ans: 2,
          why: "此處指因迎合或欲望而失真之「做作、矯飾」。" },
        { q: "「菊—隱逸、牡丹—富貴、蓮—君子」的安排，最主要運用了？",
          opts: ["設問", "對偶", "對比／對照", "頂真"],
          ans: 2,
          why: "三花並列比照，建立價值座標，是對比／對照手法。" }
      ]
    },
    "concise": {
      meta: {
        id: "concise",
        title: "簡潔題庫（課堂快用）",
        version: "1.1",
        updatedAt: "2025-10-05",
        notes: "快測縮短為三題，小測驗保留兩題"
      },
      quiz: [
        { t: "被眾人注目時，你的直覺是…",
          opts: [
            { k: "peony", txt: "把握舞台，讓表現最大化。" },
            { k: "lotus", txt: "保持真誠，別讓自己失真。" },
            { k: "chrys", txt: "低調一點，我喜歡邊緣位。" }
          ] },
        { t: "遇到紛爭，你多半會…",
          opts: [
            { k: "chrys", txt: "退一步，讓風暴過去。" },
            { k: "lotus", txt: "嘗試調停，讓各方被看見。" },
            { k: "peony", txt: "正面迎戰，追求清楚結論。" }
          ] },
        { t: "對於「成功」的想像，你更看重…",
          opts: [
            { k: "lotus", txt: "過程與品格；像誰都沒關係。" },
            { k: "peony", txt: "影響力與成果，能被看見。" },
            { k: "chrys", txt: "自由與節氣，合拍最重要。" }
          ] }
      ],
      mini: [
        { q: "〈愛蓮說〉中「蓮」象徵的核心人格是？",
          opts: ["隱逸之士", "君子之德", "權力之勢", "商賈之利"],
          ans: 1,
          why: "全文借蓮喻君子，對照菊之隱逸、牡丹之富貴。" },
        { q: "「可遠觀而不可褻玩焉」比較接近哪種態度？",
          opts: ["敬而近之", "輕佻把玩", "敬重而不戲弄", "疏離不理"],
          ans: 2,
          why: "對美德與清節宜敬重，不可輕慢褻玩。" }
      ]
    }
  };

  function listBanks() {
    var ids = [];
    for (var k in BANKS) {
      if (Object.prototype.hasOwnProperty.call(BANKS, k)) {
        var m = BANKS[k].meta;
        ids.push({ id: m.id, title: m.title, version: m.version, updatedAt: m.updatedAt, notes: m.notes });
      }
    }
    return ids;
  }
  function getBank(id) {
    if (id && BANKS[id]) return BANKS[id];
    return BANKS["default"];
  }

  var api = { listBanks: listBanks, getBank: getBank, __raw: BANKS };
  global.QuestionBank = api;

  // 舊版相容
  try {
    var def = getBank("default");
    if (!global.QUIZ) global.QUIZ = def.quiz;
    if (!global.MINI_ITEMS) global.MINI_ITEMS = def.mini;
  } catch (e) {}
})(window);
