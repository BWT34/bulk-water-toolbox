(function () {
    if (window.__bwtCapitaliseNames) return;
    window.__bwtCapitaliseNames = true;

    // ---- Config: the visible labels of the text fields to tidy up (matched ignoring case) ----
    const FIELD_LABELS = ['Customer Name', 'Customer', 'Contact Name', 'Contact'];      // only labels that exist on the page are used
    // ------------------------------------------------------------------------------------------

    const targets = FIELD_LABELS.map(l => l.trim().toLowerCase());

    function normalizeLabelText(text) {
        return (text || '').replace(/[\*:\s]+$/, '').trim().toLowerCase();
    }

    // Capital letter at the start of each word (also after a hyphen, apostrophe, bracket or slash).
    // Only lower-case letters are changed, so LSG, McDonald, etc. are left as typed.
    function capitalise(value) {
        return value.replace(/(^|[\s\-'’(\/])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
    }

    // Set a value on a Vue-controlled input (a plain .value write isn't noticed by Cognito)
    function setVueInputValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function labelTextFor(input) {
        if (!input.id) return '';
        const label = document.querySelector('label.cog-label[for="' + input.id.replace(/"/g, '\\"') + '"]');
        return label ? normalizeLabelText(label.textContent) : '';
    }

    // One listener for the whole page, so fields that Cognito draws later (or inside repeating
    // sections) are covered too. It tidies the name when the person leaves the field.
    document.addEventListener('focusout', function (e) {
        const input = e.target;
        if (!input || input.tagName !== 'INPUT' || (input.type && input.type !== 'text')) return;
        if (targets.indexOf(labelTextFor(input)) === -1) return;
        const before = input.value || '';
        const after = capitalise(before);
        if (after !== before) setVueInputValue(input, after);
    }, true);

    console.log('BWT capitalise names: watching', FIELD_LABELS);
})();
