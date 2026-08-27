# WORKSTREAM PC2 — Asset Management Frontend

- Repository: Frontend (`Secretsource`)
- งาน: ระบบจัดการทรัพย์สิน
- Branch: `recovery/assets-pc2`
- Branch เดิม: `feature/shared-work`
- HEAD ตั้งต้น: `356500aefe9353cfe7928b56bef2926adde8e2aa`

## ไฟล์และโมดูลที่แก้

- `assets.html`: หน้าต่างสแกน Barcode/QR พร้อมช่องกรอกรหัสสำรอง
- `assets.js`: เปิด/ปิดกล้อง ตรวจรหัส ค้นหาทรัพย์สิน และจัดการข้อผิดพลาด
- `assets.css`: รูปแบบหน้าต่างสแกนและการแสดงผลบนโทรศัพท์

## API, Database และ Config

- ไม่มีการเปลี่ยน API, database schema หรือ config
- ใช้ Asset search flow และระบบสิทธิ์เดิมของ Frontend

## Dependency กับระบบห้องพัก

- ไม่มีการแก้โมดูลห้องพัก
- ใช้โครงสร้างร่วมของระบบ ได้แก่ authentication, permission, config และ PWA

## สิ่งที่ยังไม่เสร็จ

- ยังไม่ได้ทดสอบกล้องจริงผ่านระบบที่ Backend ทำงานและผู้ใช้เข้าสู่ระบบ
- การแก้ไขข้อมูลทรัพย์สินและการนำเข้าข้อมูลจำนวนมากยังไม่รวมในงานชุดนี้
- Browser ที่ไม่มี `BarcodeDetector` จะใช้ช่องกรอกรหัสแทน

## การทดสอบ

- `node --check assets.js`: ผ่าน
- ตรวจโครงสร้าง modal และ accessibility บน local static server: ผ่าน
- Test/lint/type-check/build อื่น: ไม่มีคำสั่งกำหนดไว้ใน Frontend repository
