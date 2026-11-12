// ดัชนีค้นหาร่วมสำหรับทะเบียนยูนิตและรายชื่อพนักงาน ใช้รหัสพนักงานเชื่อมข้อมูล ไม่เดาจากชื่อ
(() => {
    const normalize = v => String(v ?? '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('th');
    let index = new Map();
    const setDirectory = people => {
        index = new Map();
        for (const p of people || []) for (const id of [p.employeeId, p.centralId, p.insuranceCode].filter(Boolean).map(normalize)) {
            if (!index.has(id)) index.set(id, p);
            else if (index.get(id) !== p) index.set(id, null); // รหัสซ้ำ: ไม่เชื่อมข้ามคน
        }
    };
    const personText = p => {
        const linked = [p.employeeId, p.centralId, p.insuranceCode].map(normalize).map(id => index.get(id)).find(Boolean) || {};
        return normalize([p, linked].flatMap(x => [x.name, x.employeeName, x.fullname, x.nickname, x.englishName, x.employeeId, x.centralId, x.insuranceCode, x.company, x.building, x.floor, x.room]).filter(Boolean).join(' '));
    };
    window.AccommodationPeople = { normalize, personText, setDirectory };
})();
