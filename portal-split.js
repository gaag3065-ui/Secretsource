// แบ่งจอทำงานคู่กับหน้าแชท (monitoring.html): เปิดหน้าส่วนงานอื่นข้างแชท ใช้งานและตอบแชทได้พร้อมกัน
//   - คอมพิวเตอร์: ปุ่มส่วนงานบนแถบบน → หน้าที่เลือกอยู่ครึ่งซ้าย แชทอยู่ครึ่งขวา
//   - มือถือ: ปุ่มกลมลอย (ลากย้ายได้) → เลือกหน้า → หน้าที่เลือกครึ่งบน แชทครึ่งล่าง
// ใช้ services / getAccessibleTasks จาก portal.js ผ่าน window.PortalApi (ตั้งค่าใน DOMContentLoaded ของ portal.js)
document.addEventListener('DOMContentLoaded', () => {
    const { services, getAccessibleTasks } = window.PortalApi || {};
    if (!services) return;
    const view = document.getElementById('workspaceView');
    const frame = document.getElementById('workspaceFrame');
    const container = frame?.closest('.workspace-frame-container');
    const spacer = document.querySelector('.topbar-spacer');
    if (!view || !frame || !container || !spacer) return;

    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const isChatOpen = () => !view.hidden && /(^|\/)monitoring\.html/.test(frame.getAttribute('src') || '');
    let current = null;

    // ส่วนงานที่เปิดข้างแชทได้: ไม่ใช่หน้าแชทเอง ไม่ใช่ส่วนงานที่ยังไม่เปิดใช้ และมีงานที่บัญชีนี้เข้าได้
    function targets() {
        return services.filter(service => service.id !== 'internal-support' && !service.planned).map(service => {
            const tasks = getAccessibleTasks(service).filter(task => !task.planned && task.page);
            const task = (service.directTask && tasks.find(t => t.route === service.directTask)) || tasks[0];
            return task && { service, task };
        }).filter(Boolean);
    }

    // ---------------------------------------------------------------- ช่องแบ่งจอ
    const pane = document.createElement('section');
    pane.className = 'split-pane';
    pane.hidden = true;
    pane.innerHTML = '<header class="split-head"><b></b><button type="button" class="split-close" aria-label="ปิดหน้าที่แบ่ง">✕ ปิด</button></header><iframe title="หน้าที่เปิดคู่กับแชท"></iframe>';
    container.prepend(pane);
    const paneFrame = pane.querySelector('iframe');

    function open(item) {
        if (current?.service.id === item.service.id) return close();
        current = item;
        pane.querySelector('.split-head b').textContent = item.service.title;
        paneFrame.src = item.task.page;
        pane.hidden = false;
        container.classList.add('is-split');
        render();
    }
    function close() {
        current = null;
        pane.hidden = true;
        paneFrame.src = 'about:blank';
        container.classList.remove('is-split');
        render();
    }
    pane.querySelector('.split-close').addEventListener('click', close);

    // ---------------------------------------------------------------- ปุ่มบนแถบบน (คอมพิวเตอร์)
    const nav = document.createElement('nav');
    nav.className = 'split-nav';
    nav.setAttribute('aria-label', 'เปิดหน้าอื่นข้างแชท');
    spacer.append(nav);

    // ---------------------------------------------------------------- ปุ่มกลมลอย (มือถือ)
    const fab = document.createElement('div');
    fab.className = 'split-fab';
    fab.innerHTML = '<button type="button" class="split-fab-button" aria-label="เปิดหน้าอื่นคู่กับแชท">☰</button><div class="split-fab-menu" hidden></div>';
    document.body.append(fab);
    const fabButton = fab.querySelector('.split-fab-button');
    const fabMenu = fab.querySelector('.split-fab-menu');

    function render() {
        const chat = isChatOpen();
        const list = chat ? targets() : [];
        const buttons = list.map(({ service }) => `<button type="button" data-split="${esc(service.id)}" class="${current?.service.id === service.id ? 'is-on' : ''}" style="--c:${esc(service.color || '#0f766e')}">${esc(service.shortTitle || service.title)}</button>`).join('');
        nav.innerHTML = list.length ? `<span>เปิดคู่กับแชท:</span>${buttons}` : '';
        nav.hidden = !list.length;
        fabMenu.innerHTML = buttons + (current ? '<button type="button" data-split-close>✕ ปิดหน้าที่แบ่ง</button>' : '');
        fab.hidden = !list.length;
        if (!chat && current) close();
    }
    const pick = id => { const item = targets().find(t => t.service.id === id); if (item) open(item); };
    nav.addEventListener('click', event => { const b = event.target.closest('[data-split]'); if (b) pick(b.dataset.split); });
    fabMenu.addEventListener('click', event => {
        const b = event.target.closest('[data-split]');
        if (b) pick(b.dataset.split);
        if (event.target.closest('[data-split-close]')) close();
        fabMenu.hidden = true;
    });

    // ลากปุ่มกลมไปวางตรงไหนก็ได้ (แตะเฉยๆ = เปิดเมนู)
    let drag = null;
    fabButton.addEventListener('pointerdown', event => {
        const rect = fab.getBoundingClientRect();
        drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, x: event.clientX, y: event.clientY, moved: false };
        fabButton.setPointerCapture(event.pointerId);
    });
    fabButton.addEventListener('pointermove', event => {
        if (!drag) return;
        if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6) drag.moved = true;
        if (!drag.moved) return;
        const size = fab.offsetWidth;
        fab.style.left = Math.min(innerWidth - size - 4, Math.max(4, event.clientX - drag.dx)) + 'px';
        fab.style.top = Math.min(innerHeight - size - 4, Math.max(4, event.clientY - drag.dy)) + 'px';
        fab.style.right = fab.style.bottom = 'auto';
    });
    fabButton.addEventListener('pointerup', () => {
        if (drag && !drag.moved) fabMenu.hidden = !fabMenu.hidden;
        drag = null;
    });

    // เปิด/ปิด/เปลี่ยนหน้าในพื้นที่ทำงาน → อัปเดตปุ่ม (ออกจากหน้าแชทแล้วปิดหน้าที่แบ่งให้)
    new MutationObserver(render).observe(view, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(render).observe(frame, { attributes: true, attributeFilter: ['src'] });
    render();
});
