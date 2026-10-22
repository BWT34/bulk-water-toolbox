(function () {
    if (document.getElementById('bwt-quote-popup-btn')) return;
    const SCRIPT_VERSION = 'v8';
    console.log('BWT quote pop-up script ' + SCRIPT_VERSION + ' loaded');

    // ---- Config ----
    // This script lives in the js folder; the quote page sits one level up,
    // next to the order page. The link is worked out from where this script
    // was loaded from, so it doesn't matter which page includes the script.
    const QUOTE_PAGE = 'bwt-cartage-quote.html';
    const SCRIPT_SRC = document.currentScript && document.currentScript.src;
    const QUOTE_URL = SCRIPT_SRC
        ? new URL('../' + QUOTE_PAGE, SCRIPT_SRC).href   // js/ -> one folder up
        : new URL(QUOTE_PAGE, location.href).href;       // fallback: same folder as the page
    const ADDRESS_LEGEND_MATCH = /delivery address/i; // the Delivery Address field on the order form
    const RATE_LABEL = 'FAF Estimate';                // label of the number field that receives the quoted rate

    // ---- Button + pop-up ----
    const btn = document.createElement('button');
    btn.id = 'bwt-quote-popup-btn';
    btn.type = 'button';
    btn.textContent = 'Cartage quote';
    btn.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99998;font:600 14px Segoe UI,Arial,sans-serif;background:#1d4ed8;color:#fff;border:0;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.3);';
    document.body.appendChild(btn);

    // On phones: a small button tucked in the top-right corner, hidden while a field
    // is being typed in, so it never sits over the form or the keyboard.
    const btnStyle = document.createElement('style');
    btnStyle.textContent = `
        @media (max-width: 899px) {
            #bwt-quote-popup-btn { left: auto !important; right: 8px !important; top: 8px !important; transform: none !important;
                font-size: 12px !important; padding: 6px 11px !important; opacity: .92; }
            #bwt-quote-popup-btn.bwt-typing { display: none !important; }
        }`;
    document.head.appendChild(btnStyle);
    document.addEventListener('focusin', (e) => {
        if (e.target.matches && e.target.matches('input, textarea, select') && !overlay.contains(e.target)) btn.classList.add('bwt-typing');
    });
    document.addEventListener('focusout', () => {
        setTimeout(() => {
            const a = document.activeElement;
            if (!(a && a.matches && a.matches('input, textarea, select'))) btn.classList.remove('bwt-typing');
        }, 100);
    });

    const overlay = document.createElement('div');
    overlay.id = 'bwt-quote-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.6);display:none;align-items:center;justify-content:center;padding:12px;';

    const panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:540px;height:min(96vh,860px);background:#f1f5f9;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.4);';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close quote');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:8px;right:10px;z-index:2;width:30px;height:30px;border:0;border-radius:50%;background:rgba(15,23,42,.12);color:#0f172a;font-size:15px;cursor:pointer;';

    panel.appendChild(closeBtn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let frame = null;

    function openQuote() {
        // Load the quote page only when first opened, so Google Maps isn't
        // loaded a second time unless someone actually asks for a quote.
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'bwt-quote-frame';
            frame.title = 'Cartage quote';
            frame.src = QUOTE_URL + '?embed=1';
            frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
            panel.appendChild(frame);
        }
        overlay.style.display = 'flex';
    }

    function closeQuote() { overlay.style.display = 'none'; }

    btn.addEventListener('click', openQuote);
    closeBtn.addEventListener('click', closeQuote);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeQuote(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.style.display === 'flex') closeQuote(); });

    // ---- Small message at the top of the page ----
    function toast(text, bad) {
        const t = document.createElement('div');
        t.textContent = text;
        t.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:100001;font:600 13px Segoe UI,Arial,sans-serif;padding:10px 16px;border-radius:10px;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,.3);background:' + (bad ? '#b91c1c' : '#15803d') + ';';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    // ---- Fill the Cognito Delivery Address fields ----
    // Cognito's fields are Vue-controlled, so a plain .value write is ignored.
    // Use the native setter and fire the events Vue listens for.
    function setVueInputValue(el, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function findAddressFieldset() {
        for (const fs of document.querySelectorAll('fieldset')) {
            const legend = fs.querySelector('legend');
            if (legend && ADDRESS_LEGEND_MATCH.test(legend.textContent.trim())) return fs;
        }
        return null;
    }

    function fillDeliveryAddress(a) {
        const fs = findAddressFieldset();
        if (!fs) return false;

        const inputs = Array.from(fs.querySelectorAll('input.el-input__inner, input[type="text"]'));
        const labelOf = (i) => ((i.placeholder || '') + ' ' + (i.getAttribute('aria-label') || '')).toLowerCase();
        // Match by placeholder text; fall back to the field order (line 1, line 2, city, postcode)
        const pick = (re, idx) => inputs.find((i) => re.test(labelOf(i))) || inputs[idx];

        const targets = [
            [pick(/line\s*1/, 0), a.Line1],
            [pick(/line\s*2/, 1), a.Line2],
            [pick(/city|town/, 2), a.City],
            [pick(/postal|zip/, 3), a.PostalCode]
        ];
        if (targets.some(([el]) => !el)) return false;

        // Set every part (even blanks) so an old address doesn't mix with the new one
        targets.forEach(([el, value]) => setVueInputValue(el, value || ''));
        return true;
    }

    // ---- Fill the FAF Estimate number field (found by its label, like the
    // other scripts do, since Cognito renumbers its internal ids) ----
    function normalizeLabelText(text) {
        return (text || '').replace(/\s+/g, ' ').replace(/[\*:\s]+$/, '').trim().toLowerCase();
    }

    const FIELD_SELECTOR = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea';

    function inputForLabel(label) {
        // 1. the label's own "for" link
        const forId = label.getAttribute('for');
        const linked = forId ? document.getElementById(forId) : null;
        if (linked) {
            if (linked.matches(FIELD_SELECTOR)) return linked;
            const inner = linked.querySelector(FIELD_SELECTOR);
            if (inner) return inner;
        }
        // 2. otherwise the first input in the label's own field block
        //    (stop climbing before we reach a block holding other labels)
        let box = label.parentElement;
        for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
            if (box.querySelectorAll('label.cog-label').length > 1) break;
            const found = box.querySelector(FIELD_SELECTOR);
            if (found) return found;
        }
        return null;
    }

    function findInputByLabelText(labelText) {
        const target = normalizeLabelText(labelText);
        const labels = Array.from(document.querySelectorAll('label.cog-label, label'));
        // exact match first, then "starts with" (copes with extra text such as "Required")
        for (const exact of [true, false]) {
            for (const label of labels) {
                const t = normalizeLabelText(label.textContent);
                if (exact ? t === target : t.indexOf(target) === 0) {
                    const input = inputForLabel(label);
                    if (input) return input;
                }
            }
        }
        console.log('BWT quote: no input found for label "' + labelText + '". Labels on page:',
            labels.map((l) => JSON.stringify(l.textContent.trim())));
        return null;
    }

    // rate is a number, or null when the address is outside the rate schedule.
    // Returns true if the field was found and set.
    function fillRate(rate) {
        const input = findInputByLabelText(RATE_LABEL);
        if (!input) return false;
        setVueInputValue(input, rate === null ? '' : rate.toFixed(2));
        return true;
    }

    // ---- The quote page sends the chosen address (and rate) back here ----
    window.addEventListener('message', (e) => {
        if (e.origin !== location.origin) return; // only our own quote page
        const d = e.data;
        if (!d || d.type !== 'bwt-quote-address' || !d.address) return;

        const rate = (typeof d.rate === 'number' && isFinite(d.rate)) ? d.rate : null;

        if (!fillDeliveryAddress(d.address)) {
            toast("Couldn't find the Delivery Address fields on this page", true);
            return;
        }
        const rateSet = fillRate(rate);
        // remember what we wrote, so the automatic quote below doesn't redo it
        autoLastSet = rate === null ? '' : rate.toFixed(2);
        autoLastText = currentAddressText();
        if (autoLastText) { autoReqId++; autoNoFillId = autoReqId; autoSend({ type: 'bwt-quote-request', id: autoReqId, text: autoLastText }); }
        closeQuote();

        if (rate === null) {
            toast('Address added. Outside the rate schedule, so the ' + RATE_LABEL + ' is blank - quote manually', true);
        } else if (!rateSet) {
            toast('Address added, but the "' + RATE_LABEL + '" field was not found on this page (script ' + SCRIPT_VERSION + ')', true);
        } else {
            toast('Address and ' + RATE_LABEL + ' ($' + rate.toFixed(2) + ') added to the order');
        }
    });

    // ---- Automatic FAF Estimate from the typed Delivery Address ----
    // Every couple of seconds, if the address has changed and is complete, ask the
    // quote page (hidden, same rate table as the pop-up) for the rate and put it
    // in FAF Estimate. The field stays editable: a value somebody typed by hand is
    // never overwritten, only an empty field or one this script filled itself.
    const AUTO_FILL = true;
    let autoLastText = '';      // last address text we quoted (or the pop-up filled)
    let autoPrevTick = '';      // address text seen on the previous tick (waits for typing to settle)
    let autoLastSet = null;     // value this script last wrote to the field (null = never)
    let autoFrame = null, autoReady = false, autoQueue = [], autoReqId = 0, autoPending = 0, autoNoFillId = 0;

    function currentAddressText() {
        const fs = findAddressFieldset();
        if (!fs) return '';
        const vals = Array.from(fs.querySelectorAll('input.el-input__inner, input[type="text"]'))
            .slice(0, 4).map((i) => (i.value || '').trim());
        if (vals.length < 3 || !vals[0] || !vals[2]) return ''; // need street and city
        return vals.filter(Boolean).concat('New Zealand').join(', ');
    }

    // The helper page is shown as a small panel at the bottom right (above the route
    // widget) on wide screens, and kept off-screen on phones. It is the one place
    // the rate table lives: it works out the rate and also shows the quote and map.
    const DOCK_ID = 'bwt-quote-dock';
    const dockStyle = document.createElement('style');
    dockStyle.textContent = `
        #${DOCK_ID} { position: fixed; right: 10px; bottom: 10px; width: 360px; height: 300px; z-index: 99997;
            border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,.3); background: #f1f5f9; }
        #${DOCK_ID} iframe { width: 100%; height: 100%; border: 0; display: block; }
        @media (max-width: 899px) { #${DOCK_ID} { right: auto; left: -9999px; } }`;
    document.head.appendChild(dockStyle);

    function layoutDock() {
        const dock = document.getElementById(DOCK_ID);
        if (!dock) return;
        const route = document.getElementById('bwt-job-route');
        if (route && (route.style.bottom !== '10px' || route.style.top !== 'auto')) {
            // sit the route widget in the bottom-right corner so the quote panel can stack above it
            route.style.top = 'auto'; route.style.bottom = '10px'; route.style.transform = 'none';
        }
        const routeH = route ? route.getBoundingClientRect().height : 0;
        const bottom = 10 + (routeH ? routeH + 8 : 0);
        const room = window.innerHeight - bottom - 10;
        dock.style.bottom = bottom + 'px';
        dock.style.height = Math.max(0, Math.min(330, room)) + 'px';
        dock.style.visibility = room < 170 ? 'hidden' : 'visible'; // too little room above the route widget
    }
    window.addEventListener('resize', layoutDock);
    setInterval(layoutDock, 1000); // the route widget grows and shrinks as it loads

    function autoSend(msg) {
        if (!autoFrame) {
            const dock = document.createElement('div');
            dock.id = DOCK_ID;
            autoFrame = document.createElement('iframe');
            autoFrame.title = 'Cartage quote for the delivery address';
            autoFrame.addEventListener('load', () => { autoReady = true; autoQueue.splice(0).forEach((m) => autoFrame.contentWindow.postMessage(m, location.origin)); });
            autoFrame.src = QUOTE_URL + '?embed=1&dock=1';
            dock.appendChild(autoFrame);
            document.body.appendChild(dock);
            layoutDock();
        }
        if (autoReady) autoFrame.contentWindow.postMessage(msg, location.origin);
        else autoQueue.push(msg);
    }

    function applyAutoRate(rate, status, text) {
        if (text !== currentAddressText()) return; // address changed again while waiting
        const input = findInputByLabelText(RATE_LABEL);
        if (!input) return;
        const current = (input.value || '').replace(/[^0-9.\-]/g, '');
        const mine = autoLastSet !== null && current !== '' && parseFloat(current) === parseFloat(autoLastSet || 'NaN');
        if (current !== '' && !mine) { console.log('BWT quote: FAF Estimate was typed by hand, left alone'); return; }
        const next = rate === null ? '' : rate.toFixed(2);
        if (current !== '' && next !== '' && parseFloat(current) === parseFloat(next)) { autoLastSet = next; return; }
        setVueInputValue(input, next);
        autoLastSet = next;
        if (rate === null) {
            toast(status === 'OUTSIDE'
                ? 'Outside the rate schedule - enter the ' + RATE_LABEL + ' by hand'
                : "Couldn't work out a " + RATE_LABEL + ' for that address - enter it by hand', true);
        } else {
            toast(RATE_LABEL + ' set to $' + next + ' from the Delivery Address');
        }
    }

    window.addEventListener('message', (e) => {
        if (e.origin !== location.origin) return;
        const d = e.data;
        if (!d || d.type !== 'bwt-quote-result' || d.id !== autoReqId) return;
        autoPending = 0;
        if (d.id === autoNoFillId) return; // pop-up already filled the field; this was only to update the panel
        applyAutoRate(typeof d.rate === 'number' ? d.rate : null, d.status, d.text || autoLastText);
    });

    if (AUTO_FILL) {
        autoSend({ type: 'bwt-quote-hello' }); // creates the panel straight away (shows 'waiting for the delivery address')
        setInterval(() => {
            const text = currentAddressText();
            const settled = text && text === autoPrevTick; // unchanged for one whole tick
            autoPrevTick = text;
            if (!settled || text === autoLastText) return;
            if (!findInputByLabelText(RATE_LABEL)) return;
            autoLastText = text;
            autoReqId++;
            autoPending = autoReqId;
            autoSend({ type: 'bwt-quote-request', id: autoReqId, text: text });
        }, 1500);
    }

    // ---- Show a $ in front of the FAF Estimate number (display only,
    // the stored value stays a plain number) ----
    (function addDollarSign() {
        let tries = 0;
        const timer = setInterval(() => {
            const input = findInputByLabelText(RATE_LABEL);
            if (input) {
                clearInterval(timer);
                if (input.dataset.bwtDollar) return;
                input.dataset.bwtDollar = '1';
                const box = input.parentElement;
                if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
                const sign = document.createElement('span');
                sign.textContent = '$';
                sign.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#606266;pointer-events:none;';
                box.appendChild(sign);
                input.style.paddingLeft = '22px';
            } else if (++tries > 20) {
                clearInterval(timer); // give up after about 10 seconds
            }
        }, 500);
    })();

})();
