/* database.js — 本機資料與匯出工具（無外部相依）
 * 提供：LS（localStorage 包裝）、downloadText、toCSV
 */
(function (global) {
    'use strict';

    var LS = {
        get: function (key, fallback) {
            try {
                var val = JSON.parse(localStorage.getItem(key) || 'null');
                return val === null ? (fallback !== undefined ? fallback : null) : val;
            } catch (e) {
                return fallback !== undefined ? fallback : null;
            }
        },
        set: function (key, val) {
            localStorage.setItem(key, JSON.stringify(val));
        },
        del: function (key) {
            localStorage.removeItem(key);
        },
        clearAll: function () {
            localStorage.clear();
        }
    };

    function downloadText(filename, text) {
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function toCSV(rows, headers) {
        function esc(s) {
            if (s == null) return '';
            var str = String(s);
            if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
            return str;
        }
        var out = [];
        if (headers && headers.length) out.push(headers.map(esc).join(','));
        for (var i = 0; i < rows.length; i++) {
            out.push(rows[i].map(esc).join(','));
        }
        return out.join('\n');
    }

    global.DB = { LS: LS, downloadText: downloadText, toCSV: toCSV };
})(window);
