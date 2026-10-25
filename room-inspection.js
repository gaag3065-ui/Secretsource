// ตรวจรับห้องพัก: แบบตรวจรับ (11 หมวด) + รายงานรูปภาพ → PDF
// ย้ายมาจากระบบในเครื่อง "ตรวจสอบที่พัก" (127.0.0.1:4173) — ข้อมูล/รูป/PDF อยู่ที่แบ็กเอนด์ /api/room-inspection
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/room-inspection${path}`;
    const LOCAL_KEY = kind => `room-inspection:${kind}`;

    // ---------------------------------------------------------------- ข้อมูลแบบฟอร์ม (ลำดับต้องตรงกับ pdf-tools/checklist_form.py)
    const EQUIPMENT = {
        'อุปกรณ์ที่ต้องมี': ['ไมโครเวฟ', 'ตู้เย็น', 'เครื่องซักผ้า 7 กก.ขึ้นไป', 'โต๊ะรับประทานอาหารและเก้าอี้'],
        'อุปกรณ์เพิ่มเติม': ['ทีวี', 'เตารีดและโต๊ะรีดผ้า', 'เตียงนอน 5 ฟุตขึ้นไป', 'ที่นอน 5 ฟุตขึ้นไป', 'ตู้เสื้อผ้าใหญ่', 'กล่องอินเทอร์เน็ต', 'โซฟา', 'อุปกรณ์ครัว']
    };
    const SECTIONS = {
        'ประตูและระบบความปลอดภัย': ['ประตูทางเข้าห้อง', 'วงกบประตู', 'ลูกบิดประตู', 'กุญแจใช้งานได้', 'Digital Lock', 'Door Closer', 'Door Stopper', 'ตาแมว', 'สัญญาณเตือนไฟไหม้ (ถ้ามี)'],
        'ระบบไฟฟ้า': ['ตู้เบรกเกอร์', 'ป้ายระบุวงจรไฟฟ้า', 'เบรกเกอร์ทุกตัวทำงานปกติ', 'ไฟห้องนั่งเล่น', 'ไฟห้องนอน', 'ไฟห้องน้ำ', 'ไฟครัว', 'ไฟระเบียง', 'ไฟซ่อนฝ้า', 'ไฟฉุกเฉิน (ถ้ามี)', 'ปลั๊กไฟทุกจุด', 'สวิตช์ไฟทุกจุด', 'เปิดไฟทุกดวงพร้อมกัน', 'ไม่มีไฟกระพริบ'],
        'เครื่องปรับอากาศ': ['ตัวเครื่องครบ', 'รีโมทครบ', 'เปิดเครื่องได้', 'ปรับอุณหภูมิได้', 'ลมแรงปกติ', 'ความเย็นปกติ', 'ไม่มีน้ำหยด', 'ไม่มีเสียงดังผิดปกติ', 'ไม่มีการสั่น', 'ไม่มีฝุ่นสะสมมาก', 'ไม่มีเชื้อรา', 'ไม่มีกลิ่นอับ'],
        'ตู้เย็น': ['ตัวเครื่องภายนอก', 'ประตูตู้เย็น', 'ยางขอบประตู', 'ไฟภายใน', 'ชั้นวางครบ', 'ช่องแช่เย็น', 'ช่องแช่แข็ง', 'ระบบละลายน้ำแข็ง', 'ไม่มีน้ำรั่ว', 'ไม่มีสนิม', 'ไม่มีเสียงดังผิดปกติ'],
        'ระบบน้ำและประปา': ['มิเตอร์น้ำ', 'แรงดันน้ำ', 'น้ำร้อน', 'น้ำเย็น', 'ก๊อกน้ำทุกจุด', 'อ่างล้างหน้า', 'อ่างล้างจาน', 'ฝักบัว', 'สายฉีดชำระ', 'วาล์วน้ำ'],
        'ห้องน้ำ': ['โถสุขภัณฑ์', 'ฝารองนั่ง', 'ระบบกดชักโครก', 'สายฉีดชำระ', 'ฝักบัว', 'ฉากกั้นอาบน้ำ', 'กระจก', 'ชั้นวางของ', 'พัดลมดูดอากาศ', 'ท่อน้ำทิ้ง', 'Floor Drain', 'เครื่องทำน้ำอุ่น'],
        'ห้องครัว': ['ซิงค์ล้างจาน', 'ก๊อกน้ำ', 'ตู้เก็บของ', 'บานพับตู้', 'หน้าเคาน์เตอร์', 'เตาไฟฟ้า', 'เครื่องดูดควัน', 'ไมโครเวฟ', 'เตาแก๊ส'],
        'เฟอร์นิเจอร์': ['เตียง', 'หัวเตียง', 'ที่นอน', 'ตู้เสื้อผ้า', 'โต๊ะทำงาน', 'เก้าอี้', 'โซฟา', 'โต๊ะกลาง', 'โต๊ะข้างเตียง', 'ชั้นวางทีวี', 'ผ้าม่าน', 'รางผ้าม่าน', 'เครื่องซักผ้า', 'พัดลมเพดาน'],
        'ผนัง ฝ้า เพดาน และพื้น': ['รอยแตกร้าว', 'สีหลุดลอก', 'คราบน้ำรั่ว', 'คราบเชื้อรา', 'ฝ้าเพดาน', 'พื้นกระเบื้อง', 'พื้นไม้', 'กลิ่นอับ'],
        'หน้าต่างและระเบียง': ['กระจก', 'ตัวล็อก', 'ยางกันน้ำ', 'รางเลื่อน', 'ประตูระเบียง', 'พื้นระเบียง', 'ท่อระบายน้ำระเบียง'],
        'ระบบสาธารณูปโภคและความปลอดภัย': ['ระบบล็อคประตูห้อง', 'ยิม / สระว่ายน้ำ / รปภ. 24 ชม.', 'กล้องวงจรปิด / ประตูหนีไฟ / ถังดับเพลิง', 'บริเวณรอบที่พักปลอดภัยกลางวันและกลางคืน']
    };
    const EQUIPMENT_OPTIONS = ['มี ใช้งานได้', 'มี แต่ใช้งานไม่ได้', 'ไม่มี'];
    const defaultMaps = () => [
        { workplace: 'Mireka Tower, Colombo, Sri Lanka', residence: '', distance: '', duration: '', caption: 'เส้นทางจากสถานที่ทำงานแห่งที่ 1 มายังที่พัก', mapImage: '' },
        { workplace: 'Orion City, Colombo, Sri Lanka', residence: '', distance: '', duration: '', caption: 'เส้นทางจากสถานที่ทำงานแห่งที่ 2 มายังที่พัก', mapImage: '' }
    ];
    const blankPhoto = () => ({ url: '', category: '', title: '', description: '' });

    const state = { tab: 'checklist', photos: [blankPhoto()], maps: defaultMaps(), dirty: false, images: new Map() };
    const form = $('riChecklist');

    // ---------------------------------------------------------------- ช่วยเหลือทั่วไป
    let toastTimer = null;
    function toast(text, isError = false) {
        const node = $('riToast');
        node.textContent = text;
        node.className = `ri-toast is-visible${isError ? ' is-error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { node.className = 'ri-toast'; }, isError ? 6000 : 3200);
    }
    function busy(text) { $('riBusyText').textContent = text || ''; $('riBusy').hidden = !text; }

    async function request(path, options = {}) {
        const response = await window.authFetch(api(path), { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        if (response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.message || `ทำรายการไม่สำเร็จ (${response.status})`);
            return data;
        }
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดตเป็นเวอร์ชันที่มีหน้าตรวจรับห้องพัก (git pull แล้วรีสตาร์ทหลังบ้าน)');
        if (!response.ok) throw new Error(`ทำรายการไม่สำเร็จ (${response.status})`);
        return response;
    }

    async function download(path, payload, busyText) {
        busy(busyText);
        try {
            const response = await request(path, { method: 'POST', body: JSON.stringify(payload) });
            const disposition = response.headers.get('content-disposition') || '';
            const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
            const name = match ? decodeURIComponent(match[1]) : 'เอกสาร.pdf';
            const url = URL.createObjectURL(await response.blob());
            const link = Object.assign(document.createElement('a'), { href: url, download: name });
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            toast(`ดาวน์โหลด ${name} แล้ว`);
        } finally { busy(''); }
    }

    /** รูปที่อัปโหลดต้องส่ง token จึงดึงเป็น blob แล้วใช้ object URL แสดงผล */
    function imageUrl(url) {
        if (!url) return Promise.resolve('');
        if (!state.images.has(url)) {
            state.images.set(url, window.authFetch(api(`/file?url=${encodeURIComponent(url)}`))
                .then(response => { if (!response.ok) throw new Error(); return response.blob(); })
                .then(blob => URL.createObjectURL(blob))
                .catch(() => { state.images.delete(url); return ''; }));
        }
        return state.images.get(url);
    }
    function hydrateImages(root) {
        root.querySelectorAll('img[data-src]').forEach(async img => {
            const src = await imageUrl(img.dataset.src);
            if (src) img.src = src; else img.replaceWith(Object.assign(document.createElement('span'), { textContent: 'เปิดรูปไม่ได้' }));
        });
    }

    async function upload(file) {
        if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) throw new Error(`${file.name}: รูป HEIC ต้องแปลงเป็น JPG ก่อน`);
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        const result = await request('/upload', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl }) });
        return result.url;
    }

    function markDirty() { state.dirty = true; $('riSaved').textContent = 'มีการแก้ไขที่ยังไม่ได้บันทึก'; }
    function markSaved(savedAt) {
        state.dirty = false;
        $('riSaved').textContent = savedAt ? `บันทึกล่าสุด ${new Date(savedAt).toLocaleString('th-TH')}` : 'ยังไม่ได้บันทึก';
    }
    window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

    // ---------------------------------------------------------------- แบบตรวจรับ
    function renderSections() {
        let html = '';
        for (const [title, items] of Object.entries(EQUIPMENT)) {
            html += `<section class="ri-card"><h2>${esc(title)}</h2><div class="ri-equip">${items.map(item => `<label class="ri-note">${esc(item)}<select name="equipment.${esc(item)}"><option value="">เลือกสถานะ</option>${EQUIPMENT_OPTIONS.map(option => `<option>${option}</option>`).join('')}</select></label>`).join('')}</div></section>`;
        }
        Object.entries(SECTIONS).forEach(([title, items], index) => {
            const no = index + 1;
            html += `<section class="ri-card">
                <div class="ri-sec-head"><h2>${no}. ${esc(title)}</h2><button type="button" data-check-all="${no}">ติ๊กทั้งหมด</button></div>
                <div class="ri-checks">${items.map(item => `<label class="ri-check"><input type="checkbox" name="check.${no}" value="${esc(item)}"> ${esc(item)}</label>`).join('')}</div>
                ${title === 'เครื่องปรับอากาศ' ? '<div class="ri-grid ri-grid-2"><label>แจ้งวันล้างแอร์ล่าสุด<input type="date" name="air.lastClean"></label><label>แจ้งวันเติมน้ำยาแอร์ล่าสุด<input type="date" name="air.lastRefill"></label></div>' : ''}
                <label class="ri-note">รายละเอียดข้อมูลเพิ่มเติม<textarea name="note.${no}" rows="2"></textarea></label>
            </section>`;
        });
        $('riSections').innerHTML = html;
    }

    const formatThousands = value => {
        const cleaned = String(value ?? '').replaceAll(',', '').replace(/[^0-9.]/g, '');
        if (!cleaned) return '';
        const [whole, ...rest] = cleaned.split('.');
        const grouped = (whole || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return rest.length ? `${grouped}.${rest.join('')}` : grouped;
    };

    function checklistData() {
        const out = {};
        new FormData(form).forEach((value, key) => {
            if (key.startsWith('check.')) (out[key] ||= []).push(value);
            else out[key] = value;
        });
        return out;
    }
    function fillChecklist(data) {
        form.reset();
        form.querySelectorAll('.ri-sig input[type=hidden]').forEach(input => { input.value = ''; });
        Object.entries(data || {}).forEach(([key, value]) => {
            form.querySelectorAll(`[name="${CSS.escape(key)}"]`).forEach(field => {
                if (field.type === 'checkbox') field.checked = [].concat(value).includes(field.value);
                else field.value = field.hasAttribute('data-number') ? formatThousands(value) : value ?? '';
            });
        });
        renderSignatures();
    }

    form.addEventListener('input', event => {
        if (event.target.hasAttribute('data-number')) event.target.value = formatThousands(event.target.value);
        markDirty();
    });
    form.addEventListener('change', markDirty);
    // สกุลเงิน: พิมพ์ช่องเดียว ช่องเงินอื่นที่ยังว่างจะได้สกุลเดียวกันอัตโนมัติ
    form.addEventListener('input', event => {
        const field = event.target;
        if (!field.classList.contains('ri-unit')) return;
        field.value = field.value.toUpperCase().replace(/\s+/g, '');
        if (!field.hasAttribute('data-currency')) return;
        form.querySelectorAll('.ri-unit[data-currency]').forEach(other => {
            if (other !== field && (!other.value || other.dataset.auto === '1')) { other.value = field.value; other.dataset.auto = '1'; }
        });
        delete field.dataset.auto;
    });
    $('riSections').addEventListener('click', event => {
        const button = event.target.closest('[data-check-all]');
        if (!button) return;
        const boxes = [...form.querySelectorAll(`input[name="check.${button.dataset.checkAll}"]`)];
        const value = !boxes.every(box => box.checked);
        boxes.forEach(box => { box.checked = value; });
        button.textContent = value ? 'ล้างทั้งหมด' : 'ติ๊กทั้งหมด';
        markDirty();
    });

    // ---------------------------------------------------------------- รูปลายเซ็น (3 ผู้ลงนาม)
    function renderSignatures() {
        form.querySelectorAll('.ri-sig').forEach(box => {
            const input = box.querySelector('input[type=hidden]');
            const url = input.value;
            box.querySelectorAll(':scope > :not(input)').forEach(node => node.remove());
            box.insertAdjacentHTML('beforeend', `<span class="ri-sig-label">รูปลายเซ็น</span>
                ${url ? `<button type="button" class="ri-thumb" data-sig-open title="กดเพื่อดูขนาดใหญ่"><img data-src="${esc(url)}" alt="ลายเซ็น"></button>` : '<div class="ri-thumb is-empty">ยังไม่มีรูปลายเซ็น</div>'}
                <div class="ri-sig-actions">
                    <label class="ri-pick">${url ? 'เปลี่ยนรูป' : 'อัปโหลดรูปลายเซ็น'}<input type="file" accept="image/jpeg,image/png,image/webp" data-sig-upload></label>
                    ${url ? '<button type="button" class="ri-btn ri-btn-ghost ri-btn-sm ri-btn-danger" data-sig-remove>ลบรูป</button>' : ''}
                </div>`);
            hydrateImages(box);
        });
    }
    form.addEventListener('change', async event => {
        const input = event.target.closest('[data-sig-upload]');
        if (!input || !input.files[0]) return;
        event.stopPropagation();
        const hidden = input.closest('.ri-sig').querySelector('input[type=hidden]');
        busy('กำลังอัปโหลดรูปลายเซ็น...');
        try { hidden.value = await upload(input.files[0]); markDirty(); }
        catch (error) { toast(error.message, true); }
        finally { busy(''); renderSignatures(); }
    }, true);
    form.addEventListener('click', event => {
        const box = event.target.closest('.ri-sig');
        if (!box) return;
        const hidden = box.querySelector('input[type=hidden]');
        if (event.target.closest('[data-sig-open]')) showImage(hidden.value);
        else if (event.target.closest('[data-sig-remove]')) { hidden.value = ''; markDirty(); renderSignatures(); }
    });

    // ---------------------------------------------------------------- รายงานรูปภาพ
    function renderPhotos() {
        const grid = $('riPhotoGrid');
        grid.innerHTML = state.photos.map((photo, index) => `<article class="ri-photo">
                <div class="ri-photo-head"><span>รูปที่ ${index + 1}</span><button type="button" class="ri-btn ri-btn-ghost ri-btn-sm ri-btn-danger" data-remove="${index}" ${state.photos.length === 1 ? 'disabled' : ''}>ลบ</button></div>
                ${photo.url ? `<button type="button" class="ri-thumb" data-open="${index}"><img data-src="${esc(photo.url)}" alt="รูปที่ ${index + 1}"></button>` : '<div class="ri-thumb is-empty">ยังไม่ได้เลือกรูป</div>'}
                <label class="ri-pick">${photo.url ? 'เปลี่ยนรูป' : 'เลือกรูปภาพ'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload="${index}"></label>
                <textarea data-desc="${index}" placeholder="คำบรรยายใต้รูป">${esc(photo.description)}</textarea>
                <div class="ri-photo-actions">
                    <button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-move="-1" data-i="${index}" ${index === 0 ? 'disabled' : ''}>↑ ขึ้น</button>
                    <button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-move="1" data-i="${index}" ${index === state.photos.length - 1 ? 'disabled' : ''}>↓ ลง</button>
                </div>
            </article>`).join('');
        const count = state.photos.filter(photo => photo.url).length;
        $('riPhotoCount').textContent = `${count} รูป · หน้าละ 3 รูปใน PDF`;
        hydrateImages(grid);
    }

    $('riPhotoGrid').addEventListener('change', async event => {
        const input = event.target.closest('[data-upload]');
        if (!input || !input.files.length) return;
        const index = Number(input.dataset.upload);
        const files = [...input.files];
        input.disabled = true;
        busy(`กำลังอัปโหลด 0/${files.length} รูป...`);
        try {
            for (let n = 0; n < files.length; n++) {
                busy(`กำลังอัปโหลด ${n + 1}/${files.length} รูป...`);
                const item = { url: await upload(files[n]), category: '', title: files[n].name.replace(/\.[^.]+$/, ''), description: n === 0 ? state.photos[index].description : '' };
                if (n === 0) state.photos[index] = item; else state.photos.splice(index + n, 0, item);
            }
            markDirty();
        } catch (error) { toast(error.message, true); }
        finally { busy(''); renderPhotos(); }
    });
    $('riPhotoGrid').addEventListener('input', event => {
        const field = event.target.closest('[data-desc]');
        if (field) { state.photos[Number(field.dataset.desc)].description = field.value; markDirty(); }
    });
    $('riPhotoGrid').addEventListener('click', async event => {
        const open = event.target.closest('[data-open]');
        if (open) return showImage(state.photos[Number(open.dataset.open)].url);
        const remove = event.target.closest('[data-remove]');
        if (remove) { state.photos.splice(Number(remove.dataset.remove), 1); markDirty(); return renderPhotos(); }
        const move = event.target.closest('[data-move]');
        if (move) {
            const i = Number(move.dataset.i), j = i + Number(move.dataset.move);
            [state.photos[i], state.photos[j]] = [state.photos[j], state.photos[i]];
            markDirty(); renderPhotos();
        }
    });

    function renderMaps() {
        const host = $('riMaps');
        host.innerHTML = state.maps.map((slot, index) => `<article class="ri-map">
                <h3>เส้นทางสถานที่ทำงานแห่งที่ ${index + 1}</h3>
                <div class="ri-grid">
                    <label>สถานที่ทำงาน<input data-map="${index}" data-k="workplace" value="${esc(slot.workplace)}"></label>
                    <label>ที่พัก<input data-map="${index}" data-k="residence" value="${esc(slot.residence)}"></label>
                    <label>ระยะทาง<input data-map="${index}" data-k="distance" value="${esc(slot.distance)}" placeholder="เช่น 5.4 กม."></label>
                    <label>เวลาเดินทาง<input data-map="${index}" data-k="duration" value="${esc(slot.duration)}" placeholder="เช่น 18 นาที"></label>
                </div>
                <div class="ri-map-actions">
                    <button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-route="${index}">เปิดเส้นทางใน Google Maps ↗</button>
                    <label class="ri-pick">${slot.mapImage ? 'เปลี่ยนภาพเส้นทาง' : 'อัปโหลดภาพเส้นทาง'}<input type="file" accept="image/jpeg,image/png,image/webp" data-map-upload="${index}"></label>
                </div>
                ${slot.mapImage ? `<button type="button" class="ri-thumb" data-open-map="${index}"><img data-src="${esc(slot.mapImage)}" alt="แผนที่ ${index + 1}"></button>` : '<div class="ri-thumb is-empty">ยังไม่มีภาพเส้นทาง</div>'}
                <label class="ri-note">คำอธิบายใต้ภาพ<input data-map="${index}" data-k="caption" value="${esc(slot.caption)}"></label>
            </article>`).join('');
        hydrateImages(host);
    }

    $('riMaps').addEventListener('input', event => {
        const field = event.target.closest('[data-map]');
        if (field) { state.maps[Number(field.dataset.map)][field.dataset.k] = field.value; markDirty(); }
    });
    $('riMaps').addEventListener('change', async event => {
        const input = event.target.closest('[data-map-upload]');
        if (!input || !input.files[0]) return;
        busy('กำลังอัปโหลดภาพเส้นทาง...');
        try { state.maps[Number(input.dataset.mapUpload)].mapImage = await upload(input.files[0]); markDirty(); }
        catch (error) { toast(error.message, true); }
        finally { busy(''); renderMaps(); }
    });
    $('riMaps').addEventListener('click', event => {
        const route = event.target.closest('[data-route]');
        if (route) {
            const slot = state.maps[Number(route.dataset.route)];
            if (!slot.workplace.trim() || !slot.residence.trim()) return toast('กรุณากรอกสถานที่ทำงานและที่พัก', true);
            window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(slot.workplace)}&destination=${encodeURIComponent(slot.residence)}&travelmode=driving`, '_blank', 'noopener,noreferrer');
            return;
        }
        const open = event.target.closest('[data-open-map]');
        if (open) showImage(state.maps[Number(open.dataset.openMap)].mapImage);
    });
    ['riProject', 'riInspectionDate'].forEach(id => $(id).addEventListener('input', markDirty));

    const photoData = () => ({
        project: $('riProject').value,
        inspectionDate: $('riInspectionDate').value,
        photos: state.photos.filter(photo => photo.url),
        mapSlots: state.maps
    });
    function fillPhotos(data) {
        $('riProject').value = data?.project || '';
        $('riInspectionDate').value = data?.inspectionDate || '';
        state.photos = data?.photos?.length ? data.photos.map(photo => ({ ...blankPhoto(), ...photo })) : [blankPhoto()];
        state.maps = data?.mapSlots?.length ? data.mapSlots.map((slot, i) => ({ ...defaultMaps()[i] || defaultMaps()[0], ...slot })) : defaultMaps();
        renderPhotos(); renderMaps();
    }

    // ---------------------------------------------------------------- lightbox
    const lightbox = $('riLightbox');
    async function showImage(url) {
        const src = await imageUrl(url);
        if (!src) return toast('เปิดรูปไม่ได้', true);
        lightbox.querySelector('img').src = src;
        lightbox.showModal();
    }
    lightbox.querySelector('.ri-lightbox-close').addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });

    // ---------------------------------------------------------------- บันทึก / ดาวน์โหลด
    async function save(kind) {
        const data = kind === 'checklist' ? checklistData() : photoData();
        try { localStorage.setItem(LOCAL_KEY(kind), JSON.stringify(data)); } catch { /* พื้นที่เต็ม — ข้าม */ }
        const result = await request(`/draft/${kind}`, { method: 'PUT', body: JSON.stringify({ data }) });
        markSaved(result.savedAt);
        toast('บันทึกแล้ว');
    }

    const actions = {
        'save-checklist': () => save('checklist'),
        'save-photos': () => save('photos'),
        'pdf-checklist': async () => { await save('checklist'); await download('/pdf', { kind: 'checklist', data: checklistData() }, 'กำลังสร้าง PDF แบบตรวจรับ...'); },
        'pdf-photos': async () => {
            const data = photoData();
            if (!data.photos.length) return toast('ยังไม่มีรูปในรายงาน', true);
            await save('photos');
            await download('/pdf', { kind: 'photos', data }, `กำลังสร้าง PDF รายงานรูปภาพ (${data.photos.length} รูป)...`);
        },
        'xlsx-photos': () => download('/xlsx', { kind: 'photos', data: photoData() }, 'กำลังสร้างไฟล์ Excel...'),
        recheck: () => checkHealth(true),
        'add-photo': () => { state.photos.push(blankPhoto()); markDirty(); renderPhotos(); },
        'clear-checklist': () => { if (confirm('ล้างข้อมูลแบบตรวจรับทั้งหมด? (ข้อมูลที่บันทึกไว้จะยังอยู่จนกว่าจะกดบันทึก)')) { fillChecklist({}); markDirty(); } },
        'clear-photos': () => { if (confirm('ล้างรายงานรูปภาพทั้งหมด? (รูปที่อัปโหลดแล้วยังเก็บอยู่ในระบบ)')) { fillPhotos(null); markDirty(); } }
    };
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button || !actions[button.dataset.action]) return;
        button.disabled = true;
        try { await actions[button.dataset.action](); }
        catch (error) { toast(error.message || 'ทำรายการไม่สำเร็จ', true); }
        finally { button.disabled = false; }
    });

    // ---------------------------------------------------------------- แท็บ
    function showTab(tab) {
        state.tab = tab;
        document.querySelectorAll('.ri-tabs [data-tab]').forEach(button => button.classList.toggle('is-on', button.dataset.tab === tab));
        $('tab-checklist').hidden = tab !== 'checklist';
        $('tab-photos').hidden = tab !== 'photos';
        try { history.replaceState(null, '', `#${tab}`); } catch { /* iframe sandbox */ }
    }
    document.querySelector('.ri-tabs').addEventListener('click', event => {
        const button = event.target.closest('[data-tab]');
        if (button) showTab(button.dataset.tab);
    });

    // ---------------------------------------------------------------- ความพร้อมสร้าง PDF ของเครื่องหลังบ้าน
    async function checkHealth(force = false) {
        try {
            const result = await request(`/health${force ? '?refresh=1' : ''}`);
            $('riHealth').hidden = result.ready;
            $('riHealthList').innerHTML = (result.problems || []).map(problem => `<li>${esc(problem)}</li>`).join('');
            if (force && result.ready) toast('เครื่องหลังบ้านพร้อมสร้าง PDF แล้ว');
        } catch (error) {
            if (force) toast(error.message, true);
        }
    }

    // ---------------------------------------------------------------- เริ่มต้น
    async function loadDraft(kind) {
        try {
            const result = await request(`/draft/${kind}`);
            if (result.data) return { data: result.data, savedAt: result.savedAt };
        } catch (error) { toast(`โหลดข้อมูลที่บันทึกไว้ไม่ได้: ${error.message}`, true); }
        try { const local = JSON.parse(localStorage.getItem(LOCAL_KEY(kind)) || 'null'); if (local) return { data: local, savedAt: null }; } catch { /* ignore */ }
        return { data: null, savedAt: null };
    }

    (async () => {
        renderSections();
        renderSignatures();
        renderPhotos(); renderMaps();
        showTab(location.hash === '#photos' ? 'photos' : 'checklist');
        const [checklist, photos] = await Promise.all([loadDraft('checklist'), loadDraft('photos')]);
        if (checklist.data) fillChecklist(checklist.data);
        if (photos.data) fillPhotos(photos.data);
        checkHealth();
        const latest = [checklist.savedAt, photos.savedAt].filter(Boolean).sort().pop();
        markSaved(latest);
    })();
})();
