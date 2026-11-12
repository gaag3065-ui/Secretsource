// Expense-bearing timeline rows are snapshots for one visit, keyed by case and treatment date/time.
const treatmentAmountFields = [
    ['DentalOPD', 'ทำฟัน หักวงเงิน OPD (บาท)'], ['PPUsageOPD', 'PP OPD (บาท)'], ['PPUsageIPD', 'PP IPD (บาท)'],
    ['OtherUsage', 'วงเงินอื่นๆ (บาท)'], ['SLKUsageOpdThB', 'SL OPD (บาท)'], ['SLKUsageIpdThB', 'SL IPD (บาท)'],
    ['SLKUsageOpdLkr', 'SL OPD (LKR)'], ['SLKUsageIpdLkr', 'SL IPD (LKR)'],
    ['OverLimitCreditInsThB', 'ส่วนเกินวงเงินค่ารักษา (บาท)'], ['OverLimitCreditInsLkr', 'ส่วนเกินวงเงินค่ารักษา (LKR)'],
    ['ExchangeRatesIns', 'เรทค่าเงินที่ประกันคิดให้ (THB/LKR)'], ['ExchangeRatesInt', 'เรทค่าเงินปัจจุบัน (THB/LKR)']
];

function treatmentRoundDate(value) {
    const text = String(value || '').trim();
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
    if (!m) return { time: Infinity, text: text === '-' ? '' : text, key: '' };
    const [, d, mo, y, h = '0', min = '0', sec = '0'] = m;
    const year = Number(y) > 2400 ? Number(y) - 543 : Number(y);
    const time = Date.UTC(year, Number(mo) - 1, Number(d), Number(h), Number(min), Number(sec));
    const clock = m[4] ? ` ${h.padStart(2, '0')}:${min}${Number(sec) ? ':' + sec : ''}` : '';
    return { time, text: `${Number(d)}-${Number(mo)}-${String(year + 543).slice(-2)}${clock}`, key: String(time) };
}

// ลายเซ็นยอดเงินของแถว (ใช้ตรวจว่าเป็นยอดเดียวกันหรือไม่)
const roundAmountSignature = event => treatmentAmountFields.filter(([field]) => !field.startsWith('Exchange'))
    .map(([field]) => Number(String(event[field] ?? '').replace(/,/g, '').trim()) || 0).join('|');
const roundStatusKey = event => String(event.statusText ?? '').replace(/\s+/g, ' ').trim();

// แถวที่มียอดเงินในวัน-เวลารักษาเดียวกัน:
//  - ยอดเหมือนกัน → แถวซ้ำ (สแนปช็อตของขั้นตอนถัดไป) นับครั้งเดียว
//  - ยอดต่างกันและ "ขั้นตอนการรักษาต่างกัน" → อัปเดตความคืบหน้าของรอบเดียวกัน ใช้ยอดล่าสุด
//  - ยอดต่างกันแต่ "ขั้นตอนเดียวกัน" → เป็นบิลคนละใบในเวลาเดียวกัน นับแยกเป็นหลายยอด
function splitRoundBills(expenseEvents) {
    const bills = [];
    for (const event of expenseEvents) {
        const sig = roundAmountSignature(event), status = roundStatusKey(event);
        const same = bills.find(b => b.sig === sig);
        if (same) { same.event = event; same.status = status; continue; }
        if (bills.some(b => b.status === status)) { bills.push({ event, sig, status }); continue; }
        if (bills.length) { bills[bills.length - 1] = { event, sig, status }; continue; }
        bills.push({ event, sig, status });
    }
    return bills;
}

function collectTreatmentRounds(events) {
    const rounds = new Map();
    const ordered = [...(events || [])].sort((a, b) => (Number(a.targetRowNumber) || 0) - (Number(b.targetRowNumber) || 0));
    ordered.forEach((event, index) => {
        const caseId = String(event.CaseIdNew ?? '').trim();
        const date = treatmentRoundDate(event.treatmentDateTime);
        const key = JSON.stringify([caseId && caseId !== '-' ? caseId : `row-${index}`, date.key || `row-${index}`]);
        const round = rounds.get(key) || { caseId, date, consent: false, expenseEvents: [] };
        round.status = event.statusText;
        round.consent ||= /(^|\n)\s*IPD_SHARE_CONSENT\|/i.test(String(event.DocumentsAttached || ''));
        const hasExpense = treatmentAmountFields.some(([field]) => !field.startsWith('Exchange') && Number(String(event[field] ?? '').replace(/,/g, '').trim()));
        if (hasExpense) round.expenseEvents.push(event);
        rounds.set(key, round);
    });
    const out = [];
    for (const round of rounds.values()) {
        const bills = splitRoundBills(round.expenseEvents);
        bills.forEach((bill, i) => out.push({ caseId: round.caseId, date: round.date, consent: round.consent, status: bill.status || round.status, expense: bill.event, part: i + 1, parts: bills.length }));
    }
    return out.sort((a, b) =>
        (a.date.time - b.date.time || 0) || (Number(a.expense.targetRowNumber) || 0) - (Number(b.expense.targetRowNumber) || 0));
}
