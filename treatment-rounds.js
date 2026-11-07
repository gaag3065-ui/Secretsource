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

function collectTreatmentRounds(events) {
    const rounds = new Map();
    const ordered = [...(events || [])].sort((a, b) => (Number(a.targetRowNumber) || 0) - (Number(b.targetRowNumber) || 0));
    ordered.forEach((event, index) => {
        const caseId = String(event.CaseIdNew ?? '').trim();
        const date = treatmentRoundDate(event.treatmentDateTime);
        const key = JSON.stringify([caseId && caseId !== '-' ? caseId : `row-${index}`, date.key || `row-${index}`]);
        const round = rounds.get(key) || { caseId, date, consent: false };
        round.status = event.statusText;
        round.consent ||= /(^|\n)\s*IPD_SHARE_CONSENT\|/i.test(String(event.DocumentsAttached || ''));
        const hasExpense = treatmentAmountFields.some(([field]) => !field.startsWith('Exchange') && Number(String(event[field] ?? '').replace(/,/g, '').trim()));
        if (hasExpense) round.expense = event;
        rounds.set(key, round);
    });
    return [...rounds.values()].filter(round => round.expense).sort((a, b) =>
        (a.date.time - b.date.time || 0) || (Number(a.expense.targetRowNumber) || 0) - (Number(b.expense.targetRowNumber) || 0));
}
