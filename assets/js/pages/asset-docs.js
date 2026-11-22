// เอกสารทรัพย์สิน: "ขอขึ้นทะเบียนทรัพย์สิน" / "แจ้งทรัพย์สินชำรุด ทำลายทรัพย์สิน"
// รายการทรัพย์สิน + รูป (เลือกทั้งโฟลเดอร์ OneDrive) ระบุว่าแต่ละรูปคืออะไร → จัดเรียงตามไฟล์ตัวอย่าง → PDF / XLSX ที่ /api/asset-docs
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/asset-docs${path}`;
    const LOCAL_KEY = kind => `asset-docs:${kind}`;

    // คอลัมน์ตามไฟล์ตัวอย่าง (ลำดับต้องตรงกับ asset_docs.py)
    const COLUMNS = {
        register: [['location', 'Location'], ['sublocation', 'Sublocation'], ['company', 'บริษัท'], ['purchaseDate', 'วันที่ซื้อทรัพย์สิน', 'date'],
            ['receiveDate', 'วันที่รับทรัพย์สิน', 'date'], ['assetNo', 'หมายเลขทรัพย์สิน'], ['description', 'รายละเอียดทรัพย์สิน'], ['serial', 'Serial Number (S/N)'],
            ['amount', 'Amount'], ['price', 'ราคา/ชิ้น'], ['holder', 'ชื่อ/ตำแหน่งผู้ถือครอง'], ['unit', 'หน่วยงานผู้ถือครอง'], ['shop', 'ร้านค้าที่สั่งซื้อ'], ['note', 'หมายเหตุ']],
        dispose: [['location', 'Location'], ['sublocation', 'Sublocation'], ['company', 'บริษัท'], ['assetNo', 'หมายเลขทรัพย์สิน'], ['description', 'รายละเอียดทรัพย์สิน'],
            ['status', 'สถานะของทรัพย์สินที่ต้องการระบุ'], ['amount', 'จำนวน'], ['price', 'ราคา'], ['holder', 'ชื่อจริง/ตำแหน่งผู้ถือครอง'], ['unit', 'หน่วยงานผู้ถือครอง'], ['note', 'หมายเหตุ']]
    };
    // ค่าที่เติมให้แถวใหม่ (ช่อง "ข้อมูลเอกสาร")
    const DEFAULT_FIELDS = {
        register: [['location', 'Location', 'เช่น HD / Holiday'], ['sublocation', 'Sublocation', 'เช่น ชั้น 5 ห้อง 509'], ['company', 'บริษัท', 'เช่น 365'],
            ['purchaseDate', 'วันที่ซื้อทรัพย์สิน', '', 'date'], ['receiveDate', 'วันที่รับทรัพย์สิน', '', 'date'], ['holder', 'ชื่อ/ตำแหน่งผู้ถือครอง', 'เช่น พี่สอง/MG'],
            ['unit', 'หน่วยงานผู้ถือครอง', 'เช่น CALL'], ['shop', 'ร้านค้าที่สั่งซื้อ', 'เช่น FAMILY COMPUTER']],
        dispose: [['location', 'Location', 'เช่น HD'], ['sublocation', 'Sublocation', 'เช่น ชั้น 5 ห้อง 509'], ['company', 'บริษัท', 'เช่น 365'],
            ['status', 'สถานะของทรัพย์สิน', 'เช่น Defect (Worn out)'], ['holder', 'ชื่อจริง/ตำแหน่งผู้ถือครอง', 'เช่น พี่สอง'], ['unit', 'หน่วยงานผู้ถือครอง', 'เช่น CALL']]
    };
    const TITLES = {
        register: { title: 'ขึ้นทะเบียนทรัพย์สิน', eyebrow: 'ASSET REGISTRATION · ขอขึ้นทะเบียนทรัพย์สิน', file: 'ขอขึ้นทะเบียนทรัพย์สิน', document: 'ใบสั่งซื้อและใบส่งสินค้า' },
        dispose: { title: 'ทำลายทรัพย์สิน (ชำรุด)', eyebrow: 'ASSET DISPOSAL · แจ้งทรัพย์สินชำรุด ทำลายทรัพย์สิน', file: 'แจ้งทรัพย์สินชำรุด_และ_ทำลายทรัพย์สิน', document: 'เอกสารประกอบ' }
    };
    const today = () => new Date().toISOString().slice(0, 10);
    const blankDoc = kind => ({ date: today(), defaults: kind === 'dispose' ? { status: 'Defect (Worn out)', amount: '1', price: '-' } : { amount: '1', serial: '-', assetNo: 'ไม่ระบุหมายเลขทรัพย์สิน' }, items: [], photos: [] });

    const state = { kind: new URLSearchParams(location.search).get('type') === 'dispose' ? 'dispose' : 'register', doc: null, dirty: false, images: new Map() };

    // ---------------------------------------------------------------- ตัวช่วย
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
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)');
        if (!response.ok) throw new Error(`ทำรายการไม่สำเร็จ (${response.status})`);
        return response;
    }
    function markDirty() { state.dirty = true; $('riSaved').textContent = 'มีการแก้ไขที่ยังไม่ได้บันทึก'; }
    function markSaved(savedAt) { state.dirty = false; $('riSaved').textContent = savedAt ? `บันทึกล่าสุด ${new Date(savedAt).toLocaleString('th-TH')}` : 'ยังไม่ได้บันทึก'; }
    window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

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
    /** ย่อรูปด้านยาวไม่เกิน 2000px ก่อนอัปโหลด (โฟลเดอร์อาจมีหลายสิบรูป) */
    async function shrink(file, max = 2000) {
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
            const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            return canvas.toDataURL('image/jpeg', 0.88);
        } catch { return null; }
    }
    async function upload(file) {
        if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) throw new Error(`${file.name}: รูป HEIC ต้องแปลงเป็น JPG ก่อน`);
        const dataUrl = await shrink(file) || await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        return (await request('/upload', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl }) })).url;
    }

    // ---------------------------------------------------------------- ข้อมูลเอกสาร + รายการ
    function renderDefaults() {
        const doc = state.doc;
        $('adDefaults').innerHTML = `<label>วันที่เอกสาร (ใช้ตั้งชื่อไฟล์)<input type="date" data-doc="date" value="${esc(doc.date)}"></label>`
            + DEFAULT_FIELDS[state.kind].map(([key, label, hint, type]) =>
                `<label>${esc(label)}<input ${type === 'date' ? 'type="date"' : ''} data-default="${key}" value="${esc(doc.defaults[key] || '')}" placeholder="${esc(hint || '')}"></label>`).join('');
    }
    const newItem = () => Object.fromEntries(COLUMNS[state.kind].map(([key]) => [key, state.doc.defaults[key] || '']));

    function renderItems() {
        const cols = COLUMNS[state.kind];
        const items = state.doc.items;
        $('adItems').innerHTML = `<thead><tr><th>${state.kind === 'register' ? 'NO.' : 'ลำดับ'}</th>${cols.map(([, label]) => `<th>${esc(label)}</th>`).join('')}<th></th></tr></thead>
            <tbody>${items.map((item, i) => `<tr><td class="ad-no">${i + 1}</td>${cols.map(([key, , type]) =>
                `<td><input ${type === 'date' ? 'type="date"' : ''} data-row="${i}" data-k="${key}" value="${esc(item[key])}"></td>`).join('')}
                <td><div class="ad-row-actions"><button type="button" data-copy="${i}" title="คัดลอกแถวนี้">⧉</button><button type="button" class="is-danger" data-del="${i}" title="ลบแถว">ลบ</button></div></td></tr>`).join('')
                || `<tr><td colspan="${cols.length + 2}" class="ad-no">ยังไม่มีรายการ — กด "+ เพิ่มแถว"</td></tr>`}</tbody>`;
        $('adItemCount').textContent = `${items.length} รายการ`;
    }

    // ---------------------------------------------------------------- รูปภาพ
    // ตัวเลือก "รูปนี้คือ": เอกสาร (เฉพาะขึ้นทะเบียน) / รายการทรัพย์สินแต่ละชื่อ / อื่น ๆ
    function itemNames() { return [...new Set(state.doc.items.map(item => String(item.description || '').trim()).filter(Boolean))]; }
    const kindValue = photo => photo.group === 'document' ? 'document' : photo.group === 'other' ? 'other' : photo.item ? `item:${photo.item}` : '';

    function renderPhotos() {
        const names = itemNames();
        const photos = state.doc.photos;
        const options = photo => {
            const current = kindValue(photo);
            const list = [['', '— เลือกว่ารูปนี้คืออะไร —'], ...(state.kind === 'register' ? [['document', `${TITLES.register.document} (เอกสาร)`]] : []),
                ...names.map(name => [`item:${name}`, `รูปสินค้า: ${name}`]),
                ...(photo.item && !names.includes(photo.item) ? [[`item:${photo.item}`, `รูปสินค้า: ${photo.item} (ไม่มีในรายการแล้ว)`]] : []),
                ['other', 'รูปอื่น ๆ']];
            return list.map(([value, label]) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`).join('');
        };
        $('adPhotoGrid').innerHTML = photos.map((photo, index) => `<article class="ri-photo ${photo.group === 'document' ? 'is-document' : ''} ${kindValue(photo) ? '' : 'is-unset'}">
                <div class="ri-photo-head"><span>รูปที่ ${index + 1}</span><button type="button" class="ri-btn ri-btn-ghost ri-btn-sm ri-btn-danger" data-remove="${index}">ลบ</button></div>
                <button type="button" class="ri-thumb" data-open="${index}"><img data-src="${esc(photo.url)}" alt="รูปที่ ${index + 1}"></button>
                <select class="ad-photo-kind" data-kind="${index}">${options(photo)}</select>
                <textarea data-caption="${index}" placeholder="คำบรรยายใต้รูป (ถ้ามี)">${esc(photo.caption)}</textarea>
                <div class="ri-photo-actions">
                    <button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-move="-1" data-i="${index}" ${index === 0 ? 'disabled' : ''}>↑ ขึ้น</button>
                    <button type="button" class="ri-btn ri-btn-ghost ri-btn-sm" data-move="1" data-i="${index}" ${index === photos.length - 1 ? 'disabled' : ''}>↓ ลง</button>
                </div>
            </article>`).join('') || '<p class="ri-hint">ยังไม่มีรูป — กด "เลือกทั้งโฟลเดอร์ (OneDrive)"</p>';
        const unset = photos.filter(photo => !kindValue(photo)).length;
        $('riPhotoCount').textContent = `${photos.length} รูป${unset ? ` · ยังไม่ระบุ ${unset} รูป` : ''}`;
        $('adArrangeHint').textContent = state.kind === 'register'
            ? 'จัดเรียงตามตัวอย่าง: ใบสั่งซื้อและใบส่งสินค้า → รูปสินค้าตามลำดับรายการในตาราง → รูปอื่น ๆ (ในไฟล์จะมีกล่องชื่อรายการเหนือรูป แถวละ 2 รูป)'
            : 'จัดเรียงตามตัวอย่าง: รูปทรัพย์สินตามลำดับรายการในตาราง → รูปอื่น ๆ (ในไฟล์จะมีกล่องชื่อรายการเหนือรูป แถวละ 2 รูป)';
        hydrateImages($('adPhotoGrid'));
    }

    async function addFiles(files) {
        const images = files
            .filter(file => /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name))
            .sort((a, b) => a.lastModified - b.lastModified || (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'th', { numeric: true }));
        const heic = files.filter(file => /\.hei[cf]$/i.test(file.name)).length;
        if (!images.length) return toast(heic ? `มีแต่รูป HEIC ${heic} รูป — ต้องแปลงเป็น JPG ก่อน` : 'ไม่พบรูปที่เลือก', true);
        if (images.length > 3 && !confirm(`พบรูป ${images.length} รูป${heic ? ` (ข้ามรูป HEIC ${heic} รูป)` : ''}\nเพิ่มทั้งหมดต่อท้าย?`)) return;
        const results = new Array(images.length);
        const failed = [];
        let next = 0, done = 0;
        busy(`กำลังอัปโหลด 0/${images.length} รูป...`);
        const worker = async () => {
            while (next < images.length) {
                const i = next++;
                try { results[i] = { url: await upload(images[i]), group: '', item: '', caption: '' }; }
                catch { failed.push(images[i].name); }
                busy(`กำลังอัปโหลด ${++done}/${images.length} รูป...`);
            }
        };
        try { await Promise.all([worker(), worker(), worker()]); }
        finally { state.doc.photos.push(...results.filter(Boolean)); markDirty(); busy(''); renderPhotos(); }
        const added = images.length - failed.length;
        if (failed.length) toast(`เพิ่มแล้ว ${added} รูป, ไม่สำเร็จ ${failed.length} รูป: ${failed.slice(0, 3).join(', ')}`, true);
        else toast(`เพิ่ม ${added} รูปแล้ว — เลือกว่าแต่ละรูปคืออะไร แล้วกด "จัดเรียงตามตัวอย่าง"`);
    }

    /** เรียงแบบไฟล์ตัวอย่าง: เอกสาร → รูปตามลำดับรายการในตาราง → อื่น ๆ → ยังไม่ระบุ (ภายในกลุ่มคงลำดับเดิม) */
    function arrange() {
        const names = itemNames();
        const rank = photo => photo.group === 'document' ? 0 : photo.group === 'item' && names.includes(photo.item) ? 1 + names.indexOf(photo.item)
            : photo.group === 'item' ? names.length + 1 : photo.group === 'other' ? names.length + 2 : names.length + 3;
        state.doc.photos = state.doc.photos.map((photo, index) => ({ photo, index }))
            .sort((a, b) => rank(a.photo) - rank(b.photo) || a.index - b.index).map(entry => entry.photo);
        markDirty(); renderPhotos();
        const unset = state.doc.photos.filter(photo => !kindValue(photo)).length;
        toast(unset ? `จัดเรียงแล้ว — ยังมี ${unset} รูปที่ยังไม่ระบุ (อยู่ท้ายสุด)` : 'จัดเรียงตามตัวอย่างแล้ว');
    }

    // ---------------------------------------------------------------- เหตุการณ์
    document.addEventListener('input', event => {
        const t = event.target;
        if (t.dataset.doc) { state.doc[t.dataset.doc] = t.value; markDirty(); }
        else if (t.dataset.default) { state.doc.defaults[t.dataset.default] = t.value; markDirty(); }
        else if (t.dataset.row !== undefined && t.dataset.k) { state.doc.items[Number(t.dataset.row)][t.dataset.k] = t.value; markDirty(); }
        else if (t.dataset.caption !== undefined) { state.doc.photos[Number(t.dataset.caption)].caption = t.value; markDirty(); }
    });
    // ชื่อรายการเปลี่ยน → อัปเดตตัวเลือก "รูปนี้คือ" (ตอนออกจากช่อง ไม่วาดใหม่ขณะพิมพ์)
    document.addEventListener('change', event => {
        const t = event.target;
        if (t.dataset.k === 'description') renderPhotos();
        if (t.dataset.kind !== undefined) {
            const photo = state.doc.photos[Number(t.dataset.kind)];
            const value = t.value;
            photo.group = value === 'document' ? 'document' : value === 'other' ? 'other' : value ? 'item' : '';
            photo.item = value.startsWith('item:') ? value.slice(5) : '';
            markDirty(); renderPhotos();
        }
    });
    $('adFolder').addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; addFiles(files); });
    $('adFiles').addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; addFiles(files); });

    $('adItems').addEventListener('click', event => {
        const copy = event.target.closest('[data-copy]'), del = event.target.closest('[data-del]');
        if (copy) { const i = Number(copy.dataset.copy); state.doc.items.splice(i + 1, 0, { ...state.doc.items[i] }); }
        else if (del) { if (!confirm('ลบแถวนี้?')) return; state.doc.items.splice(Number(del.dataset.del), 1); }
        else return;
        markDirty(); renderItems(); renderPhotos();
    });
    $('adPhotoGrid').addEventListener('click', async event => {
        const open = event.target.closest('[data-open]');
        if (open) return showImage(state.doc.photos[Number(open.dataset.open)].url);
        const remove = event.target.closest('[data-remove]');
        if (remove) { state.doc.photos.splice(Number(remove.dataset.remove), 1); markDirty(); return renderPhotos(); }
        const move = event.target.closest('[data-move]');
        if (move) {
            const i = Number(move.dataset.i), j = i + Number(move.dataset.move);
            [state.doc.photos[i], state.doc.photos[j]] = [state.doc.photos[j], state.doc.photos[i]];
            markDirty(); renderPhotos();
        }
    });

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
    async function save() {
        try { localStorage.setItem(LOCAL_KEY(state.kind), JSON.stringify(state.doc)); } catch { /* พื้นที่เต็ม */ }
        const result = await request(`/draft/${state.kind}`, { method: 'PUT', body: JSON.stringify({ data: state.doc }) });
        markSaved(result.savedAt);
    }
    /** ชื่อไฟล์แบบตัวอย่าง: 13_08_26_ขอขึ้นทะเบียนทรัพย์สิน_HD_365_CALL */
    function fileName() {
        const [y, m, d] = String(state.doc.date || today()).split('-');
        const first = state.doc.items[0] || {};
        const parts = state.kind === 'register' ? [first.location || state.doc.defaults.location, first.company || state.doc.defaults.company, first.unit || state.doc.defaults.unit] : [];
        return [`${d}_${m}_${String(y).slice(-2)}`, TITLES[state.kind].file, ...parts.map(v => String(v || '').trim()).filter(Boolean)]
            .join('_').replace(/[<>:"/\\|?*\s]+/g, '_');
    }
    function validate() {
        const items = state.doc.items.filter(item => Object.values(item).some(value => String(value || '').trim()));
        if (!items.length) throw new Error('ยังไม่มีรายการทรัพย์สิน');
        const missing = items.findIndex(item => !String(item.description || '').trim());
        if (missing >= 0) throw new Error(`แถวที่ ${missing + 1} ยังไม่ได้กรอกรายละเอียดทรัพย์สิน`);
        const unset = state.doc.photos.filter(photo => !kindValue(photo)).length;
        if (unset && !confirm(`มี ${unset} รูปที่ยังไม่ได้ระบุว่าคืออะไร — จะถูกจัดเป็น "รูปเพิ่มเติม" ต่อท้าย\nดาวน์โหลดต่อหรือไม่?`)) throw new Error('ยกเลิกแล้ว');
    }
    async function download(format) {
        validate();
        await save().catch(() => {});
        busy(format === 'pdf' ? `กำลังสร้าง PDF (${state.doc.photos.length} รูป)...` : 'กำลังสร้างไฟล์ XLSX...');
        try {
            const name = `${fileName()}.${format}`;
            const response = await request('/export', { method: 'POST', body: JSON.stringify({ kind: state.kind, format, fileName: name, data: state.doc }) });
            const url = URL.createObjectURL(await response.blob());
            const link = Object.assign(document.createElement('a'), { href: url, download: name });
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            toast(`ดาวน์โหลด ${name} แล้ว`);
        } finally { busy(''); }
    }

    const actions = {
        'add-item': () => { state.doc.items.push(newItem()); markDirty(); renderItems(); const inputs = $('adItems').querySelectorAll('tbody tr:last-child input'); inputs[0]?.focus(); },
        arrange,
        save: async () => { await save(); toast('บันทึกแล้ว'); },
        pdf: () => download('pdf'),
        xlsx: () => download('xlsx'),
        clear: () => { if (!confirm('ล้างเอกสารนี้ทั้งหมด? (รายการและรูปจะหายจากหน้านี้)')) return; state.doc = blankDoc(state.kind); markDirty(); renderAll(); }
    };
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button || !actions[button.dataset.action]) return;
        button.disabled = true;
        try { await actions[button.dataset.action](); }
        catch (error) { if (error.message !== 'ยกเลิกแล้ว') toast(error.message || 'ทำรายการไม่สำเร็จ', true); }
        finally { button.disabled = false; }
    });

    // ---------------------------------------------------------------- สลับประเภทเอกสาร / เริ่มต้น
    function renderAll() {
        const t = TITLES[state.kind];
        $('adTitle').textContent = t.title;
        $('adEyebrow').textContent = t.eyebrow;
        document.title = `${t.title} | GA Operations`;
        document.querySelectorAll('.ri-tabs [data-kind]').forEach(button => button.classList.toggle('is-on', button.dataset.kind === state.kind));
        renderDefaults(); renderItems(); renderPhotos();
    }
    async function loadKind(kind) {
        state.kind = kind;
        try { history.replaceState(null, '', `?type=${kind}`); } catch { /* iframe */ }
        let data = null, savedAt = null;
        try { const result = await request(`/draft/${kind}`); data = result.data; savedAt = result.savedAt; }
        catch (error) { toast(`โหลดข้อมูลที่บันทึกไว้ไม่ได้: ${error.message}`, true); }
        if (!data) { try { data = JSON.parse(localStorage.getItem(LOCAL_KEY(kind)) || 'null'); } catch { data = null; } }
        const blank = blankDoc(kind);
        state.doc = data ? { ...blank, ...data, defaults: { ...blank.defaults, ...(data.defaults || {}) }, items: data.items || [], photos: data.photos || [] } : blank;
        renderAll(); markSaved(savedAt);
    }
    document.querySelector('.ri-tabs').addEventListener('click', async event => {
        const button = event.target.closest('[data-kind]');
        if (!button || button.dataset.kind === state.kind) return;
        if (state.dirty) await save().catch(() => {});
        loadKind(button.dataset.kind);
    });

    loadKind(state.kind);
})();
