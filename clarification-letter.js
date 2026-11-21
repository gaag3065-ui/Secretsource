// ปุ่ม "บันทึกข้อความ" (หน้างาน GA): กรอกข้อมูล → ดูตัวอย่างหน้า A4 แบบเรียลไทม์ → พิมพ์/บันทึกเป็น PDF หรือคัดลอกข้อความ
// (เดิมคือ "หนังสือชี้แจง" — เปลี่ยนเป็นรูปแบบบันทึกข้อความมาตรฐาน: ส่วนงาน / วันที่ / เรื่อง / เรียน + ช่องลงนาม + กล่อง "สำหรับผู้บริหารพิจารณา")
(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const fmtDate = (iso, era) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + (era === 'ad' ? 0 : 543)}` : ''; };
    const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const DEFAULT_CLOSING = 'จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติการดำเนินการดังกล่าวโดยเร็ว';
    // [ชื่อช่อง, ป้าย, ชนิด, ข้อความตัวอย่าง]
    const FIELDS = [
        ['dept', 'ส่วนงาน', 'text', 'เช่น แผนก GA'],
        ['date', 'วันที่', 'date', ''],
        ['era', 'ปีที่แสดง', 'era', ''],
        ['subject', 'เรื่อง', 'text', 'เช่น ชี้แจงและขออนุมัติใช้เงินค่าเช่าเป็นการชั่วคราว'],
        ['to', 'เรียน', 'text', 'เช่น ผู้บริหาร'],
        ['intro', 'ย่อหน้าเกริ่นนำ', 'textarea', 'ข้อความเกริ่นนำ (กด Enter = ขึ้นบรรทัดใหม่ · เว้น 1 บรรทัด = ย่อหน้าใหม่)'],
        ['stepsTitle', 'หัวข้อย่อย', 'text', 'เช่น ลำดับการดำเนินการ (ปี 2026)'],
        ['steps', 'รายการย่อย (1 บรรทัด = 1 รายการ ไม่ใส่เลขข้อ)', 'textarea', '26/10  ตรวจสอบห้องพักและส่งเอกสารขอเบิกเงินมัดจำ'],
        ['body', 'ย่อหน้าเหตุผล / ข้อเสนอ', 'textarea', 'เนื้อหาส่วนกลางและส่วนสรุป (เว้น 1 บรรทัด = ย่อหน้าใหม่)'],
        ['closing', 'ประโยคปิดท้าย', 'text', DEFAULT_CLOSING],
        ['name', 'ชื่อผู้เสนอเรื่อง', 'text', 'เช่น คัง อภิวัฒน์'],
        ['ownerDept', 'ส่วนงานผู้เสนอ', 'text', 'เช่น แผนก GA'],
        ['signature', 'ลายเซ็นผู้เสนอ (อัปโหลดรูป)', 'file', ''],
        ['reviewerName', 'ชื่อผู้พิจารณา (เว้นว่าง = เส้นประให้เซ็น)', 'text', ''],
        ['reviewerPosition', 'ตำแหน่งผู้พิจารณา', 'text', 'ผู้บริหาร']
    ];
    const WIDE = new Set(['subject', 'to', 'intro', 'stepsTitle', 'steps', 'body', 'closing', 'signature']);
    const lines = t => String(t || '').split(/\r?\n/).map(x => x.replace(/\s+$/, '')).filter(x => x.trim());
    const paras = t => String(t || '').split(/\r?\n\s*\r?\n/).map(x => x.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('\n')).filter(Boolean);
    const val = (v, k) => String(v[k] || '').trim();
    const dots = n => '.'.repeat(n);

    // ข้อมูล → บล็อกของบันทึกข้อความ (ใช้ทั้งตัวอย่าง พิมพ์ และคัดลอก)
    function build(v) {
        const b = [];
        b.push({ t: 'title', text: 'บันทึกข้อความ' });
        b.push({ t: 'kv', rows: [['ส่วนงาน', val(v, 'dept')], ['วันที่', fmtDate(val(v, 'date'), v.era)], ['เรื่อง', val(v, 'subject')], ['เรียน', val(v, 'to')]] });
        for (const p of paras(v.intro)) b.push({ t: 'p', text: p });
        if (val(v, 'stepsTitle') || lines(v.steps).length) {
            if (val(v, 'stepsTitle')) b.push({ t: 'h', text: val(v, 'stepsTitle') });
            if (lines(v.steps).length) b.push({ t: 'steps', items: lines(v.steps) });
        }
        for (const p of paras(v.body)) b.push({ t: 'p', text: p });
        b.push({ t: 'p', text: val(v, 'closing') || DEFAULT_CLOSING });
        b.push({ t: 'sign', name: val(v, 'name'), dept: val(v, 'ownerDept'), img: v.signature || '', reviewerName: val(v, 'reviewerName'), reviewerPosition: val(v, 'reviewerPosition') || 'ผู้บริหาร' });
        return b;
    }
    const signHtml = x => `<div class="cl-signrow">
        <div class="cl-sign-l"><p>ด้วยความเคารพ</p>
            <div class="cl-sigbox">${x.img ? `<img src="${esc(x.img)}" alt="ลายเซ็น">` : ''}<p class="cl-sigline">ลงชื่อ${dots(36)}</p></div>
            <p><b>(${esc(x.name) || '<span class="cl-ph">ชื่อผู้เสนอเรื่อง</span>'})</b></p><p>${esc(x.dept) || '<span class="cl-ph">ส่วนงาน</span>'}</p></div>
        <div class="cl-sign-r"><p class="cl-boxh"><b>สำหรับผู้บริหารพิจารณา</b></p>
            <p class="cl-ck"><span>☐ อนุมัติ</span><span>☐ ไม่อนุมัติ</span></p>
            <p class="cl-bl">ลงชื่อ ${dots(52)}</p><p>(${x.reviewerName ? esc(x.reviewerName) : dots(52)})</p>
            <p>ตำแหน่ง ${esc(x.reviewerPosition)}</p><p>วันที่ ${dots(12)} / ${dots(12)} / ${dots(12)}</p></div></div>`;
    const html = blocks => blocks.map(x => x.t === 'title' ? `<h1 class="cl-title">${esc(x.text)}</h1>`
        : x.t === 'kv' ? `<div class="cl-kv">${x.rows.map(([k, t]) => `<p><b>${esc(k)}</b> ${esc(t) || '<span class="cl-ph">[ยังไม่ระบุ]</span>'}</p>`).join('')}</div>`
        : x.t === 'h' ? `<p class="cl-h"><b>${esc(x.text)}</b></p>`
        : x.t === 'steps' ? `<div class="cl-steps">${x.items.map(i => `<p>${esc(i)}</p>`).join('')}</div>`
        : x.t === 'sign' ? signHtml(x)
        : `<p class="cl-p">${esc(x.text)}</p>`).join('');
    const plain = blocks => blocks.map(x => x.t === 'title' ? x.text : x.t === 'kv' ? x.rows.map(([k, t]) => `${k} ${t}`).join('\n')
        : x.t === 'h' ? x.text : x.t === 'steps' ? x.items.map(i => '    ' + i).join('\n')
        : x.t === 'sign' ? `ด้วยความเคารพ\nลงชื่อ.................................\n(${x.name || ''})\n${x.dept || ''}\n\nสำหรับผู้บริหารพิจารณา\n☐ อนุมัติ   ☐ ไม่อนุมัติ\nลงชื่อ ....................  (${x.reviewerName || '....................'})\nตำแหน่ง ${x.reviewerPosition}\nวันที่ ....... / ....... / .......`
        : '    ' + x.text).join('\n\n');

    // CSS หน้ากระดาษ — ใช้ชุดเดียวกันทั้งตัวอย่างและหน้าพิมพ์ (ตัวอย่าง = ที่จะได้ใน PDF)
    const PAPER_CSS = `
.cl-paper { box-sizing: border-box; width: 210mm; background: #fff; color: #000; font-family: 'TH Sarabun New', 'THSarabunNew', 'TH SarabunPSK', 'Sarabun', Tahoma, sans-serif; font-size: 15pt; line-height: 1.22; }
.cl-paper p { margin: 0 0 2pt; overflow-wrap: break-word; }
.cl-paper .cl-title { margin: 0 0 14pt; text-align: center; font-size: 21pt; font-weight: 700; }
.cl-paper .cl-kv { margin-bottom: 8pt; }
.cl-paper .cl-p { margin: 0 0 6pt; text-indent: 2.2em; white-space: pre-wrap; }
.cl-paper .cl-h { margin: 8pt 0 3pt; }
.cl-paper .cl-steps { margin: 0 0 8pt; padding-left: 2.2em; }
.cl-paper .cl-steps p { white-space: pre-wrap; margin: 0; }
.cl-paper .cl-signrow { display: grid; grid-template-columns: 1fr 1fr; gap: 16pt; margin-top: 14pt; align-items: start; break-inside: avoid; }
.cl-paper .cl-sign-l { text-align: center; }
.cl-paper .cl-sigbox { position: relative; min-height: 46pt; display: flex; flex-direction: column; justify-content: flex-end; }
.cl-paper .cl-sigbox img { position: absolute; left: 50%; top: -2pt; transform: translateX(-50%); max-height: 46pt; max-width: 70%; object-fit: contain; }
.cl-paper .cl-sigline { margin: 0; white-space: nowrap; }
.cl-paper .cl-sign-r { border: 1px solid #000; padding: 8pt 10pt; text-align: center; font-size: 13pt; }
.cl-paper .cl-sign-r p { margin: 0 0 4pt; white-space: nowrap; overflow: hidden; }
.cl-paper .cl-boxh { margin-bottom: 6pt !important; }
.cl-paper .cl-ck { display: flex; justify-content: center; gap: 28pt; margin-bottom: 10pt !important; }
.cl-paper .cl-ph { color: #98a2b3; }
`;
    const CSS = `
.cl-dialog { border: 0; border-radius: 16px; padding: 0; width: min(1180px, 96vw); max-height: 94vh; box-shadow: 0 24px 60px rgba(16,24,40,.35); }
.cl-dialog::backdrop { background: rgba(16,24,40,.55); }
.cl-wrap { display: grid; grid-template-rows: auto 1fr; max-height: 94vh; }
.cl-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e4e7ec; }
.cl-top h2 { margin: 0; font-size: 18px; }
.cl-top button { border: 0; background: #f2f4f7; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; }
.cl-body { display: grid; grid-template-columns: minmax(300px, 400px) 1fr; gap: 16px; padding: 14px 18px 18px; overflow: auto; min-height: 0; }
.cl-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start; }
.cl-form label { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: #475467; }
.cl-form label.is-wide { grid-column: 1 / -1; }
.cl-form input, .cl-form textarea, .cl-form select { font: inherit; font-weight: 400; padding: 8px 10px; border: 1px solid #d0d5dd; border-radius: 8px; width: 100%; box-sizing: border-box; }
.cl-form textarea { min-height: 76px; resize: vertical; }
.cl-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cl-actions button { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; cursor: pointer; font: inherit; }
.cl-actions .is-primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.cl-stage { min-width: 0; }
.cl-fit { position: relative; overflow: hidden; border: 1px solid #d0d5dd; border-radius: 10px; background: #fff; box-shadow: 0 2px 10px rgba(16,24,40,.08); }
.cl-fit .cl-paper { transform-origin: top left; padding: 15mm 18mm; min-height: 297mm; }
.cl-warn { margin: 6px 0 0; font-size: 12.5px; color: #b42318; }
.cl-msg { font-size: 12.5px; color: #027a48; }
@media (max-width: 820px) { .cl-body { grid-template-columns: 1fr; } .cl-form { grid-template-columns: 1fr; } }
` + PAPER_CSS;
    let dlg = null;
    const fresh = () => ({ dept: 'แผนก GA', date: today(), era: 'be', to: 'ผู้บริหาร', closing: DEFAULT_CLOSING, ownerDept: 'แผนก GA', reviewerPosition: 'ผู้บริหาร' });
    const state = { v: fresh() };
    const KEY = 'gaMemoDraft';
    try { Object.assign(state.v, JSON.parse(localStorage.getItem(KEY) || '{}'), { date: today() }); } catch { /* ไม่มีร่างเก่า */ }
    const A4_PX = 210 / 25.4 * 96;   // ความกว้างหน้ากระดาษ A4 เป็นพิกเซล (ใช้คำนวณย่อให้พอดีช่องแสดง)
    function fit() {
        const fitBox = dlg.querySelector('.cl-fit'), paper = dlg.querySelector('.cl-paper');
        const w = fitBox.clientWidth; if (!w) return;
        const k = Math.min(1, w / A4_PX);
        paper.style.transform = `scale(${k})`;
        fitBox.style.height = Math.ceil(paper.offsetHeight * k) + 'px';
        dlg.querySelector('.cl-warn').hidden = paper.offsetHeight <= (297 / 25.4 * 96) + 2;   // ยาวเกิน 1 หน้า A4
    }
    const refresh = () => {
        dlg.querySelector('.cl-paper').innerHTML = html(build(state.v));
        try { localStorage.setItem(KEY, JSON.stringify(state.v)); } catch { /* เก็บร่างไม่ได้ (เช่น รูปใหญ่) ไม่เป็นไร */ }
        fit();
    };
    const fill = () => dlg.querySelectorAll('.cl-form [name]').forEach(el => { if (el.type !== 'file') el.value = state.v[el.name] || ''; });

    function printable() {
        const w = window.open('', '_blank');
        if (!w) return alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาต pop-up แล้วลองใหม่');
        w.document.write(`<!doctype html><meta charset="utf-8"><title>บันทึกข้อความ</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap"><style>@page{size:A4;margin:15mm 18mm}html,body{margin:0}${PAPER_CSS}.cl-paper{width:auto}</style><div class="cl-paper">${html(build(state.v))}</div>`);
        w.document.close();
        w.focus();
        const go = () => w.print();
        (w.document.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 300)).catch(go);
    }
    const readImage = file => new Promise((res, rej) => {   // ย่อรูปลายเซ็นให้เล็ก (สูงสุด 600px) เก็บเป็น data URL
        const fr = new FileReader();
        fr.onerror = () => rej(new Error('อ่านไฟล์ไม่ได้'));
        fr.onload = () => {
            const img = new Image();
            img.onerror = () => rej(new Error('ไฟล์ไม่ใช่รูปภาพ'));
            img.onload = () => {
                const k = Math.min(1, 600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
                c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                res(c.toDataURL('image/png'));
            };
            img.src = fr.result;
        };
        fr.readAsDataURL(file);
    });
    function open() {
        if (!dlg) {
            document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
            document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap' }));
            dlg = document.createElement('dialog');
            dlg.className = 'cl-dialog';
            const field = ([k, label, type, ph]) => `<label class="${WIDE.has(k) ? 'is-wide' : ''}">${esc(label)}${
                type === 'textarea' ? `<textarea name="${k}" placeholder="${esc(ph)}"></textarea>`
                    : type === 'era' ? `<select name="${k}"><option value="be">พ.ศ.</option><option value="ad">ค.ศ.</option></select>`
                        : type === 'file' ? `<span class="cl-file"><input name="${k}" type="file" accept="image/*"><button type="button" data-cl="unsign">เอาลายเซ็นออก</button></span>`
                            : `<input name="${k}" type="${type}" placeholder="${esc(ph)}">`}</label>`;
            dlg.innerHTML = `<div class="cl-wrap">
                <div class="cl-top"><h2>📄 บันทึกข้อความ</h2><button type="button" data-cl-close aria-label="ปิด">✕</button></div>
                <div class="cl-body"><form class="cl-form" autocomplete="off">${FIELDS.map(field).join('')}
                    <div class="cl-actions"><button type="button" class="is-primary" data-cl="print">🖨️ พิมพ์ / บันทึกเป็น PDF</button><button type="button" data-cl="copy">📋 คัดลอกข้อความ</button><button type="button" data-cl="clear">ล้างฟอร์ม</button><span class="cl-msg" role="status"></span></div></form>
                    <div class="cl-stage"><div class="cl-fit"><div class="cl-paper"></div></div><p class="cl-warn" hidden>⚠ เนื้อหายาวเกิน 1 หน้า A4 — ลดข้อความให้พอดีหนึ่งหน้า</p></div></div></div>`;
            document.body.append(dlg);
            dlg.querySelector('.cl-form').addEventListener('input', e => { if (e.target.name && e.target.type !== 'file') { state.v[e.target.name] = e.target.value; refresh(); } });
            dlg.querySelector('.cl-form').addEventListener('change', async e => {
                if (e.target.name !== 'signature' || !e.target.files[0]) return;
                try { state.v.signature = await readImage(e.target.files[0]); refresh(); } catch (error) { dlg.querySelector('.cl-msg').textContent = error.message; }
            });
            if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (dlg.open) fit(); }).observe(dlg.querySelector('.cl-stage'));
            dlg.addEventListener('click', async e => {
                if (e.target.closest('[data-cl-close]') || e.target === dlg) return dlg.close();
                const act = e.target.closest('[data-cl]')?.dataset.cl;
                const msg = dlg.querySelector('.cl-msg');
                if (act === 'print') printable();
                if (act === 'unsign') { delete state.v.signature; dlg.querySelector('[name=signature]').value = ''; refresh(); }
                if (act === 'copy') {
                    try { await navigator.clipboard.writeText(plain(build(state.v))); msg.textContent = '✓ คัดลอกแล้ว'; } catch { msg.textContent = 'คัดลอกไม่ได้ — ใช้ปุ่มพิมพ์แทน'; }
                }
                if (act === 'clear' && confirm('ล้างข้อมูลที่กรอกทั้งหมด?')) { state.v = fresh(); fill(); refresh(); }
            });
        }
        fill();
        dlg.showModal();
        refresh();
    }
    document.addEventListener('click', e => { if (e.target.closest('#gwClarification')) open(); });
})();
