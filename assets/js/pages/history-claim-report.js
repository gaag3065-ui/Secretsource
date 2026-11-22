// ปุ่ม "สร้างรายงาน" หน้าประกัน: ป๊อปอัปเลือกพื้นที่ / บริษัท / ประเภท + ลายเซ็นและวันที่
// แล้วดาวน์โหลด "ใบสรุปการเบิกค่ารักษาพยาบาล" เป็น PDF หรือ XLSX — /api/history/claim-summary
(() => {
    const AREAS = ['PP', 'GE', 'SL', 'TH', 'MY'];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const clean = v => String(v ?? '').trim().replace(/^-$/, '');
    let dialog;

    const style = document.createElement('style');
    style.textContent = `
.hcr { border: 0; border-radius: 18px; padding: 0; width: min(560px, calc(100vw - 32px)); box-shadow: 0 24px 60px rgba(15,23,42,.25); font: inherit; }
.hcr::backdrop { background: rgba(15,23,42,.45); }
.hcr form { display: grid; gap: 14px; padding: 20px; }
.hcr h3 { margin: 0; font-size: 18px; }
.hcr p.hcr-sub { margin: 2px 0 0; color: #667085; font-size: 12.5px; }
.hcr-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: start; }
.hcr label { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: #344054; }
.hcr select, .hcr input[type=date] { border: 1px solid #d0d5dd; border-radius: 10px; padding: 8px 10px; font: inherit; font-size: 13px; background: #fff; }
.hcr-company { display: grid; gap: 6px; }
.hcr-split { display: grid; gap: 3px; }
.hcr-split label { display: flex !important; align-items: center; gap: 6px; font-weight: 500; font-size: 12px; }
.hcr-split input { width: 15px; height: 15px; margin: 0; }
.hcr-split.is-off { opacity: .45; }
.hcr-check { display: flex !important; grid-template-columns: none; align-items: center; gap: 8px; font-weight: 600; }
.hcr-check input { width: 18px; height: 18px; }
.hcr-count { padding: 8px 12px; border-radius: 10px; background: #f2f4f7; font-size: 13px; }
.hcr-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hcr-sign fieldset { border: 1px solid #e4e7ec; border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; margin: 0; }
.hcr-sign legend { font-size: 13px; font-weight: 700; padding: 0 4px; }
.hcr-pick { display: grid; place-items: center; height: 70px; border: 1px dashed #98a2b3; border-radius: 10px; cursor: pointer; color: #667085; font-size: 12px; text-align: center; overflow: hidden; background: #fcfcfd; }
.hcr-pick img { max-height: 64px; max-width: 100%; }
.hcr-pick input { display: none; }
.hcr-clear { justify-self: start; border: 0; background: none; color: #b42318; font-size: 12px; cursor: pointer; padding: 0; }
.hcr-actions { display: grid; gap: 8px; }
.hcr-actions button { border: 1px solid #e4e7ec; border-radius: 12px; padding: 11px 14px; background: #fff; font: inherit; text-align: left; cursor: pointer; }
.hcr-actions button b { display: block; font-size: 14px; }
.hcr-actions button small { color: #667085; font-size: 12px; }
.hcr-actions button.is-main { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
.hcr-actions button.is-main small { color: #dbeafe; }
.hcr-actions button:disabled { opacity: .6; cursor: wait; }
@media (max-width: 560px) { .hcr-grid, .hcr-sign { grid-template-columns: 1fr; } }`;
    document.head.appendChild(style);

    const history = () => window.currentFilteredHistory || [];
    const options = key => [...new Set(history().map(item => clean(item[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const today = () => new Date().toISOString().slice(0, 10);
    // 2026-10-05 → 5/10/69 (แบบในใบสรุปเดิม)
    const thaiShort = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${Number(m[3])}/${Number(m[2])}/${String(Number(m[1]) + 543).slice(-2)}` : ''; };

    function build() {
        dialog = document.createElement('dialog');
        dialog.className = 'hcr';
        dialog.innerHTML = `<form method="dialog">
            <div><h3>📊 สร้างรายงาน — ใบสรุปการเบิกค่ารักษาพยาบาล</h3><p class="hcr-sub">ใช้ประวัติตามช่วงวันที่ที่กรองไว้ด้านนอก แล้วเลือกเพิ่มด้านล่าง</p></div>
            <div class="hcr-grid">
                <label>พื้นที่<select name="area"></select></label>
                <div class="hcr-company"><label>บริษัท<select name="company"></select></label>
                    <div class="hcr-split" title="ใช้เมื่อเลือกบริษัท = ทั้งหมด">
                        <label><input type="radio" name="split" value="one" checked> รวมไฟล์เดียว</label>
                        <label><input type="radio" name="split" value="each"> แยกไฟล์ละ 1 บริษัท</label>
                    </div></div>
                <label>ประเภทการเบิก<select name="type"><option value="all">ทั้งหมด</option><option value="opd">ค่ารักษาพยาบาล OPD</option><option value="ipd">ค่ารักษาพยาบาล IPD</option><option value="dental">ค่าเบิกทันตกรรม</option></select></label>
            </div>
            <div class="hcr-count"></div>
            <label class="hcr-check"><input type="checkbox" name="withEvidence" checked> แนบรูปหลักฐาน ใบเสร็จ ใบรับรองแพทย์ (PDF: ต่อท้ายหน้าละ 4 รูป · XLSX: แท็บ "รูปหลักฐาน") — ไม่รวมหลักฐานการปิดเคส</label>
            <div class="hcr-sign">
                ${['preparer', 'approver'].map(who => `<fieldset data-who="${who}"><legend>${who === 'preparer' ? 'ผู้จัดเตรียมเอกสาร (บริษัท)' : 'ผู้อนุมัติ GM ขึ้นไป'}</legend>
                    <label class="hcr-pick"><span>แตะเพื่อเลือกรูปลายเซ็น</span><input type="file" accept="image/*"></label>
                    <button type="button" class="hcr-clear" hidden>ลบรูปลายเซ็น</button>
                    <label>ลงวันที่<input type="date" name="${who}Date"></label></fieldset>`).join('')}
            </div>
            <div class="hcr-actions">
                <button type="button" value="pdf" class="is-main"><b>ดาวน์โหลด PDF</b><small>ใบสรุปการเบิก + รายละเอียด แยกค่ารักษา OPD / IPD / ทันตกรรม พร้อมลายเซ็น</small></button>
                <button type="button" value="xlsx"><b>ดาวน์โหลด XLSX</b><small>รูปแบบเดียวกัน แก้ไขต่อใน Excel ได้</small></button>
                <button type="button" value="cancel"><b>ยกเลิก</b></button>
            </div></form>`;
        document.body.appendChild(dialog);
        dialog.signatures = {};
        dialog.querySelectorAll('fieldset').forEach(set => {
            const who = set.dataset.who, pick = set.querySelector('.hcr-pick'), clear = set.querySelector('.hcr-clear');
            const show = url => { pick.innerHTML = url ? `<img src="${url}" alt="">` : '<span>แตะเพื่อเลือกรูปลายเซ็น</span>'; pick.appendChild(input); clear.hidden = !url; };
            const input = set.querySelector('input[type=file]');
            input.addEventListener('change', async () => {
                const file = input.files[0];
                if (!file) return;
                dialog.signatures[who] = await shrink(file);
                show(dialog.signatures[who]);
                input.value = '';
            });
            clear.addEventListener('click', () => { delete dialog.signatures[who]; show(''); });
        });
        dialog.addEventListener('change', event => { if (event.target.matches('select')) updateCount(); });
        dialog.addEventListener('click', event => {
            const button = event.target.closest('.hcr-actions button');
            if (event.target === dialog || button?.value === 'cancel') return dialog.close();
            if (button) download(button);
        });
    }

    // ย่อรูปลายเซ็นให้เล็ก (กว้างไม่เกิน 600px) ส่งเป็น PNG — คงพื้นโปร่งใส
    function shrink(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 600 / img.width, 200 / img.height);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(img.src);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    function fill(select, values, current) {
        select.innerHTML = `<option value="">ทั้งหมด</option>${values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;
        if (values.includes(current)) select.value = current;
    }

    function selected() {
        const area = dialog.querySelector('[name=area]').value, company = dialog.querySelector('[name=company]').value;
        return history().filter(item => (!area || clean(item.workLocation) === area) && (!company || clean(item.company) === company));
    }

    function updateCount() {
        const allCompanies = !dialog.querySelector('[name=company]').value;
        const split = dialog.querySelector('.hcr-split');
        split.classList.toggle('is-off', !allCompanies);
        split.querySelectorAll('input').forEach(input => { input.disabled = !allCompanies; });
        const items = selected();
        // ใบสรุปแสดงเฉพาะเคสที่มียอดเบิกตามประเภทที่เลือก — บอกให้ชัดว่ากี่เคสจะอยู่ในไฟล์และเคสไหนยังไม่มียอด
        const type = dialog.querySelector('[name=type]').value;
        const num = value => Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0;
        const amountOf = item => ({
            dental: num(item.DentalOPD),
            opd: num(item.PPUsageOPD) + num(item.SLKUsageOpdThB),
            ipd: num(item.PPUsageIPD) + num(item.SLKUsageIpdThB)
        });
        const byCase = new Map();
        for (const item of items) {
            const key = clean(item.CaseIdNew) || `row-${item.targetRowNumber}`;
            const a = amountOf(item);
            const sum = type === 'all' ? a.dental + a.opd + a.ipd : a[type] || 0;
            byCase.set(key, Math.max(byCase.get(key) || 0, sum));
        }
        const withAmount = [...byCase.values()].filter(Boolean).length;
        const without = [...byCase.entries()].filter(([, sum]) => !sum).map(([key]) => key);
        const preview = without.slice(0, 8).map(key => `#${key}`).join(', ');
        dialog.querySelector('.hcr-count').innerHTML = `ตรงเงื่อนไข <b>${byCase.size.toLocaleString('th-TH')}</b> เคส · มียอดเบิก (อยู่ในใบสรุป) <b>${withAmount.toLocaleString('th-TH')}</b> เคส`
            + (without.length ? `<br><small>ยังไม่มียอดเบิก ${without.length.toLocaleString('th-TH')} เคส จึงไม่อยู่ในใบสรุป: ${esc(preview)}${without.length > 8 ? ' …' : ''}</small>` : '');
    }

    function open() {
        if (!history().length) { alert('ยังไม่มีข้อมูลสำหรับสร้างรายงาน — กดกรองประวัติก่อน'); return; }
        if (!dialog) build();
        const area = dialog.querySelector('[name=area]'), company = dialog.querySelector('[name=company]');
        // ตั้งต้นตามตัวกรองด้านนอกที่เลือกไว้
        const outerArea = document.getElementById('historyAreaFilter')?.value || '';
        const outerCompany = document.getElementById('historyCompanyFilter')?.value || '';
        fill(area, [...new Set([...AREAS, ...options('workLocation'), outerArea].filter(Boolean))], outerArea || area.value);
        fill(company, options('company'), outerCompany || company.value);
        dialog.querySelectorAll('input[type=date]').forEach(input => { if (!input.value) input.value = today(); });
        updateCount();
        dialog.showModal();
    }

    async function requestFile(format, items, company) {
        const get = name => dialog.querySelector(`[name=${name}]`).value;
        const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/history/claim-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rowNumbers: items.map(item => Number(item.targetRowNumber)),
                area: get('area'), company, type: get('type'), format,
                withEvidence: dialog.querySelector('[name=withEvidence]').checked,
                preparer: { signature: dialog.signatures.preparer || '', date: thaiShort(get('preparerDate')) },
                approver: { signature: dialog.signatures.approver || '', date: thaiShort(get('approverDate')) }
            })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const error = new Error(response.status === 404 && !data.message ? 'เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)' : data.message || 'สร้างรายงานไม่สำเร็จ');
            error.noAmount = response.status === 404 && Boolean(data.message);
            throw error;
        }
        const blob = await response.blob();
        const link = document.createElement('a');
        const name = ['ใบสรุปการเบิกค่ารักษาพยาบาล', get('area'), company, today()].filter(Boolean).join('_');
        link.href = URL.createObjectURL(blob);
        link.download = `${name}.${format}`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    }

    // รวมไฟล์เดียว หรือแยกไฟล์ละ 1 บริษัท (ดาวน์โหลดทีละไฟล์ — บริษัทที่ไม่มียอดเบิกข้ามไป)
    async function download(button) {
        const format = button.value;
        const items = selected();
        if (!items.length) { alert('ไม่พบประวัติตามพื้นที่/บริษัทที่เลือก'); return; }
        const company = dialog.querySelector('[name=company]').value;
        const each = !company && dialog.querySelector('[name=split]:checked')?.value === 'each';
        const companies = each ? [...new Set(items.map(item => clean(item.company)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')) : [company];
        const buttons = dialog.querySelectorAll('.hcr-actions button');
        const label = button.querySelector('b').textContent;
        buttons.forEach(b => { b.disabled = true; });
        const done = [], skipped = [];
        try {
            for (const [index, name] of companies.entries()) {
                button.querySelector('b').textContent = each ? `กำลังสร้างไฟล์ ${index + 1}/${companies.length} (${name})…` : 'กำลังสร้างไฟล์…';
                const rows = each ? items.filter(item => clean(item.company) === name) : items;
                try {
                    await requestFile(format, rows, name);
                    done.push(name || 'ทุกบริษัท');
                } catch (error) {
                    if (!each || !error.noAmount) throw error;
                    skipped.push(name);
                }
                if (each) await new Promise(resolve => setTimeout(resolve, 400));
            }
            if (each) alert(`ดาวน์โหลดแล้ว ${done.length} ไฟล์: ${done.join(', ') || '-'}${skipped.length ? `
ไม่มียอดเบิก (ไม่สร้างไฟล์): ${skipped.join(', ')}` : ''}`);
        } catch (error) {
            alert(error.message);
        } finally {
            buttons.forEach(b => { b.disabled = false; });
            button.querySelector('b').textContent = label;
        }
    }

    window.openClaimReportDialog = open;
})();
