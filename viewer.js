// ============================================================
// FleetPay – viewer.js  (GitHub Pages – Chỉ xem)
// Không phụ thuộc vào Chrome Extension, không có quyền sửa data.
// ============================================================

let payments = [];
let ticketStatuses = {};  // {ticketKey: statusString} – tải từ GAS

const STATUS_OVERDUE  = 'Quá hạn';
const STATUS_UPCOMING = 'Sắp đến hạn';
const STATUS_PENDING  = 'Chưa thanh toán';
const STATUS_PAID     = 'Đã thanh toán';

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    loadSettings();
});

// ── NAVIGATION ────────────────────────────────────────────────
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active-section'));
            link.classList.add('active');
            document.getElementById(link.getAttribute('data-target')).classList.add('active-section');
            if (link.getAttribute('data-target') === 'dashboard') updateDashboard();
        });
    });

    document.getElementById('btnExportExcel').addEventListener('click', exportToExcel);

    document.getElementById('btnRefresh').addEventListener('click', () => {
        const url = localStorage.getItem('fleetApiUrl');
        if (url) fetchDataFromServer(url);
        else showOverlay();
    });

    document.getElementById('btnSaveSettings').addEventListener('click', () => {
        const url = document.getElementById('apiEndpoint').value.trim();
        if (!url || !url.includes('script.google.com')) {
            showToast('⚠ URL không hợp lệ!');
            return;
        }
        const clean = url.replace(/\/dev$/, '/exec').replace(/\/$/, '');
        localStorage.setItem('fleetApiUrl', clean);
        document.getElementById('apiEndpoint').value = clean;
        showToast('Đã lưu. Đang tải dữ liệu...');
        fetchDataFromServer(clean);
        checkSyncStatus();
    });

    document.getElementById('searchInput').addEventListener('input', updateDashboard);
}

// ── GAS SETUP OVERLAY ─────────────────────────────────────────
function showOverlay() {
    document.getElementById('setupOverlay').classList.add('show');
    document.getElementById('setupUrl').focus();
}

function connectGAS() {
    const raw = document.getElementById('setupUrl').value.trim();
    const errEl = document.getElementById('setupError');

    if (!raw || !raw.includes('script.google.com')) {
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';

    const url = raw.replace(/\/dev$/, '/exec').replace(/\/$/, '');
    localStorage.setItem('fleetApiUrl', url);
    document.getElementById('apiEndpoint').value = url;
    document.getElementById('setupOverlay').classList.remove('show');
    checkSyncStatus();
    fetchDataFromServer(url);
}

// ── LOAD & FETCH ──────────────────────────────────────────────
function loadSettings() {
    // Ưu tiên: ?api= query param → localStorage → overlay
    const params = new URLSearchParams(window.location.search);
    let url = params.get('api') || localStorage.getItem('fleetApiUrl') || '';

    if (url) {
        url = url.trim().replace(/\/dev$/, '/exec').replace(/\/$/, '');
        localStorage.setItem('fleetApiUrl', url);
        document.getElementById('apiEndpoint').value = url;
        checkSyncStatus();
        fetchDataFromServer(url);
    } else {
        // Không có URL → hiện overlay nhập
        showOverlay();
    }
}

async function fetchDataFromServer(url) {
    const syncText   = document.getElementById('syncText');
    const syncStatus = document.getElementById('syncStatus');
    const loading    = document.getElementById('tableLoading');

    if (syncText)  syncText.textContent = 'Đang tải dữ liệu...';
    if (loading)   loading.style.display = 'block';

    try {
        const res = await fetch(url, { method: 'GET', redirect: 'follow' });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (_) {
            if (text.toLowerCase().includes('<html')) {
                throw new Error('GAS chưa Deploy đúng. Vui lòng liên hệ Admin.');
            }
            throw new Error('Phản hồi không phải JSON.');
        }

        if (json.status === 'success' && Array.isArray(json.data)) {
            payments = json.data.map(p => ({
                ...p,
                executionMonth:  normalizeMonth(p.executionMonth),
                paymentDeadline: normalizeDate(p.paymentDeadline)
            }));
            localStorage.setItem('fleetPayments_cache', JSON.stringify(payments));

            // Lưu ticketStatuses từ GAS
            if (json.ticketStatuses && typeof json.ticketStatuses === 'object') {
                ticketStatuses = json.ticketStatuses;
                localStorage.setItem('fleetTicketStatuses_cache', JSON.stringify(ticketStatuses));
            }
            updateDashboard();
            if (syncText) syncText.textContent = 'Đã đồng bộ ' + new Date().toLocaleTimeString('vi-VN');
            syncStatus.classList.add('online');
        } else {
            throw new Error(json.message || 'Lỗi không xác định từ GAS.');
        }
    } catch (e) {
        console.error('FleetPay fetch error:', e);
        // Thử load cache
        const cache = localStorage.getItem('fleetPayments_cache');
        if (cache) {
            try {
                const raw = JSON.parse(cache);
                payments = raw.map(p => ({
                    ...p,
                    executionMonth:  normalizeMonth(p.executionMonth),
                    paymentDeadline: normalizeDate(p.paymentDeadline)
                }));
            } catch(_) { payments = []; }
            // Load ticketStatuses cache
            try {
                const tCache = localStorage.getItem('fleetTicketStatuses_cache');
                if (tCache) ticketStatuses = JSON.parse(tCache);
            } catch(_) {}
            updateDashboard();
            if (syncText) syncText.innerHTML =
                `<span style="color:#f59e0b" title="${e.message}">⚠ Dùng cache – ${e.message.slice(0,40)}</span>`;
        } else {
            if (syncText) syncText.innerHTML =
                `<span style="color:#ef4444" title="${e.message}">⚠ Lỗi tải: ${e.message.slice(0,50)}</span>`;
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// ── STATUS & SYNC ─────────────────────────────────────────────
function checkSyncStatus() {
    const url = localStorage.getItem('fleetApiUrl');
    const syncStatus = document.getElementById('syncStatus');
    const syncText   = document.getElementById('syncText');
    if (url && url.includes('script.google.com')) {
        syncStatus.classList.add('online');
        syncText.textContent = 'Đã kết nối Google Sheets';
    } else {
        syncStatus.classList.remove('online');
        syncText.textContent = 'Chưa kết nối';
    }
}

// ── UTILS ─────────────────────────────────────────────────────

function renderTicketBadge(status, href) {
    if (!status) {
        return `<span class="ticket-status" style="background:#f1f5f9;color:#94a3b8;font-size:10px;">
                    <i class="fa-solid fa-question"></i> Chưa có
                </span>`;
    }
    const lower = status.toLowerCase();
    let style = '';
    if (lower.includes('hoàn tất') || lower.includes('hoan tat')) {
        style = 'background:#dcfce7;color:#16a34a;';
    } else if (lower.includes('đã duyệt') || lower.includes('da duyet')) {
        style = 'background:#dbeafe;color:#1e40af;';
    } else if (lower.includes('từ chối') || lower.includes('hủy') || lower.includes('lỗi')) {
        style = 'background:#fee2e2;color:#dc2626;';
    } else if (lower.includes('chờ') || lower.includes('chưa duyệt') || lower.includes('đang xử lý')) {
        style = 'background:#fef9c3;color:#92400e;';
    } else {
        style = 'background:#e0f2fe;color:#0369a1;';
    }
    return `<a href="${href}" target="_blank" rel="noopener" style="text-decoration:none;">
                <span class="ticket-status" style="${style}cursor:pointer;" title="${status}">${status}</span>
            </a>`;
}


function normalizeMonth(val) {
    if (!val) return '';
    if (/^\d{4}-\d{2}$/.test(val)) return val;
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 7);
    const d = new Date(val);
    if (!isNaN(d.getTime()))
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return val;
}

function normalizeDate(val) {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime()))
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0');
    return val;
}

/** "yyyy-MM" → "MM/yyyy" để hiển thị trong bảng */
function formatMonth(val) {
    const m = normalizeMonth(val);
    if (!m) return '';
    const p = m.split('-');
    return p.length >= 2 ? p[1] + '/' + p[0] : m;
}

function parseCurrency(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/\D/g, '')) || 0;
}

function formatVND(amount) {
    if (!amount && amount !== 0) return '0';
    return Number(amount).toLocaleString('en-US');
}

function removeAccents(str) {
    if (!str) return '';
    return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function matchesKeywords(text, searchStr) {
    if (!searchStr) return true;
    if (searchStr.toLowerCase() === 'blanks' || searchStr.toLowerCase() === '(blanks)') {
        return !text || text.trim() === '';
    }
    const orGroups = searchStr.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const target   = (text || '').toLowerCase();
    for (const group of orGroups) {
        if (group.split(/\s+/).every(kw => target.includes(kw))) return true;
    }
    return false;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function calculateStatus(deadlineDate, status) {
    if (status === STATUS_PAID) return STATUS_PAID;
    const today    = new Date(); today.setHours(0,0,0,0);
    const deadline = new Date(deadlineDate);
    const diffDays = Math.ceil((deadline - today) / 86400000);
    if (diffDays < 0)  return STATUS_OVERDUE;
    if (diffDays <= 7) return STATUS_UPCOMING;
    return STATUS_PENDING;
}

// ── FILTERS ───────────────────────────────────────────────────
function initFilters() {
    ['fltSupplier','fltMonth','fltBill','fltDeadline','fltAmount',
     'fltLinkDNMH','fltLinkDNTT','fltNotes'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateDashboard);
    });
    document.getElementById('fltStatus').addEventListener('change', updateDashboard);
}

function updateFilterDatalists() {
    const cols = [
        { id: 'dlSupplier',  field: 'supplierName'    },
        { id: 'dlMonth',     field: 'executionMonth'  },
        { id: 'dlBill',      field: 'billName'        },
        { id: 'dlDeadline',  field: 'paymentDeadline' },
        { id: 'dlAmount',    field: 'amount'          },
        { id: 'dlLinkDNMH',  field: 'linkDNMH'        },
        { id: 'dlLinkDNTT',  field: 'linkDNTT'        },
        { id: 'dlNotes',     field: 'notes'           }
    ];
    cols.forEach(({ id, field }) => {
        const dl = document.getElementById(id);
        if (!dl) return;
        const unique = [...new Set(payments.map(p => p[field]).filter(v => v && v.toString().trim()))].slice(0, 200);
        const frag = document.createDocumentFragment();
        unique.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            frag.appendChild(opt);
        });
        dl.innerHTML = '';
        dl.appendChild(frag);
    });
}

// ── DASHBOARD ─────────────────────────────────────────────────
function updateDashboard() {
    const tbody = document.getElementById('paymentTableBody');
    tbody.innerHTML = '';

    const globalSearch = removeAccents(document.getElementById('searchInput').value);
    const fltSupplier  = removeAccents(document.getElementById('fltSupplier').value);
    const fltMonth     = removeAccents(document.getElementById('fltMonth').value);
    const fltBill      = removeAccents(document.getElementById('fltBill').value);
    const fltDeadline  = removeAccents(document.getElementById('fltDeadline').value);
    const fltAmount    = removeAccents(document.getElementById('fltAmount').value);
    const fltLinkDNMH  = removeAccents(document.getElementById('fltLinkDNMH').value);
    const fltLinkDNTT  = removeAccents(document.getElementById('fltLinkDNTT').value);
    const fltNotes     = removeAccents(document.getElementById('fltNotes').value);
    const fltStatus    = document.getElementById('fltStatus').value;

    let totalPending = 0, countUpcoming = 0, countOverdue = 0, totalPaidThisMonth = 0;
    const currentMonth = new Date().toISOString().slice(0, 7);

    let filtered = payments.map(p => ({
        ...p,
        computedStatus: calculateStatus(p.paymentDeadline, p.status)
    })).filter(p => {
        if (globalSearch) {
            const hay = removeAccents(`${p.supplierName} ${p.executionMonth} ${p.billName} ${p.amount} ${p.notes} ${p.linkDNMH} ${p.linkDNTT}`);
            if (!matchesKeywords(hay, globalSearch)) return false;
        }
        if (fltSupplier && !matchesKeywords(removeAccents(p.supplierName),    fltSupplier))  return false;
        if (fltMonth    && !matchesKeywords(removeAccents(p.executionMonth),   fltMonth))     return false;
        if (fltBill     && !matchesKeywords(removeAccents(p.billName),         fltBill))      return false;
        if (fltDeadline && !matchesKeywords(removeAccents(p.paymentDeadline),  fltDeadline))  return false;
        if (fltAmount   && !matchesKeywords(removeAccents(p.amount),           fltAmount))    return false;
        if (fltLinkDNMH && !matchesKeywords(removeAccents(p.linkDNMH),        fltLinkDNMH))  return false;
        if (fltLinkDNTT && !matchesKeywords(removeAccents(p.linkDNTT),        fltLinkDNTT))  return false;
        if (fltNotes    && !matchesKeywords(removeAccents(p.notes),            fltNotes))     return false;
        if (fltStatus   && p.computedStatus !== fltStatus) return false;
        return true;
    });

    // Sort: NCC → Tháng → Bill
    filtered.sort((a, b) => {
        const na = (a.supplierName || '').toLowerCase(), nb = (b.supplierName || '').toLowerCase();
        if (na !== nb) return na < nb ? -1 : 1;
        const ma = a.executionMonth || '', mb = b.executionMonth || '';
        if (ma !== mb) return ma < mb ? -1 : 1;
        const ba = (a.billName || '').toLowerCase(), bb = (b.billName || '').toLowerCase();
        return ba < bb ? -1 : ba > bb ? 1 : 0;
    });

    const frag = document.createDocumentFragment();

    filtered.forEach(p => {
        const amount = parseCurrency(p.amount);

        // KPI
        if (p.computedStatus !== STATUS_PAID) {
            totalPending += amount;
            if (p.computedStatus === STATUS_OVERDUE)  countOverdue++;
            if (p.computedStatus === STATUS_UPCOMING) countUpcoming++;
        } else if ((p.executionMonth || '').slice(0, 7) === currentMonth) {
            totalPaidThisMonth += amount;
        }

        const tr = document.createElement('tr');
        if (p.computedStatus === STATUS_OVERDUE)  tr.className = 'row-overdue';
        else if (p.computedStatus === STATUS_UPCOMING) tr.className = 'row-upcoming';

        const badgeClass =
            p.computedStatus === STATUS_OVERDUE  ? 'badge-overdue'  :
            p.computedStatus === STATUS_UPCOMING ? 'badge-upcoming' :
            p.computedStatus === STATUS_PAID     ? 'badge-paid'     : 'badge-pending';

        const buildLink = (rawUrl, icon) => {
            if (!rawUrl) return '-';
            const clean = rawUrl.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            if (!clean) return '-';
            let full = clean;
            if (!full.startsWith('http')) {
                if (full.includes('_OPRNM_')) full = 'https://noibo.ghn.vn/qlns/form/' + full;
                else if (full.startsWith('www.')) full = 'https://' + full;
            }

            // Tìm trạng thái: match theo ticketId hoặc URL đầy đủ
            let status = ticketStatuses[clean] || ticketStatuses[full] || null;
            if (!status) {
                const m = clean.match(/([0-9]+_[A-Z]+_[0-9]+_[0-9]+)/);
                if (m) status = ticketStatuses[m[1]] || null;
            }

            const badge = renderTicketBadge(status, full);
            return `<div class="ticket-link-container">
                <a href="\${full}" target="_blank" rel="noopener" class="link-icon" title="Mở phiếu \${clean}">
                    <i class="fa-solid \${icon}"></i>
                </a>
                \${badge}
            </div>`;
        };

        const deadlineDisplay = p.paymentDeadline
            ? new Date(p.paymentDeadline + 'T00:00:00').toLocaleDateString('vi-VN')
            : '';

        tr.innerHTML = `
            <td><strong>${p.supplierName || ''}</strong></td>
            <td>${formatMonth(p.executionMonth)}</td>
            <td class="bill-cell">${p.billName || ''}</td>
            <td>${deadlineDisplay}</td>
            <td class="amount-text">${formatVND(amount)}</td>
            <td><span class="badge ${badgeClass}">${p.computedStatus}</span></td>
            <td style="text-align:center">${buildLink(p.linkDNMH, 'fa-file-contract')}</td>
            <td style="text-align:center">${buildLink(p.linkDNTT, 'fa-money-check-dollar')}</td>
            <td class="notes-cell">${p.notes || ''}</td>
        `;

        tr.addEventListener('click', () => {
            if (window._activeRow) window._activeRow.classList.remove('row-clicked');
            tr.classList.add('row-clicked');
            window._activeRow = tr;
        });

        frag.appendChild(tr);
    });

    tbody.appendChild(frag);

    document.getElementById('kpiTotalPending').textContent  = formatVND(totalPending);
    document.getElementById('kpiTotalUpcoming').textContent = `${countUpcoming} bill`;
    document.getElementById('kpiTotalOverdue').textContent  = `${countOverdue} bill`;
    document.getElementById('kpiTotalPaid').textContent     = formatVND(totalPaidThisMonth);

    // Rebuild datalists sau khi DOM đã render xong, không block frame hiện tại
    requestAnimationFrame(updateFilterDatalists);
}

// ── EXPORT ────────────────────────────────────────────────────
function exportToExcel() {
    const headers = ['Nhà cung cấp','Tháng TH','Tên Bill','Hạn TT','Số tiền','Trạng thái','Link ĐNMH','Link ĐNTT','Ghi chú'];
    const rows    = document.getElementById('paymentTableBody').querySelectorAll('tr');
    let csv = '\uFEFF' + headers.join(',') + '\n';

    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 9) return;
        csv += [
            `"${cols[0].innerText.replace(/"/g,'""')}"`,
            `"${cols[1].innerText.replace(/"/g,'""')}"`,
            `"${cols[2].innerText.replace(/"/g,'""')}"`,
            `"${cols[3].innerText.replace(/"/g,'""')}"`,
            cols[4].innerText.replace(/,/g,'').replace(/\D/g,''),
            `"${cols[5].innerText.replace(/"/g,'""')}"`,
            `"${cols[6].querySelector('a') ? cols[6].querySelector('a').href : ''}"`,
            `"${cols[7].querySelector('a') ? cols[7].querySelector('a').href : ''}"`,
            `"${cols[8].innerText.replace(/"/g,'""')}"`
        ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `FleetPay_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
