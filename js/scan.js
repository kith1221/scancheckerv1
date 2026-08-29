// ============================================
// ScanChecker — Scan Page Logic (Barang & Retur)
// ============================================

const APP_URL_SCAN = window.location.origin + '/scan_checker';
let html5QrCode = null;
let isScannerOpen = false;
let scanList = [];
let expeditionCounts = {};

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
    loadTodayScans();
    updateDateDisplay();
    setupInputEnter();

    // Focus the resi input on load
    setTimeout(() => {
        const input = document.getElementById('resiInput');
        if (input) input.focus();
    }, 300);
});

function updateDateDisplay() {
    const el = document.getElementById('scanDate');
    if (el) el.textContent = getTodayDisplay();
}

// ===== LOAD TODAY'S SCANS =====

async function loadTodayScans() {
    const jenis = document.getElementById('scanJenis')?.value || 'barang';
    const res = await apiFetch(`${APP_URL_SCAN}/api/scan_list.php?date=${todayString()}&jenis=${jenis}`);
    if (res.success) {
        scanList = res.data.scans || [];
        expeditionCounts = res.data.counts || {};
        renderScanList();
        renderExpeditionCards();
        updateTotalCount();
    }
}

// ===== RENDER SCAN LIST =====

function renderScanList() {
    const container = document.getElementById('scanList');
    if (!container) return;

    if (scanList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                <p>Belum ada scan hari ini</p>
            </div>`;
        return;
    }

    container.innerHTML = scanList.map((s, i) => `
        <div class="scan-item ${s.jenis === 'retur' ? 'retur' : ''} stagger-${Math.min(i+1,5)}" id="scan-item-${s.id}" style="animation: slideInRight ${0.1 + i * 0.05}s ease both">
            <div>
                <div class="scan-item-no">${escHtml(s.no_resi)}</div>
                <div class="scan-item-meta">
                    ${courierBadge(s.ekspedisi_kode)}
                    ${s.jenis === 'retur' ? '<span class="badge badge-warning">RETUR</span>' : ''}
                    <span>${escHtml(s.username || '')}</span>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <span class="scan-item-time">${formatTime(s.scan_time)}</span>
                ${canDelete() ? `<button class="btn-icon" onclick="deleteScan(${s.id})" title="Hapus" style="color:var(--danger)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>` : ''}
            </div>
        </div>
    `).join('');
}

function canDelete() {
    // Setiap user yang sudah login boleh menghapus data scan.
    return true;
}

// ===== RENDER EXPEDITION CARDS =====

function renderExpeditionCards() {
    const container = document.getElementById('expeditionCards');
    if (!container) return;

    const activeExpeditions = JSON.parse(document.getElementById('activeExpeditions')?.value || '[]');
    const allCouriers = getAllCouriers();

    const list = activeExpeditions.length > 0
        ? allCouriers.filter(c => activeExpeditions.includes(c.code))
        : allCouriers;

    container.innerHTML = list.map(c => `
        <div class="expedition-card ${c.class}" onclick="viewExpeditionDetail('${c.code}')" title="Lihat detail ${c.name}">
            <div class="expedition-count" id="count-${c.code}">${expeditionCounts[c.code] || 0}</div>
            <div class="expedition-name">${c.name}</div>
        </div>
    `).join('');
}

// ===== UPDATE TOTAL COUNT =====

function updateTotalCount() {
    const el = document.getElementById('totalCount');
    if (el) {
        el.textContent = scanList.length;
        el.classList.remove('count-animate');
        void el.offsetWidth;
        el.classList.add('count-animate');
    }
}

// ===== SUBMIT SCAN (Enter / Button) =====

function setupInputEnter() {
    const input = document.getElementById('resiInput');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitScan();
    });
    input.addEventListener('input', () => {
        updateCourierPreview(normalizeResi(input.value));
    });
}

function updateCourierPreview(resi) {
    const preview = document.getElementById('courierPreview');
    if (!preview) return;
    if (resi.length < 5) {
        preview.innerHTML = '';
        preview.style.display = 'none';
        return;
    }
    const courier = detectCourier(resi);
    if (courier) {
        preview.style.display = 'flex';
        preview.style.borderColor = courier.color + '55';
        preview.style.background = courier.color + '18';
        preview.style.color = courier.color;
        preview.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <span>${courier.name} terdeteksi</span>
        `;
    }
}

/**
 * @param {{ fromScanner?: boolean }} [opts]
 * @returns {Promise<'success'|'duplicate'|'error'|'invalid'>}
 */
async function submitScan(opts = {}) {
    const fromScanner = !!opts.fromScanner;
    const input = document.getElementById('resiInput');
    const resi = normalizeResi(input?.value);
    if (input && resi !== input.value) input.value = resi;
    const jenis = document.getElementById('scanJenis')?.value || 'barang';

    if (!resi || resi.length < 5) {
        showToast('Masukkan nomor resi yang valid (min. 5 karakter)', 'warning');
        playErrorSound();
        if (fromScanner) closeQRScanner();
        return 'invalid';
    }

    // Detect courier
    const courier = detectCourier(resi);

    // Check duplicate
    const dupCheck = await apiFetch(`${APP_URL_SCAN}/api/scan_check_duplicate.php?resi=${encodeURIComponent(resi)}&date=${todayString()}`);
    if (dupCheck.success && dupCheck.data?.is_duplicate) {
        if (fromScanner) {
            // Dari kamera: duplikat => tutup kamera + notif (tanpa dialog).
            showToast(`⚠️ Duplikat! "${resi}" sudah discan hari ini (${dupCheck.data.scan_time}).`, 'warning', 3000);
            playErrorSound();
            input.value = '';
            closeQRScanner();
            return 'duplicate';
        }
        const conf = confirm(`⚠️ No. resi "${resi}" sudah pernah discan hari ini (${dupCheck.data.scan_time}). Lanjutkan?`);
        if (!conf) {
            input.value = '';
            input.focus();
            return 'duplicate';
        }
    }

    const res = await apiFetch(`${APP_URL_SCAN}/api/scan_add.php`, {
        method: 'POST',
        body: JSON.stringify({
            no_resi: resi,
            ekspedisi: courier?.name || 'Lainnya',
            ekspedisi_kode: courier?.code || 'OTHER',
            jenis: jenis,
            scan_date: todayString()
        })
    });

    if (res.success) {
        input.value = '';
        document.getElementById('courierPreview').style.display = 'none';
        document.getElementById('courierPreview').innerHTML = '';

        // Flash success
        input.classList.add('scan-success-flash');
        setTimeout(() => input.classList.remove('scan-success-flash'), 400);

        showToast(`✓ ${resi} berhasil discan (${courier?.name || 'Lainnya'})`, 'success', 2500);
        await loadTodayScans();

        // Haptic + suara sukses (melodi naik, lebih keras)
        if (navigator.vibrate) navigator.vibrate(80);
        playSuccessSound();

        // Kamera tetap terbuka dari mode scan kamera untuk lanjut scan berikutnya
        input.focus();
        return 'success';
    } else {
        showToast(res.message || 'Gagal menyimpan scan', 'error');
        playErrorSound();
        if (fromScanner) closeQRScanner();
        return 'error';
    }
}

// ===== SOUND FEEDBACK =====

let _audioCtx = null;
let _masterGain = null;

function getAudioCtx() {
    if (!_audioCtx) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            _audioCtx = new AC();
            // Master gain + kompresor supaya suara keras tapi tidak pecah.
            const comp = _audioCtx.createDynamicsCompressor();
            comp.threshold.value = -18;
            comp.knee.value = 20;
            comp.ratio.value = 12;
            _masterGain = _audioCtx.createGain();
            _masterGain.gain.value = 0.9; // volume cukup keras
            _masterGain.connect(comp).connect(_audioCtx.destination);
        } catch (e) { _audioCtx = null; _masterGain = null; }
    }
    return _audioCtx;
}

// Mainkan satu nada. type: 'sine'|'square'|'triangle'|'sawtooth'
function tone(freq, startOffset, dur, type = 'sine', vol = 0.9) {
    try {
        const ctx = getAudioCtx();
        if (!ctx || !_masterGain) return;
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime + startOffset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur / 1000) - 0.01);
        osc.connect(gain).connect(_masterGain);
        osc.start(t);
        osc.stop(t + dur / 1000);
    } catch (e) { /* suara gagal => abaikan */ }
}

// SUARA SUKSES: melodi naik 3 nada (ceria), keras & jelas.
function playSuccessSound() {
    tone(523.25, 0.0,  150, 'square');  // C5
    tone(659.25, 0.12, 150, 'square');  // E5
    tone(783.99, 0.24, 230, 'square');  // G5 (berakhir lebih panjang)
}

// SUARA GAGAL / DUPLIKAT: nada rendah ganda (buzzer), jelas beda dari sukses.
function playErrorSound() {
    tone(196.0, 0.0, 220, 'square');  // G3
    tone(196.0, 0.28, 220, 'square'); // G3 lagi
}

// Nada tunggal sederhana (cadangan).
function playBeep(freq = 880, dur = 160, type = 'sine') {
    tone(freq, 0, dur, type, 0.9);
}

// ===== DELETE SCAN =====

async function deleteScan(id) {
    confirmDialog('Hapus scan ini?', async () => {
        const res = await apiFetch(`${APP_URL_SCAN}/api/scan_delete.php`, {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        if (res.success) {
            const item = document.getElementById(`scan-item-${id}`);
            if (item) {
                item.style.opacity = '0';
                item.style.transform = 'translateX(30px)';
                item.style.transition = 'all 0.2s ease';
                setTimeout(() => { loadTodayScans(); }, 200);
            }
            showToast('Scan berhasil dihapus', 'success');
        } else {
            showToast(res.message || 'Gagal menghapus', 'error');
        }
    });
}

// ===== QR SCANNER =====

async function openQRScanner() {
    if (isScannerOpen) { closeQRScanner(); return; }

    // Aktifkan audio context saat user mengklik (izin autoplay browser).
    const actx = getAudioCtx();
    if (actx && actx.state === 'suspended') actx.resume();

    openModal('qrModal');
    isScannerOpen = true;

    const btn = document.getElementById('btnQrScan');
    if (btn) btn.classList.add('scanning');

    // Load html5-qrcode (bundled locally for offline support)
    if (!window.Html5Qrcode) {
        await loadScript(`${APP_URL_SCAN}/assets/html5-qrcode.min.js`);
    }

    // Decide which decoder to trust for 1D barcodes:
    //  - Chrome/Edge's native BarcodeDetector often does NOT list 1D formats
    //    (QR only) on desktop Windows. If 1D isn't supported natively, fall
    //    back to html5-qrcode's built-in (ZXing) 1D decoder.
    const useNative = nativeDetects1D();

    const formatsToSupport = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODE_25,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
    ];

    // 1D barcode (barcode/CODABAR) scanning on a webcam needs:
    //  - high FPS for fast frame sampling
    //  - a WIDE viewfinder so the horizontal barcode stays in frame
    //  - native BarcodeDetector when available (best accuracy for 1D)
    const viewfinderWidth = Math.min(window.innerWidth - 24, 460);
    const config = {
        fps: 30,
        qrbox: { width: viewfinderWidth, height: Math.max(80, Math.round(viewfinderWidth * 0.28)) },
        aspectRatio: 1.9,
        formatsToSupport,
        experimentalFeatures: { useBarCodeDetectorIfSupported: useNative },
    };

    html5QrCode = new Html5Qrcode('qr-reader', { formatsToSupport });

    try {
        const camera = await resolveCamera();
        try {
            await html5QrCode.start(camera, config, onDecoded, (err) => { /* ignore */ });
        } catch (err) {
            // First camera failed — retry with the front camera (laptop webcam)
            // or any camera before giving up.
            const videos = await listVideoDevices();
            const fallback = videos.length > 0
                ? { deviceId: { exact: videos[0].deviceId } }
                : { facingMode: 'user' };
            await html5QrCode.start(fallback, config, onDecoded, (err) => { /* ignore */ });
        }
    } catch (err) {
        closeQRScanner();
        showToast('Tidak dapat mengakses kamera. Izinkan akses kamera, dan pastikan halaman dibuka lewat localhost/HTTPS.', 'error', 6000);
    }
}

async function listVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'videoinput');
    } catch (e) { return []; }
}

// Native BarcodeDetector is great for 2D but often does NOT support 1D
// barcodes on desktop Chrome/Windows. Return true only if it lists at least
// one 1D format, so 1D reading falls back to the JS (ZXing) decoder otherwise.
function nativeDetects1D() {
    try {
        if (!('BarcodeDetector' in window)) return false;
        const formats = window.BarcodeDetector.getSupportedFormats();
        const oneD = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8',
            'upc_a', 'upc_e', 'codabar', 'itf', 'code_25'];
        return Array.isArray(formats)
            ? formats.some(f => oneD.includes(String(f).toLowerCase()))
            : false;
    } catch (e) {
        return false;
    }
}

function onDecoded(decodedText) {
    const input = document.getElementById('resiInput');
    if (!input) return;
    const resi = normalizeResi(decodedText);
    input.value = resi;
    updateCourierPreview(resi);
    // Proses scan. submitScan() (mode kamera): sukses => kamera tetap buka;
    // gagal/duplikat/tidak valid => kamera ditutup di dalam submitScan().
    submitScan({ fromScanner: true });
}

/**
 * Resolve a usable video device, trying rear -> front -> any, so it also
 * works on laptops that only have a front webcam.
 * @returns {Promise<{ facingMode: string }|{ deviceId: { exact: string } }>}
 */
async function resolveCamera() {
    // Enumerate available cameras (empty labels until permission granted).
    let videos = [];
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videos = devices.filter(d => d.kind === 'videoinput');
    } catch (e) { /* fall through */ }

    if (videos.length > 0) {
        // Prefer explicit rear/front, otherwise take the first device.
        const rear  = videos.find(d => /back|environment|rear/i.test(d.label || ''));
        const front = videos.find(d => /front|user|webcam/i.test(d.label || ''));
        if (rear)  return { deviceId: { exact: rear.deviceId } };
        if (front) return { deviceId: { exact: front.deviceId } };
        return { deviceId: { exact: videos[0].deviceId } };
    }

    // No labeled devices yet: try rear first, then fall back to the front
    // camera (common case on laptops that only have one webcam).
    return { facingMode: 'environment' };
}

async function closeQRScanner() {
    if (html5QrCode) {
        try { await html5QrCode.stop(); } catch (e) { /* ignore */ }
        html5QrCode = null;
    }
    isScannerOpen = false;
    const btn = document.getElementById('btnQrScan');
    if (btn) btn.classList.remove('scanning');
    closeModal('qrModal');
}

// ===== EXPEDITION DETAIL =====

function viewExpeditionDetail(courierCode) {
    const courier = getAllCouriers().find(c => c.code === courierCode);
    if (!courier) return;
    const jenis = document.getElementById('scanJenis')?.value || 'barang';
    window.location.href = `${APP_URL_SCAN}/pages/database.php?date=${todayString()}&ekspedisi=${courierCode}&jenis=${jenis}`;
}

// ===== TOGGLE VISIBILITY =====

function toggleListVisibility() {
    const list = document.getElementById('scanList');
    const btn = document.getElementById('btnToggleList');
    if (!list) return;
    const isHidden = list.classList.toggle('hidden');
    if (btn) {
        btn.style.opacity = isHidden ? '0.5' : '1';
        btn.title = isHidden ? 'Tampilkan daftar' : 'Sembunyikan daftar';
    }
}

// ===== UTILS =====

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}
