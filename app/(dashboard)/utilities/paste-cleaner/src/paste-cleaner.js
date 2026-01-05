/**
 * Paste Cleaner Pro - UI Layer
 *
 * This module handles DOM interactions and UI state.
 * All cleaning logic is delegated to PasteCleanerCore.
 *
 * @version 1.2.0
 */

// ---------- DOM refs ----------
const byId = id => document.getElementById(id);
const pasteBox = byId('pasteBox');
const output = byId('output');
const outputPreview = byId('outputPreview');
const stats = byId('stats');
const inStats = byId('inStats');
const outStats = byId('outStats');

// ---------- Options from DOM ----------
function getOptionsFromDOM() {
    return {
        preserveImages: !!byId('preserveImages')?.checked,
        preserveSpan: !!byId('preserveSpan')?.checked,
        preserveDiv: !!byId('preserveDiv')?.checked,
        preserveTables: !!byId('preserveTables')?.checked,
        preserveStyle: !!byId('preserveStyle')?.checked,
        preserveClass: !!byId('preserveClass')?.checked,
        preserveId: !!byId('preserveId')?.checked,
        preserveDataAttrs: !!byId('preserveDataAttrs')?.checked,
        maxDepth: 0,
        singleNewline: true,
        debug: !!byId('enableDebug')?.checked,
        debugCallback: logDebug
    };
}

// ---------- Stats & Helpers ----------
function countLinks(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.querySelectorAll('a[href]').length;
}

function updateStats(src = '') {
    const inLen = (src || '').length;
    const outLen = (output.value || '').length;
    const linkCount = countLinks(output.value);
    stats.textContent = `Input: ${inLen} | Output: ${outLen} | Links: ${linkCount}`;
    inStats.textContent = `${inLen} chars`;
    outStats.textContent = `${outLen} chars`;
}

function sourceHTMLFromPasteBox() {
    const html = pasteBox.innerHTML.trim();
    if (!html || html === '<br>') return '';
    return html;
}

// ---------- Debounce ----------
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ---------- Main Clean Function ----------
function doClean() {
    const src = sourceHTMLFromPasteBox();
    if (!src) {
        output.value = '';
        if (outputPreview) outputPreview.innerHTML = '';
        updateStats('');
        return;
    }

    try {
        const options = getOptionsFromDOM();
        const formatted = PasteCleanerCore.cleanAndFormat(src, options);
        output.value = formatted;
        if (outputPreview) outputPreview.innerHTML = formatted;
        updateStats(src);
    } catch (err) {
        output.value = `Error: ${err.message}`;
        if (outputPreview) outputPreview.textContent = `Error: ${err.message}`;
        logDebug('doClean error', { error: String(err) });
    }
}

const doCleanDebounced = debounce(doClean, 150);

// ---------- Event Handlers ----------

// Paste handler
pasteBox.addEventListener('paste', (e) => {
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain');

    if (html || (text && PasteCleanerCore.looksLikeHTML(text))) {
        e.preventDefault();
        const toInsert = html || text;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            pasteBox.insertAdjacentHTML('beforeend', toInsert);
        } else {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const frag = range.createContextualFragment(toInsert);
            range.insertNode(frag);
            sel.collapse(pasteBox, pasteBox.childNodes.length);
        }
        pasteBox.classList.toggle('placeholder', pasteBox.textContent.trim() === '');
        setTimeout(doClean, 0);
    } else {
        setTimeout(doClean, 0);
    }
});

pasteBox.addEventListener('input', () => {
    pasteBox.classList.toggle('placeholder', pasteBox.textContent.trim() === '');
    doCleanDebounced();
});

// View mode toggle
document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'preview') {
            output.style.display = 'none';
            if (outputPreview) {
                outputPreview.style.display = 'block';
                outputPreview.innerHTML = output.value;
            }
            logDebug('View mode', { mode: 'preview' });
        } else {
            output.style.display = 'block';
            if (outputPreview) outputPreview.style.display = 'none';
            logDebug('View mode', { mode: 'html' });
        }
    });
});

// Button handlers
byId('btnClear')?.addEventListener('click', () => {
    pasteBox.innerHTML = '';
    pasteBox.classList.add('placeholder');
    output.value = '';
    if (outputPreview) outputPreview.innerHTML = '';
    updateStats('');
    pasteBox.focus();
});

byId('btnCopy')?.addEventListener('click', async () => {
    const v = output.value;
    try {
        await navigator.clipboard.writeText(v);
        logDebug('Copied output', { length: v.length });
    } catch (err) {
        logDebug('Copy failed', { err: String(err) });
    }
});

byId('btnDownload')?.addEventListener('click', () => {
    const blob = new Blob([output.value], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clean.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

byId('downloadPage')?.addEventListener('click', (e) => {
    e.preventDefault();
    const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paste-cleaner.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// ---------- Debug ----------
function logDebug(label, data) {
    if (!byId('enableDebug')?.checked) return;
    const logEl = byId('debugLog');
    if (!logEl) return;
    const time = new Date().toISOString().split('T')[1].replace('Z', '');
    const entry = `[${time}] ${label}: ` + (data ? JSON.stringify(data) : '');
    logEl.textContent += (logEl.textContent ? '\n' : '') + entry;
    logEl.scrollTop = logEl.scrollHeight;
}

byId('btnClearLog')?.addEventListener('click', () => {
    const logEl = byId('debugLog');
    if (logEl) logEl.textContent = '';
});

// ---------- Init ----------
updateStats('');
