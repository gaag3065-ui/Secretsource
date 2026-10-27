// ใบรับ - ส่งเงินสด: ปุ่มบนหัวหน้าห้องพัก → ป็อปอัปกรอกตามแบบฟอร์ม "บันทึกการส่งมอบ และรับเงิน / CASH RECEIPT" → ดาวน์โหลด PDF
// PDF สร้างที่หลังบ้าน (/api/room-inspection/pdf, kind: cash-receipt) ด้วยแบบเดียวกับแบบฟอร์มเปล่า
(() => {
    const actions = document.querySelector('.as-actions');
    if (!actions) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api`;
    const DRAFT_KEY = 'cash-receipt-draft';

    // ---------------------------------------------------------------- จำนวนเงินเป็นตัวหนังสือ (อังกฤษ)
    const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const under1000 = n => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 >= 20 ? `${TENS[Math.floor(n % 100 / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}` : ONES[n % 100]].filter(Boolean).join(' ');
    function words(n) {
        if (!n) return 'Zero';
        const parts = [];
        for (const [size, name] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [1, '']]) {
            const chunk = Math.floor(n / size) % 1000;
            if (chunk) parts.push(`${under1000(chunk)}${name ? ' ' + name : ''}`);
        }
        return parts.join(' ');
    }
    function amountInWords(value) {
        const amount = Number(String(value || '').replace(/,/g, ''));
        if (!Number.isFinite(amount) || amount <= 0) return '';
        const rupees = Math.floor(amount), cents = Math.round((amount - rupees) * 100);
        return `${words(rupees)} Rupees${cents ? ` and ${words(cents)} Cents` : ''} Only`;
    }

    // ---------------------------------------------------------------- ปุ่ม + ป็อปอัป
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'as-btn as-btn-ghost';
    button.textContent = 'ใบรับ - ส่งเงินสด';
    actions.prepend(button);

    document.head.insertAdjacentHTML('beforeend', `<style>
        .cr-dialog { width: min(720px, calc(100vw - 20px)); max-height: calc(100dvh - 24px); border: 0; border-radius: 16px; padding: 0; box-shadow: 0 24px 70px rgba(16,24,40,.3); }
        .cr-dialog::backdrop { background: rgba(16,24,40,.5); }
        .cr-form { display: grid; gap: 12px; padding: 20px; }
        .cr-form header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .cr-form h2 { margin: 0; font-size: 18px; }
        .cr-form header p { margin: 2px 0 0; color: #6b7785; font-size: 12.5px; }
        .cr-close { border: 0; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; color: #667085; }
        .cr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
        .cr-form label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; color: #344054; }
        .cr-form label small { font-weight: 400; color: #6b7785; }
        .cr-form input, .cr-form textarea { width: 100%; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 9px; padding: 8px 10px; font: inherit; font-size: 14px; }
        .cr-form textarea { min-height: 64px; resize: vertical; }
        .cr-full { grid-column: 1 / -1; }
        .cr-method { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 14px; }
        .cr-method label { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
        .cr-method input { width: auto; }
        .cr-section { margin: 4px 0 0; font-size: 13.5px; font-weight: 700; color: #087f74; }
        .cr-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 6px; border-top: 1px solid #eef1f3; }
        .cr-foot .cr-status { margin-right: auto; color: #6b7785; font-size: 12.5px; }
        .cr-foot .cr-status.is-error { color: #b42318; }
        .cr-foot button { border: 1px solid #d0d5dd; border-radius: 10px; padding: 9px 16px; background: #fff; font: inherit; font-weight: 600; cursor: pointer; }
        .cr-foot .cr-download { border-color: #087f74; background: #087f74; color: #fff; }
        .cr-foot .cr-download:disabled { opacity: .6; cursor: wait; }
        @media (max-width: 560px) { .cr-grid { grid-template-columns: 1fr; } .cr-form { padding: 16px; } .cr-foot button { flex: 1; } }
    </style>`);
    const dialog = document.createElement('dialog');
    dialog.className = 'cr-dialog';
    dialog.innerHTML = `<form class="cr-form" novalidate>
        <header><div><h2>ใบรับ - ส่งเงินสด</h2><p>บันทึกการส่งมอบ และรับเงิน / CASH RECEIPT · สกุลเงิน LKR</p></div><button type="button" class="cr-close" data-cr-close aria-label="ปิด">×</button></header>
        <div class="cr-grid">
            <label>วันที่ / Date<input type="date" name="date" required></label>
            <label>จำนวนเงิน / Amount (LKR)<input type="number" name="amount" min="0" step="0.01" inputmode="decimal" placeholder="เช่น 15000" required></label>
            <label class="cr-full">รายละเอียด / Details<textarea name="details" placeholder="เช่น ค่าทำความสะอาดห้องพัก Bagatale Court 5/2 (ขึ้นบรรทัดใหม่ได้ 1 ครั้ง)" required></textarea></label>
            <label class="cr-full">จำนวนเงินเป็นตัวหนังสือ / Amount in Words <small>ระบบเติมให้จากจำนวนเงิน — แก้เองได้</small><input name="amountWords" placeholder="Fifteen Thousand Rupees Only"></label>
            <div class="cr-full"><div class="cr-section">วิธีการรับเงิน / Method of Payment</div>
                <div class="cr-method"><label><input type="radio" name="method" value="cash" checked> เงินสด / Cash</label><label><input type="radio" name="method" value="bank"> ใบถอนเงินฝากธนาคาร / Bank Withdrawal Slip</label></div></div>
            <div class="cr-full cr-section">โดยได้ส่งมอบให้กับ / The payment has been made to</div>
            <label>1. ชื่อ / Name<input name="person1Name"></label>
            <label>ตำแหน่ง / Position<input name="person1Position"></label>
            <label>2. ชื่อ / Name<input name="person2Name"></label>
            <label>ตำแหน่ง / Position<input name="person2Position"></label>
            <div class="cr-full cr-section">ผู้ลงลายมือชื่อ <small style="font-weight:400;color:#6b7785">(ชื่อพิมพ์ใต้เส้นลายมือชื่อ — เว้นว่างได้)</small></div>
            <label>ผู้ส่งมอบ / Paid By<input name="paidByName"></label>
            <label>ผู้รับมอบ / Received By<input name="receivedByName"></label>
        </div>
        <div class="cr-foot"><span class="cr-status" role="status"></span><button type="button" data-cr-reset>ล้างข้อมูล</button><button type="submit" class="cr-download">ดาวน์โหลด PDF</button></div>
    </form>`;
    document.body.append(dialog);
    const form = dialog.querySelector('form');
    const status = dialog.querySelector('.cr-status');
    const field = name => form.elements[name];
    let wordsEdited = false;

    const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
    const save = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch { /* ไม่บังคับ */ } };
    function restore() {
        let draft = {};
        try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { draft = {}; }
        form.reset();
        for (const [k, v] of Object.entries(draft)) { const el = field(k); if (el && el.type !== 'radio' && typeof el.value === 'string') el.value = v; }
        if (draft.method) form.querySelectorAll('input[name="method"]').forEach(r => { r.checked = r.value === draft.method; });
        if (!field('date').value) field('date').value = today();
        wordsEdited = Boolean(draft.amountWords && draft.amountWords !== amountInWords(draft.amount));
    }
    form.addEventListener('input', event => {
        if (event.target.name === 'amountWords') wordsEdited = Boolean(event.target.value.trim());
        if (event.target.name === 'amount' && !wordsEdited) field('amountWords').value = amountInWords(event.target.value);
        save();
    });
    dialog.addEventListener('click', event => {
        if (event.target === dialog || event.target.closest('[data-cr-close]')) dialog.close();
        if (event.target.closest('[data-cr-reset]')) { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ไม่บังคับ */ } restore(); status.textContent = ''; }
    });
    button.addEventListener('click', () => { restore(); status.textContent = ''; status.className = 'cr-status'; dialog.showModal(); });

    async function ensureCsrf() {
        if (window.getCsrfToken && window.getCsrfToken()) return;
        const response = await window.authFetch(`${API}/session`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (data.csrfToken) sessionStorage.setItem('csrfToken', data.csrfToken);
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const missing = [['date', 'วันที่'], ['details', 'รายละเอียด'], ['amount', 'จำนวนเงิน']].filter(([k]) => !String(data[k] || '').trim());
        if (missing.length) { status.textContent = `กรุณากรอก ${missing.map(m => m[1]).join(', ')}`; status.className = 'cr-status is-error'; field(missing[0][0]).focus(); return; }
        const [y, m, d] = data.date.split('-');
        data.date = `${d}/${m}/${y}`;
        const download = form.querySelector('.cr-download');
        download.disabled = true; download.textContent = 'กำลังสร้าง PDF…';
        status.textContent = ''; status.className = 'cr-status';
        try {
            await ensureCsrf();
            const response = await window.authFetch(`${API}/room-inspection/pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'cash-receipt', data }) });
            if (!response.ok) {
                const info = await response.json().catch(() => ({}));
                throw new Error(/ประเภทเอกสารไม่ถูกต้อง/.test(info.message || '') ? 'เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)' : info.message || 'สร้าง PDF ไม่สำเร็จ');
            }
            const blob = await response.blob();
            const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ใบรับ-ส่งเงินสด ${data.date.replace(/\//g, '-')}.pdf` });
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 10000);
            status.textContent = 'ดาวน์โหลด PDF แล้ว';
        } catch (error) {
            status.textContent = error.message; status.className = 'cr-status is-error';
        } finally {
            download.disabled = false; download.textContent = 'ดาวน์โหลด PDF';
        }
    });
})();
