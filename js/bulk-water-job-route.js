(function () {
    if (document.getElementById('bwt-job-route')) return;

    // ---- Config ----
    const API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
    const ORIGIN = 'Upper Hutt, New Zealand';
    const ADDRESS_LEGEND_MATCH = /delivery address/i;

    const panel = document.createElement('div');
    panel.id = 'bwt-job-route';
    panel.style.position = 'fixed';
    panel.style.top = '50%';
    panel.style.right = '10px';
    panel.style.transform = 'translateY(-50%)';
    panel.style.zIndex = '99999';
    panel.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    document.body.appendChild(panel);
    panel.appendChild((function () {
        const c = document.createElement('div');
        c.style.background = '#1e293b';
        c.style.color = '#94a3b8';
        c.style.width = '240px';
        c.style.padding = '10px 12px';
        c.style.borderRadius = '10px';
        c.style.fontSize = '11px';
        c.style.textAlign = 'center';
        c.textContent = 'Looking for delivery address field…';
        return c;
    })());

    function buildMessageCard(text) {
        const card = document.createElement('div');
        card.style.background = '#1e293b';
        card.style.color = '#94a3b8';
        card.style.width = '240px';
        card.style.padding = '10px 12px';
        card.style.borderRadius = '10px';
        card.style.fontSize = '11px';
        card.style.textAlign = 'center';
        card.textContent = text;
        return card;
    }

    function buildRouteCard(addressLabel, normalSecs, trafficSecs) {

        const delaySecs = Math.max(0, trafficSecs - normalSecs);
        const delayMins = Math.round(delaySecs / 60);
        const delayPct = normalSecs > 0 ? (delaySecs / normalSecs) : 0;

        let statusColor = '#22c55e';
        let statusLabel = 'Clear';

        if (delayPct > 0.30) {
            statusColor = '#ef4444';
            statusLabel = 'Heavy delay';
        } else if (delayPct > 0.10) {
            statusColor = '#eab308';
            statusLabel = 'Some delay';
        }

        const hours = Math.floor(trafficSecs / 3600);
        const mins = Math.round((trafficSecs % 3600) / 60);
        const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        const card = document.createElement('div');
        card.style.background = '#08122f';
        card.style.color = 'white';
        card.style.width = '240px';
        card.style.padding = '10px 12px';
        card.style.borderRadius = '10px';
        card.style.boxShadow = '0 4px 10px rgba(0,0,0,.3)';
        card.style.borderLeft = `4px solid ${statusColor}`;

        card.innerHTML = `
            <div style="font-size:10px; color:#94a3b8;">
                🚚 Upper Hutt → 
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                <div style="font-size:12px; font-weight:600; max-width:170px;">
                    ${addressLabel}
                </div>
                <div style="font-size:10px; color:${statusColor}; font-weight:600;">
                    ${statusLabel}
                </div>
            </div>
            <div style="font-size:24px; font-weight:300; margin-top:6px;">
                ${durationText}
            </div>
            <div style="font-size:10px; color:#94a3b8; margin-top:4px;">
                ${delayMins > 0 ? `+${delayMins} min vs normal` : 'On schedule'}
            </div>
        `;

        return card;

    }

    // ---- Find the delivery address on the job card ----

    function getDeliveryAddress() {

        const fieldsets = document.querySelectorAll('fieldset');

        for (const fs of fieldsets) {

            const legend = fs.querySelector('legend');
            if (!legend || !ADDRESS_LEGEND_MATCH.test(legend.textContent)) continue;

            const inputs = fs.querySelectorAll('input.el-input__inner, input[type="text"]');

            const parts = Array.from(inputs)
                .map(i => (i.value || '').trim())
                .filter(v => v.length > 0);

            if (parts.length > 0) {
                return {
                    full: parts.join(', ') + ', New Zealand',
                    label: parts[0] // Address Line 1, for display
                };
            }

        }

        return null;

    }

    // ---- Traffic lookup ----

    function loadRoute(address) {

        panel.innerHTML = '';
        panel.appendChild(buildMessageCard('Checking route…'));

        if (typeof google === 'undefined' || !google.maps || !google.maps.DistanceMatrixService) {
            panel.innerHTML = '';
            panel.appendChild(buildMessageCard('Route data unavailable'));
            return;
        }

        const service = new google.maps.DistanceMatrixService();

        service.getDistanceMatrix({
            origins: [ORIGIN],
            destinations: [address.full],
            travelMode: 'DRIVING',
            drivingOptions: {
                departureTime: new Date(),
                trafficModel: google.maps.TrafficModel.BEST_GUESS
            },
            unitSystem: google.maps.UnitSystem.METRIC
        }, (response, status) => {

            panel.innerHTML = '';

            if (status !== 'OK') {
                console.log('Distance Matrix error:', status);
                panel.appendChild(buildMessageCard('Route data unavailable'));
                return;
            }

            const el = response.rows[0].elements[0];

            if (el.status !== 'OK') {
                panel.appendChild(buildMessageCard('Could not find that address'));
                return;
            }

            const normalSecs = el.duration.value;
            const trafficSecs = el.duration_in_traffic
                ? el.duration_in_traffic.value
                : normalSecs;

            panel.appendChild(buildRouteCard(address.label, normalSecs, trafficSecs));

        });

    }

    // ---- Wait for CognitoForms to render the address fields, then
    // watch them live as the operator types ----

    let debounceTimer = null;
    let lastLookedUp = null;
    let listenersAttached = false;

    function handleAddressChange() {

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {

            const address = getDeliveryAddress();

            if (!address) return; // nothing typed yet, stay quiet

            if (address.full === lastLookedUp) return; // unchanged, skip

            lastLookedUp = address.full;
            ensureMapsLoaded(() => loadRoute(address));

        }, 1200);

    }

    function attachListeners(fieldset) {

        if (listenersAttached) return;

        const inputs = fieldset.querySelectorAll('input.el-input__inner, input[type="text"]');

        inputs.forEach(input => {
            input.addEventListener('input', handleAddressChange);
            input.addEventListener('blur', handleAddressChange);
        });

        listenersAttached = true;

        panel.innerHTML = '';
        panel.appendChild(buildMessageCard('Waiting for delivery address…'));

        // In case the field is already filled in (e.g. editing an
        // existing draft), run once immediately too
        handleAddressChange();

    }

    function findAddressFieldset() {

        const fieldsets = document.querySelectorAll('fieldset');

        for (const fs of fieldsets) {
            const legend = fs.querySelector('legend');
            if (legend && ADDRESS_LEGEND_MATCH.test(legend.textContent)) {
                return fs;
            }
        }

        return null;

    }

    function watchForAddressField() {

        const fieldset = findAddressFieldset();

        if (fieldset) {
            attachListeners(fieldset);
            return;
        }

        // Not rendered yet — CognitoForms is a SPA, so keep checking
        // rather than giving up after a fixed timeout
        setTimeout(watchForAddressField, 500);

    }

    watchForAddressField();

    function ensureMapsLoaded(callback) {

        if (typeof google !== 'undefined' && google.maps) {
            callback();
            return;
        }

        window.bwtJobRouteReady = callback;

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=bwtJobRouteReady`;
        script.async = true;
        document.head.appendChild(script);

    }

})();
