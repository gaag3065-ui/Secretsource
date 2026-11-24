// แปลงค่าวันที่ที่ชีตส่งมาเป็นเลขลำดับวันของ Excel/Sheets (เช่น "46,305.8") ให้เป็น DD/MM/YYYY หรือ DD/MM/YYYY HH:mm
// - ปีที่ได้ > 2400 แปลว่าคนกรอกปี พ.ศ. แล้วชีตตีเป็น ค.ศ. (เช่น 244,632.8 ≈ 24/11/2569) → แสดงปีนั้นตามเดิม ไม่ลบ 543
// - ข้อความวันที่ปกติ (เช่น "24 พ.ย. 2569 10:00 น." หรือ "24/11/2026") ไม่แตะต้อง
(() => {
    'use strict';
    const SERIAL = /^\d{1,3}(,\d{3})+(\.\d+)?$|^\d{5,7}(\.\d+)?$/;
    const two = n => String(n).padStart(2, '0');
    function text(value) {
        const raw = String(value ?? '').trim();
        if (!SERIAL.test(raw)) return raw;
        const n = Number(raw.replace(/,/g, ''));
        if (!Number.isFinite(n) || n < 20000 || n > 3000000) return raw;
        const minutes = Math.round((n - Math.floor(n)) * 1440);
        const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000 + minutes * 60000);
        const day = `${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
        return minutes ? `${day} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}` : day;
    }
    window.HistoryDateText = { text };
})();
