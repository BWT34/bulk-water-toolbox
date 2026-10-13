(function () {
    if (document.getElementById('bwt-quote-popup-btn')) return;

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

    // ---- Button + pop-up ----
    const btn = document.createElement('button');
    btn.id = 'bwt-quote-popup-btn';
    btn.type = 'button';
    btn.textContent = 'Cartage quote';
    btn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99998;font:600 14px Segoe UI,Arial,sans-serif;background:#1d4ed8;color:#fff;border:0;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.3);';
    document.body.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.id = 'bwt-quote-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.6);display:none;align-items:center;justify-content:center;padding:12px;';

    const panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:540px;height:min(92vh,760px);background:#f1f5f9;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.4);';

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

    // ---- The quote page sends the chosen address back here ----
    window.addEventListener('message', (e) => {
        if (e.origin !== location.origin) return; // only our own quote page
        const d = e.data;
        if (!d || d.type !== 'bwt-quote-address' || !d.address) return;

        if (fillDeliveryAddress(d.address)) {
            closeQuote();
            toast('Delivery address added to the order');
        } else {
            toast("Couldn't find the Delivery Address fields on this page", true);
        }
    });

})();
