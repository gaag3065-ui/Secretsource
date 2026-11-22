// สร้างเอกสารขออนุมัติสั่งซื้อ — กำหนดเนื้อหาได้ตั้งแต่ "เรียน" ถึงลายเซ็น แล้วพิมพ์/บันทึกเป็น PDF (A4)
// ทำงานในเบราว์เซอร์ล้วน ร่างเอกสารเก็บในเครื่องนี้อัตโนมัติ (localStorage)
(async () => {
    try { await window.requirePagePermission?.('ViewAssets'); } catch { return; }
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const KEY = 'purchase-request-draft-v1';
    const STATUS = { ok: 'เพียงพอ', buy: 'ควรสั่งซื้อ', spare: 'อุปกรณ์สำรอง' };
    const TAGS = { '': '—', spare: 'อุปกรณ์สำรอง', urgent: 'สั่งด่วน' };
    const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

    const blank = () => ({
        eyebrow: 'บันทึกขออนุมัติ · PURCHASE REQUEST',
        title1: 'ขออนุมัติจัดซื้ออุปกรณ์สำนักงาน', title2: 'พื้นที่ Mireka Tower',
        to: 'ผู้บริหาร', from: 'ฝ่าย GA', date: todayIso(),
        subject: 'เตรียมความพร้อมทรัพย์สินที่ Mireka Tower ให้รองรับการใช้งาน 100 ที่นั่ง และจัดเก็บอุปกรณ์สำรองในสต็อก',
        s1: { show: true, title: 'ภาพรวมที่นั่ง', cards: [
            { label: 'ที่นั่งปัจจุบัน (อุปกรณ์ครบ พร้อมใช้งาน)', value: '65', unit: 'ที่นั่ง' },
            { label: 'ที่นั่งที่ต้องเพิ่ม', value: '+35', unit: 'ที่นั่ง' },
            { label: 'เป้าหมายรวม', value: '100', unit: 'ที่นั่ง' }] },
        s2: { show: true, title: 'สถานะอุปกรณ์ปัจจุบัน', rows: [
            { name: 'โน้ตบุ๊ก', have: '62 (สต็อก + นำเข้าจาก TH)', status: 'ok' },
            { name: 'จอมอนิเตอร์', have: 'ครบ (ตัวเดิม)', status: 'ok' },
            { name: 'คีย์บอร์ด', have: '4', status: 'buy' },
            { name: 'เมาส์', have: '22', status: 'buy' },
            { name: 'USB Hub', have: '3', status: 'buy' }] },
        s3: { title: 'รายการขออนุมัติสั่งซื้อ', rows: [
            { name: 'คีย์บอร์ด', qty: '50', unit: 'อัน', price: '', note: 'ครบ 35 ที่นั่ง + สำรอง', tag: '' },
            { name: 'เมาส์', qty: '30', unit: 'อัน', price: '', note: 'ครบ 35 ที่นั่ง + สำรอง', tag: '' },
            { name: 'USB Hub', qty: '40', unit: 'อัน', price: '', note: 'ครบ 35 ที่นั่ง + สำรอง', tag: '' },
            { name: 'Power Adapter 12V 3A (จอ)', qty: '5', unit: 'อัน', price: '', note: '', tag: 'spare' },
            { name: 'สาย LAN 2 เมตร (พร้อมใช้งาน)', qty: '10', unit: 'เส้น', price: '', note: '', tag: 'spare' },
            { name: 'Network Switch 5 Port 10/100 Mbps', qty: '10', unit: 'อัน', price: '', note: '', tag: 'spare' }] },
        s4: { show: true, title: 'เหตุผลและประโยชน์', items: [
            'ทำให้พื้นที่ Mireka Tower รองรับการใช้งานครบ 100 ที่นั่ง ทุกที่นั่งมีอุปกรณ์พร้อมใช้งาน',
            'ปิดส่วนที่ขาดของคีย์บอร์ด เมาส์ และ USB Hub สำหรับ 35 ที่นั่งใหม่',
            'มีอุปกรณ์สำรองในสต็อก ลดเวลาหยุดงานเมื่ออุปกรณ์ชำรุด และรองรับการขยายที่นั่งในอนาคต'] },
        proposer: { role: 'ผู้เสนอ', dept: 'ฝ่าย GA', name: '', date: todayIso(), sig: '' },
        approver: { role: 'ผู้อนุมัติ', name: '', sig: '' },
        footer: 'บันทึกขออนุมัติจัดซื้ออุปกรณ์ · Mireka Tower'
    });
    let doc;
    try { doc = { ...blank(), ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; } catch { doc = blank(); }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(doc)); } catch { toast('บันทึกร่างอัตโนมัติไม่ได้ (พื้นที่เบราว์เซอร์เต็ม) — ลองลดขนาดลายเซ็น'); } };
    let toastTimer;
    function toast(text) { const t = $('prToast'); t.textContent = text; t.classList.add('is-on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200); }

    const thaiDate = iso => { const d = /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? new Date(iso + 'T00:00:00') : null; return d ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
    const num = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
    const fmt = n => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
    const lines = text => esc(text).replace(/\n/g, '<br>');

    // ---------------------------------------------------------------- เอกสาร (ตัวอย่าง A4)
    function paperHtml() {
        let n = 0;
        const sec = (title, body) => `<h2><i>${++n}</i>${esc(title)}</h2>${body}`;
        const rows3 = doc.s3.rows.filter(r => r.name || r.qty);
        const total = rows3.reduce((s, r) => s + (num(r.qty) || 0) * (num(r.price) || 0), 0);
        const hasPrice = rows3.some(r => num(r.price) > 0);
        const pieces = rows3.reduce((s, r) => s + (num(r.qty) || 0), 0);
        const money = v => (num(v) > 0 ? fmt(num(v)) : '–');
        const body = [
            doc.s1.show ? sec(doc.s1.title, `<div class="cards">${doc.s1.cards.map((c, i) => `<div class="pcard ${i === 2 ? 'dark' : ''}"><small>${esc(c.label)}</small><strong>${esc(c.value)}</strong><span>${esc(c.unit)}</span></div>`).join('')}</div>`) : '',
            doc.s2.show ? sec(doc.s2.title, `<table class="ptable"><thead><tr><th>อุปกรณ์</th><th>มีอยู่ปัจจุบัน</th><th>สถานะ</th></tr></thead><tbody>${doc.s2.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.have)}</td><td><span class="chip ${r.status}">${esc(STATUS[r.status] || '')}</span></td></tr>`).join('')}</tbody></table>`) : '',
            sec(doc.s3.title, `<table class="ptable"><thead><tr><th>รายการ</th><th>จำนวนขอซื้อ</th><th>หน่วย</th>${hasPrice ? '<th>ราคา/หน่วย (บาท)</th><th>รวม (บาท)</th>' : ''}<th>หมายเหตุ</th></tr></thead><tbody>${rows3.map(r => `<tr><td>${esc(r.name)}</td><td class="num"><b>${esc(r.qty)}</b></td><td>${esc(r.unit)}</td>${hasPrice ? `<td class="num">${money(r.price)}</td><td class="num">${num(r.qty) > 0 && num(r.price) > 0 ? fmt(num(r.qty) * num(r.price)) : '–'}</td>` : ''}<td class="note">${r.tag ? `<span class="chip ${r.tag}">${esc(TAGS[r.tag])}</span>` : ''}${r.tag && r.note ? ' ' : ''}${esc(r.note)}</td></tr>`).join('')}</tbody>${hasPrice ? `<tfoot><tr><td colspan="4" style="text-align:right">รวมทั้งสิ้น</td><td class="num">${fmt(total)}</td><td></td></tr></tfoot>` : ''}</table>`),
            doc.s4.show && doc.s4.items.some(Boolean) ? sec(doc.s4.title, `<ul class="reasons">${doc.s4.items.filter(Boolean).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`) : ''
        ].join('');
        const p = doc.proposer, a = doc.approver;
        return `<header class="paper-head"><div><p class="paper-eyebrow">${esc(doc.eyebrow)}</p><h1 class="paper-title">${esc(doc.title1)}${doc.title2 ? '<br>' + esc(doc.title2) : ''}</h1></div>
            <div class="paper-meta">เรียน <b>${esc(doc.to)}</b><br>จาก <b>${esc(doc.from)}</b><br>วันที่ <b>${esc(thaiDate(doc.date))}</b></div></header>
            <div class="paper-subject"><b>เรื่อง</b> ${lines(doc.subject)}</div>
            ${body}
            <div class="signs">
                <div class="sign"><div class="space">${p.sig ? `<img src="${esc(p.sig)}" alt="">` : ''}</div><b>${esc(p.role)}${p.name ? ' · ' + esc(p.name) : ''}</b><small>${esc(p.dept)}</small><small>${p.date ? 'วันที่ ' + esc(thaiDate(p.date)) : ''}</small></div>
                <div class="sign"><div class="space">${a.sig ? `<img src="${esc(a.sig)}" alt="">` : ''}</div><b>${esc(a.role)}</b><small>(${a.name ? esc(a.name) : '......................................................'})</small><small class="boxes">☐ อนุมัติ &nbsp;&nbsp; ☐ ไม่อนุมัติ</small></div>
            </div>
            <footer class="paper-foot"><span>${esc(doc.footer)}</span><span>จำนวนเสนอซื้อรวม ${fmt(pieces)} ชิ้น (${rows3.length} รายการ)</span></footer>`;
    }
    function fit() {
        const stage = document.querySelector('.pr-stage'), scale = $('prScale'), paper = $('prPaper');
        if (!stage) return;
        const k = Math.min(1, (stage.clientWidth || 794) / 794);
        scale.style.transform = k < 1 ? `scale(${k})` : '';
        scale.style.width = '794px';
        scale.style.height = Math.ceil(paper.offsetHeight * k) + 'px';
    }
    function renderPaper() { $('prPaper').innerHTML = paperHtml(); fit(); }

    // ---------------------------------------------------------------- ตัวแก้ไข
    const input = (path, label, value, opts = {}) => `<label class="${opts.cls || ''}">${esc(label)}${opts.area ? `<textarea data-k="${path}" ${opts.max ? `maxlength="${opts.max}"` : ''}>${esc(value)}</textarea>` : `<input data-k="${path}" type="${opts.type || 'text'}" value="${esc(value)}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>`}</label>`;
    const open = new Set(['head', 'items']);
    function editorHtml() {
        const d = doc;
        const det = (key, title, inner) => `<details data-d="${key}" ${open.has(key) ? 'open' : ''}><summary>${esc(title)}</summary>${inner}</details>`;
        return [
            det('head', '① หัวเอกสาร (เรียน · จาก · วันที่ · เรื่อง)',
                input('eyebrow', 'หัวเรื่องเล็ก (เหนือชื่อเอกสาร)', d.eyebrow) + input('title1', 'ชื่อเอกสาร บรรทัด 1', d.title1) + input('title2', 'ชื่อเอกสาร บรรทัด 2 (เช่น พื้นที่/โครงการ)', d.title2) +
                input('to', 'เรียน', d.to) + input('from', 'จาก', d.from) + input('date', 'วันที่', d.date, { type: 'date' }) + input('subject', 'เรื่อง', d.subject, { area: true })),
            det('s1', '② ภาพรวม (กล่องตัวเลข 3 กล่อง)',
                `<label class="pr-check"><input type="checkbox" data-k="s1.show" ${d.s1.show ? 'checked' : ''}> แสดงส่วนนี้</label>` + input('s1.title', 'หัวข้อ', d.s1.title) +
                d.s1.cards.map((c, i) => `<div class="pr-row"><div class="pr-row-head">กล่องที่ ${i + 1}${i === 2 ? ' (พื้นสีเข้ม)' : ''}</div><div class="pr-row-grid">${input(`s1.cards.${i}.label`, 'ข้อความ', c.label, { cls: 'w6' })}${input(`s1.cards.${i}.value`, 'ตัวเลข', c.value, { cls: 'w3' })}${input(`s1.cards.${i}.unit`, 'หน่วย', c.unit, { cls: 'w3' })}</div></div>`).join('')),
            det('s2', '③ สถานะอุปกรณ์ปัจจุบัน (ตาราง)',
                `<label class="pr-check"><input type="checkbox" data-k="s2.show" ${d.s2.show ? 'checked' : ''}> แสดงส่วนนี้</label>` + input('s2.title', 'หัวข้อ', d.s2.title) +
                d.s2.rows.map((r, i) => `<div class="pr-row"><div class="pr-row-head">แถวที่ ${i + 1}<button type="button" class="pr-mini is-del" data-act="del" data-list="s2.rows" data-i="${i}">ลบ</button></div><div class="pr-row-grid">${input(`s2.rows.${i}.name`, 'อุปกรณ์', r.name, { cls: 'w3' })}${input(`s2.rows.${i}.have`, 'มีอยู่ปัจจุบัน', r.have, { cls: 'w3' })}<label class="w6">สถานะ<select data-k="s2.rows.${i}.status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div></div>`).join('') +
                '<button type="button" class="pr-add" data-act="add" data-list="s2.rows">＋ เพิ่มแถว</button>'),
            det('items', '④ รายการขออนุมัติสั่งซื้อ (ตาราง)',
                input('s3.title', 'หัวข้อ', d.s3.title) +
                d.s3.rows.map((r, i) => `<div class="pr-row"><div class="pr-row-head">รายการที่ ${i + 1}<button type="button" class="pr-mini is-del" data-act="del" data-list="s3.rows" data-i="${i}">ลบ</button></div><div class="pr-row-grid">${input(`s3.rows.${i}.name`, 'รายการ', r.name, { cls: 'w6' })}${input(`s3.rows.${i}.qty`, 'จำนวน', r.qty, { cls: 'w2' })}${input(`s3.rows.${i}.unit`, 'หน่วย', r.unit, { cls: 'w2' })}${input(`s3.rows.${i}.price`, 'ราคา/หน่วย (ถ้ามี)', r.price, { cls: 'w2', ph: 'เว้นว่างได้' })}${input(`s3.rows.${i}.note`, 'หมายเหตุ', r.note, { cls: 'w3' })}<label class="w3">ป้าย<select data-k="s3.rows.${i}.tag">${Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${r.tag === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div></div>`).join('') +
                '<button type="button" class="pr-add" data-act="add" data-list="s3.rows">＋ เพิ่มรายการ</button><p class="pr-hint2">ใส่ราคา/หน่วยอย่างน้อย 1 รายการ ระบบจะเพิ่มคอลัมน์ราคา และแถว "รวมทั้งสิ้น" ให้อัตโนมัติ</p>'),
            det('s4', '⑤ เหตุผลและประโยชน์',
                `<label class="pr-check"><input type="checkbox" data-k="s4.show" ${d.s4.show ? 'checked' : ''}> แสดงส่วนนี้</label>` + input('s4.title', 'หัวข้อ', d.s4.title) +
                d.s4.items.map((t, i) => `<div class="pr-row"><div class="pr-row-head">ข้อ ${i + 1}<button type="button" class="pr-mini is-del" data-act="del" data-list="s4.items" data-i="${i}">ลบ</button></div>${input(`s4.items.${i}`, 'ข้อความ', t, { area: true })}</div>`).join('') +
                '<button type="button" class="pr-add" data-act="add" data-list="s4.items">＋ เพิ่มข้อ</button>'),
            det('sign', '⑥ ลายเซ็น (ผู้เสนอ · ผู้อนุมัติ) และท้ายเอกสาร',
                `<div class="pr-row"><div class="pr-row-head">ผู้เสนอ</div><div class="pr-row-grid">${input('proposer.role', 'ตำแหน่งในเอกสาร', d.proposer.role, { cls: 'w3' })}${input('proposer.dept', 'ฝ่าย/แผนก', d.proposer.dept, { cls: 'w3' })}${input('proposer.name', 'ชื่อ (ไม่บังคับ)', d.proposer.name, { cls: 'w3' })}${input('proposer.date', 'วันที่ลงนาม', d.proposer.date, { cls: 'w3', type: 'date' })}</div>
                    <div class="pr-sig">${d.proposer.sig ? `<img src="${esc(d.proposer.sig)}" alt="">` : ''}<input type="file" accept="image/*" data-sig="proposer"><button type="button" class="pr-mini" data-act="clear-sig" data-who="proposer">ลบลายเซ็น</button></div></div>` +
                `<div class="pr-row"><div class="pr-row-head">ผู้อนุมัติ</div><div class="pr-row-grid">${input('approver.role', 'ตำแหน่งในเอกสาร', d.approver.role, { cls: 'w3' })}${input('approver.name', 'ชื่อ (เว้นว่าง = เส้นประให้เซ็น)', d.approver.name, { cls: 'w3' })}</div>
                    <div class="pr-sig">${d.approver.sig ? `<img src="${esc(d.approver.sig)}" alt="">` : ''}<input type="file" accept="image/*" data-sig="approver"><button type="button" class="pr-mini" data-act="clear-sig" data-who="approver">ลบลายเซ็น</button></div></div>` +
                input('footer', 'ข้อความท้ายเอกสาร (ซ้าย)', d.footer))
        ].join('');
    }
    function renderEditor() { $('prEditor').innerHTML = editorHtml(); }
    const getPath = (path) => path.split('.').reduce((o, k) => o?.[k], doc);
    function setPath(path, value) {
        const keys = path.split('.'); const last = keys.pop();
        const obj = keys.reduce((o, k) => o[k], doc);
        obj[last] = value;
    }
    $('prEditor').addEventListener('input', event => {
        const el = event.target.closest('[data-k]'); if (!el) return;
        setPath(el.dataset.k, el.type === 'checkbox' ? el.checked : el.value);
        save(); renderPaper();
    });
    $('prEditor').addEventListener('toggle', event => { const d = event.target.closest?.('[data-d]'); if (d) (d.open ? open.add(d.dataset.d) : open.delete(d.dataset.d)); }, true);
    const NEW_ROW = { 's2.rows': () => ({ name: '', have: '', status: 'buy' }), 's3.rows': () => ({ name: '', qty: '', unit: 'อัน', price: '', note: '', tag: '' }), 's4.items': () => '' };
    $('prEditor').addEventListener('click', event => {
        const b = event.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'add') { getPath(b.dataset.list).push(NEW_ROW[b.dataset.list]()); }
        else if (b.dataset.act === 'del') { getPath(b.dataset.list).splice(Number(b.dataset.i), 1); }
        else if (b.dataset.act === 'clear-sig') { doc[b.dataset.who].sig = ''; }
        else return;
        save(); renderEditor(); renderPaper();
    });
    // ลายเซ็น: ย่อรูปแล้วเก็บเป็น data URL
    $('prEditor').addEventListener('change', event => {
        const file = event.target.closest('[data-sig]')?.files?.[0]; if (!file) return;
        const who = event.target.dataset.sig;
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            const k = Math.min(1, 420 / Math.max(img.width, img.height));
            const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            doc[who].sig = c.toDataURL('image/png'); URL.revokeObjectURL(url);
            save(); renderEditor(); renderPaper();
        };
        img.onerror = () => toast('เปิดรูปลายเซ็นไม่ได้');
        img.src = url;
    });

    $('prPrint').addEventListener('click', () => { document.title = `ขออนุมัติสั่งซื้อ ${doc.title2 || ''} ${thaiDate(doc.date)}`.trim(); window.print(); });
    $('prReset').addEventListener('click', () => { if (!confirm('เริ่มเอกสารใหม่? เนื้อหาที่แก้ไว้จะถูกแทนที่ด้วยตัวอย่างตั้งต้น')) return; doc = blank(); save(); renderEditor(); renderPaper(); });
    window.addEventListener('resize', fit);
    renderEditor(); renderPaper();
    document.fonts?.ready?.then(fit);
})();
