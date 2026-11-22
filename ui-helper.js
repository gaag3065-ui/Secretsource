// ตัวช่วย UI กลาง: Skeleton Loading + แถบสถานะเล็กที่ไม่ขัดการคลิก (ใช้แทนป๊อปอัป/ป้าย "กำลังโหลด…")
//   GaUI.skeletonRows(tbody, columns, rows)  → แถวโครงตารางระหว่างรอข้อมูลครั้งแรก
//   GaUI.statusLine(host, text)              → บรรทัดสถานะเล็กๆ (เช่น "กำลังอัปเดตข้อมูลล่าสุด…") · ส่งข้อความว่าง = ซ่อน
(() => {
    if (window.GaUI) return;
    const STYLE_ID = 'gaUiHelperStyle';
    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = '@keyframes gaSkel{0%{background-position:100% 0}100%{background-position:-100% 0}}'
            + '.ga-skel-bar{display:block;height:14px;border-radius:6px;background:linear-gradient(90deg,#eef1f5 25%,#f8fafc 37%,#eef1f5 63%);background-size:200% 100%;animation:gaSkel 1.2s linear infinite}'
            + '.ga-status-line{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:12.5px;color:#475467}'
            + '.ga-status-line::before{content:"";width:12px;height:12px;border:2px solid #cbd5e1;border-top-color:#2563eb;border-radius:50%;animation:gaSpin .8s linear infinite}'
            + '@keyframes gaSpin{to{transform:rotate(360deg)}}'
            + '@media (prefers-reduced-motion:reduce){.ga-skel-bar,.ga-status-line::before{animation:none}}';
        document.head.appendChild(style);
    }
    function skeletonRows(tbody, columns = 6, rows = 8) {
        if (!tbody) return;
        ensureStyle();
        const widths = [14, 55, 40, 70, 30, 60, 45];
        tbody.replaceChildren(...Array.from({ length: rows }, (_, r) => {
            const tr = document.createElement('tr');
            tr.className = 'ga-skel-row';
            tr.setAttribute('aria-hidden', 'true');
            for (let c = 0; c < columns; c += 1) {
                const td = document.createElement('td');
                const bar = document.createElement('span');
                bar.className = 'ga-skel-bar';
                bar.style.width = `${widths[(r + c) % widths.length] + 20}%`;
                td.appendChild(bar);
                tr.appendChild(td);
            }
            return tr;
        }));
    }
    function statusLine(host, text) {
        if (!host) return;
        ensureStyle();
        let line = host.querySelector(':scope > .ga-status-line');
        if (!text) { line?.remove(); return; }
        if (!line) {
            line = document.createElement('div');
            line.className = 'ga-status-line';
            line.setAttribute('role', 'status');
            host.prepend(line);
        }
        line.textContent = text;
    }
    window.GaUI = { skeletonRows, statusLine };
})();
