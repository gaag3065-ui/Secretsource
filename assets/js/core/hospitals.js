// รายชื่อสถานพยาบาล "ชุดเดียว" ที่ทุกหน้าใช้ร่วมกัน (เปิดเคส, แก้ไขเคสในประวัติการรักษา ฯลฯ)
// เพิ่ม/แก้ไข/ลบสถานพยาบาลที่ไฟล์นี้ที่เดียว — ทุกหน้าจะอัปเดตตามกันอัตโนมัติ
// distance = ระยะทางอ้างอิงที่แสดงในช่อง "ระยะทางอ้างอิง" ตอนเปิดเคส
(function () {
    'use strict';
    const HOSPITALS = [
    { name: "รอยัล อังกอร์", distance: "1.7 กม." },
    { name: "จัสมิน คลินิก", distance: "1.4 กม." },
    { name: "เทวิน ข้างฮุยเกียร์", distance: "1 กม." },
    { name: "คลินิกโซน 3", distance: "4.2 กม." },
    { name: "คลินิก สุวิสา", distance: "1  กม." },
    { name: "คลินิกไทยช่าง (ท้ายคลัง)", distance: "3.2 กม." },
    { name: "คลินิกวงเทพ", distance: "2.5 กม." },
    { name: "คลินิกโอเคทินนา", distance: "2.6 กม." },
    { name: "คลินิกอิลิแก้นต์", distance: "2.3 กม." },
    { name: "คลินิกกาแล็คซี่", distance: "2.7 กม." },
    { name: "Durdans hospital", distance: "300 ม." },
    { name: "Clinic Dr. Menghong", distance: "1.5 กม." },
    { name: "Akea Thmey Clinic", distance: "3.3 กม." },
    { name: "Dermall Dental Clinic", distance: "1.4 กม." },
    { name: "king hospital", distance: "4.9 กม." },
    { name: "Nawaloka Hospital", distance: "2.9 กม." },
    { name: "TPR DENTAL CARE", distance: "1.7 กม." },
    { name: "คลินิกทำฟันอื่นๆ PP", distance: "2.0 กม." },
    { name: "อื่นๆ พื้นที่ GE", distance: "พื้นที่ GE" },
    { name: "อื่นๆ พื้นที่ SL", distance: "พื้นที่ SL" },
    { name: "อื่นๆ พื้นที่ 3", distance: "พื้นที่ 3" },
    { name: "อื่นๆ กรุงเทพและปริมณฑล", distance: "ภาคกลาง" },
    { name: "อื่นๆ ต่างจังหวัด", distance: "ตามภูมิลำเนา" }
    ];

    window.HOSPITALS = HOSPITALS;
    window.HOSPITAL_DISTANCE = Object.fromEntries(HOSPITALS.map(item => [item.name, item.distance]));

    // สร้างตัวเลือกใน <select> จากรายชื่อกลาง โดยคงค่าที่เลือกไว้เดิม
    window.fillHospitalSelect = function (select, options = {}) {
        if (!select) return;
        const current = select.value;
        select.innerHTML = '';
        if (options.placeholder) {
            const placeholder = new Option(options.placeholder, '');
            placeholder.disabled = true;
            placeholder.selected = true;
            select.add(placeholder);
        }
        HOSPITALS.forEach(item => select.add(new Option(item.name, item.name)));
        if (current) window.setHospitalValue(select, current);
    };

    // ตั้งค่าสถานพยาบาลให้ select — ถ้าเป็นชื่อเก่าที่ไม่อยู่ในรายชื่อแล้ว จะเพิ่มเป็นตัวเลือกชั่วคราว
    // เพื่อไม่ให้ค่าเดิมของเคสหายไปตอนกดบันทึกแก้ไข
    window.setHospitalValue = function (select, value) {
        if (!select) return;
        const text = String(value ?? '').trim();
        if (text && text !== '-' && ![...select.options].some(option => option.value === text)) {
            select.add(new Option(text + ' (รายชื่อเดิม)', text));
        }
        select.value = text;
    };
})();
