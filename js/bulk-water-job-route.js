(function () {
    if (document.getElementById('bwt-job-route')) return;

    // ---- Config ----
    const API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
    const ORIGIN = 'Upper Hutt, New Zealand';
    const ADDRESS_LEGEND_MATCH = /delivery address/i;

    // ---- Responsive styling ----
    // Compact by default (phones), scales up once there's more screen
    // width to use (desktop/tablet).
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        #bwt-job-route .bwt-card {
            width: 240px;
            box-sizing: border-box;
            border-radius: 10px;
            font-family: Segoe UI, Arial, sans-serif;
        }
        #bwt-job-route .bwt-msg {
            background: #1e293b;
            color: #94a3b8;
            padding: 10px 12px;
            font-size: 11px;
            text-align: center;
        }
        #bwt-job-route .bwt-route {
            background: #08122f;
            color: white;
            padding: 10px 12px;
            box-shadow: 0 4px 10px rgba(0,0,0,.3);
            margin-bottom: 8px;
        }
        #bwt-job-route .bwt-route-sub { font-size: 10px; color: #94a3b8; }
        #bwt-job-route .bwt-route-toprow { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
        #bwt-job-route .bwt-route-label { font-size: 12px; font-weight: 600; max-width: 170px; }
        #bwt-job-route .bwt-route-status { font-size: 10px; font-weight: 600; }
        #bwt-job-route .bwt-route-duration { font-size: 24px; font-weight: 300; margin-top: 6px; }
        #bwt-job-route .bwt-route-delay { font-size: 10px; color: #94a3b8; margin-top: 4px; }
        #bwt-job-route .bwt-map {
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,.3);
        }
        #bwt-job-route .bwt-map iframe {
            width: 100%;
            height: 180px;
            border: 0;
            display: block;
        }

        /* Desktop / tablet — more room, so scale everything up */
        @media (min-width: 900px) {
            #bwt-job-route .bwt-card { width: 360px; }
            #bwt-job-route .bwt-route-label { font-size: 15px; max-width: 260px; }
            #bwt-job-route .bwt-route-status { font-size: 12px; }
            #bwt-job-route .bwt-route-duration { font-size: 38px; }
            #bwt-job-route .bwt-route-delay { font-size: 12px; }
            #bwt-job-route .bwt-map iframe { height: 280px; }
        }
    `;
    document.head.appendChild(styleTag);

    const panel = document.createElement('div');
    panel.id = 'bwt-job-route';
    panel.style.position = 'fixed';
    panel.style.top = '50%';
    panel.style.right = '10px';
    panel.style.transform = 'translateY(-50%)';
    panel.style.zIndex = '99999';
    document.body.appendChild(panel);
    panel.appendChild((function () {
        const c = document.createElement('div');
        c.className = 'bwt-card bwt-msg';
        c.textContent = 'Looking for delivery address field…';
        return c;
    })());

    function buildMessageCard(text) {
        const card = document.createElement('div');
        card.className = 'bwt-card bwt-msg';
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
        card.className = 'bwt-card bwt-route';
        card.style.borderLeft = `4px solid ${statusColor}`;

        card.innerHTML = `
            <div class="bwt-route-sub">🚚 Upper Hutt → </div>
            <div class="bwt-route-toprow">
                <div class="bwt-route-label">${addressLabel}</div>
                <div class="bwt-route-status" style="color:${statusColor};">${statusLabel}</div>
            </div>
            <div class="bwt-route-duration">${durationText}</div>
            <div class="bwt-route-delay">${delayMins > 0 ? `+${delayMins} min vs normal` : 'On schedule'}</div>
        `;

        return card;

    }

    function buildMapCard(address) {

        const card = document.createElement('div');
        card.className = 'bwt-card bwt-map';

        const iframe = document.createElement('iframe');
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.src = `https://www.google.com/maps/embed/v1/directions?key=${API_KEY}&origin=${encodeURIComponent(ORIGIN)}&destination=${encodeURIComponent(address.full)}&mode=driving`;

        card.appendChild(iframe);
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
            panel.appendChild(buildMapCard(address));

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
