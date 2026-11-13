// ปุ่ม "หนังสือชี้แจง" (หน้างาน GA): กรอกข้อมูล → ดูตัวอย่างตามรูปแบบหนังสือชี้แจง → พิมพ์/บันทึก PDF หรือคัดลอกข้อความ
(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const thDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : ''; };
    const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const CLOSINGS = ['จึงเรียนมาเพื่อโปรดทราบ', 'จึงเรียนมาเพื่อโปรดพิจารณา'];
    const FIELDS = [
        ['place', 'เขียนที่', 'text', 'ที่อยู่ผู้เขียน หรือชื่อบริษัท/หน่วยงาน'],
        ['date', 'วันที่', 'date', ''],
        ['subject', 'เรื่อง', 'text', 'ขอชี้แจงข้อเท็จจริงกรณี … (ระบุเรื่องที่ต้องการชี้แจง)'],
        ['to', 'เรียน', 'text', 'ตำแหน่ง หรือ ชื่อ-นามสกุล ผู้รับหนังสือ'],
        ['ref', 'อ้างถึง (ถ้ามี)', 'text', 'หนังสือ/คำสั่ง ที่อ้างถึง'],
        ['attach', 'สิ่งที่ส่งมาด้วย (ถ้ามี)', 'text', 'รายการเอกสารหลักฐานแนบ'],
        ['source', 'ตามที่ (ที่มาของเรื่อง)', 'textarea', 'เช่น บริษัทฯ ได้มีหนังสือสอบถาม / ข้าพเจ้าได้รับเรื่อง … ลงวันที่ … เกี่ยวกับ …'],
        ['facts', 'ข้อเท็จจริง (1 บรรทัด = 1 ข้อ)', 'textarea', 'ข้อเท็จจริงหรือลำดับเหตุการณ์ที่เกิดขึ้นจริง พร้อมวันที่และเวลาที่ชัดเจน'],
        ['reasons', 'สาเหตุ / เหตุผล (1 บรรทัด = 1 ข้อ)', 'textarea', 'สาเหตุหรือเหตุผลความจำเป็น พร้อมอ้างอิงเอกสารหลักฐาน'],
        ['evidence', 'ชื่อเอกสารหลักฐานที่แนบ', 'text', 'ระบุชื่อเอกสารหลักฐาน'],
        ['closing', 'ประโยคปิดท้าย', 'select', CLOSINGS],
        ['name', 'ชื่อ-นามสกุล ผู้ชี้แจง', 'text', ''],
        ['position', 'ตำแหน่ง', 'text', ''],
        ['phone', 'โทรศัพท์', 'tel', 'เบอร์ติดต่อ']
    ];
    const WIDE = new Set(['subject', 'to', 'source', 'facts', 'reasons', 'place', 'attach', 'ref', 'evidence']);
    const lines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
    const val = (v, k) => String(v[k] || '').trim();

    // ข้อมูล → บล็อกของหนังสือ (ใช้ทั้งตัวอย่าง พิมพ์ และคัดลอก)
    function build(v) {
        const b = [];
        const head = [];
        if (val(v, 'place')) head.push(['เขียนที่', val(v, 'place')]);
        head.push(['วันที่', thDate(val(v, 'date'))]);
        b.push({ t: 'kv', rows: head });
        const meta = [['เรื่อง', val(v, 'subject')], ['เรียน', val(v, 'to')]];
        if (val(v, 'ref')) meta.push(['อ้างถึง', val(v, 'ref')]);
        if (val(v, 'attach')) meta.push(['สิ่งที่ส่งมาด้วย', val(v, 'attach')]);
        b.push({ t: 'kv', rows: meta });
        if (val(v, 'source')) b.push({ t: 'p', text: 'ตามที่ ' + val(v, 'source') });
        b.push({ t: 'p', text: `ข้าพเจ้า ${val(v, 'name') || '[ชื่อ-นามสกุล]'} ตำแหน่ง ${val(v, 'position') || '[ตำแหน่ง]'} ขอเรียนชี้แจงข้อเท็จจริงและเหตุผลในกรณีดังกล่าว ดังนี้` });
        const items = [...lines(v.facts), ...lines(v.reasons)];
        if (items.length) b.push({ t: 'ol', items });
        b.push({ t: 'p', text: `ทั้งนี้ ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ${val(v, 'evidence') ? ' และได้แนบ ' + val(v, 'evidence') + ' มาพร้อมกับหนังสือฉบับนี้เพื่อประกอบการพิจารณา' : ''}` });
        b.push({ t: 'p', text: val(v, 'closing') || CLOSINGS[0] });
        b.push({ t: 'p', text: 'ขอแสดงความนับถือ' });
        b.push({ t: 'sign', rows: ['(ลงชื่อ) ……………………………………………', `(${val(v, 'name') || '[ชื่อ-นามสกุล ตัวบรรจง]'})`, `ตำแหน่ง ${val(v, 'position') || '[ตำแหน่งงาน]'}`, `โทรศัพท์ ${val(v, 'phone') || '[เบอร์ติดต่อ]'}`] });
        return b;
    }
    const html = blocks => blocks.map(x => x.t === 'kv' ? `<div class="cl-kv">${x.rows.map(([k, t]) => `<p><b>${esc(k)}</b> ${esc(t) || '<span class="cl-ph">[ยังไม่ระบุ]</span>'}</p>`).join('')}</div>`
        : x.t === 'ol' ? `<ol>${x.items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`
        : x.t === 'sign' ? `<div class="cl-sign">${x.rows.map(r => `<p>${esc(r)}</p>`).join('')}</div>`
        : `<p class="cl-p">${esc(x.text)}</p>`).join('');
    const plain = blocks => blocks.map(x => x.t === 'kv' ? x.rows.map(([k, t]) => `${k} ${t}`).join('\n')
        : x.t === 'ol' ? x.items.map((i, n) => `${n + 1}. ${i}`).join('\n') : x.t === 'sign' ? x.rows.join('\n') : x.text).join('\n\n');

    const CSS = `
.cl-dialog { border: 0; border-radius: 16px; padding: 0; width: min(1100px, 96vw); max-height: 94vh; box-shadow: 0 24px 60px rgba(16,24,40,.35); }
.cl-dialog::backdrop { background: rgba(16,24,40,.55); }
.cl-wrap { display: grid; grid-template-rows: auto auto 1fr; max-height: 94vh; }
.cl-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e4e7ec; }
.cl-top h2 { margin: 0; font-size: 18px; }
.cl-top button { border: 0; background: #f2f4f7; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; }
.cl-purpose { margin: 12px 18px 0; padding: 12px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-left: 5px solid #0284c7; border-radius: 12px; font-size: 13.5px; line-height: 1.55; }
.cl-purpose h3 { margin: 0 0 4px; font-size: 14px; }
.cl-purpose ul { margin: 6px 0 0; padding-left: 20px; }
.cl-body { display: grid; grid-template-columns: minmax(300px, 420px) 1fr; gap: 16px; padding: 14px 18px 18px; overflow: auto; min-height: 0; }
.cl-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start; }
.cl-form label { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: #475467; }
.cl-form label.is-wide { grid-column: 1 / -1; }
.cl-form input, .cl-form textarea, .cl-form select { font: inherit; font-weight: 400; padding: 8px 10px; border: 1px solid #d0d5dd; border-radius: 8px; width: 100%; box-sizing: border-box; }
.cl-form textarea { min-height: 76px; resize: vertical; }
.cl-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cl-actions button { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; cursor: pointer; font: inherit; }
.cl-actions .is-primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.cl-paper { background: #fff; border: 1px solid #d0d5dd; border-radius: 10px; padding: 28px 34px; font-family: 'TH Sarabun New', 'THSarabunNew', 'TH SarabunPSK', 'Sarabun', Tahoma, sans-serif; font-size: 21px; line-height: 1.35; box-shadow: 0 2px 10px rgba(16,24,40,.08); }
.cl-paper p { margin: 0 0 4px; }
.cl-paper .cl-p { margin: 0 0 12px; text-indent: 2.2em; }
.cl-paper .cl-kv { margin-bottom: 14px; }
.cl-paper ol { margin: 0 0 12px; padding-left: 3.2em; }
.cl-paper li { margin-bottom: 4px; }
.cl-sign { margin-top: 18px; margin-left: 40%; }
.cl-ph { color: #98a2b3; }
.cl-msg { font-size: 12.5px; color: #027a48; }
@media (max-width: 820px) { .cl-body { grid-template-columns: 1fr; } .cl-form { grid-template-columns: 1fr; } }
`;
    let dlg = null;
    const fresh = () => ({ date: today(), closing: CLOSINGS[0] });
    const state = { v: fresh() };
    const KEY = 'gaClarificationDraft';
    try { Object.assign(state.v, JSON.parse(localStorage.getItem(KEY) || '{}'), { date: today() }); } catch { /* ไม่มีร่างเก่า */ }
    const refresh = () => {
        dlg.querySelector('.cl-paper').innerHTML = html(build(state.v));
        try { localStorage.setItem(KEY, JSON.stringify(state.v)); } catch { /* เก็บร่างไม่ได้ ไม่เป็นไร */ }
    };
    const fill = () => dlg.querySelectorAll('.cl-form [name]').forEach(el => { el.value = state.v[el.name] || ''; });

    function printable() {
        const w = window.open('', '_blank');
        if (!w) return alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาต pop-up แล้วลองใหม่');
        w.document.write(`<!doctype html><meta charset="utf-8"><title>หนังสือชี้แจง</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap"><style>@page{size:A4;margin:22mm 20mm}body{font-family:'TH Sarabun New','THSarabunNew','TH SarabunPSK','Sarabun',Tahoma,sans-serif;font-size:16pt;line-height:1.3;color:#000}p{margin:0 0 4px}.cl-p{margin:0 0 12px;text-indent:2.2em}.cl-kv{margin-bottom:14px}ol{margin:0 0 12px;padding-left:3.2em}li{margin-bottom:4px}.cl-sign{margin-top:22px;margin-left:40%}.cl-ph{color:#999}</style>${html(build(state.v))}`);
        w.document.close();
        w.focus();
        const go = () => w.print();
        (w.document.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 300)).catch(go);
    }
    function open() {
        if (!dlg) {
            document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
            document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap' }));
            dlg = document.createElement('dialog');
            dlg.className = 'cl-dialog';
            const field = ([k, label, type, ph]) => `<label class="${WIDE.has(k) ? 'is-wide' : ''}">${esc(label)}${
                type === 'textarea' ? `<textarea name="${k}" placeholder="${esc(ph)}"></textarea>`
                    : type === 'select' ? `<select name="${k}">${ph.map(o => `<option>${esc(o)}</option>`).join('')}</select>`
                        : `<input name="${k}" type="${type}" placeholder="${esc(ph)}">`}</label>`;
            dlg.innerHTML = `<div class="cl-wrap">
                <div class="cl-top"><h2>📄 หนังสือชี้แจง</h2><button type="button" data-cl-close aria-label="ปิด">✕</button></div>
                <div class="cl-purpose"><h3>หนังสือชี้แจงใช้ทำอะไร</h3>บันทึกข้อเท็จจริงและเหตุผลเป็นลายลักษณ์อักษร เพื่อให้ทุกฝ่ายเข้าใจตรงกัน ใช้เป็นหลักฐานอ้างอิง และปกป้องสิทธิ์ของผู้เกี่ยวข้อง
                    <ul><li><b>อธิบายเหตุผล</b> — เมื่อเกิดเหตุไม่ปกติ เช่น ส่งงานล่าช้า ไม่ลงเวลา ใช้งบเกินแผน</li><li><b>แก้ข้อกล่าวหา</b> — โต้แย้งข้อมูลที่คลาดเคลื่อน เมื่อถูกร้องเรียนหรือสอบสวน</li><li><b>สร้างความโปร่งใส</b> — ให้ผู้พิจารณาเห็นที่มาที่ไปของเรื่อง ตรวจสอบได้</li><li><b>เก็บเป็นหลักฐาน</b> — เก็บในแฟ้มประวัติ/ระบบสารบรรณ ใช้ประกอบการตัดสินใจ</li></ul></div>
                <div class="cl-body"><form class="cl-form" autocomplete="off">${FIELDS.map(field).join('')}
                    <div class="cl-actions"><button type="button" class="is-primary" data-cl="print">🖨️ พิมพ์ / บันทึกเป็น PDF</button><button type="button" data-cl="copy">📋 คัดลอกข้อความ</button><button type="button" data-cl="clear">ล้างฟอร์ม</button><span class="cl-msg" role="status"></span></div></form>
                    <div><div class="cl-paper"></div></div></div></div>`;
            document.body.append(dlg);
            dlg.querySelector('.cl-form').addEventListener('input', e => { if (e.target.name) { state.v[e.target.name] = e.target.value; refresh(); } });
            dlg.addEventListener('click', async e => {
                if (e.target.closest('[data-cl-close]') || e.target === dlg) return dlg.close();
                const act = e.target.closest('[data-cl]')?.dataset.cl;
                const msg = dlg.querySelector('.cl-msg');
                if (act === 'print') printable();
                if (act === 'copy') {
                    try { await navigator.clipboard.writeText(plain(build(state.v))); msg.textContent = '✓ คัดลอกแล้ว'; } catch { msg.textContent = 'คัดลอกไม่ได้ — ใช้ปุ่มพิมพ์แทน'; }
                }
                if (act === 'clear' && confirm('ล้างข้อมูลที่กรอกทั้งหมด?')) { state.v = fresh(); fill(); refresh(); }
            });
        }
        fill();
        refresh();
        dlg.showModal();
    }
    document.addEventListener('click', e => { if (e.target.closest('#gwClarification')) open(); });
})();
