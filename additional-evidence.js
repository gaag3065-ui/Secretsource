// รูปเพิ่มเติม (Additional): เลือกได้ครั้งละหลายรูป ใช้ได้ทั้งฟอร์มเปิดเคส หน้าต่างอัปเดตผล และปุ่ม + ในการ์ดเคส
// เก็บลงคอลัมน์เอกสารแนบเป็นบรรทัด "ADDITIONAL|ลิงก์" — ชื่อไฟล์ตามรูปแบบเดิม + "_Additional_ลำดับ"
(() => {
    if (window.AdditionalEvidence) return;
    const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    const style = document.createElement('style');
    style.textContent = `
.ae-zone { display: grid; gap: 8px; margin-top: 8px; }
.ae-add { display: inline-flex; align-items: center; gap: 6px; width: max-content; padding: 7px 14px; border: 1px dashed #7a8aa0; border-radius: 8px;
    background: #f8fafc; color: #1f3a5f; font-size: 13px; font-weight: 600; cursor: pointer; }
.ae-add:hover { background: #eef4ff; border-color: #2563eb; }
.ae-list { display: flex; flex-wrap: wrap; gap: 8px; }
.ae-list:empty { display: none; }
.ae-thumb { position: relative; width: 74px; height: 74px; border: 1px solid #d0d5dd; border-radius: 8px; overflow: hidden; background: #fff; }
.ae-thumb img { width: 100%; height: 100%; object-fit: cover; }
.ae-thumb button { position: absolute; top: 2px; right: 2px; width: 22px; height: 22px; border: 0; border-radius: 50%; background: rgba(180,35,24,.9);
    color: #fff; font-size: 13px; line-height: 22px; cursor: pointer; padding: 0; }
.ae-thumb span { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,.65); color: #fff; font-size: 10px; text-align: center; }
.history-evidence-grid.has-additional { grid-template-columns: repeat(auto-fill, minmax(90px, 124px)) !important; justify-content: start; }
.history-evidence-item.ae-tile { display: flex; flex-direction: column; }
.ae-tile-button { flex: 1; min-height: 84px; display: grid; place-items: center; gap: 2px; border: 2px dashed #98a2b3; border-radius: 10px; background: #fcfcfd;
    color: #475467; font-size: 26px; font-weight: 700; cursor: pointer; }
.ae-tile-button small { font-size: 11px; font-weight: 600; }
.ae-tile-button:hover { border-color: #2563eb; color: #2563eb; background: #eef4ff; }
.ae-tile-button.is-busy { cursor: wait; opacity: .7; }`;
    document.head.appendChild(style);

    const zoneFiles = new WeakMap();
    const filesOf = zone => zoneFiles.get(zone) || [];

    function render(zone) {
        const list = zone.querySelector('.ae-list');
        list.querySelectorAll('img').forEach(img => URL.revokeObjectURL(img.src));
        list.replaceChildren(...filesOf(zone).map((file, index) => {
            const box = document.createElement('div');
            box.className = 'ae-thumb';
            box.title = file.name;
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = `รูปเพิ่มเติม ${index + 1}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '×';
            remove.title = 'เอารูปนี้ออก';
            remove.addEventListener('click', () => {
                zoneFiles.set(zone, filesOf(zone).filter((_, i) => i !== index));
                render(zone);
            });
            const tag = document.createElement('span');
            tag.textContent = `Additional ${index + 1}`;
            box.append(img, remove, tag);
            return box;
        }));
    }

    // ช่องเลือกรูปเพิ่มเติมในฟอร์ม (ใช้ event delegation จึงทำงานแม้ฟอร์มโหลดทีหลัง)
    document.addEventListener('change', event => {
        const input = event.target.closest?.('.ae-zone .ae-input');
        if (!input) return;
        const zone = input.closest('.ae-zone');
        const picked = [...input.files].filter(file => TYPES.includes(file.type));
        if (picked.length < input.files.length) alert('รองรับเฉพาะรูป JPG, PNG และ WEBP');
        zoneFiles.set(zone, [...filesOf(zone), ...picked].slice(0, 30));
        input.value = '';
        render(zone);
    });

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    const extensionOf = file => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
        || (file.name.split('.').pop() || 'jpg').toLowerCase());
    const safeName = name => String(name || 'ไม่ทราบชื่อ').trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');

    // อัปโหลดทีละรูปตามลำดับ — buildName(ลำดับ, นามสกุลไฟล์) คืนชื่อไฟล์
    async function upload(files, { caseId = ' ', employeeName = '', buildName }) {
        const urls = [];
        for (const [index, file] of files.entries()) {
            const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/upload-drive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId, fileName: buildName(index + 1, extensionOf(file)), employeeName, fileData: await readFile(file) })
            });
            const result = await response.json().catch(() => ({}));
            if (result.needAuth && result.authUrl) window.open(result.authUrl, '_blank', 'noopener,noreferrer');
            if (!response.ok || !result.success || !result.fileUrl) {
                throw new Error(result.message || `อัปโหลดรูปเพิ่มเติมรูปที่ ${index + 1} ไม่สำเร็จ`);
            }
            urls.push(result.fileUrl);
        }
        return urls;
    }

    function parse(raw) {
        return String(raw || '').split(/\r?\n/).map(line => /^ADDITIONAL\|(.+)$/i.exec(line.trim())?.[1]?.trim()).filter(Boolean);
    }

    // ปุ่ม + ข้างกล่องรูปในการ์ดเคส: เลือกหลายรูป → อัปโหลด → ต่อท้ายแถวในชีต → เรียก onDone(ข้อความเอกสารแนบใหม่)
    function cardTile({ caseId, rowNumber, employeeName, existingCount = 0, onDone }) {
        const section = document.createElement('div');
        section.className = 'history-evidence-item ae-tile';
        const title = document.createElement('div');
        title.className = 'history-evidence-title';
        title.textContent = 'เพิ่มรูป (Additional)';
        const button = document.createElement('label');
        button.className = 'ae-tile-button';
        button.title = 'เพิ่มรูปเพิ่มเติม เลือกได้หลายรูป';
        button.innerHTML = '＋<small>เลือกได้หลายรูป</small>';
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = TYPES.join(',');
        input.multiple = true;
        input.hidden = true;
        button.appendChild(input);
        button.addEventListener('click', event => event.stopPropagation());
        input.addEventListener('change', async () => {
            const files = [...input.files].filter(file => TYPES.includes(file.type)).slice(0, 30);
            input.value = '';
            if (!files.length) return;
            if (!confirm(`เพิ่มรูปเพิ่มเติม ${files.length} รูป ให้เคส ${caseId} ใช่ไหม?`)) return;
            button.classList.add('is-busy');
            button.innerHTML = '⏳<small>กำลังอัปโหลด…</small>';
            try {
                const numeric = String(caseId).replace(/[^0-9]/g, '') || String(caseId).trim();
                const urls = await upload(files, {
                    caseId: String(caseId).trim(),
                    employeeName,
                    buildName: (n, ext) => `AdditionalCase_${numeric}_${safeName(employeeName)}_${existingCount + n}.${ext}`
                });
                const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/history/add-evidence`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheetRowIndex: rowNumber, CaseIdNew: String(caseId).trim(), urls })
                });
                const result = await response.json().catch(() => ({}));
                if (response.status === 404 && !result.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)');
                if (!response.ok || !result.success) throw new Error(result.message || 'บันทึกรูปเพิ่มเติมไม่สำเร็จ');
                onDone?.(result.DocumentsAttached);
            } catch (error) {
                alert(error.message);
                button.classList.remove('is-busy');
                button.innerHTML = '＋<small>เลือกได้หลายรูป</small>';
                button.appendChild(input);
            }
        });
        section.append(title, button);
        return section;
    }

    window.AdditionalEvidence = {
        files: zone => (zone ? filesOf(zone) : []),
        clear: zone => { if (zone) { zoneFiles.set(zone, []); render(zone); } },
        upload, parse, cardTile, safeName
    };
})();
