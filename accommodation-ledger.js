// ส่วนรายงานทะเบียนที่พัก (ใต้กล่องตึกในหน้า "จัดการห้องพักพนักงาน") — สไตล์แบบแดชบอร์ด TRANSIT
// ข้อมูล: /api/accommodation-ledger (ผังห้องพัก/ค่าน้ำค่าไฟรายยูนิต + สัญญาเช่า ย้ายมาจาก "ห้องพักปัจจุบัน")
// ไม่มีข้อมูลบุคคล — เตียง/ผู้พักนับเป็นจำนวนแยกบริษัทเท่านั้น
(() => {
    const host = document.getElementById('accommodationLedger');
    if (!host) return;

    const PALETTE = ['#e8452c', '#0e7c86', '#c98a12', '#3b4ba8', '#2f8a4a', '#b0346a', '#6a4fb3', '#d46a1f', '#1f6fb2', '#7a8a1e', '#a23b2a', '#127a66'];
    const UTIL = [['electric', 'ค่าไฟ', '#e8452c'], ['water', 'ค่าน้ำ', '#0e7c86'], ['internet', 'อินเทอร์เน็ต', '#3b4ba8'], ['other', 'อื่นๆ', '#9a968c']];
    const DAY = 24 * 60 * 60 * 1000;
    const state = { data: null, focus: '', sort: { key: 'building', asc: true } };

    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = value => Number(value || 0).toLocaleString('en-US');
    const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    const parseDate = text => text ? new Date(`${text}T00:00:00`) : null;
    const thDate = text => text ? parseDate(text).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';

    /** รหัสย่อ 3 ตัวของที่พัก (เช่น Elysian Residencies → ELY) — ใช้ตัวแรกของแต่ละคำ ถ้าคำน้อยใช้ตัวต้นของคำแรก */
    function makeCodes(names) {
        const used = new Set();
        const codes = {};
        for (const name of names) {
            const words = name.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
            const initials = words.map(word => word[0]).join('').toUpperCase();
            const candidates = [
                words.length >= 3 ? initials.slice(0, 3) : '',
                (words[0] || 'XXX').slice(0, 3).toUpperCase(),
                ((words[0] || 'X')[0] + (words[1] || words[0] || 'XX').slice(0, 2)).toUpperCase()
            ].filter(code => code.length === 3);
            let code = candidates.find(item => !used.has(item)) || candidates[0] || 'XXX';
            for (let n = 2; used.has(code); n++) code = code.slice(0, 2) + n;
            used.add(code);
            codes[name] = code;
        }
        return codes;
    }

    function prepare(raw) {
        const contractOf = new Map(raw.contracts.filter(item => item.housingBuilding).map(item => [`${item.housingBuilding}|${item.unitKey}`, item]));
        const names = raw.buildings.map(building => building.building);
        const codes = makeCodes(names);
        const color = Object.fromEntries(names.map((name, i) => [name, PALETTE[i % PALETTE.length]]));
        const units = raw.buildings.flatMap(building => building.units.map(unit => {
            const beds = unit.rooms.reduce((sum, room) => sum + room.beds, 0);
            const occupied = unit.rooms.reduce((sum, room) => sum + room.occupied, 0);
            const companies = {};
            unit.rooms.forEach(room => Object.entries(room.companies).forEach(([company, n]) => { companies[company] = (companies[company] || 0) + n; }));
            return { building: building.building, address: building.address, unit: unit.unit, level: unit.level, rooms: unit.rooms.length, roomList: unit.rooms, beds, occupied, companies, utility: unit.utility, contract: contractOf.get(`${building.building}|${unit.unit}`) || null };
        }));
        const buildings = raw.buildings.map(building => {
            const own = units.filter(unit => unit.building === building.building);
            return { name: building.building, units: own.length, rooms: own.reduce((s, u) => s + u.rooms, 0), beds: own.reduce((s, u) => s + u.beds, 0), occupied: own.reduce((s, u) => s + u.occupied, 0), utility: own.reduce((s, u) => s + (u.utility?.total || 0), 0) };
        });
        // สัญญาที่ไม่มีในผังห้องพักใช้ชื่ออาคารตามสัญญา และให้รหัส/สีแยก
        const extra = [...new Set(raw.contracts.filter(item => !names.includes(item.housingBuilding)).map(item => item.housingBuilding || item.building))];
        Object.assign(codes, makeCodes(extra.filter(name => !codes[name])));
        extra.forEach((name, i) => { color[name] ??= PALETTE[(names.length + i) % PALETTE.length]; });
        return { ...raw, units, buildingsSum: buildings, codes, color };
    }

    // ---------------------------------------------------------------- ชิ้นส่วน HTML
    const code = name => `<span class="lg-code" style="--c:${state.data.color[name] || '#6c7280'}">${esc(state.data.codes[name] || '---')}</span>`;
    const focusAttr = name => `data-b="${esc(name)}"`; // คลาส is-focus ใส่ทีหลังใน render()
    const viewButton = name => `<button type="button" class="lg-view" data-view="${esc(name)}">ดูห้องพัก →</button>`;
    const section = (no, title, intro, body, legend = '') => `<section class="lg-sec">
            <div class="lg-rule"><b>${String(no).padStart(2, '0')}</b><i></i></div>
            <div class="lg-head"><div><h2>${title}</h2>${intro ? `<p>${intro}</p>` : ''}</div>${legend}</div>
            ${body}
        </section>`;
    const legend = items => `<div class="lg-legend">${items.map(([label, c]) => `<span style="--c:${c}">${esc(label)}</span>`).join('')}</div>`;

    function kpis() {
        const d = state.data;
        const beds = d.units.reduce((s, u) => s + u.beds, 0);
        const occupied = d.units.reduce((s, u) => s + u.occupied, 0);
        const utility = d.units.reduce((s, u) => s + (u.utility?.total || 0), 0);
        const now = today();
        const active = d.contracts.filter(item => !item.end || parseDate(item.end) >= now);
        const rent = active.reduce((s, item) => s + (item.rent || 0), 0);
        const soon = active.filter(item => item.end && (parseDate(item.end) - now) / DAY <= 90).length;
        const items = [
            ['ผู้พัก / เตียงทั้งหมด', `${occupied}<em>/ ${beds}</em>`, `${d.buildingsSum.length} ที่พัก · ${d.units.length} ยูนิต`, 'var(--lg-hot)'],
            ['อัตราเข้าพัก', `${beds ? Math.round(occupied / beds * 100) : 0}<em>%</em>`, `เตียงว่าง ${beds - occupied} เตียง`, 'var(--lg-teal)'],
            ['ค่าน้ำ·ไฟ รอบบิล', `${money(utility)}<em>${esc(d.currency)}</em>`, esc(d.month), 'var(--lg-navy)'],
            ['ค่าเช่ารวม / เดือน', `${money(rent)}<em>${esc(d.currency)}</em>`, `${active.length} สัญญาที่ยังไม่หมด`, 'var(--lg-gold)'],
            ['สัญญาหมดใน 90 วัน', `${soon}<em>ฉบับ</em>`, 'ดูรายละเอียดในหัวข้อ 05', soon ? 'var(--lg-hot)' : '']
        ];
        return `<div class="lg-top">
                <p class="lg-eyebrow">STAFF HOUSING LEDGER · ทะเบียนที่พัก</p>
                <div class="lg-kpis">${items.map(([label, value, sub, dot]) => `<div class="lg-kpi" style="--dot:${dot || 'var(--lg-muted)'};${dot && label.startsWith('สัญญา') ? `--tone:${dot}` : ''}"><small>${esc(label)}</small><strong>${value}</strong><span>${sub}</span></div>`).join('')}</div>
            </div>`;
    }

    function chips() {
        const d = state.data;
        const body = `<div class="lg-chips">${d.buildingsSum.map(b => `<button type="button" class="lg-chip${state.focus === b.name ? ' is-on' : ''}" style="--c:${d.color[b.name]}" data-focus="${esc(b.name)}">${code(b.name)}${esc(b.name)} <small>${b.occupied}</small></button>`).join('')}
            ${state.focus ? '<button type="button" class="lg-clear" data-focus="">ล้างการเน้น ✕</button>' : ''}</div>`;
        return section(1, 'เลือกที่พักเพื่อเน้นทั้งส่วน', 'แต่ละที่พักมีรหัสและสีประจำตัวในทุกกราฟและตาราง คลิกเพื่อเน้น ส่วนอื่นจะจางลงพร้อมกัน (ตัวเลขหลังชื่อคือจำนวนผู้พัก)', body);
    }

    function occupancy() {
        const d = state.data;
        const rows = d.buildingsSum.slice().sort((a, b) => b.occupied - a.occupied || a.name.localeCompare(b.name)).map(b => {
            const pct = b.beds ? b.occupied / b.beds * 100 : 0;
            return `<div class="lg-bar-row" ${focusAttr(b.name)}>
                    <div class="lg-who">${code(b.name)}<span><b>${esc(b.name)}</b><small>${b.units} ยูนิต · ${b.rooms} ห้อง</small>${viewButton(b.name)}</span></div>
                    <div class="lg-track" style="--c:${d.color[b.name]}"><span style="width:${pct}%;background:var(--lg-hot)"></span><i style="left:${pct}%"></i></div>
                    <span class="lg-num is-hot">${b.occupied}</span><span class="lg-num is-teal">${b.beds - b.occupied}</span><span class="lg-num is-strong">${b.beds}</span>
                </div>`;
        }).join('');
        return section(2, 'อัตราเข้าพัก แยกตามที่พัก', 'แท่งสีส้มคือเตียงที่มีผู้พัก ส่วนที่เหลือคือเตียงว่าง จุดกลมบอกตำแหน่งอัตราเข้าพัก',
            `<div class="lg-bars"><div class="lg-bars-head"><span>ที่พัก</span><span>สัดส่วน ผู้พัก / เตียง</span><span>ผู้พัก</span><span>ว่าง</span><span>เตียง</span></div>${rows}</div>`,
            legend([['ผู้พัก', 'var(--lg-hot)'], ['เตียงว่าง', '#b9b4a8']]));
    }

    function utilities() {
        const d = state.data;
        const list = d.units.filter(u => u.utility?.total).sort((a, b) => b.utility.total - a.utility.total);
        const max = Math.max(1, ...list.map(u => u.utility.total));
        const rows = list.map(u => `<div class="lg-bar-row" ${focusAttr(u.building)}>
                <div class="lg-who">${code(u.building)}<span><b>${esc(u.building)} · ${esc(u.unit)}</b><small>${u.occupied} คน${u.utility.note ? ` · ${esc(u.utility.note)}` : ''}</small></span></div>
                <div class="lg-track" style="width:${Math.max(4, u.utility.total / max * 100)}%">${UTIL.filter(([key]) => u.utility[key]).map(([key, label, c]) => `<span title="${label} ${money(u.utility[key])}" style="width:${u.utility[key] / u.utility.total * 100}%;background:${c}"></span>`).join('')}</div>
                <span class="lg-num is-hot">${money(u.utility.electric)}</span><span class="lg-num is-teal">${money(u.utility.water)}</span><span class="lg-num is-strong">${money(u.utility.total)}</span>
            </div>`).join('');
        return section(3, 'ค่าน้ำ · ค่าไฟ แยกตามยูนิต', `รอบบิล ${esc(d.month)} หน่วย ${esc(d.currency)} — ความยาวแท่งเทียบกับยูนิตที่จ่ายมากที่สุด แบ่งสีตามประเภทค่าใช้จ่าย`,
            `<div class="lg-bars"><div class="lg-bars-head"><span>ยูนิต</span><span>สัดส่วนค่าใช้จ่าย</span><span>ค่าไฟ</span><span>ค่าน้ำ</span><span>รวม</span></div>${rows || '<p class="lg-note">ยังไม่มีข้อมูลค่าน้ำค่าไฟ</p>'}</div>`,
            legend(UTIL.map(([, label, c]) => [label, c])));
    }

    const SORTERS = {
        building: u => `${u.building}|${u.unit}`, unit: u => u.unit, rooms: u => u.rooms, beds: u => u.beds, occupied: u => u.occupied,
        vacant: u => u.beds - u.occupied, rent: u => u.contract?.rent || 0, utility: u => u.utility?.total || 0, end: u => u.contract?.end || '9999'
    };
    function detailTable() {
        const d = state.data;
        const { key, asc } = state.sort;
        const pick = SORTERS[key];
        const list = d.units.slice().sort((a, b) => { const x = pick(a), y = pick(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'th', { numeric: true })) * (asc ? 1 : -1); });
        const th = (k, label, num) => `<th data-sort="${k}" class="${num ? 'lg-n ' : ''}${key === k ? `is-sorted${asc ? ' is-asc' : ''}` : ''}">${label}</th>`;
        const rows = list.map(u => `<tr ${focusAttr(u.building)}>
                <td>${code(u.building)} ${esc(u.building)}<small>${esc(u.address)}</small>${viewButton(u.building)}</td>
                <td class="lg-n">${esc(u.unit)}<small>ชั้น ${esc(u.level)}</small></td>
                <td class="lg-n">${u.rooms}</td><td class="lg-n">${u.beds}</td><td class="lg-n">${u.occupied}</td>
                <td class="lg-n ${u.beds - u.occupied ? '' : 'lg-dim'}">${u.beds - u.occupied}</td>
                <td>${Object.entries(u.companies).map(([c, n]) => `<span class="lg-co">${esc(c)} ${n}</span>`).join('') || '<span class="lg-dim">-</span>'}</td>
                <td class="lg-n">${u.contract?.rent ? money(u.contract.rent) : '<span class="lg-dim">-</span>'}</td>
                <td class="lg-n">${u.utility?.total ? money(u.utility.total) : '<span class="lg-dim">-</span>'}</td>
                <td class="lg-n">${u.contract?.end ? thDate(u.contract.end) : '<span class="lg-dim">-</span>'}</td>
            </tr>`).join('');
        const sum = f => list.reduce((s, u) => s + f(u), 0);
        return section(4, 'ตารางรายละเอียดรายยูนิตที่พัก', `คลิกหัวคอลัมน์เพื่อเรียงลำดับ · ค่าเช่าและวันสิ้นสุดมาจากสัญญาเช่าที่จับคู่กับยูนิตได้ · หน่วย ${esc(d.currency)}`,
            `<div class="lg-table-wrap"><table><thead><tr>${th('building', 'ที่พัก')}${th('unit', 'ยูนิต', 1)}${th('rooms', 'ห้อง', 1)}${th('beds', 'เตียง', 1)}${th('occupied', 'ผู้พัก', 1)}${th('vacant', 'ว่าง', 1)}<th>บริษัท</th>${th('rent', 'ค่าเช่า/เดือน', 1)}${th('utility', 'ค่าน้ำ·ไฟ', 1)}${th('end', 'สัญญาสิ้นสุด', 1)}</tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><td>รวม ${list.length} ยูนิต</td><td></td><td class="lg-n">${sum(u => u.rooms)}</td><td class="lg-n">${sum(u => u.beds)}</td><td class="lg-n">${sum(u => u.occupied)}</td><td class="lg-n">${sum(u => u.beds - u.occupied)}</td><td></td><td class="lg-n">${money(sum(u => u.contract?.rent || 0))}</td><td class="lg-n">${money(sum(u => u.utility?.total || 0))}</td><td></td></tr></tfoot>
            </table></div>`);
    }

    function contracts() {
        const d = state.data;
        const now = today();
        const list = d.contracts.slice().sort((a, b) => String(a.end || '9999').localeCompare(String(b.end || '9999')));
        const rows = list.map(item => {
            const name = item.housingBuilding || item.building;
            const start = parseDate(item.start), end = parseDate(item.end);
            const pct = start && end ? Math.min(100, Math.max(0, (now - start) / (end - start) * 100)) : 0;
            const left = end ? Math.round((end - now) / DAY) : null;
            const cls = left === null ? '' : left < 0 ? 'is-over' : left <= 60 ? 'is-soon' : left <= 120 ? 'is-near' : '';
            const next = (item.payments || []).find(p => p.due && parseDate(p.due) >= now);
            return `<tr ${focusAttr(name)}>
                    <td>${code(name)} ${esc(item.building)}<small>ยูนิต ${esc(item.unit)}</small></td>
                    <td><span class="lg-co">${esc(item.company)}</span></td>
                    <td>${thDate(item.start)} – ${thDate(item.end)}<div class="lg-span" style="--c:${d.color[name] || 'var(--lg-teal)'}"><span style="width:${pct}%"></span></div></td>
                    <td class="lg-n">${item.rent ? money(item.rent) : '-'}</td>
                    <td class="lg-n">${item.deposit ? money(item.deposit) : '-'}</td>
                    <td class="lg-n">${next ? `${thDate(next.due)}<small>${money(next.amount)} · งวด ${next.no}</small>` : '<span class="lg-dim">-</span>'}</td>
                    <td class="lg-n"><span class="lg-left ${cls}">${left === null ? '-' : left < 0 ? 'หมดแล้ว' : `${left} วัน`}</span></td>
                </tr>`;
        }).join('');
        return section(5, 'สัญญาเช่า เรียงตามวันหมดสัญญา', 'แถบสีคือช่วงสัญญาที่ผ่านไปแล้ว · ตัวเลขสีแดงคือเหลือไม่เกิน 60 วัน สีทองไม่เกิน 120 วัน · งวดถัดไปคือค่าเช่าล่วงหน้างวดที่ยังไม่ถึงกำหนด',
            `<div class="lg-table-wrap"><table><thead><tr><th>ที่พัก / ยูนิต</th><th>บริษัท</th><th>ระยะสัญญา</th><th class="lg-n">ค่าเช่า/เดือน</th><th class="lg-n">มัดจำ</th><th class="lg-n">งวดถัดไป</th><th class="lg-n">เหลือ</th></tr></thead><tbody>${rows}</tbody></table></div>
             <p class="lg-note">ข้อมูลจากสัญญาเช่า ${list.length} ฉบับ (ไม่แสดงชื่อผู้เช่า) — แก้ไขข้อมูลได้ที่ไฟล์ทะเบียนบนเครื่องหลังบ้าน</p>`,
            legend([['≤ 60 วัน', 'var(--lg-hot)'], ['≤ 120 วัน', 'var(--lg-gold)']]));
    }

    function render() {
        host.classList.toggle('has-focus', Boolean(state.focus));
        host.innerHTML = kpis() + chips() + occupancy() + utilities() + detailTable() + contracts();
        host.querySelectorAll('[data-b]').forEach(node => node.classList.toggle('is-focus', node.dataset.b === state.focus));
    }

    // ---------------------------------------------------------------- หน้าต่างรายละเอียดที่พักทีละแห่ง (ปุ่ม "ดูห้องพัก")
    const dialog = Object.assign(document.createElement('dialog'), { className: 'lg lg-dialog' });
    dialog.setAttribute('aria-label', 'รายละเอียดที่พัก');
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
        if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
    });

    // งวดค่าเช่า: ถ้ามีเกิน 6 งวด (สัญญาจ่ายรายเดือน) พับไว้ แสดงงวดถัดไปบนหัวข้อแทน
    function paymentTable(item, rows) {
        const table = `<table class="lg-mini"><thead><tr><th>งวด</th><th>ช่วงเดือน</th><th class="lg-n">กำหนดจ่าย</th><th class="lg-n">ยอด</th></tr></thead><tbody>${rows}</tbody></table>`;
        const list = item.payments || [];
        if (list.length <= 6) return table;
        const next = list.find(p => p.due && parseDate(p.due) >= today());
        return `<details class="lg-pay"><summary>งวดค่าเช่า ${list.length} งวด${next ? ` · งวดถัดไป ${thDate(next.due)} (${money(next.amount)})` : ''}</summary>${table}</details>`;
    }

    function contractBlock(item) {
        if (!item) return '<p class="lg-dim lg-unit-note">ยังไม่มีสัญญาเช่าที่จับคู่กับยูนิตนี้</p>';
        const now = today();
        const end = parseDate(item.end);
        const left = end ? Math.round((end - now) / DAY) : null;
        const cls = left === null ? '' : left < 0 ? 'is-over' : left <= 60 ? 'is-soon' : left <= 120 ? 'is-near' : '';
        const payer = { 'ผู้เช่า': 'ผู้เช่าจ่าย', 'เจ้าของ': 'เจ้าของจ่าย' };
        const kinds = { electricity: 'ค่าไฟ', water: 'ค่าน้ำ', maintenance: 'ค่าส่วนกลาง' };
        const utilities = Object.entries(item.utilities || {}).filter(([, v]) => v).map(([k, v]) => `${kinds[k] || k}: ${payer[v] || v}`);
        const facts = [
            ['บริษัท', `<span class="lg-co">${esc(item.company)}</span>`],
            ['ระยะสัญญา', `${thDate(item.start)} – ${thDate(item.end)} <span class="lg-left ${cls}">${left === null ? '' : left < 0 ? 'หมดแล้ว' : `เหลือ ${left} วัน`}</span>`],
            ['ค่าเช่า/เดือน', item.rent ? `<span class="lg-num">${money(item.rent)}</span>` : '-'],
            ['มัดจำ', item.deposit ? `<span class="lg-num">${money(item.deposit)}</span>` : '-'],
            ['ที่อยู่', esc(item.address || '-')],
            ['ผู้ให้เช่า', esc(item.lessor || '-')],
            ['ค่าสาธารณูปโภค', esc(utilities.join(' · ') || '-')],
            ['ออกก่อนกำหนด', esc(item.earlyExit || '-')]
        ];
        const payments = (item.payments || []).map(p => {
            const done = p.atSigning || (p.due && parseDate(p.due) < now);
            return `<tr class="${done ? 'lg-dim' : ''}"><td>งวด ${p.no}</td><td>${esc(p.period || '')}</td><td class="lg-n">${p.atSigning ? 'วันเซ็นสัญญา' : thDate(p.due)}</td><td class="lg-n">${money(p.amount)}</td></tr>`;
        }).join('');
        return `<dl class="lg-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
            ${payments ? paymentTable(item, payments) : ''}
            ${(item.flags || []).length ? `<ul class="lg-flags">${item.flags.map(flag => `<li>${esc(flag)}</li>`).join('')}</ul>` : ''}`;
    }

    function openBuilding(name) {
        const d = state.data;
        const units = d.units.filter(u => u.building === name);
        const unitKeys = new Set(units.map(u => u.unit));
        // สัญญาของที่พักนี้ที่ยูนิตไม่อยู่ในผังห้องรอบบิล (เช่น เลขยูนิตไม่ตรง หรือเพิ่งเริ่มสัญญา)
        const others = d.contracts.filter(item => (item.housingBuilding || item.building) === name && !unitKeys.has(item.unitKey));
        const sum = f => units.reduce((s, u) => s + f(u), 0);
        const beds = sum(u => u.beds), occupied = sum(u => u.occupied);
        const rent = sum(u => u.contract?.rent || 0) + others.reduce((s, item) => s + (item.rent || 0), 0);
        const stats = [['ยูนิต', units.length], ['ห้อง', sum(u => u.rooms)], ['เตียง', beds], ['ผู้พัก', occupied], ['ว่าง', beds - occupied],
            [`ค่าน้ำ·ไฟ (${esc(d.currency)})`, money(sum(u => u.utility?.total || 0))], [`ค่าเช่า/เดือน (${esc(d.currency)})`, money(rent)]];
        const unitCards = units.map(u => {
            const rooms = u.roomList.map(room => `<tr><td>ห้อง ${esc(room.room)}</td><td class="lg-n">${room.beds}</td><td class="lg-n">${room.occupied}</td><td class="lg-n ${room.beds - room.occupied ? 'is-free' : 'lg-dim'}">${room.beds - room.occupied}</td><td>${Object.entries(room.companies).map(([c, n]) => `<span class="lg-co">${esc(c)} ${n}</span>`).join('') || '<span class="lg-dim">ว่าง</span>'}</td></tr>`).join('');
            const util = u.utility
                ? `<div class="lg-util">${UTIL.filter(([key]) => u.utility[key]).map(([key, label, c]) => `<span style="--c:${c}">${label} <b class="lg-num">${money(u.utility[key])}</b></span>`).join('')}<span class="is-total">รวม <b class="lg-num">${money(u.utility.total)}</b></span>${u.utility.note ? `<small>${esc(u.utility.note)}</small>` : ''}</div>`
                : '<p class="lg-dim lg-unit-note">ไม่มีข้อมูลค่าน้ำค่าไฟรอบนี้</p>';
            return `<article class="lg-unit">
                    <header><h3>ยูนิต ${esc(u.unit)}</h3><span>ชั้น ${esc(u.level)} · ${u.rooms} ห้อง · ผู้พัก ${u.occupied}/${u.beds}</span></header>
                    <div class="lg-unit-grid">
                        <div><h4>ห้องและเตียง</h4><table class="lg-mini"><thead><tr><th>ห้อง</th><th class="lg-n">เตียง</th><th class="lg-n">ผู้พัก</th><th class="lg-n">ว่าง</th><th>บริษัท</th></tr></thead><tbody>${rooms}</tbody></table>
                            <h4>ค่าน้ำ · ค่าไฟ รอบบิล</h4>${util}</div>
                        <div><h4>สัญญาเช่า</h4>${contractBlock(u.contract)}</div>
                    </div>
                </article>`;
        }).join('');
        const otherCards = others.map(item => `<article class="lg-unit"><header><h3>ยูนิต ${esc(item.unit)}</h3><span>มีสัญญา แต่ไม่อยู่ในผังห้องรอบบิล ${esc(d.month)}</span></header><h4>สัญญาเช่า</h4>${contractBlock(item)}</article>`).join('');
        dialog.innerHTML = `<div class="lg-dialog-head">
                <div>${code(name)}<h2>${esc(name)}</h2><p>${esc(units[0]?.address || others[0]?.address || '')}</p></div>
                <button type="button" class="lg-close" data-close aria-label="ปิด">×</button>
            </div>
            <div class="lg-dialog-stats">${stats.map(([k, v]) => `<div><small>${k}</small><strong class="lg-num">${v}</strong></div>`).join('')}</div>
            <div class="lg-dialog-body">${unitCards}${otherCards}${unitCards || otherCards ? '' : '<p class="lg-dim">ไม่มีข้อมูลยูนิต</p>'}</div>`;
        dialog.showModal();
        dialog.scrollTop = 0;
    }

    host.addEventListener('click', event => {
        const view = event.target.closest('[data-view]');
        if (view) return openBuilding(view.dataset.view);
        const focus = event.target.closest('[data-focus]');
        if (focus) { state.focus = state.focus === focus.dataset.focus ? '' : focus.dataset.focus; return render(); }
        const sort = event.target.closest('th[data-sort]');
        if (sort) {
            const key = sort.dataset.sort;
            state.sort = { key, asc: state.sort.key === key ? !state.sort.asc : key === 'building' || key === 'unit' || key === 'end' };
            render();
        }
    });

    (async () => {
        host.innerHTML = '<p class="lg-empty">กำลังโหลดทะเบียนที่พัก...</p>';
        try {
            const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/accommodation-ledger`);
            const data = await response.json().catch(() => ({}));
            if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ทหลังบ้าน)');
            if (!response.ok || data.success === false) throw new Error(data.message || `โหลดไม่สำเร็จ (${response.status})`);
            state.data = prepare(data);
            render();
        } catch (error) {
            host.innerHTML = `<p class="lg-empty">โหลดทะเบียนที่พักไม่ได้: ${esc(error.message)}</p>`;
        }
    })();
})();
