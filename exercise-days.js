/* หน้าบันทึก "ออกกำลังกายทั่วไป" และ "ฟิตเนสรายเดือน" แบบใหม่ (โหลดต่อจากสคริปต์หลักใน exercise.html)
   - แต่ละครั้งเป็นการ์ดของตัวเอง: กดที่กรอบรูปในการ์ดเพื่อเลือกไฟล์ได้เลย + วันที่ + รายละเอียด
   - จำนวนครั้ง = จำนวนวันของเดือน (30/31) ต้องส่งครบอย่างน้อย 15 ครั้งตามกติกาเดิม
   - รูปแสดงเต็มทั้งรูป (ไม่ครอบตัด) กดแว่นขยายเพื่อดูขนาดใหญ่
   - ย่อรูปในเครื่องก่อนส่ง (ด้านยาวสุด 1600px) รูปจากมือถือขนาดใหญ่จึงอัปโหลดได้
   - เอากิจกรรม 30 วัน และแถบปุ่มด้านล่างออกจากหน้าพนักงาน */
(() => {
  const BILL_SLOT = 99;
  const MIN_DAYS = 15;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const monthDays = () => {
    const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  };
  const toIso = text => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text || ''); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

  // ---------------------------------------------------------------- เอากิจกรรม 30 วัน / แถบปุ่มล่าง ออก
  const activityIndex = PROGRESS_FORMS.findIndex(f => f.key === 'activity');
  if (activityIndex >= 0) PROGRESS_FORMS.splice(activityIndex, 1);
  document.querySelector('#menuCard > .actions')?.remove();
  document.querySelector('.btn-join')?.remove();
  $('activityProgressCard')?.remove();
  window.updateActivity30DashboardCopy = () => {};

  // ---------------------------------------------------------------- สไตล์การ์ดรายครั้ง
  document.head.insertAdjacentHTML('beforeend', `<style>
    .dx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:12px;margin-bottom:18px}
    .dx-card{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid rgba(72,186,255,.55);border-radius:13px;background:#09223b;min-width:0}
    .dx-card.done{border-color:var(--green);background:rgba(22,90,67,.45)}
    .dx-card.dirty{border-color:var(--gold);box-shadow:0 0 0 1px rgba(245,196,90,.25)}
    .dx-card header{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
    .dx-card header b{color:var(--gold2);font-size:15px}
    .dx-card.done header b{color:#a9f3c9}
    .dx-card header small{color:var(--muted);font-size:11px;text-align:right}
    .dx-shots{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .dx-shot{display:flex;flex-direction:column;min-width:0;border:1px dashed rgba(120,200,255,.6);border-radius:10px;background:#061627;overflow:hidden}
    .dx-shot.has{border-style:solid}
    .dx-shot.pending{border-color:var(--gold)}
    .dx-pick{display:grid;place-items:center;aspect-ratio:3/4;cursor:pointer;text-align:center;color:#b9e6ff;font-size:12px;line-height:1.4;padding:4px}
    .dx-pick img{display:block;width:100%;height:100%;object-fit:contain}
    .dx-pick input{display:none}
    .dx-pick:hover{background:rgba(72,186,255,.08)}
    .dx-cap{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 6px;border-top:1px solid rgba(120,200,255,.25);color:#d7eafd;font-size:10.5px}
    .dx-shot.pending .dx-cap{color:var(--gold2)}
    .dx-zoom{border:1px solid rgba(120,200,255,.45);border-radius:6px;background:transparent;color:#d7eafd;font:inherit;font-size:11px;padding:1px 6px;cursor:zoom-in}
    .dx-card input[type=date],.dx-card input[type=text]{width:100%;padding:8px 9px;border:1px solid rgba(72,186,255,.56);border-radius:9px;background:#071b31;color:#fff;font:14px inherit;min-width:0}
    .dx-card label.dx-field{display:grid;gap:3px;color:var(--gold2);font-size:11.5px;font-weight:bold}
    .dx-help{margin:0 0 12px;color:var(--muted);font-size:13px}
    /* ความคืบหน้า: เหลือ 2 แบบฟอร์ม → 2 กล่องเต็มแถว ขนาดใหญ่ขึ้น (มือถือ 1 กล่องต่อแถว) */
    #menuCard .progress-summary.progress-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    #menuCard .form-progress-card{gap:16px;padding:20px}
    #menuCard .progress-card-icon{flex-basis:46px;width:46px;height:46px;font-size:24px}
    #menuCard .progress-card-copy b{font-size:18px}
    #menuCard .progress-card-copy small{font-size:12.5px}
    #menuCard .progress-state{font-size:12px;padding:5px 10px}
    #menuCard .progress-card-body{grid-template-columns:116px minmax(0,1fr);gap:20px}
    #menuCard .mini-ring{width:112px;height:112px}
    #menuCard .mini-ring:before{inset:10px}
    #menuCard .mini-ring strong{font-size:22px}
    #menuCard .metrics{gap:11px}
    #menuCard .metric-line{grid-template-columns:24px minmax(0,1fr) auto;gap:10px;font-size:14px}
    #menuCard .metric-line b{font-size:14px}
    #menuCard .progress-note{font-size:13px}
    #menuCard .progress-action{padding:12px 14px;font-size:15px}
    /* ตัวอย่างภาพ: แสดงเต็มทั้งภาพ (เดิมครอบเป็นสี่เหลี่ยมจัตุรัส ตัดข้อความซ้าย-ขวา) · กดขยายได้ใหญ่ขึ้น */
    .sample{aspect-ratio:4/3;display:grid;place-items:center}
    .sample img{width:100%;height:100%;object-fit:contain}
    .sample:hover img{transform:none;filter:brightness(1.08)}
    .modal img{max-width:min(1400px,100%);max-height:88vh;object-fit:contain}
    @media(max-width:720px){
      .modal{padding:10px}
      .modal button{top:10px;right:10px}
      #menuCard .progress-summary.progress-grid{grid-template-columns:1fr}
      #menuCard .form-progress-card{padding:16px}
      #menuCard .progress-card-body{grid-template-columns:88px minmax(0,1fr);gap:14px}
      #menuCard .mini-ring{width:86px;height:86px}
      #menuCard .mini-ring strong{font-size:18px}
      #menuCard .metric-line,#menuCard .metric-line b{font-size:12.5px}
    }
  </style>`);

  // ช่องกรอกเดิม (เลือกครั้ง → กรอกด้านล่าง) ไม่ใช้แล้ว: ซ่อนไว้ เหลือใบเสร็จ ลายเซ็น และปุ่มบันทึก
  ['activityDate', 'activityDay', 'activityDescription', 'exerciseImage', 'generalActivityDate', 'generalActivityDay', 'generalActivityDescription', 'generalExerciseImage']
    .forEach(id => { const box = $(id)?.closest('.form-row, .upload-row, .input-group'); if (box) box.hidden = true; });
  document.querySelectorAll('.activity-form .upload-row, .activity-form .form-row, #activityDescriptionGroup').forEach(el => { el.hidden = true; el.style.display = 'none'; });
  document.querySelector('.general-notice')?.remove();
  document.querySelectorAll('.general-steps span')[0]?.replaceChildren('1. กดกรอบรูปในการ์ดของครั้งนั้น');

  // ---------------------------------------------------------------- สถานะของหน้า
  const state = { data: null, count: 0, files: new Map(), previews: new Map(), dates: new Map(), descs: new Map(), dirty: new Set() };
  function resetPending() {
    state.previews.forEach(url => URL.revokeObjectURL(url));
    state.files.clear(); state.previews.clear(); state.dates.clear(); state.descs.clear(); state.dirty.clear();
  }

  function cardMarkup(day) {
    const data = state.data || {};
    const general = isExerciseForm();
    const a = day * 2 - 1, b = day * 2;
    const src = slot => state.previews.get(slot) || (data.images || [])[slot - 1] || '';
    const date = state.dates.has(day) ? state.dates.get(day) : toIso((data.dates || [])[day - 1]);
    const desc = state.descs.has(day) ? state.descs.get(day) : (data.details || [])[day - 1] || '';
    const done = src(a) && src(b) && date;
    const pending = state.files.has(a) || state.files.has(b) || state.dirty.has(day);
    const shot = (slot, label) => {
      const url = src(slot), isPending = state.files.has(slot);
      return `<div class="dx-shot${url ? ' has' : ''}${isPending ? ' pending' : ''}">
        <label class="dx-pick" title="กดเพื่อเลือกรูป${url ? 'ใหม่แทนที่' : ''}"><input type="file" accept="image/*" data-slot="${slot}">
          ${url ? `<img src="${esc(url)}" alt="${esc(label)} ครั้งที่ ${day}" loading="lazy">` : `<span>${label}<br><small>แตะเพื่อเลือกรูป</small></span>`}</label>
        <div class="dx-cap"><span>${isPending ? 'รอบันทึก' : url ? label.replace(/^\S+\s/, '') : 'ยังไม่มีรูป'}</span>${url ? `<button type="button" class="dx-zoom" data-zoom="${esc(url)}" aria-label="ดูรูปขนาดใหญ่">🔍</button>` : ''}</div>
      </div>`;
    };
    const status = pending ? 'ยังไม่ได้บันทึก' : done ? '✓ ครบแล้ว' : src(a) || src(b) || date ? 'ยังไม่ครบ' : 'ยังไม่อัปโหลด';
    return `<article class="dx-card${done && !pending ? ' done' : ''}${pending ? ' dirty' : ''}" data-day="${day}">
      <header><b>ครั้งที่ ${day}</b><small>${status}</small></header>
      <div class="dx-shots">${shot(a, '📸 รูปออกกำลังกาย')}${shot(b, '🤳 รูปเซลฟี่')}</div>
      <label class="dx-field">วันที่ออกกำลังกาย<input type="date" data-date="${day}" value="${esc(date)}"></label>
      ${general ? `<label class="dx-field">ระบุการออกกำลังกาย / ระยะเวลา<input type="text" maxlength="500" data-desc="${day}" value="${esc(desc)}" placeholder="เช่น เดินเร็ว 30 นาที"></label>` : ''}
    </article>`;
  }

  function render() {
    const grid = formField('dayGrid');
    if (!grid) return;
    grid.className = 'dx-grid';
    grid.innerHTML = Array.from({ length: state.count }, (_, i) => cardMarkup(i + 1)).join('');
    const help = formField('help');
    if (help) { help.className = 'dx-help'; help.textContent = `บันทึกได้ทุกวันของเดือนนี้ (สูงสุด ${state.count} ครั้ง) ต้องส่งครบอย่างน้อย ${MIN_DAYS} ครั้ง — กดที่กรอบรูปในการ์ดเพื่อเลือกรูป กรอกวันที่ แล้วกดบันทึกด้านล่าง`; }
    const billHint = $('fitnessBillHint');
    if (billHint && isFitnessForm()) billHint.textContent = state.data?.bill ? '✓ แนบใบเสร็จค่าฟิตเนสแล้ว · เลือกรูปใหม่เพื่อแทนที่ได้' : 'แนบ 1 รูปต่อเดือน';
  }
  const rerenderCard = day => { const card = document.querySelector(`.dx-card[data-day="${day}"]`); if (card) card.outerHTML = cardMarkup(day); };

  // แทน renderDays เดิม (เรียกหลังโหลดข้อมูลจากหลังบ้าน)
  window.renderDays = function (data) {
    if (isFitnessForm() || isExerciseForm()) {
      resetPending();
      state.data = data && !data.error ? data : { images: [], dates: [], details: [] };
      state.count = Number(state.data.maxDays) || monthDays();
      activityState = { images: state.data.images || [], dates: state.data.dates || [] };
      render();
      if (isFitnessForm()) renderOneUploadPreview?.($('fitnessBillImage'), state.data.bill || '');
      return;
    }
  };
  // ไม่ใช้การเลือกครั้งแบบเดิมแล้ว
  window.selectDay = () => {};
  window.renderUploadPreviews = () => { if (isFitnessForm()) renderOneUploadPreview?.($('fitnessBillImage'), state.data?.bill || ''); };

  // ---------------------------------------------------------------- เลือกรูป / กรอกข้อมูลในการ์ด
  document.addEventListener('change', event => {
    const input = event.target;
    if (input.matches?.('.dx-pick input[type=file]')) {
      const file = input.files && input.files[0];
      const slot = Number(input.dataset.slot);
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast('กรุณาเลือกไฟล์รูปภาพ'); return; }
      if (state.previews.has(slot)) URL.revokeObjectURL(state.previews.get(slot));
      state.files.set(slot, file);
      state.previews.set(slot, URL.createObjectURL(file));
      rerenderCard(Math.ceil(slot / 2));
    }
  });
  document.addEventListener('input', event => {
    const t = event.target;
    const day = Number(t.dataset?.date || t.dataset?.desc);
    if (!day) return;
    (t.dataset.date ? state.dates : state.descs).set(day, t.value);
    state.dirty.add(day);
    const card = t.closest('.dx-card');
    if (card) { card.classList.add('dirty'); card.classList.remove('done'); card.querySelector('header small').textContent = 'ยังไม่ได้บันทึก'; }
  });
  document.addEventListener('click', event => {
    const zoom = event.target.closest?.('[data-zoom]');
    if (zoom) { event.preventDefault(); showPreview(zoom.dataset.zoom); }
  });

  // ย่อรูปก่อนส่ง: ด้านยาวสุด 1600px, JPEG 85% (รูป PNG โปร่งใสพื้นขาว)
  async function compress(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('เปิดรูปภาพไม่ได้')); im.src = url; });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------------------------------------------------------------- บันทึกทุกอย่างที่เปลี่ยนในครั้งเดียว
  const baseSubmit = window.submitActivity;
  window.submitActivity = async function (event) {
    if (!(isFitnessForm() || isExerciseForm())) return baseSubmit.apply(this, arguments);
    if (event) event.preventDefault();
    const fitness = isFitnessForm(), button = formField('saveButton'), status = formField('saveStatus');
    const show = (message, type = '') => { if (status) { status.textContent = message; status.className = 'save-status ' + type; } if ($('loadingDetail')) $('loadingDetail').textContent = message; };
    const billInput = $('fitnessBillImage');
    const billFile = fitness && billInput && billInput.files && billInput.files[0];
    const slots = [...state.files.keys()].sort((x, y) => x - y);
    const days = [...state.dirty].sort((x, y) => x - y);
    const hasSignature = signatureHasInk;
    if (!slots.length && !days.length && !billFile && !hasSignature) { show('ยังไม่มีข้อมูลใหม่ให้บันทึก — กดกรอบรูปในการ์ด กรอกวันที่ หรือวาดลายเซ็นก่อน'); return; }
    showLoading('กำลังบันทึก ' + activeFormLabel() + '…', 'โปรดอย่าปิดหน้าจอ');
    const label = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = '⏳ กำลังบันทึก…'; }
    try {
      let n = 0;
      for (const slot of slots) {
        n += 1;
        show(`กำลังอัปโหลดรูป ${n}/${slots.length} (ครั้งที่ ${Math.ceil(slot / 2)})…`);
        const result = await api('uploadSingleImage', currentUser, await compress(state.files.get(slot)), slot, activeFormType);
        if (apiFailed(result)) throw new Error(result);
        state.files.delete(slot);
      }
      if (days.length) {
        show('กำลังบันทึกวันที่และรายละเอียด…');
        const list = Array(state.count).fill('');
        days.forEach(day => {
          const date = state.dates.has(day) ? state.dates.get(day) : toIso((state.data?.dates || [])[day - 1]);
          const desc = state.descs.has(day) ? state.descs.get(day) : (state.data?.details || [])[day - 1] || '';
          list[day - 1] = fitness ? { date } : { date, desc };
        });
        const result = await api('finalizeForm', currentUser.fullname, list, activeFormType);
        if (apiFailed(result)) throw new Error(result);
      }
      if (billFile) {
        show('กำลังอัปโหลดใบเสร็จค่าฟิตเนส…');
        const result = await api('uploadSingleImage', currentUser, await compress(billFile), BILL_SLOT, activeFormType);
        if (apiFailed(result)) throw new Error(result);
        clearSelectedFile?.(billInput);
      }
      if (hasSignature) {
        show('กำลังอัปโหลดลายเซ็น…');
        const result = await api('uploadSignatureImage', currentUser, formField('signature').toDataURL('image/png'), activeFormType);
        if (apiFailed(result)) throw new Error(result);
        clearSignature(true);
      }
      await api('autoUpdateSummary', currentUser.fullname, activeFormType);
      show('✓ บันทึก' + activeFormLabel() + 'เรียบร้อย', 'ok');
      loadDays();
      refreshProgress();
    } catch (error) {
      show('✕ ' + ((error && error.message) || 'บันทึกไม่สำเร็จ') + ' — รูปที่ยังไม่ได้บันทึกยังค้างอยู่ในการ์ด กดบันทึกอีกครั้งได้', 'error');
      render();
    } finally {
      if (button) { button.disabled = false; button.textContent = label; }
      hideLoading();
    }
  };
})();
