// หน้าต่างดูตัวอย่างรายงานก่อนสร้างจริง (Report Preview & Staging) — แสดงเลขที่ฉบับ, รายชื่อ/ยอดทุกเคสที่จะอยู่ในรายงาน, ช่องชื่อผู้จัดทำ
// ปุ่ม 2 แบบ: "ฉบับร่าง" (ดาวน์โหลดได้ ไม่เปลี่ยนสถานะเคส ไม่บันทึกฉบับ) / "ยืนยันสร้างรายงาน" (บันทึกฉบับ + เปลี่ยนสถานะเคส + ผูกเลขที่ฉบับ)
// ใช้งาน: window.ClaimReportPreview.show({ data, format, each, onRun(mode, creator) })  — data = ผลของ /api/history/claim-summary { mode:'preview' }
(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = v => Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
    const KEY = 'claimReportCreator';
    const remembered = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
    const remember = name => { try { localStorage.setItem(KEY, name); } catch { /* ใช้ต่อได้แม้เก็บไม่ได้ */ } };

    function show({ data, format, each, onRun }) {
        const rows = data.rows || [];
        const teams = [...new Set(rows.map(r => r.team || '-'))];
        const dialog = Object.assign(document.createElement('dialog'), { className: 'hcp' });
        const sub = team => rows.filter(r => (r.team || '-') === team).reduce((n, r) => n + r.opd + r.ipd + r.dental, 0);
        const files = each ? teams.length : 1;
        dialog.innerHTML = `<form method="dialog" class="hcp-form">
            <header class="hcp-head"><div><h3>🧾 ตัวอย่างรายงาน — ก่อนสร้างจริง</h3>
                <p>ยังไม่มีการเปลี่ยนสถานะเคสจนกว่าจะกด “ยืนยันสร้างรายงาน”</p></div>
                <button type="button" class="hcp-x" data-act="close" aria-label="ปิด">×</button></header>
            <div class="hcp-meta">
                <span>เลขที่ฉบับ <b class="hcp-no">${esc(data.nextReportNo)}</b>${files > 1 ? ` <small>(และฉบับถัดไปอีก ${files - 1} ฉบับ — แยกตามบริษัท ${files} ไฟล์)</small>` : ''}</span>
                <span>จำนวนเคส <b>${rows.length.toLocaleString('th-TH')}</b></span>
                <span>ยอดรวมทั้งหมด <b>${money(data.total)}</b> บาท</span>
                <span>รูปแบบไฟล์ <b>${esc(String(format).toUpperCase())}</b></span>
            </div>
            ${each ? `<div class="hcp-teams">${teams.map(t => `<span>${esc(t)}: <b>${money(sub(t))}</b></span>`).join('')}</div>` : ''}
            <div class="hcp-table"><table><thead><tr><th>เคส</th><th>พนักงาน</th><th>บริษัท</th><th>วันที่</th><th>อาการ</th><th class="n">OPD</th><th class="n">IPD</th><th class="n">ทันตกรรม</th><th class="n">รวม</th></tr></thead>
                <tbody>${rows.map(r => `<tr><td>#${esc(r.caseKey)}</td><td>${esc(r.name)}<small>${esc(r.insuranceId)}</small></td><td>${esc(r.team)}</td><td>${esc(r.date)}</td><td>${esc(r.symptom)}</td>
                    <td class="n">${money(r.opd)}</td><td class="n">${money(r.ipd)}</td><td class="n">${money(r.dental)}</td><td class="n"><b>${money(r.opd + r.ipd + r.dental)}</b></td></tr>`).join('')}</tbody></table></div>
            <label class="hcp-creator">ชื่อผู้จัดทำรายงาน <small>(จำเป็นเมื่อกดยืนยันสร้างรายงาน)</small><input name="creator" maxlength="80" autocomplete="name" placeholder="เช่น ชื่อ-นามสกุลผู้ทำรายงาน" value="${esc(remembered())}"></label>
            <p class="hcp-error" role="alert" hidden></p>
            <footer class="hcp-actions">
                <button type="button" data-act="draft"><b>ทดลองดาวน์โหลด (ฉบับร่าง)</b><small>ได้ไฟล์ไปดูก่อน — ไม่เปลี่ยนสถานะเคส ไม่บันทึกฉบับ</small></button>
                <button type="button" data-act="confirm" class="is-main"><b>ยืนยันสร้างรายงานและอัปเดตสถานะ</b><small>บันทึกฉบับ · ดาวน์โหลดไฟล์จริง · เปลี่ยนเคสเป็น “ส่งเอกสารเคลมแล้ว รอรับเงินคืน”</small></button>
                <button type="button" data-act="close"><b>ยกเลิก</b></button>
            </footer></form>`;
        document.body.appendChild(dialog);
        const creator = dialog.querySelector('[name=creator]'), error = dialog.querySelector('.hcp-error');
        dialog.addEventListener('close', () => dialog.remove());
        dialog.addEventListener('click', event => {
            const act = event.target.closest('[data-act]')?.dataset.act;
            if (event.target === dialog || act === 'close') return dialog.close();
            if (!act) return;
            const name = creator.value.trim();
            if (act === 'confirm' && !name) { error.textContent = 'กรุณากรอกชื่อผู้จัดทำรายงานก่อนยืนยันสร้างรายงาน'; error.hidden = false; creator.focus(); return; }
            if (name) remember(name);
            dialog.close();
            onRun(act, name);
        });
        dialog.showModal();
    }
    window.ClaimReportPreview = { show };
})();
