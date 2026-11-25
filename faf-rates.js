/* BWT FAF rate schedule - the ONE place to edit when the rates change.
   Used by the cartage quote page and by the delivery form's Whey distance script.
   Each line: round-trip km up to (and including) "max" -> "rate" in dollars.
   "extra: true" marks bands that are not on the printed schedule (the quote page shows a warning for them). */
window.BWT_FAF_SCHEDULE_NOTE = 'Rates per the Rural Water Delivery cartage schedule dated 8 Nov 2026.';

window.BWT_FAF_BANDS = [
    { max: 10,  rate: 3.20 },
    { max: 20,  rate: 6.40 },
    { max: 30,  rate: 9.60 },
    { max: 40,  rate: 12.80 },
    { max: 50,  rate: 16.00 },
    { max: 60,  rate: 19.20 },
    { max: 70,  rate: 22.40 },
    { max: 80,  rate: 25.60 },
    { max: 90,  rate: 28.80 },
    { max: 100, rate: 32.00 },
    // Over 100 km round trip: priced at the 100 km rate plus $3.20 per extra 10 km
    { max: 110, rate: 35.20, extra: true },
    { max: 120, rate: 38.40, extra: true },
    { max: 130, rate: 41.60, extra: true },
    { max: 140, rate: 44.80, extra: true },
    { max: 150, rate: 48.00, extra: true }
];

// Look up the rate for a round-trip distance. Returns the rate in dollars, or null if outside the schedule.
window.BWT_fafRate = function (roundTripKm) {
    const bands = window.BWT_FAF_BANDS;
    for (let i = 0; i < bands.length; i++) {
        if (roundTripKm <= bands[i].max) return bands[i].rate;
    }
    return null;
};
