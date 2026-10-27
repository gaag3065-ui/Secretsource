// กดเข้าส่วนงานแล้วแสดงหน้านั้นเต็มหน้าต่างทันที (ซ่อนแถบบนของพอร์ทัลและหัวกรอบงาน) — ไม่ต้องกด "เปิดเต็มหน้า" อีก
// ยังเปิดอยู่ในกรอบของพอร์ทัล → หน้าที่ส่งข้อความหาพอร์ทัล (เช่น "เช่าที่พักใหม่" เปิดตรวจรับห้องพัก) ใช้ได้เหมือนเดิม
// ยกเว้นหน้าแชท (ใช้แถบบนเปิดหน้าอื่นคู่กับแชท) · กลับหน้าหลักด้วยปุ่มบนแถบบางด้านบน
document.addEventListener('DOMContentLoaded', () => {
    const view = document.getElementById('workspaceView');
    const frame = document.getElementById('workspaceFrame');
    const back = document.getElementById('workspaceBackButton');
    if (!view || !frame || !back) return;

    const bar = document.createElement('div');
    bar.className = 'fullpage-bar';
    bar.hidden = true;
    bar.innerHTML = '<button type="button" data-fullpage-back>← กลับหน้าหลัก</button><span class="fullpage-title"></span><span class="fullpage-spacer"></span>';
    document.body.append(bar);
    const title = bar.querySelector('.fullpage-title');
    bar.querySelector('[data-fullpage-back]').addEventListener('click', () => back.click());

    // ปุ่ม "สร้างรายงาน" ของห้องพักอยู่บนแถบบนที่ถูกซ่อน → ย้ายมาไว้ในแถบลอยระหว่างเต็มหน้า
    const report = document.getElementById('accommodationReportTopbarButton');
    const reportHome = report && { parent: report.parentNode, next: report.nextSibling };

    function render() {
        const src = frame.getAttribute('src') || '';
        const on = !view.hidden && src && src !== 'about:blank' && !/(^|\/)monitoring\.html/.test(src);
        document.body.classList.toggle('task-fullpage', Boolean(on));
        bar.hidden = !on;
        if (on) {
            const main = document.getElementById('workspaceTitle')?.textContent.trim() || '';
            const sub = document.getElementById('workspaceSubtitle')?.textContent.trim() || '';
            title.innerHTML = '';
            title.append(main);
            if (sub && sub !== main) title.append(Object.assign(document.createElement('small'), { textContent: sub }));
        }
        if (report) {
            if (on && report.parentNode !== bar) bar.append(report);
            if (!on && report.parentNode === bar) reportHome.parent.insertBefore(report, reportHome.next);
        }
    }
    new MutationObserver(render).observe(view, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(render).observe(frame, { attributes: true, attributeFilter: ['src'] });
    render();
});
