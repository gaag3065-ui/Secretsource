# กฎประจำโปรเจกต์ (สำหรับผู้ช่วย AI ทุกตัว: Claude / Codex)

อ่านและทำตาม [CLAUDE.md](CLAUDE.md) ในโฟลเดอร์เดียวกัน ซึ่งเป็นกฎหลักของโปรเจกต์นี้ สรุปย่อ:

- Tech Stack: คง Vanilla HTML/CSS/JS บน GitHub Pages ห้ามเปลี่ยนเป็น React/Next.js/Tailwind และห้ามใช้ Mock Data ทับข้อมูลจริง
- Layout: ห้ามใช้ `position: absolute` / `margin` ติดลบจัด Layout หลัก ใช้ Flexbox/Grid เท่านั้น, ข้อความยาวต้อง wrap, ปุ่ม/Badge `nowrap`, z-index 0/20/30/50
- ก่อน commit: รัน `npm test` (E2E + `layoutProblems`) ให้ผ่านทั้งหมด และตรวจ Bug ให้ได้ PASS
- Push อัตโนมัติได้เมื่อเทสต์ผ่าน 100% และไม่มี Bug (ห้าม Push ถ้าเทสต์ไม่ผ่าน) แล้วตรวจ deploy
- ห้าม commit ความลับ ไฟล์นี้อยู่ใน repo สาธารณะ
- หลายผู้ช่วยทำงานร่วมกัน: ก่อนแก้ไฟล์ให้ดู/บันทึกใน `HANDOFF.md` (ไฟล์ส่งต่องานบนเครื่องผู้ใช้ ไม่ได้อยู่ใน repo นี้) เพื่อไม่แก้ทับกัน
