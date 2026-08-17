(function () {
    if (document.getElementById('bwt-weather-panel')) return;

    // ---- Responsive styling ----
    // Hidden entirely below 900px (phones) — there's no room for two
    // side panels on a small screen, and the traffic widget already
    // takes priority there. Shows as a fixed left column on desktop/tablet.
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        #bwt-weather-panel {
            display: none;
        }
        @media (min-width: 900px) {
            #bwt-weather-panel {
                display: flex;
                flex-direction: column;
                gap: 10px;
                position: fixed;
                top: 50%;
                left: 10px;
                transform: translateY(-50%);
                z-index: 99999;
                max-height: 90vh;
                overflow-y: auto;
                width: 220px;
                font-family: Segoe UI, Arial, sans-serif;
            }
        }
        #bwt-weather-panel .bwt-wcard {
            background: #08122f;
            color: white;
            border-radius: 10px;
            padding: 12px 14px;
            box-shadow: 0 4px 10px rgba(0,0,0,.3);
            box-sizing: border-box;
        }
        #bwt-weather-panel .bwt-wcard.bwt-wlocal {
            border: 2px solid #38bdf8;
        }
        #bwt-weather-panel .bwt-wrow {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #bwt-weather-panel .bwt-wname { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        #bwt-weather-panel .bwt-wicon { font-size: 20px; margin-bottom: 4px; }
        #bwt-weather-panel .bwt-wwind { font-size: 11px; color: #cbd5e1; }
        #bwt-weather-panel .bwt-wminmax { font-size: 11px; color: #94a3b8; }
        #bwt-weather-panel .bwt-wtemp { font-size: 30px; font-weight: 300; line-height: 1; }
        #bwt-weather-panel .bwt-wmsg {
            background: #1e293b;
            color: #94a3b8;
            border-radius: 10px;
            padding: 12px 14px;
            font-size: 12px;
            text-align: center;
        }
    `;
    document.head.appendChild(styleTag);

    const panel = document.createElement('div');
    panel.id = 'bwt-weather-panel';
    document.body.appendChild(panel);

    const LOCATIONS = [
        { name: 'Upper Hutt', lat: -41.125, lon: 175.070 },
        { name: 'Wellington', lat: -41.2866, lon: 174.7762 },
        { name: 'Porirua', lat: -41.133, lon: 174.840 },
        { name: 'Hutt Valley', lat: -41.210, lon: 174.910 },
        { name: 'Kāpiti', lat: -40.900, lon: 175.000 },
        { name: 'Wairarapa', lat: -41.150, lon: 175.450 }
    ];

    function weatherIcon(code) {
        switch (code) {
            case 0: return '☀️';
            case 1: return '🌤️';
            case 2: return '⛅';
            case 3: return '☁️';
            case 45:
            case 48: return '🌫️';
            case 51:
            case 53:
            case 55: return '🌦️';
            case 56:
            case 57: return '🌧️';
            case 61:
            case 63:
            case 65: return '🌧️';
            case 66:
            case 67: return '🌧️';
            case 71:
            case 73:
            case 75:
            case 77: return '❄️';
            case 80:
            case 81:
            case 82: return '🌦️';
            case 85:
            case 86: return '🌨️';
            case 95:
            case 96:
            case 99: return '⛈️';
            default: return '☁️';
        }
    }

    function buildCard(name, w, isLocal) {

        const card = document.createElement('div');
        card.className = 'bwt-wcard' + (isLocal ? ' bwt-wlocal' : '');

        card.innerHTML = `
            <div class="bwt-wrow">
                <div>
                    <div class="bwt-wname">${isLocal ? '📍 ' : ''}${name}</div>
                    <div class="bwt-wicon">${w.icon}</div>
                    <div class="bwt-wwind">💨 ${w.wind} km/h</div>
                    <div class="bwt-wminmax">↑${w.maxTemp}° ↓${w.minTemp}°</div>
                </div>
                <div class="bwt-wtemp">${w.currentTemp}°</div>
            </div>
        `;

        return card;

    }

    function buildMessageCard(text) {
        const card = document.createElement('div');
        card.className = 'bwt-wmsg';
        card.textContent = text;
        return card;
    }

    async function fetchWeatherFor(lat, lon) {

        const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1`;

        const data = await fetch(url).then(r => r.json());

        return {
            currentTemp: Math.round(data.current.temperature_2m),
            wind: Math.round(data.current.wind_speed_10m),
            maxTemp: Math.round(data.daily.temperature_2m_max[0]),
            minTemp: Math.round(data.daily.temperature_2m_min[0]),
            icon: weatherIcon(data.current.weather_code)
        };

    }

    async function reverseGeocode(lat, lon) {
        try {
            const url =
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const data = await fetch(url).then(r => r.json());
            return data.locality || data.city || data.principalSubdivision || 'My Location';
        } catch (err) {
            return 'My Location';
        }
    }

    function getBrowserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                err => reject(err),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
            );
        });
    }

    async function loadLocalCard() {

        const placeholder = buildMessageCard('Checking your location…');
        panel.appendChild(placeholder);

        try {

            const { lat, lon } = await getBrowserLocation();
            const [w, name] = await Promise.all([
                fetchWeatherFor(lat, lon),
                reverseGeocode(lat, lon)
            ]);

            panel.replaceChild(buildCard(name, w, true), placeholder);

        } catch (err) {

            const message = (err && err.code === 1)
                ? 'Location denied'
                : 'Location unavailable';

            panel.replaceChild(buildMessageCard(message), placeholder);

        }

    }

    async function loadWeather() {

        panel.innerHTML = '';

        await loadLocalCard();

        for (const loc of LOCATIONS) {
            try {
                const w = await fetchWeatherFor(loc.lat, loc.lon);
                panel.appendChild(buildCard(loc.name, w, false));
            } catch (err) {
                console.log('Weather error:', loc.name, err);
            }
        }

    }

    loadWeather();
    setInterval(loadWeather, 900000);

})();
