// ============================================
// ScanChecker — Courier / Expedition Detector
// ============================================
// Detects courier from resi number prefix patterns

const COURIERS = {
    JNT: {
        name: 'J&T Express',
        code: 'JNT',
        class: 'exp-jnt',
        color: '#FF6B35',
        patterns: [
            /^JP\d{10,}/i,
            /^JT\d{10,}/i,
            /^JY\d{10,}/i,
        ],
        test: (resi) => /^(JP|JT|JY)\d{8,}/i.test(resi)
    },
    JNTC: {
        name: 'J&T Cargo',
        code: 'JNTC',
        class: 'exp-jntc',
        color: '#2ECC71',
        test: (resi) => /^JC\d{8,}/i.test(resi) || /^JNTC/i.test(resi)
    },
    JNE: {
        name: 'JNE Express',
        code: 'JNE',
        class: 'exp-jne',
        color: '#003087',
        test: (resi) => /^[A-Z]{2,3}\d{10,}/i.test(resi) && !['JT','JP','JC','ID','AA','SP','LX','LE'].includes(resi.substring(0,2).toUpperCase())
            || /^(CGK|SUB|BDO|MES|MDN|PLM|PKU|BTH|PNK|BPN)\d+/i.test(resi)
    },
    SICEPAT: {
        name: 'SiCepat',
        code: 'SICEPAT',
        class: 'exp-sicepat',
        color: '#E74C3C',
        // Di tempat ini, semua resi yang berupa angka murni adalah SiCepat.
        test: (resi) => /^\d+$/i.test(resi) || /^SCP/i.test(resi)
    },
    POS: {
        name: 'Pos Indonesia',
        code: 'POS',
        class: 'exp-pos',
        color: '#FF8C00',
        test: (resi) => /^(RA|RC|RR|RX|EA|EC|EE|LA|LC)\d{9}ID$/i.test(resi)
            || /^(RA|RC|RR|RX|EA|EC|EE|LA|LC)\d{7,}/i.test(resi)
    },
    NINJA: {
        name: 'Ninja Xpress',
        code: 'NINJA',
        class: 'exp-ninja',
        color: '#8B0000',
        test: (resi) => /^NVSID\d+/i.test(resi) || /^ID\d{14,}/i.test(resi) || /^NVS/i.test(resi)
    },
    ANTERAJA: {
        name: 'AnterAja',
        code: 'ANTERAJA',
        class: 'exp-anteraja',
        color: '#6C3483',
        test: (resi) => /^AA\d{10,}/i.test(resi) || /^10\d{10,}/i.test(resi)
    },
    SPX: {
        name: 'Shopee Express',
        code: 'SPX',
        class: 'exp-spx',
        color: '#EE4D2D',
        test: (resi) => /^SPX\w+/i.test(resi) || /^MY\d{12,}/i.test(resi) || /^SLS\d+/i.test(resi)
    },
    LAZADA: {
        name: 'Lazada Logistics',
        code: 'LAZADA',
        class: 'exp-lazada',
        color: '#10307A',
        test: (resi) => /^(LXAD|LEXID|LEX)-?\d+/i.test(resi)
    },
};

/**
 * Normalize resi string from scan or manual input
 * @param {string} raw
 * @returns {string}
 */
function normalizeResi(raw) {
    if (!raw) return '';
    let r = String(raw).trim().toUpperCase();
    r = r.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, '');
    r = r.replace(/^(LXAD|LEXID|LEX)(\d+)/i, '$1-$2');
    return r;
}

/**
 * Detect courier from resi number
 * @param {string} resi
 * @returns {{ code: string, name: string, class: string, color: string } | null}
 */
function detectCourier(resi) {
    const r = normalizeResi(resi);
    if (!r || r.length < 5) return null;

    for (const [key, courier] of Object.entries(COURIERS)) {
        try {
            if (courier.test(r)) {
                return { ...courier, key };
            }
        } catch (e) { /* skip */ }
    }

    // No specific courier matched — mark as "Lainnya" (unknown) instead of
    // guessing J&T, so wrong detections don't happen for unrecognized resis.
    return { code: 'OTHER', name: 'Lainnya', class: 'exp-other', color: '#64748B', key: 'OTHER' };
}

/**
 * Get HTML badge for a courier
 */
function courierBadge(courierCode) {
    const c = Object.values(COURIERS).find(x => x.code === courierCode)
        || { name: courierCode || 'Lainnya', class: 'exp-other', color: '#64748B' };
    return `<span class="badge" style="background:${c.color}22;color:${c.color};border:1px solid ${c.color}44">${c.name}</span>`;
}

/**
 * Get all courier list for UI rendering
 */
function getAllCouriers() {
    return Object.values(COURIERS);
}

// ============================================
// User-defined pattern overrides (from settings)
// ============================================
// Server injects <script>window.COURIER_PATTERNS_OVERRIDE = {...};</script>
// where keys are courier codes and values are arrays of regex patterns.
// Apply to the matching courier so detection uses the user's own sample resi rules.
(function applyPatternOverrides() {
    const ov = window.COURIER_PATTERNS_OVERRIDE;
    if (!ov || typeof ov !== 'object') return;

    // If a courier has override patterns, replace its detection with a
    // pattern-based test (a resi matches if it matches ANY pattern).
    const makePatternTest = (list) => {
        const compiled = list
            .map(p => { try { return new RegExp(p.trim(), 'i'); } catch (e) { return null; } })
            .filter(Boolean);
        return (resi) => compiled.some(re => re.test(resi));
    };

    for (const code of Object.keys(COURIERS)) {
        const list = ov[code];
        if (Array.isArray(list) && list.filter(p => p && p.trim()).length > 0) {
            COURIERS[code].patterns = list.slice();
            COURIERS[code].test = makePatternTest(list);
        }
    }
})();
