// มุมมอง "ผัง Flow chart" (กล่อง + ลูกศร + ข้อสี่เหลี่ยมข้าวหลามตัด + สายคู่ขนาน + วนกลับ) ของแท็บติดตามขั้นตอนที่พักใหม่
// จัดด้วย Flexbox/Grid ล้วน (ไม่มี absolute / ไม่วัดตำแหน่งด้วย JS) · ปุ่มใช้ data-step / data-add / data-decision ชุดเดียวกับมุมมองรายการ
// ใช้งาน: window.AccFlowChart.html(build, { esc, thDate }) → HTML ของผังหนึ่งยูนิต
(() => {
    const SIDE_TAGS = [
        ['⇉ ทำไปพร้อมกัน', s => s.kind !== 'rework' && s.kind !== 'cancel'],
        ['↩ วนแก้สัญญา (ส่งกลับเจ้าของบ้าน → ส่งส่วนกลางอีกครั้ง)', s => s.kind === 'rework' || s.kind === 'cancel']
    ];

    function html(b, { esc, thDate }) {
        const { room, side } = b;
        const box = s => {
            const gap = s.date && s.gap != null ? `<span class="fc-gap${s.gap < 0 ? ' is-bad' : s.gap >= 14 ? ' is-slow' : ''}" title="จาก “${esc(s.from)}”">⏱ +${s.gap < 0 ? '?' : s.gap} วัน</span>` : '';
            const tag = s.virtual ? 'div' : 'button';
            const attrs = s.virtual ? '' : ` type="button" data-step="${esc(s.id)}" data-no="${room.no}" title="กดเพื่อกำหนดวันที่ / แนบหลักฐาน"`;
            return `<${tag}${attrs} class="fc-box ${s.date ? 'is-done' : 'is-todo'}${s.kind === 'rework' ? ' is-rework' : ''}${s.kind === 'cancel' ? ' is-cancel' : ''}">
                <b class="fc-label">${s.kind === 'rework' ? '↩ ' : s.kind === 'cancel' ? '✖ ' : ''}${esc(s.label)}</b>
                ${s.date ? `<span class="fc-date">${esc(thDate(s.date))}</span><small>${esc(s.text)}</small>` : '<span class="fc-date is-empty">ยังไม่มีวันที่</span>'}
                ${s.note ? `<small class="fc-note">📝 ${esc(s.note)}</small>` : ''}
                ${s.virtual ? '' : s.files.length ? `<span class="fc-clip">📎 ${s.files.length} หลักฐาน</span>` : '<span class="fc-clip is-none">＋ แนบหลักฐาน</span>'}
                ${gap}</${tag}>`;
        };
        const plus = (after, lane = 'main') => `<button type="button" class="fc-plus" data-add="${esc(after)}" data-lane="${lane}" data-no="${room.no}" title="เพิ่มขั้นตอนเสริมตรงนี้">＋</button>`;
        const diamond = () => {
            const rounds = b.rework.filter(s => /ส่งกลับให้เจ้าของบ้าน/.test(s.label)).length;
            return `<span class="fc-dec"><button type="button" class="fc-diamond${rounds ? ' has-rework' : ''}" data-decision="${room.no}" title="กดเพื่อเพิ่มรอบแก้สัญญา"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,2 98,50 50,98 2,50"/></svg><span>สัญญา<br>ต้องแก้ไข?</span></button><i class="fc-yes">ใช่ ↓ ${rounds ? rounds + ' รอบ' : ''}</i></span>`;
        };
        const main = b.cancelled ? b.main.slice(0, Math.max(0, b.main.findIndex(m => m.id === 'dL')) + 1) : b.main;
        const cols = main.map((m, i) => {
            const sides = side.get(m.id) || [];
            const decision = m.id === 'dL' ? `<span class="fc-arrow">${b.cancelled ? '→' : 'ไม่ →'}</span>${diamond()}` : '';
            const groups = SIDE_TAGS.map(([tag, pick]) => [tag, sides.filter(pick)]).filter(g => g[1].length).map(([tag, list]) => {
                const rw = list[0].kind === 'rework' || list[0].kind === 'cancel';
                return `<div class="fc-side${rw ? ' is-rw' : ''}"><span class="fc-side-tag">${tag}</span>${list.map(s => `<div class="fc-side-item">${box(s)}${s.kind === 'rework' && /ส่งสัญญาให้ส่วนกลางอีกครั้ง/.test(s.label) ? '<span class="fc-loopback">↺ วนกลับไปตรวจสัญญาที่ส่วนกลาง</span>' : ''}</div>`).join('')}</div>`;
            }).join('');
            const lead = i ? '<span class="fc-arrow">→</span>' : '<span class="fc-start">เริ่ม</span><span class="fc-arrow">→</span>';
            return `<div class="fc-col"><div class="fc-row">${lead}${box(m)}${decision}${b.cancelled && m.id === 'dL' ? '' : plus(m.id)}</div><div class="fc-sides">${groups}</div></div>`;
        }).join('');
        return `<div class="fc-chart">${cols}${b.cancelled ? '' : '<span class="fc-end">เซ็นสัญญา ✔</span>'}</div>`;
    }
    window.AccFlowChart = { html };
})();
