// สถานะกำลังโหลดแบบ Skeleton ของหน้า "จัดการห้องพักพนักงาน" — ใช้ร่วมกันทุกแท็บ (โหลดก่อนสคริปต์อื่นของหน้า)
// ใช้: window.AccSkeleton.html(แถว, ข้อความอ่านออกเสียง)  ·  ถ้าไฟล์นี้ไม่ถูกโหลด โมดูลต่างๆ จะถอยกลับไปใช้ข้อความ "กำลังโหลด…" เดิม
(() => {
    const WIDTHS = ['w60', 'w90', 'w75', 'w45'];
    window.AccSkeleton = {
        html(rows = 4, label = 'กำลังโหลดข้อมูล') {
            const lines = Array.from({ length: rows }, (_, i) => `<span class="sk-line ${WIDTHS[i % WIDTHS.length]}"></span>`).join('');
            return `<div class="sk" role="status" aria-busy="true" aria-live="polite"><span class="sk-sr">${label}…</span><div class="sk-head"></div>${lines}</div>`;
        }
    };
})();
