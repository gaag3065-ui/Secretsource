// แปลงเลขวันที่ Excel ในหน้าสรุปเคส (history-date-text.js) — ทดสอบตรงๆ ไม่ต้องเปิดเบราว์เซอร์
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../../assets/js/pages/history-date-text.js'), 'utf8'));
const t = window.HistoryDateText.text;

test('เลขวันที่ Excel → DD/MM/YYYY (+ HH:mm เมื่อมีเวลา)', () => {
    assert.equal(t('46305'), '10/10/2026');
    assert.equal(t('46,305.8'), '10/10/2026 19:12', 'ค่าตามภาพที่ผู้ใช้เจอ');
    assert.equal(t('46305.5'), '10/10/2026 12:00');
    assert.equal(t('46305.99999'), '11/10/2026 00:00', 'ปัดเวลาข้ามเที่ยงคืน → วันถัดไป 00:00 ไม่ขึ้น 24:00');
});

test('ปีที่ชีตตีเป็น ค.ศ. ทั้งที่กรอกเป็น พ.ศ. (เลขใหญ่) ยังได้ปี 25xx ไม่ถูกลบ 543', () => {
    assert.match(t('244,632.8'), /^\d{2}\/\d{2}\/25\d{2} \d{2}:\d{2}$/);
});

test('ข้อความวันที่ปกติและค่าที่ไม่ใช่เลขวันที่ ไม่ถูกแตะ', () => {
    for (const v of ['24 พ.ย. 2569 10:00 น.', '24/11/2026', '20/11/2026 09:30', '519', '1,200.50', '-', '', 'IC0263189']) assert.equal(t(v), v);
    assert.equal(t(null), '');
});
