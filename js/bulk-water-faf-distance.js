(function () {
    if (document.getElementById('bwt-faf-distance')) return;

    // ---- Config ----
    const API_KEY = 'AIzaSyBm0CGfQuGewRjmc2wsKMx50QxUND2Puqk';
    const START_LABEL_TEXT = 'Start Location'; // dropdown (Choice) field, matched by label
    // Dropdown choice -> real start address used for the distance calculation
    const DEPOTS = {
        'upper hutt': '34 Montgomery Crescent, Clouston Park, Upper Hutt, New Zealand',
        'palmerston north': '14a Savage Crescent, West End, Palmerston North, New Zealand'
    };
    const END_LABEL_TEXT = 'Address'; // single-line field, matched by label — not a fieldset
    const DISTANCE_LABEL_TEXT = 'Distance (KM)';

    // ---- Small status indicator (not a full route card — this one
    // just needs to quietly fill in a number) ----
    const panel = document.createElement('div');
    panel.id = 'bwt-faf-distance';
    panel.style.cssText = 'position:fixed;bottom:15px;left:10px;z-index:99999;font-family:Segoe UI,Arial,sans-serif;background:#1e293b;color:#94a3b8;padding:8px 12px;border-radius:10px;font-size:11px;box-shadow:0 4px 10px rgba(0,0,0,.3);display:none;';
    document.body.appendChild(panel);

    function showStatus(text) {
        panel.textContent = text;
        panel.style.display = 'block';
    }

    function hideStatus() {
        panel.style.display = 'none';
    }

    // ---- Find any field's actual input by its visible label text
    // (robust against CognitoForms renumbering internal field IDs) ----
    function normalizeLabelText(text) {
        return (text || '').replace(/[\*:\s]+$/, '').trim().toLowerCase();
    }

    function findInputByLabelText(labelText) {

        const labels = document.querySelectorAll('label.cog-label');
        const target = normalizeLabelText(labelText);

        for (const label of labels) {
            if (normalizeLabelText(label.textContent) === target) {
                const forId = label.getAttribute('for');
                if (forId) {
                    const input = document.getElementById(forId);
                    if (input) return input;
                }
            }
        }

        return null;

    }

    // ---- Start Location dropdown: read the selected choice and map it to a depot address ----
    function findStartControl() {
        const direct = findInputByLabelText(START_LABEL_TEXT);
        if (direct) return direct;
        const target = normalizeLabelText(START_LABEL_TEXT);
        for (const label of document.querySelectorAll('label.cog-label')) {
            if (normalizeLabelText(label.textContent) !== target) continue;
            const box = label.closest('.cog-field, .cog-field--choice, div');
            const el = box && box.querySelector('input.el-input__inner, select, input');
            if (el) return el;
        }
        return null;
    }

    function getStartAddress() {
        const el = findStartControl();
        if (!el) return null;
        let text = '';
        if (el.tagName === 'SELECT') text = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
        else text = el.value || '';
        const key = text.trim().toLowerCase();
        if (DEPOTS[key]) return DEPOTS[key];
        // tolerate extra wording, e.g. "Palmerston North depot"
        for (const name in DEPOTS) if (key.includes(name)) return DEPOTS[name];
        return null;
    }

    function getEndAddress() {

        const input = findInputByLabelText(END_LABEL_TEXT);
        if (!input) return null;

        const value = (input.value || '').trim();
        if (!value) return null;

        return value + ', New Zealand';

    }

    // ---- Properly set a value on a Vue/Element-UI controlled input ----
    // Setting .value directly doesn't work here — Vue tracks its own
    // internal state and won't notice a plain DOM write. This uses the
    // input's native property setter (bypassing Vue's override) and
    // then fires the events Vue actually listens for.
    function setVueInputValue(input, value) {

        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

    }

    // ---- Distance calculation via Google ----
    function calculateAndFillDistance(startAddress, endAddress) {

        showStatus('Calculating distance…');

        if (typeof google === 'undefined' || !google.maps || !google.maps.DistanceMatrixService) {
            showStatus('Distance calc unavailable');
            return;
        }

        const service = new google.maps.DistanceMatrixService();

        service.getDistanceMatrix({
            origins: [startAddress],
            destinations: [endAddress],
            travelMode: 'DRIVING',
            unitSystem: google.maps.UnitSystem.METRIC
        }, (response, status) => {

            if (status !== 'OK') {
                console.log('Distance Matrix error:', status);
                showStatus('Distance calc failed');
                return;
            }

            const el = response.rows[0].elements[0];

            if (el.status !== 'OK') {
                showStatus('Could not calculate route');
                return;
            }

            const distanceKm = (el.distance.value / 1000 * 2).toFixed(2);

            const distanceInput = findInputByLabelText(DISTANCE_LABEL_TEXT);

            if (!distanceInput) {
                showStatus('Distance field not found on page');
                console.log('Could not find input for label:', DISTANCE_LABEL_TEXT);
                console.log('Actual labels found on page:', Array.from(document.querySelectorAll('label.cog-label')).map(l => l.textContent.trim()));
                return;
            }

            setVueInputValue(distanceInput, distanceKm);

            showStatus(`Distance: ${distanceKm} km`);
            setTimeout(hideStatus, 4000);

        });

    }

    // ---- Watch both address fieldsets for changes, debounced ----

    let debounceTimer = null;
    let lastStart = null;
    let lastEnd = null;

    function handleAddressChange() {

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {

            const start = getStartAddress();
            const end = getEndAddress();

            if (!start || !end) return;
            if (start === lastStart && end === lastEnd) return;

            lastStart = start;
            lastEnd = end;

            ensureMapsLoaded(() => calculateAndFillDistance(start, end));

        }, 1200);

    }

    function attachListenerToLabeledInput(labelText) {

        const input = findInputByLabelText(labelText);
        if (!input) return false;

        input.addEventListener('input', handleAddressChange);
        input.addEventListener('blur', handleAddressChange);

        return true;

    }

    function watchForFields() {

        const startFound = !!findStartControl();
        const endFound = attachListenerToLabeledInput(END_LABEL_TEXT);

        if (startFound && endFound) {
            console.log('BWT FAF: both Start Location and Address fields found, watching for changes.');
            // The dropdown doesn't fire normal input events, so check it once a second
            // (handleAddressChange only recalculates when the start or end actually changed)
            setInterval(handleAddressChange, 2000);   // must be longer than the 1.2 s debounce, or the debounce never completes
            // Run once immediately in case fields are already filled
            // (e.g. Order Lookup already populated the address)
            handleAddressChange();
            return;
        }

        console.log('BWT FAF: still waiting — Start Location found:', startFound, '| Address found:', endFound);

        // Not all fields rendered yet — CognitoForms is a SPA
        setTimeout(watchForFields, 500);

    }

    watchForFields();

    function ensureMapsLoaded(callback) {

        if (typeof google !== 'undefined' && google.maps) {
            callback();
            return;
        }

        window.bwtFafMapsReady = callback;

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=bwtFafMapsReady`;
        script.async = true;
        document.head.appendChild(script);

    }

})();
