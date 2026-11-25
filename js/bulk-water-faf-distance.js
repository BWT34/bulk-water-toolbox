(function () {
    if (document.getElementById('bwt-faf-distance')) return;

    // ---- Config ----
    const API_KEY = 'AIzaSyBm0CGfQuGewRjmc2wsKMx50QxUND2Puqk';
    const START_LEGEND_MATCH = /start location/i;
    const END_LABEL_TEXT = 'Address'; // single-line field, matched by label — not a fieldset
    const DISTANCE_LABEL_TEXT = 'Distance (KM)';

    // ---- Whey run: depot -> Zanzy Zeus -> Greytown -> depot ----
    const SERVICE_LABEL_TEXT = 'Services Type';  // label of the dropdown on the Customer Bulk Water Delivery Order form
    const WHEY_MATCH = /whey/i;                  // service type value that triggers the whey route
    const WHEY_DEPOT = '34 Montgomery Crescent, Clouston Park, Upper Hutt, New Zealand';
    const WHEY_STOP_1 = '120 Hutt Park Road, Gracefield, Lower Hutt 5010, New Zealand'; // Zany Zeus Factory
    const WHEY_STOP_2 = '112 Wards Line, Greytown, New Zealand';

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

    // ---- Find an address fieldset by its legend text, same
    // approach that already worked for the delivery-order page ----
    function getAddressFromFieldset(legendMatch) {

        const fieldsets = document.querySelectorAll('fieldset');

        for (const fs of fieldsets) {
            const legend = fs.querySelector('legend');
            if (!legend || !legendMatch.test(legend.textContent.trim())) continue;

            const inputs = fs.querySelectorAll('input.el-input__inner, input[type="text"]');
            const parts = Array.from(inputs)
                .map(i => (i.value || '').trim())
                .filter(v => v.length > 0);

            if (parts.length > 0) {
                return parts.join(', ') + ', New Zealand';
            }
        }

        return null;

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

    // ---- Read the Service Type (works for a dropdown, radio buttons or a text-style field) ----
    function getServiceType() {
        const input = findInputByLabelText(SERVICE_LABEL_TEXT);
        if (input && (input.value || '').trim()) return input.value.trim();

        const target = normalizeLabelText(SERVICE_LABEL_TEXT);
        for (const fs of document.querySelectorAll('fieldset')) {
            const legend = fs.querySelector('legend');
            if (!legend || normalizeLabelText(legend.textContent) !== target) continue;
            const checked = fs.querySelector('input:checked');
            if (checked) {
                const lab = checked.closest('label') || document.querySelector('label[for="' + checked.id + '"]');
                return ((lab && lab.textContent) || checked.value || '').trim();
            }
            const sel = fs.querySelector('input.el-input__inner');
            if (sel && sel.value) return sel.value.trim();
        }
        return '';
    }

    function isWhey() { return WHEY_MATCH.test(getServiceType()); }

    function fillDistance(km) {
        const distanceInput = findInputByLabelText(DISTANCE_LABEL_TEXT);
        if (!distanceInput) {
            showStatus('Distance field not found on page');
            return;
        }
        setVueInputValue(distanceInput, km);
        showStatus('Distance: ' + km + ' km');
        setTimeout(hideStatus, 4000);
    }

    function legKm(origin, destination) {
        return new Promise((resolve, reject) => {
            new google.maps.DistanceMatrixService().getDistanceMatrix({
                origins: [origin],
                destinations: [destination],
                travelMode: 'DRIVING',
                unitSystem: google.maps.UnitSystem.METRIC
            }, (response, status) => {
                if (status !== 'OK') { reject('Distance Matrix error: ' + status); return; }
                const el = response.rows[0].elements[0];
                if (el.status !== 'OK') { reject('No route: ' + origin + ' -> ' + destination); return; }
                resolve(el.distance.value / 1000);
            });
        });
    }

    function calculateWheyRun() {
        showStatus('Calculating whey run…');
        Promise.all([
            legKm(WHEY_DEPOT, WHEY_STOP_1),
            legKm(WHEY_STOP_1, WHEY_STOP_2),
            legKm(WHEY_STOP_2, WHEY_DEPOT)
        ]).then(legs => {
            const total = legs[0] + legs[1] + legs[2];
            console.log('BWT whey run legs (km):', legs.map(l => l.toFixed(2)), 'total:', total.toFixed(2));
            fillDistance(total.toFixed(2));
        }).catch(err => {
            console.log('BWT whey run error:', err);
            showStatus('Whey distance calc failed');
        });
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

            const distanceKm = (el.distance.value / 1000).toFixed(2);

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
    let lastMode = null;
    let lastService = null;

    function handleAddressChange() {

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {

            // Whey runs use the fixed route, whatever the addresses say
            if (isWhey()) {
                if (lastMode === 'whey') return;
                lastMode = 'whey';
                lastStart = null; lastEnd = null;
                ensureMapsLoaded(() => calculateWheyRun());
                return;
            }
            lastMode = 'normal';

            const start = getAddressFromFieldset(START_LEGEND_MATCH);
            const end = getEndAddress();

            if (!start || !end) return;
            if (start === lastStart && end === lastEnd) return;

            lastStart = start;
            lastEnd = end;

            ensureMapsLoaded(() => calculateAndFillDistance(start, end));

        }, 1200);

    }

    function attachListenersToFieldset(legendMatch) {

        const fieldsets = document.querySelectorAll('fieldset');

        for (const fs of fieldsets) {
            const legend = fs.querySelector('legend');
            if (!legend || !legendMatch.test(legend.textContent.trim())) continue;

            const inputs = fs.querySelectorAll('input.el-input__inner, input[type="text"]');
            inputs.forEach(input => {
                input.addEventListener('input', handleAddressChange);
                input.addEventListener('blur', handleAddressChange);
            });

            return true;

        }

        return false;

    }

    function attachListenerToLabeledInput(labelText) {

        const input = findInputByLabelText(labelText);
        if (!input) return false;

        input.addEventListener('input', handleAddressChange);
        input.addEventListener('blur', handleAddressChange);

        return true;

    }

    function watchForFields() {

        const startFound = attachListenersToFieldset(START_LEGEND_MATCH);
        const endFound = attachListenerToLabeledInput(END_LABEL_TEXT);

        if (startFound && endFound) {
            console.log('BWT FAF: both Start Location and Address fields found, watching for changes.');
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

    // Re-check whenever the Service Type changes (it may be a dropdown or radio buttons)
    setInterval(() => {
        const svc = getServiceType();
        if (svc !== lastService) {
            lastService = svc;
            handleAddressChange();
        }
    }, 1000);

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
