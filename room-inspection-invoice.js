// แท็บ "ตั้งเบิก Invoice": กรอกใบตั้งเบิกค่าที่พักทีละใบ → PDF แบบเดียวกับไฟล์ "ตั้งเบิก Invoice SL"
// แล้วเลือกหลายใบรวมเป็น "ใบปะหน้า" (ตารางสรุปค่าใช้จ่ายประจำเดือน) → PDF
// PDF สร้างที่แบ็กเอนด์ (pdf-tools/generate_invoice.py) ข้อมูลบันทึกเป็นแบบร่างชนิด "invoices"
(() => {
    const RI = window.RoomInspection;
    const $ = id => document.getElementById(id);
    if (!RI || !$('tab-invoice')) return;
    const { request, download, toast, markDirty, markSaved, loadDraft, LOCAL_KEY, esc } = RI;

    const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const today = () => new Date().toISOString().slice(0, 10);
    const num = value => Number(String(value ?? '').replace(/,/g, '')) || 0;
    const money = value => `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const longDate = text => { const d = text && new Date(`${text}T00:00:00`); return d && !isNaN(d) ? `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}` : ''; };

    const blankItem = () => ({ description: '', period: '', amount: '' });
    const blankInvoice = () => ({
        building: '', unit: '', invoiceNo: '', invoiceNoManual: false, company: 'EAST GROUP', department: 'Call Center SL',
        issueDate: today(), dueDate: today(), items: [blankItem()], paymentMethod: 'Paid by cash', payee: 'THE LANDLORD',
        paymentDate: today(), coverDescription: '', coverRemark: '', bank: 'เงินสด', inCover: true
    });
    const defaultCover = () => ({ month: today().slice(0, 7), company: 'EAST GROUP', department: 'Call Center', fileName: '' });
    const state = { invoices: [blankInvoice()], cover: defaultCover() };

    // ---------------------------------------------------------------- ค่าที่คำนวณอัตโนมัติ
    const location = inv => [inv.building, inv.unit].map(v => String(v || '').trim()).filter(Boolean).join(' ');
    const total = inv => inv.items.reduce((sum, item) => sum + num(item.amount), 0);
    /** รหัสที่พัก: ตัวแรกของแต่ละคำในชื่อที่พัก (อังกฤษ/ตัวเลข) + เลขยูนิต เช่น Fairway Skygarden + 04D → FS04D */
    function placeCode(inv) {
        const initials = String(inv.building || '').split(/\s+/).map(word => (word.match(/[A-Za-z0-9]/) || [''])[0]).join('').toUpperCase();
        return initials + String(inv.unit || '').replace(/\s+/g, '').toUpperCase();
    }
    /** Invoice No. = INV-ปีที่ออก-รหัสที่พัก ถ้าซ้ำกับใบก่อนหน้าในรายการ ต่อท้าย -2, -3 */
    function autoNumbers() {
        const used = new Set();
        state.invoices.forEach(inv => {
            if (!inv.invoiceNoManual) {
                const base = `INV-${(inv.issueDate || today()).slice(0, 4)}-${placeCode(inv) || 'XXX'}`;
                let no = base;
                for (let n = 2; used.has(no); n++) no = `${base}-${n}`;
                inv.invoiceNo = no;
            }
            used.add(inv.invoiceNo);
        });
    }
    const coverDescription = inv => inv.coverDescription || [inv.items.find(i => i.description)?.description, location(inv)].filter(Boolean).join(' ');
    const coverRemark = inv => inv.coverRemark || longDate(inv.dueDate);
    function coverMonthText() {
        const [y, m] = String(state.cover.month || '').split('-').map(Number);
        return y && m ? { th: `${MONTHS_TH[m - 1]} ${y}`, en: `${MONTHS_EN[m - 1]} ${y}` } : { th: '', en: '' };
    }
    const coverFileName = () => state.cover.fileName || `ใบปะหน้าค่าเช่าบ้านพักพนักงาน_Call_East_${coverMonthText().en}`.trim();

    // ---------------------------------------------------------------- แสดงผล
    const input = (i, key, label, value, attrs = '') => `<label>${label}<input data-inv="${i}" data-k="${key}" value="${esc(value)}" ${attrs}></label>`;
    function render() {
        autoNumbers();
        $('riInvoiceList').innerHTML = state.invoices.map((inv, i) => `<article class="ri-card ri-invoice">
                <div class="ri-inv-head">
                    <h2>Invoice ${i + 1} <small>${esc(location(inv) || 'ยังไม่ระบุที่พัก')}</small></h2>
                    <label class="ri-inv-pick"><input type="checkbox" data-inv="${i}" data-k="inCover" ${inv.inCover ? 'checked' : ''}> รวมในใบปะหน้า</label>
                    <span class="ri-spacer"></span>
                    <button type="button" class="ri-btn ri-btn-primary ri-btn-sm" data-inv-pdf="${i}">ดาวน์โหลด PDF Invoice</button>
                    <button type="button" class="ri-btn ri-btn-ghost ri-btn-sm ri-btn-danger" data-inv-remove="${i}" ${state.invoices.length === 1 ? 'disabled' : ''}>ลบ</button>
                </div>
                <div class="ri-grid">
                    ${input(i, 'building', 'ชื่อที่พัก', inv.building, 'placeholder="เช่น Fairway Skygarden"')}
                    ${input(i, 'unit', 'ยูนิต', inv.unit, 'placeholder="เช่น 04D"')}
                    <label>Invoice No. <small>(ตั้งให้อัตโนมัติจากชื่อที่พัก)</small><span class="ri-unit-row"><input data-inv="${i}" data-k="invoiceNo" value="${esc(inv.invoiceNo)}">${inv.invoiceNoManual ? `<button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-inv-auto="${i}" title="กลับไปใช้เลขอัตโนมัติ">อัตโนมัติ</button>` : ''}</span></label>
                    ${input(i, 'company', 'บริษัท (Company)', inv.company)}
                    ${input(i, 'department', 'แผนก (Department)', inv.department)}
                    <div></div>
                    ${input(i, 'issueDate', 'Issue Date', inv.issueDate, 'type="date"')}
                    ${input(i, 'dueDate', 'Due Date', inv.dueDate, 'type="date"')}
                </div>
                <table class="ri-inv-items">
                    <thead><tr><th>No.</th><th>Description</th><th>Period / Reference</th><th class="ri-num">Amount (LKR)</th><th></th></tr></thead>
                    <tbody>${inv.items.map((item, j) => `<tr>
                        <td>${j + 1}</td>
                        <td><input data-inv="${i}" data-item="${j}" data-k="description" value="${esc(item.description)}" placeholder="เช่น ค่าเช่าล่วงหน้า 4 เดือน"></td>
                        <td><input data-inv="${i}" data-item="${j}" data-k="period" value="${esc(item.period)}"></td>
                        <td><input class="ri-num${num(item.amount) < 0 ? ' is-neg' : ''}" data-inv="${i}" data-item="${j}" data-k="amount" value="${esc(item.amount)}" inputmode="decimal" placeholder="0.00"></td>
                        <td><button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-item-remove="${i}:${j}" ${inv.items.length === 1 ? 'disabled' : ''} aria-label="ลบรายการ">×</button></td>
                    </tr>`).join('')}</tbody>
                    <tfoot><tr><td></td><td><button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-item-add="${i}">+ เพิ่มรายการ</button> <small>ยอดหัก (เช่น หักเงินมัดจำที่ชำระแล้ว) ใส่เป็นเลขติดลบ</small></td><th>Total Amount Payable</th><th class="ri-num" data-inv-total="${i}">LKR ${money(total(inv))}</th><td></td></tr></tfoot>
                </table>
                <div class="ri-grid">
                    ${input(i, 'paymentMethod', 'Payment Method', inv.paymentMethod)}
                    ${input(i, 'payee', 'Payee / Recipient', inv.payee)}
                    ${input(i, 'paymentDate', 'Payment Date', inv.paymentDate, 'type="date"')}
                    <label class="ri-full">ข้อความในใบปะหน้า <small>(เว้นว่าง = รายการแรก + ที่พัก)</small><input data-inv="${i}" data-k="coverDescription" value="${esc(inv.coverDescription)}" placeholder="${esc(coverDescription({ ...inv, coverDescription: '' }))}"></label>
                    ${input(i, 'bank', 'Bank Name (ใบปะหน้า)', inv.bank)}
                    <label>Remark (ใบปะหน้า) <small>(เว้นว่าง = Due Date)</small><input data-inv="${i}" data-k="coverRemark" value="${esc(inv.coverRemark)}" placeholder="${esc(longDate(inv.dueDate))}"></label>
                </div>
            </article>`).join('');
        renderCover();
    }

    function renderCover() {
        const picked = state.invoices.filter(inv => inv.inCover);
        const sum = picked.reduce((s, inv) => s + total(inv), 0);
        $('riCoverMonth').value = state.cover.month;
        $('riCoverCompany').value = state.cover.company;
        $('riCoverDepartment').value = state.cover.department;
        $('riCoverFile').value = state.cover.fileName;
        $('riCoverFile').placeholder = coverFileName();
        $('riCoverSummary').innerHTML = picked.length
            ? `<table class="ri-inv-items"><thead><tr><th>No</th><th>Description</th><th class="ri-num">Amount (LKR)</th><th>Remark</th></tr></thead><tbody>${picked.map((inv, n) => `<tr><td>${n + 1}</td><td>${esc(coverDescription(inv))}</td><td class="ri-num">LKR ${money(total(inv))}</td><td class="ri-red">${esc(coverRemark(inv))}</td></tr>`).join('')}</tbody><tfoot><tr><td></td><th>Grand Total</th><th class="ri-num">LKR ${money(sum)}</th><td></td></tr></tfoot></table>`
            : '<p class="ri-hint">ยังไม่ได้เลือก Invoice — ติ๊ก "รวมในใบปะหน้า" ที่ Invoice ที่ต้องการ</p>';
    }

    // ---------------------------------------------------------------- แก้ไขข้อมูล
    $('riInvoiceList').addEventListener('input', event => {
        const field = event.target.closest('[data-inv]');
        if (!field) return;
        const inv = state.invoices[Number(field.dataset.inv)];
        const key = field.dataset.k;
        const value = field.type === 'checkbox' ? field.checked : field.value;
        if (field.dataset.item !== undefined) inv.items[Number(field.dataset.item)][key] = value;
        else inv[key] = value;
        if (key === 'invoiceNo') inv.invoiceNoManual = true;
        markDirty();
        // อัปเดตเฉพาะส่วนที่คำนวณ ไม่วาดใหม่ทั้งหมด (ไม่ให้ช่องที่กำลังพิมพ์หลุดโฟกัส)
        autoNumbers();
        const cards = document.querySelectorAll('.ri-invoice');
        state.invoices.forEach((item, n) => {
            const node = cards[n]?.querySelector('[data-k="invoiceNo"]');
            if (node && node !== field) node.value = item.invoiceNo;
        });
        const card = field.closest('.ri-invoice');
        card.querySelector('h2 small').textContent = location(inv) || 'ยังไม่ระบุที่พัก';
        card.querySelector('[data-inv-total]').textContent = `LKR ${money(total(inv))}`;
        if (key === 'amount') field.classList.toggle('is-neg', num(value) < 0);
        renderCover();
    });
    $('riInvoiceList').addEventListener('change', event => {
        if (event.target.matches('[data-k="inCover"]')) { state.invoices[Number(event.target.dataset.inv)].inCover = event.target.checked; markDirty(); renderCover(); }
        if (event.target.matches('[data-k="invoiceNo"]') && !event.target.value.trim()) { state.invoices[Number(event.target.dataset.inv)].invoiceNoManual = false; render(); }
    });
    $('riInvoiceList').addEventListener('click', async event => {
        const t = event.target;
        if (t.closest('[data-item-add]')) { state.invoices[Number(t.closest('[data-item-add]').dataset.itemAdd)].items.push(blankItem()); markDirty(); return render(); }
        if (t.closest('[data-item-remove]')) { const [i, j] = t.closest('[data-item-remove]').dataset.itemRemove.split(':').map(Number); state.invoices[i].items.splice(j, 1); markDirty(); return render(); }
        if (t.closest('[data-inv-auto]')) { state.invoices[Number(t.closest('[data-inv-auto]').dataset.invAuto)].invoiceNoManual = false; markDirty(); return render(); }
        if (t.closest('[data-inv-remove]')) {
            const i = Number(t.closest('[data-inv-remove]').dataset.invRemove);
            if (!confirm(`ลบ Invoice ${i + 1} (${location(state.invoices[i]) || 'ยังไม่ระบุที่พัก'})?`)) return;
            state.invoices.splice(i, 1); markDirty(); return render();
        }
        const pdf = t.closest('[data-inv-pdf]');
        if (pdf) {
            const inv = state.invoices[Number(pdf.dataset.invPdf)];
            if (!location(inv)) return toast('กรุณากรอกชื่อที่พักก่อน', true);
            pdf.disabled = true;
            try {
                await save(false);
                await download('/pdf', { kind: 'invoice', data: invoicePayload(inv) }, `กำลังสร้าง PDF ${inv.invoiceNo}...`, `ตั้งเบิก Invoice SL - ${location(inv).replace(/[\/:*?"<>|]+/g, '_')}.pdf`);
            } catch (error) { toast(error.message, true); }
            finally { pdf.disabled = false; }
        }
    });
    [['riCoverMonth', 'month'], ['riCoverCompany', 'company'], ['riCoverDepartment', 'department'], ['riCoverFile', 'fileName']].forEach(([id, key]) => {
        $(id).addEventListener('input', event => { state.cover[key] = event.target.value; markDirty(); renderCover(); });
    });

    const invoicePayload = inv => ({
        company: inv.company, location: location(inv), department: inv.department, invoiceNo: inv.invoiceNo,
        issueDate: inv.issueDate, dueDate: inv.dueDate, paymentMethod: inv.paymentMethod, payee: inv.payee, paymentDate: inv.paymentDate,
        items: inv.items.filter(item => String(item.description).trim() || num(item.amount)).map(item => ({ ...item, amount: num(item.amount) })), currency: 'LKR'
    });

    // ---------------------------------------------------------------- บันทึก / ปุ่มด้านล่าง
    const OUTDATED = 'เครื่องหลังบ้านยังไม่ได้อัปเดตเป็นเวอร์ชันที่มีตั้งเบิก Invoice — ที่เครื่องหลังบ้านให้รัน git pull ในโฟลเดอร์ secretsource-backend แล้วปิด/เปิดเซิร์ฟเวอร์ใหม่ (ข้อมูลที่กรอกเก็บไว้ในเครื่องนี้แล้ว)';
    async function save(notify = true) {
        const data = { invoices: state.invoices, cover: state.cover };
        try { localStorage.setItem(LOCAL_KEY('invoices'), JSON.stringify(data)); } catch { /* พื้นที่เต็ม — ข้าม */ }
        // หลังบ้านเวอร์ชันเก่ายังไม่รู้จักแบบร่างชนิด invoices → ตอบ "ประเภทเอกสารไม่ถูกต้อง"
        const result = await request('/draft/invoices', { method: 'PUT', body: JSON.stringify({ data }) }).catch(error => {
            if (/ประเภทเอกสารไม่ถูกต้อง/.test(error.message)) throw new Error(OUTDATED);
            throw error;
        });
        markSaved(result.savedAt);
        if (notify) toast('บันทึกแล้ว');
    }
    const actions = {
        'invoice-add': () => { state.invoices.push(blankInvoice()); markDirty(); render(); document.querySelectorAll('.ri-invoice')[state.invoices.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        'invoice-save': () => save(),
        'invoice-cover': async () => {
            const picked = state.invoices.filter(inv => inv.inCover);
            if (!picked.length) return toast('ยังไม่ได้เลือก Invoice สำหรับใบปะหน้า', true);
            await save(false);
            const month = coverMonthText();
            const data = {
                title: `ตารางสรุปค่าใช้จ่าย (LKR) ประจำเดือน  ${month.th}`.trim(), company: state.cover.company, department: state.cover.department, currency: 'LKR',
                fileName: coverFileName(),
                rows: picked.map(inv => ({ description: coverDescription(inv), amount: total(inv), bank: inv.bank || 'เงินสด', accountNo: '-', accountName: '-', remark: coverRemark(inv) }))
            };
            await download('/pdf', { kind: 'invoice-cover', data }, `กำลังสร้างใบปะหน้า (${picked.length} ใบ)...`, `${coverFileName()}.pdf`);
        },
        'invoice-clear': () => { if (confirm('ล้าง Invoice ทั้งหมด? (ข้อมูลที่บันทึกไว้จะยังอยู่จนกว่าจะกดบันทึก)')) { state.invoices = [blankInvoice()]; state.cover = defaultCover(); markDirty(); render(); } }
    };
    $('tab-invoice').addEventListener('click', async event => {
        const button = event.target.closest('[data-invoice-action]');
        if (!button) return;
        button.disabled = true;
        try { await actions[button.dataset.invoiceAction](); }
        catch (error) { toast(error.message || 'ทำรายการไม่สำเร็จ', true); }
        finally { button.disabled = false; }
    });

    (async () => {
        render();
        const draft = await loadDraft('invoices');
        if (draft.data?.invoices?.length) {
            state.invoices = draft.data.invoices.map(inv => ({ ...blankInvoice(), ...inv, items: inv.items?.length ? inv.items : [blankItem()] }));
            state.cover = { ...defaultCover(), ...(draft.data.cover || {}) };
            render();
        }
    })();
})();
