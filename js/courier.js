// ============================================
// ScanChecker — Courier / Expedition Detector
// ============================================
// Detects courier from resi number prefix patterns.
// Pola disusun dari format resi yang dipakai masing-masing ekspedisi
// di marketplace (Shopee, Tokopedia, TikTok Shop, dll) dan dokumen pelacakan
// resmi — sebagian prefix berubah tergantung marketplace, mis. J&T:
// JD (Shopee), JT/JO (Tokopedia), JP (ECO), JDID (JD.ID).
// Deteksi dilakukan berurutan; pola paling khas didahulukan,
// resi angka murni (ambigu antar ekspedisi) dipilah via prefix + panjang digit.

const COURIERS = {
    // Pos Indonesia — 2 huruf layanan + 7-9 digit, kadang diakhiri ID
    POS: {
        name: 'Pos Indonesia',
        code: 'POS',
        class: 'exp-pos',
        color: '#FF8C00',
        test: (resi) => /^(RA|RC|RR|RX|EA|EC|EE|LA|LC|LV)\d{7,}(ID)?$/i.test(resi),
    },
    // Lazada Logistics (LEX) — LXAD-/LEXID-/LEXP-/LEX- + digit
    LAZADA: {
        name: 'Lazada Logistics',
        code: 'LAZADA',
        class: 'exp-lazada',
        color: '#10307A',
        test: (resi) => /^(LXAD|LEXID|LEXP|LEX)-?\d{8,}/i.test(resi),
    },
    // ID Express — IDE/IDS/IDD + digit
    IDX: {
        name: 'ID Express',
        code: 'IDX',
        class: 'exp-idx',
        color: '#7D3C98',
        test: (resi) => /^(IDE|IDS|IDD)\d{7,}/i.test(resi),
    },
    // J&T Cargo — JC/JNTC atau angka murni 12 digit diawali 201/570
    JNTC: {
        name: 'J&T Cargo',
        code: 'JNTC',
        class: 'exp-jntc',
        color: '#2ECC71',
        test: (resi) => /^(JC|JNTC)\d{5,}/i.test(resi) || /^(201|570)\d{9}$/.test(resi),
    },
    // J&T Express — prefix bervariasi per marketplace: JD, JT, JO, JP, JE, JZ, JX, JY, JDID
    JNT: {
        name: 'J&T Express',
        code: 'JNT',
        class: 'exp-jnt',
        color: '#FF6B35',
        test: (resi) => /^(JDID|JD|JO|JP|JT|JZ|JX|JY|JE)\d{8,}/i.test(resi),
    },
    // SPX (Shopee Express) — SPXID+digit, SLS, ID+digit (resi SPX), MY
    SPX: {
        name: 'Shopee Express',
        code: 'SPX',
        class: 'exp-spx',
        color: '#EE4D2D',
        test: (resi) => /^(SPXID|SPX)\d{6,}/i.test(resi)
            || /^SLS\d+/i.test(resi)
            || /^ID\d{11,}N$/i.test(resi)
            || /^MY\d{10,}/i.test(resi)
            || /^ID\d{11,}/i.test(resi),
    },
    // Ninja Xpress — NVSID/NLIDAP/NVS/NVL/NID/NJV/SHP + digit
    NINJA: {
        name: 'Ninja Xpress',
        code: 'NINJA',
        class: 'exp-ninja',
        color: '#8B0000',
        test: (resi) => /^(NVSID|NVS|NVL|NLID|NID|NJV|NL)[A-Z]*\d{4,}$/i.test(resi)
            || /^SHP\d{8,}/i.test(resi),
    },
    // AnterAja — SD/TSA/BLIAJS + digit, A+digit, atau 14 digit diawali 1 (REG/Next-Day)
    ANTERAJA: {
        name: 'AnterAja',
        code: 'ANTERAJA',
        class: 'exp-anteraja',
        color: '#6C3483',
        test: (resi) => /^(SD|TSA)\d{6,}/i.test(resi)
            || /^BLIAJS\d+/i.test(resi)
            || /^A\d{12,}$/.test(resi)
            || /^1\d{13}$/.test(resi),
    },
    // JNE — prefix layanan/kota (JNAP-OKE, TJE-REG, CGK/SUB/BDO, CM/TG lama) atau 15 digit angka (YES/JTR)
    JNE: {
        name: 'JNE Express',
        code: 'JNE',
        class: 'exp-jne',
        color: '#003087',
        test: (resi) => /^(JNAP|JNA|JNE|TJ[A-Z]|JK)-?\d{7,}/i.test(resi)
            || /^(CGK|JKT|SUB|BDO|BDG|MDN|MES|BTW|BPN|PLM|PKU|BTH|PNK|DPS|SRG|SOC|YOG|BKS|TSM|UPG|AMQ|PDG|TRK|PAL)\d{8,}/i.test(resi)
            || /^(CM\d|TG\d)\d{7,}/i.test(resi)
            || /^1\d{14}$/.test(resi),
    },
    // SiCepat — SCP/SIJ prefix atau 12 digit diawali 00 (HALU/BEST/REG/GOKIL)
    SICEPAT: {
        name: 'SiCepat',
        code: 'SICEPAT',
        class: 'exp-sicepat',
        color: '#E74C3C',
        test: (resi) => /^(SCP|SIJ)\w*[0-9]{4,}/i.test(resi) || /^00\d{10}$/.test(resi),
    },
    // Lion Parcel — 11LP/88LP/77LP/TSLP/LP + digit
    LION: {
        name: 'Lion Parcel',
        code: 'LION',
        class: 'exp-lion',
        color: '#0E7A0D',
        test: (resi) => /^(11LP|88LP|77LP|TSLP|LP)\d{5,}/i.test(resi),
    },
    // Wahana — WH/WHS + digit
    WAHANA: {
        name: 'Wahana',
        code: 'WAHANA',
        class: 'exp-wahana',
        color: '#C0392B',
        test: (resi) => /^(WHS|WH)\d{5,}/i.test(resi),
    },
    // SAP Express — TK + digit
    SAP: {
        name: 'SAP Express',
        code: 'SAP',
        class: 'exp-sap',
        color: '#1F618D',
        test: (resi) => /^TK\d{6,}/i.test(resi),
    },
    // TIKI — angka murni 12 digit (connote) yang belum cocok pola lain
    TIKI: {
        name: 'TIKI',
        code: 'TIKI',
        class: 'exp-tiki',
        color: '#2874A6',
        test: (resi) => /^\d{12}$/.test(resi),
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
    // guessing, so wrong detections don't happen for unrecognized resis.
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

/**
 * Apply user-defined pattern overrides to COURIERS detection.
 * @param {object} ov - keys = courier codes, values = arrays of regex strings
 */
function applyCourierPatterns(ov) {
    if (!ov || typeof ov !== 'object') return;
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
}

// ============================================
// User-defined pattern overrides (from settings)
// ============================================
// Server injects <script>window.COURIER_PATTERNS_OVERRIDE = {...};</script>
// where keys are courier codes and values are arrays of regex patterns.
// Apply to the matching courier so detection uses the user's own sample resi rules.
(function applyPatternOverrides() {
    applyCourierPatterns(window.COURIER_PATTERNS_OVERRIDE);
})();