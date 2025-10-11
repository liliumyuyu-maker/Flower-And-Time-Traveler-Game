/* app.js — 互動主程式（題庫切換、測驗、思辨、仿作、匯出、Podcast）*/
(function () {
    'use strict';

    // ========= DOM 快捷 =========
    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));

    // ========= Toast 通知系統 =========
    function showToast(msg, duration = 2500) {
        const t = $('#toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), duration);
    }

    // ========= 音訊預設 =========
    const AUDIO_DEFAULTS = {
        full: 'https://github.com/liliumyuyu-maker/my-images/raw/refs/heads/main/%E6%84%9B%E8%93%AE%E8%AA%AA%20(online-audio-converter.com).mp3'
    };

    // ========= 範例文本 =========
    const EXAMPLES = {
        mud: '例如：班上流行抄功課，我一開始也想跟著做省時間，但後來想到這樣根本學不到東西，就決定自己寫，雖然比較累但心安。',
        notyao: '例如：得獎後很多人突然對我很好，我發現自己開始說些違心的話來維持關係，後來覺得這樣很假，決定還是做自己比較自在。',
        lab1: '🌼菊：「每個人有自己的選擇，我尊重你。」\n🌺牡丹：「偶爾享受也不錯，但記得別迷失自己。」\n🪷蓮：「外在的東西會過去，內在的充實才長久喔。」',
        lab2: '例如：我會提醒自己當初為什麼努力，然後在該堅持的地方說真話，不迎合所有人的期待。可以謙虛但不必虛偽。'
    };

    // ========= 題庫動態載入 =========
    let MINI_ITEMS = [];
    let QUIZ = [];

    function loadCurrentBank() {
        if (!window.QuestionBank) return;
        const bankId = localStorage.getItem('bankId') || 'default';
        const bank = window.QuestionBank.getBank(bankId);
        MINI_ITEMS = bank.mini;
        QUIZ = bank.quiz;
    }
    function setupDropZone() {
        const dz = $('#dropZone');
        const picker = $('#filePicker');
        const list = $('#fileList');
        const btnCSV = $('#btnProcessCSV');
        if (!dz || !picker || !list || !btnCSV) return;

        let importRecords = [];

        const readFiles = files => {
            const tasks = [...files].map(f => new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const obj = JSON.parse(reader.result || '{}');
                        importRecords.push(obj);
                    } catch (e) {
                        console.error("無法解析檔案:", f.name, e);
                    }
                    resolve();
                };
                reader.readAsText(f, 'utf-8');
            }));

            Promise.all(tasks).then(() => {
                list.innerHTML = `已載入檔案：<strong>${importRecords.length}</strong> 份`;
                btnCSV.disabled = importRecords.length === 0;
                showToast(`✅ 已讀入 ${importRecords.length} 份學生 .json 檔`);
            });
        };

        dz.addEventListener('click', () => picker.click());
        picker.addEventListener('change', e => readFiles(e.target.files));
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); readFiles(e.dataTransfer.files); });

        btnCSV.addEventListener('click', () => {
            if (importRecords.length === 0) return;

            const headers = ['座號', '姓名', '花型', '牡丹分', '蓮花分', '菊花分', '淤泥情境', '順境不妖', '狀況一', '狀況二', '仿作內容'];
            const rows = importRecords.map(rec => {
                const quiz = rec.quiz || {};
                const lab = rec.lab || {};
                return [
                    rec.seat || '',
                    rec.name || '',
                    quiz.type || '',
                    quiz.counts?.peony || 0,
                    quiz.counts?.lotus || 0,
                    quiz.counts?.chrys || 0,
                    lab.mud || '',
                    lab.notYao || '',
                    lab.lab1 || '',
                    lab.lab2 || '',
                    rec.draft || ''
                ];
            });

            const csvContent = DB.toCSV(rows, headers);
            DB.downloadText('全班愛蓮說作答彙整.csv', csvContent);
        });
    }

    // ========= 題庫 UI =========
    function populateBankSelect() {
        const sel = $('#bankSelect');
        if (!sel || !window.QuestionBank) return;

        const banks = window.QuestionBank.listBanks();
        const currentBankId = localStorage.getItem('bankId') || 'default';

        sel.innerHTML = banks.map(b =>
            `<option value="${b.id}"${b.id === currentBankId ? ' selected' : ''}>${b.title} v${b.version}</option>`
        ).join('');

        updateBankMeta(currentBankId);
    }

    function updateBankMeta(id) {
        const metaEl = $('#bankMeta');
        if (!metaEl || !window.QuestionBank) return;

        const bank = window.QuestionBank.getBank(id);
        const m = bank.meta;
        metaEl.textContent = `ID：${m.id}｜更新：${m.updatedAt}｜備註：${m.notes || '無'}`;
    }

    function applyBank() {
        const id = $('#bankSelect').value;
        localStorage.setItem('bankId', id);

        loadCurrentBank();

        // 重新渲染所有題目
        renderQuiz();
        $('#quizResult').style.display = 'none';
        renderMiniQuiz();
        $('#miniResult').style.display = 'none';

        const bank = window.QuestionBank.getBank(id);
        showToast(`✅ 題庫已切換為：${bank.meta.title}`);
        updateProgress();
    }

    function viewBank() {
        const id = $('#bankSelect').value;
        const bank = window.QuestionBank.getBank(id);

        const content = [
            `【題庫】${bank.meta.title} v${bank.meta.version}`,
            `更新：${bank.meta.updatedAt}`,
            `備註：${bank.meta.notes || '無'}`,
            '',
            `— 快問快答（${bank.quiz.length} 題） —`,
            ...bank.quiz.map((q, i) => `${i + 1}. ${q.t} / 選項數：${q.opts.length}`),
            '',
            `— 小測驗（${bank.mini.length} 題） —`,
            ...bank.mini.map((m, i) => `${i + 1}. ${m.q}（正解索引：${m.ans}）`)
        ].join('\n');

        DB.downloadText(`題庫檢視_${id}.txt`, content);
    }

    // ========= 進度條系統 =========
    function updateProgress() {
        const checks = [
            DB.LS.get('aiLianQuiz') !== null,
            ($('#inputMud')?.value.trim() || $('#inputNotYao')?.value.trim()) ? true : false,
            ($('#lab1')?.value.trim() || $('#lab2')?.value.trim()) ? true : false,
            $('#draft')?.style.display === 'block'
        ];

        const done = checks.filter(Boolean).length;
        const pct = (done / 4) * 100;

        const fillEl = $('#progressFill');
        if (fillEl) fillEl.style.width = `${pct}%`;

        // 更新狀態徽章
        const badges = [
            { el: $('#status1'), check: checks[0] },
            { el: $('#status3'), check: checks[1] },
            { el: $('#status4'), check: checks[2] },
            { el: $('#status5'), check: checks[3] }
        ];

        badges.forEach(({ el, check }) => {
            if (!el) return;
            el.textContent = check ? '已完成' : '待完成';
            el.className = `status-badge ${check ? 'done' : 'todo'}`;
        });
    }

    // ========= 快問快答 =========
    function renderQuiz() {
        const box = $('#quiz');
        if (!box) return;

        box.innerHTML = '';

        QUIZ.forEach((q, qi) => {
            const div = document.createElement('div');
            div.className = 'q';
            div.innerHTML = `
                <p><strong>Q${qi + 1}.</strong> ${q.t}</p>
                ${q.opts.map((o, oi) => {
                const id = `q${qi}_o${oi}`;
                return `<label><input type="radio" name="q${qi}" value="${o.k}" id="${id}"> ${o.txt}</label>`;
            }).join('')}
            `;
            box.appendChild(div);
        });
    }

    function calcQuiz() {
        const counts = { peony: 0, lotus: 0, chrys: 0 };

        for (let i = 0; i < QUIZ.length; i++) {
            const checked = document.querySelector(`input[name="q${i}"]:checked`);
            if (!checked) return null;
            counts[checked.value]++;
        }

        let type = 'lotus';
        let max = -1;

        Object.entries(counts).forEach(([k, v]) => {
            if (v > max) {
                max = v;
                type = k;
            }
        });

        return { type, counts };
    }

    function showQuizResult(res) {
        const typeMap = {
            peony: { title: '🌺 牡丹型人格', desc: '你如牡丹，勇於追求卓越、擁抱舞台與成果。享受盛放的榮光，也別忘了欣賞他人的花期。' },
            lotus: { title: '🪷 蓮花型人格', desc: '你如蓮花，身在複雜仍守準則，重視和諧與真誠。順境中「不妖」是你的練習題。' },
            chrys: { title: '🌼 菊花型人格', desc: '你如菊花，按自己的節氣綻放，安靜專注、不與爭鋒。也請適時讓世界看到你的美。' }
        };

        const info = typeMap[res.type];
        const el = $('#quizResult');

        el.style.display = 'block';
        el.innerHTML = `
            <strong>${info.title}</strong><br>${info.desc}
            <div class="small muted" style="margin-top:8px">
                統計 → 牡丹 ${res.counts.peony}、蓮 ${res.counts.lotus}、菊 ${res.counts.chrys}
            </div>
        `;

        DB.LS.set('aiLianQuiz', res);
        updateProgress();
        showToast('✅ 測驗結果已儲存！');

        // 平滑滾動到結果
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ========= 文句互動 & 圖例 =========
    function wireTextHints() {
        $$('.key').forEach(k => {
            const toggleHint = () => {
                const hintId = 'hint-' + k.dataset.hint.split('tag-')[1];
                const el = document.getElementById(hintId);
                const isVisible = el.style.display === 'block';

                el.style.display = isVisible ? 'none' : 'block';
                k.setAttribute('aria-expanded', !isVisible);
            };

            k.addEventListener('click', toggleHint);
            k.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleHint();
                }
            });
        });
    }

    function wireLegend() {
        const note = $('#morphNote');
        const txtMap = {
            stem: '🌱 莖直且中空 → 表裡如一、骨幹挺立（中通外直）',
            root: '🌿 不任意旁生攀附 → 原則感（不蔓不枝）',
            fragrance: '🌸 香而不膩、清而不近 → 品格影響力（香遠益清）',
            posture: '💎 姿態端正、潔淨挺立 → 自持自重（亭亭淨植）'
        };

        $$('.legend-item').forEach(btn => {
            const handler = () => {
                $$('.legend-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const part = btn.dataset.part;
                note.textContent = txtMap[part] || '💡 點選標籤查看說明';
            };

            btn.addEventListener('click', handler);
            btn.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        });
    }

    // ========= 思辨實驗室儲存 =========
    function saveLab() {
        const data = {
            mud: $('#inputMud')?.value || '',
            notYao: $('#inputNotYao')?.value || '',
            lab1: $('#lab1')?.value || '',
            lab2: $('#lab2')?.value || ''
        };

        DB.LS.set('aiLianLab', data);
        updateProgress();
        showToast('💾 思考紀錄已儲存！');
    }

    function loadLab() {
        const d = DB.LS.get('aiLianLab', {});

        if (d.mud && $('#inputMud')) $('#inputMud').value = d.mud;
        if (d.notYao && $('#inputNotYao')) $('#inputNotYao').value = d.notYao;
        if (d.lab1 && $('#lab1')) $('#lab1').value = d.lab1;
        if (d.lab2 && $('#lab2')) $('#lab2').value = d.lab2;
    }

    function clearLab() {
        if (!confirm('確定要清空本機紀錄？')) return;

        DB.LS.set('aiLianLab', {});
        loadLab();
        showToast('🗑️ 已清空');
    }

    function setupAutoSave() {
        const inputs = ['#inputMud', '#inputNotYao', '#lab1', '#lab2'];
        let timer;

        inputs.forEach(sel => {
            const el = $(sel);
            if (!el) return;

            el.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(saveLab, 1200);
            });
        });
    }

    // ========= 仿作生成 =========
    function genDraft() {
        const topic = $('#w-topic').value.trim();
        const a = $('#w-a').value.trim();
        const b = $('#w-b').value.trim();
        const v = $('#w-value').value.trim();

        if (!topic) {
            showToast('⚠️ 請至少填寫主題名詞', 3000);
            $('#w-topic').focus();
            return;
        }

        const title = `愛${topic}說`;
        const body = [
            `【點題】予獨愛${topic}之${v || '（品格）'}也。`,
            `【對照】${a || '（對照A）'}，事之甲也；${b || '（對照B）'}，事之乙也；${topic}，事之君子者也。`,
            `【描寫】其中通外直，不蔓不枝；久習而不厭，專注益清；置身喧鬧而不妖，守其本心而不矯。`,
            `【明志】夫${topic}之可愛者，非徒可觀可玩，實可以自持自警。`
        ].join('\n\n');

        const full = `《${title}》\n\n${body}\n`;
        const box = $('#draft');

        box.style.display = 'block';
        box.textContent = full;
        $('#btnExport').disabled = false;

        updateProgress();
        showToast('✨ 草稿已生成！');

        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function exportTxt() {
        const txt = $('#draft').textContent;
        if (!txt) {
            showToast('⚠️ 請先生成草稿', 2000);
            return;
        }

        DB.downloadText('愛___說_草稿.txt', txt);
        showToast('⬇️ 檔案已下載');
    }

    // ========= 小測驗 =========
    function renderMiniQuiz() {
        const box = $('#miniQuiz');
        if (!box) return;

        box.innerHTML = '';

        MINI_ITEMS.forEach((it, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'q';
            wrap.innerHTML = `
                <p><strong>${i + 1}.</strong> ${it.q}</p>
                ${it.opts.map((t, idx) =>
                `<label><input type="radio" name="m${i}" value="${idx}"> ${t}</label>`
            ).join('')}
            `;
            box.appendChild(wrap);
        });
    }

    function submitMiniQuiz() {
        const total = MINI_ITEMS.length;

        // 檢查是否全部作答
        for (let i = 0; i < total; i++) {
            const sel = document.querySelector(`input[name="m${i}"]:checked`);
            if (!sel) {
                showToast('⚠️ 還有小題未作答喔', 3000);
                return;
            }
        }

        // 計算分數與回饋
        let correct = 0;
        const feedback = [];

        for (let j = 0; j < total; j++) {
            const pick = parseInt(document.querySelector(`input[name="m${j}"]:checked`).value, 10);
            const isCorrect = pick === MINI_ITEMS[j].ans;

            if (isCorrect) correct++;

            feedback.push(`第 ${j + 1} 題：${isCorrect ? '✅ 正確' : '❌ 錯誤'}｜解析：${MINI_ITEMS[j].why}`);
        }

        const resultEl = $('#miniResult');
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
            <strong>分數：${correct} / ${total}</strong><br><br>
            ${feedback.join('<br>')}
        `;

        showToast(`✨ 你答對了 ${correct} 題！`);
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ========= 下載：學習歷程 / TXT / CSV =========
    function exportPortfolio() {
        const seat = $('#studentSeat').value.trim();
        const name = $('#studentName').value.trim();

        if (!seat || !name) {
            showToast('⚠️ 請先輸入座號和姓名', 3000);
            $('#studentSeat').focus();
            return;
        }

        const separator = '\n\n================================\n\n';
        let content = `〈愛蓮說〉互動學習歷程紀錄\n\n座號：${seat}\n姓名：${name}\n匯出時間：${new Date().toLocaleString('zh-TW')}\n`;

        // PART 1: 測驗結果
        const quizResult = DB.LS.get('aiLianQuiz');
        const quizText = quizResult
            ? `測驗結果：${{ peony: '牡丹', lotus: '蓮花', chrys: '菊花' }[quizResult.type]}型人格\n(統計：牡丹 ${quizResult.counts.peony}｜蓮 ${quizResult.counts.lotus}｜菊 ${quizResult.counts.chrys})`
            : '尚未作答';

        content += `${separator}PART 1：你是哪一種花？\n\n${quizText}`;

        // PART 3: 探問反思
        const mud = $('#inputMud')?.value.trim() || '未填寫';
        const notYao = $('#inputNotYao')?.value.trim() || '未填寫';

        content += `${separator}PART 3：一句一世界（探問反思）\n\n`;
        content += `▶︎ #出淤泥而不染（我的淤泥情境）：\n${mud}`;
        content += `\n\n▶︎ #濯清漣而不妖（我觀察到的順境考驗）：\n${notYao}`;

        // PART 4: 思辨實驗室
        const lab1 = $('#lab1')?.value.trim() || '未填寫';
        const lab2 = $('#lab2')?.value.trim() || '未填寫';

        content += `${separator}PART 4：思辨實驗室\n\n`;
        content += `▶︎ 狀況一（好友太牡丹）：\n${lab1}`;
        content += `\n\n▶︎ 狀況二（自己有點妖）：\n${lab2}`;

        // PART 5: 仿作
        const draft = $('#draft')?.textContent.trim() || '未生成草稿';
        content += `${separator}PART 5：我的「＿＿說」仿作\n\n${draft}`;

        const filename = `${seat}_${name}_愛蓮說學習歷程.txt`;
        DB.downloadText(filename, content);
        showToast('📦 學習歷程已打包下載！');
    }
    function exportStudentJSON() {
        const seat = $('#studentSeat').value.trim();
        const name = $('#studentName').value.trim();
        if (!seat || !name) {
            showToast('⚠️ 請先輸入座號和姓名', 3000);
            $('#studentSeat').focus();
            return;
        }

        const quiz = DB.LS.get('aiLianQuiz', null);
        const lab = DB.LS.get('aiLianLab', {});
        const draft = $('#draft')?.textContent || '';

        const payload = { seat, name, quiz, lab, draft };
        DB.downloadText(`${seat}_${name}_愛蓮說作答.json`, JSON.stringify(payload, null, 2));
        showToast('⬇️ 已匯出 .json 檔 (請繳交此檔)');
    }

    function exportAllTxt() {
        const out = [`[系統] 題庫：${localStorage.getItem('bankId') || 'default'}`];

        const quiz = DB.LS.get('aiLianQuiz');
        if (quiz) out.push(`\n[測驗] ${JSON.stringify(quiz, null, 2)}`);

        const lab = DB.LS.get('aiLianLab');
        if (lab) out.push(`\n[思辨實驗室] ${JSON.stringify(lab, null, 2)}`);

        const draft = $('#draft')?.textContent || '';
        if (draft) out.push(`\n[仿作草稿]\n${draft}`);

        DB.downloadText('愛蓮說_本機資料.txt', out.join('\n'));
    }

    function exportAllCSV() {
        const rows = [['field', 'value']];
        const lab = DB.LS.get('aiLianLab', {});
        const quiz = DB.LS.get('aiLianQuiz', null);
        const draft = $('#draft')?.textContent || '';

        rows.push(['bankId', localStorage.getItem('bankId') || 'default']);

        if (quiz) {
            rows.push(['quizType', quiz.type]);
            rows.push(['quizCounts_peony', quiz.counts.peony]);
            rows.push(['quizCounts_lotus', quiz.counts.lotus]);
            rows.push(['quizCounts_chrys', quiz.counts.chrys]);
        }

        rows.push(['mud', lab.mud || '']);
        rows.push(['notYao', lab.notYao || '']);
        rows.push(['lab1', lab.lab1 || '']);
        rows.push(['lab2', lab.lab2 || '']);
        rows.push(['draft', draft]);

        const csv = DB.toCSV(rows);
        DB.downloadText('愛蓮說_本機資料.csv', csv);
    }

    function clearAllData() {
        if (!confirm('確定清空本機所有資料（含題庫選擇、測驗、思辨、草稿）？')) return;

        DB.LS.clearAll();

        renderQuiz();
        $('#quizResult').style.display = 'none';
        renderMiniQuiz();
        $('#miniResult').style.display = 'none';
        loadLab();

        const draftEl = $('#draft');
        draftEl.style.display = 'none';
        draftEl.textContent = '';

        populateBankSelect();
        updateProgress();
        showToast('🗑️ 已清空本機資料');
    }

    // ========= 例示填充 =========
    function showExample(type) {
        const text = EXAMPLES[type] || '';
        showToast('💡 已顯示參考範例（可自行修改）', 3000);

        const mapping = {
            mud: '#inputMud',
            notyao: '#inputNotYao',
            lab1: '#lab1',
            lab2: '#lab2'
        };

        const el = $(mapping[type]);
        if (el) {
            el.value = text;
            el.focus();
        }
    }

    function fillExample() {
        $('#w-topic').value = '貓';
        $('#w-a').value = '狗';
        $('#w-b').value = '倉鼠';
        $('#w-value').value = '優雅自持';
        showToast('📝 已填入範例，可直接生成或修改', 3000);
    }

    // ========= 初始化 =========
    function init() {
        // 載入當前題庫
        loadCurrentBank();

        // 題庫下拉選單
        populateBankSelect();
        $('#bankSelect').addEventListener('change', function () {
            updateBankMeta(this.value);
        });
        $('#btnApplyBank').addEventListener('click', applyBank);
        $('#btnViewBank').addEventListener('click', viewBank);

        // 快問快答
        renderQuiz();
        $('#btnSubmitQuiz').addEventListener('click', () => {
            const res = calcQuiz();
            if (!res) {
                showToast('⚠️ 還有題目未作答喔', 3000);
                return;
            }
            showQuizResult(res);
        });
        $('#btnResetQuiz').addEventListener('click', () => {
            renderQuiz();
            $('#quizResult').style.display = 'none';
            showToast('🔄 已重置測驗');
        });

        // 文句互動與圖例
        wireTextHints();
        wireLegend();

        // 思辨實驗室
        loadLab();
        setupAutoSave();
        $('#btnSaveLab').addEventListener('click', saveLab);
        $('#btnClearLab').addEventListener('click', clearLab);

        // 仿作生成
        $('#btnGen').addEventListener('click', genDraft);
        $('#btnExport').addEventListener('click', exportTxt);

        // 小測驗
        renderMiniQuiz();
        $('#btnMiniSubmit').addEventListener('click', submitMiniQuiz);

        // 學習歷程打包
        $('#btnExportPortfolio').addEventListener('click', exportPortfolio);
        $('#btnExportJSON').addEventListener('click', exportStudentJSON); // <-- 新增這行
        // 老師面板：拖放區初始化
        setupDropZone(); // <-- 新增這行

        // 資料管理
        $('#btnExportTxt').addEventListener('click', exportAllTxt);
        $('#btnExportCSV').addEventListener('click', exportAllCSV);
        $('#btnClearAll').addEventListener('click', clearAllData);

        // Podcast 音訊
        const fullAudioPlayer = $('#fullPodcast');
        if (fullAudioPlayer) {
            fullAudioPlayer.src = AUDIO_DEFAULTS.full;
        }

        // 恢復已儲存的測驗結果
        const saved = DB.LS.get('aiLianQuiz');
        if (saved) showQuizResult(saved);

        // 進度條初始化
        updateProgress();
    }

    // DOM 載入完成後執行
    document.addEventListener('DOMContentLoaded', init);

    // 對外介面（供 HTML onclick 使用）
    window.showExample = showExample;
    window.fillExample = fillExample;

})();