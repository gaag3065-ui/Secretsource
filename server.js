// =============================================================================================================================== //
// =================================== 📦 [ส่วนที่ 1: ส่วนรวมระบบ (หัวเชื้อโครงสร้างหลักหลังบ้าน)] =================================== //
// =============================================================================================================================== //

const API_BASE_URL = 'http://localhost:3000';

require('dotenv').config();
const path = require('path'); // 🎯 วางไว้ตรงนี้เลยครับ
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// 🎯 แก้ไขเปลี่ยนแทนที่บล็อก CORS ในไฟล์ server.js ของคุณด้วยชุดนี้เป๊ะๆ เลยครับ 
// 🎯 ปรับปรุงบล็อก CORS ในไฟล์ server.js ของคุณให้เปลี่ยนมาใช้ชุดนี้แทนได้เลยครับ
app.use(cors({
    origin: function (origin, callback) {
        // 🔓 อนุญาตไฟเขียวให้กับทุกชื่อโดเมนที่ส่งมาจากเว็บ GitHub Pages ของคุณ หรือรันในเครื่องตัวเอง
        if (!origin || origin.indexOf('github.io') !== -1 || origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) {
            callback(null, true);
        } else {
            callback(new Error('ติดสิทธิ์ความปลอดภัย CORS: ไม่อนุญาตให้โดเมนนี้เข้าถึง'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
}));



app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'), // ดึงกุญแจลับจากในโฟลเดอร์มาใช้งาน
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;


function cleanThaiText(text) {
    if (!text) return '';
    return String(text)
        .normalize('NFC')       // แก้สระและวรรณยุกต์ภาษาไทยซ้อนเพี้ยน
        .replace(/\s+/g, '')    // ลบช่องว่างและเว้นวรรคทั้งหมดภายในคำ
        .toLowerCase();         // แปลงภาษาอังกฤษเป็นพิมพ์เล็กทั้งหมด
}
// =============================================================================================================================== //
// =================================== 📦 [ส่วนท้าย: สิ้นสุดระบบรวมโครงสร้างหลักหลังบ้าน] ============================================ //
// =============================================================================================================================== //













// =============================================================================================================================== //
// =================================== 🔐 [ส่วนหัวเรื่อง: เริ่มต้นระบบฟังก์ชันหน้า Login (กล่องที่ 1)] ================================== //
// =============================================================================================================================== //
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
       const client = await auth.getClient(); // ขอบัตรผ่านจากไฟล์ credentials
      const sheets = google.sheets({ version: 'v4', auth: client }); // นำบัตรผ่านไปใช้คุยกับชีต


       const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'AdminUsers!A2:D', 
            });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
        }

        let userFound = null;
        for (const row of rows) {
            const sheetUsername = row[0]; // คอลัมน์ A
            const sheetPassword = row[1]; // คอลัมน์ B
            const sheetName = row[2];     // คอลัมน์ C
            const sheetRole = row[3];     // คอลัมน์ D

            if (sheetUsername && sheetPassword &&
                String(sheetUsername).trim() === String(username).trim() && 
                String(sheetPassword).trim() === String(password).trim()) {
                
                userFound = { username: sheetUsername, name: sheetName || '', role: sheetRole || '' };
                break;
            }
        }

        if (userFound) {
            return res.json({ success: true, message: `ยินดีต้อนรับคุณ ${userFound.name}`, user: userFound });
        } else {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (error) {
        console.error('Google Sheets Error:', error);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลชีต' });
    }
});
// =============================================================================================================================== //
// =================================== 🔐 [ส่วนท้าย: สิ้นสุดระบบฟังก์ชันหน้า Login (กล่องที่ 1)] ====================================== //
// =============================================================================================================================== //
















// =============================================================================================================================== //
// =================================== 🔎 [ส่วนหัวเรื่อง: เริ่มต้นระบบฟังก์ชันการค้นหาข้อมูล (กล่องที่ 2)] ================================= //
// =============================================================================================================================== //
app.post('/api/search', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกคำที่ต้องการค้นหา' });
    }
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'credentials.json'), 
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
           const client = await auth.getClient(); // ขอบัตรผ่านจากไฟล์ credentials
    const sheets = google.sheets({ version: 'v4', auth: client }); // นำบัตรผ่านไปใช้คุยกับชีต

        // 1. ดึงโปรไฟล์พนักงาน
        const profileResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ข้อมูลเบื้องต้น!A5:BH'
        });

        // 2. ดึงประวัติการรักษา
        const historyResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'บันทึกประวัติการรักษา!A3:Z'
        });

        const profileRows = profileResponse.data.values;
        const historyRows = historyResponse.data.values || [];

        if (!profileRows || profileRows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่มีข้อมูลในตารางระบบ' });
        }
        
        const searchKeyword = cleanThaiText(keyword);
        let matchedEmployee = null;

        for (let i = 0; i < profileRows.length; i++) {
            const row = profileRows[i];
            if (!row) continue;
            const isMatch = row.some(cellValue => cleanThaiText(cellValue).includes(searchKeyword));
            if (isMatch) {
                matchedEmployee = {
                    status: "เจอ", 
                    foundRow: i + 5,
                    colG: row[6] || '-',   
                    colB: row[1] || '-',   
                    colD: row[3] || '-',   
                    colC: row[2] || '-',   
                    colJ: row[9] || '-',   
                    colAO: row[40] || '-', 
                    colAP: row[41] || '-', 
                    colAT: row[45] || '-', 
                    colAT: row[45] || '-', 
                    colAU: row[46] || '-'  
                };
                break; 
            }
        }

        if (!matchedEmployee) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงานในระบบ' });
        }

        // 🎯 บล็อกคำสั่งวนลูปประวัติเวอร์ชันปลอดภัยสูง (ไม่กลัวค่าว่างในชีต)
        let userHistory = [];
        historyRows.forEach(hRow => {
            // เช็คก่อนว่ามีแถวข้อมูลจริง และคอลัมน์ชื่อพนักงาน (ดัชนีที่ 10) มีข้อมูล ไม่เป็นค่าว่าง
            if (hRow && hRow[10] !== undefined && hRow[10] !== null && hRow[10].toString().trim() !== '') {
                // ทำการเปรียบเทียบชื่อพนักงาน
                if (cleanThaiText(hRow[10]) === cleanThaiText(matchedEmployee.colG)) {
                    userHistory.push({
                        caseId: hRow[0] || '-',               
                        autoDateTime: hRow[1] || '-',     
                        adminName: hRow[2] || '-',     
                        treatmentDateTime: hRow[3] || '-',    
                        company: hRow[4] || '-',              
                        workLocation: hRow[5] || '-',         
                        hospital: hRow[6] || '-',             
                        symptoms: hRow[7] || '-',    
                        statusText: hRow[11] || '-',  
                        DentalOPD: hRow[12] || '-',        
                        PPUsageOPD: hRow[13] || '-',        
                        PPUsageIPD: hRow[14] || '-',        
                        SLKUsageOpdThB: hRow[15] || '-',        
                        SLKUsageIpdThB: hRow[16] || '-',        
                        SLKUsageOpdLkr: hRow[17] || '-',        
                        SLKUsageIpdLkr: hRow[18] || '-',        
                        OverLimitCreditInsThB: hRow[19] || '-',        
                        OverLimitCreditInsLkr: hRow[20] || '-',        
                        ExchangeRatesIns: hRow[21] || '-',   
                        ExchangeRatesInt: hRow[22] || '-',      
                        ClinicianReportedOutcomes: hRow[23] || '-',        
                        DocumentsAttached: hRow[24] || '-',        
                        notes: hRow[25] || '-'          
                    });
                }
            }
        });

        return res.json({ 
            success: true, 
            employee: matchedEmployee, 
            history: userHistory 
        });

    } catch (error) {
        console.error('Search Error:', error);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลชีตระดับสูงหลังบ้าน' });
    }
});
// =============================================================================================================================== //
// =================================== 🔎 [ส่วนท้าย: สิ้นสุดระบบฟังก์ชันการค้นหาข้อมูล (กล่องที่ 2)] ==================================== //
// =============================================================================================================================== //









// =============================================================================================================================== //
// =================================== 📋 [ส่วนหัวเรื่อง: เริ่มต้นระบบฟังก์ชันสำหรับการเคลม (กล่องที่ 3)] ================================== //
// =============================================================================================================================== //
// 🎯 API ตัวใหม่: ค้นหาและคำนวณเลขเคส ID สูงสุดบวกหนึ่งออโต้ส่งไปที่ฟอร์มเคลมช่องที่ 1
// 🎯 ปรับชื่อ Path เป็น /api/get-next-caseid ให้ตรงกับที่หน้าบ้านใช้เรียกหา
app.get('/api/next-caseId', async (req, res) => {
    try {
        const client = await auth.getClient(); 
        const sheets = google.sheets({ version: 'v4', auth: client }); 

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'บันทึกประวัติการรักษา!A2:A', // พุ่งเป้าไปที่คอลัมน์ A เพื่อหาเลขเคสสูงสุด
        });

        const rows = response.data.values;
        let maxId = 0;
        
        if (rows && rows.length > 0) {
            rows.forEach(row => {
                // ดึงข้อมูลในช่องแรกของแถวนั้น (เนื่องจากดึงมาคอลัมน์เดียว row[0] คือข้อมูลเคส ID)
                if (row && row[0] !== undefined && row[0] !== null) { 
                    const cleanString = row[0].toString().trim();

                    if (cleanString !== '') {
                        const currentNum = parseInt(cleanString, 10);
                        
                        if (!isNaN(currentNum) && currentNum > maxId) {
                            maxId = currentNum; // ล็อกเป้าบันทึกค่าเลขสูงสุด
                        }
                    }
                }           
            });
        }
        
        // สูตรรวมแต้มอัปเกรดอัตโนมัติ: ยอดสูงสุดบวกเพิ่ม 1
        const nextId = maxId + 1;
        return res.json({ success: true, nextId: nextId });

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการคำนวณ Case ID:", error);
        return res.status(500).json({ success: false, message: "ไม่สามารถคำนวณเลขเคสถัดไปได้" });
    }
});



//------------------------------------------------ 🎯 API ตัวรับข้อมูลไปฝาก post หลังบ้าน : ฝั่งหลังบ้าน (Backend Node.js) ---------------------------------------------//
app.post('/api/save-treatment', async (req, res) => {
    const { 
        caseId, autoDateTime, adminName, treatmentDateTime, 
        company, workLocation, hospital, symptoms, 
        insuranceId, size, employeeName, statusText,DentalOPD,
        PPUsageOPD,PPUsageIPD, SLKUsageOpdThB,SLKUsageIpdThB,              
        SLKUsageOpdLkr, SLKUsageIpdLkr,OverLimitCreditInsThB, OverLimitCreditInsLkr,          
        ExchangeRatesIns,ExchangeRatesInt,ClinicianReportedOutcomes,DocumentsAttached,notes
    } = req.body;

        console.log("📦 ข้อมูลที่หน้าบ้านส่งมาจริง:", req.body);
        console.log("👤 แกะชื่อแอดมินได้ค่าว่า:", adminName);




    // ตรวจสอบข้อมูลบังคับฝั่งหลังบ้านอีกชั้นเพื่อความปลอดภัย
    if (!symptoms || symptoms.trim() === '') {
        return res.status(400).json({ success: false, message: 'กรุณากรอกอาการป่วยอย่างละเอียด' });
    }
    if (!hospital) {
        return res.status(400).json({ success: false, message: 'กรุณาเลือกสถานพยาบาล' });
    }

    try {

  // 🔐 1. เปิดใช้ระบบยืนยันตัวตนระดับสูงผ่านสิทธิ์บัญชีบริการ (Service Account)
        // หมายเหตุ: แทนที่คำว่า 'credentials.json' ด้วยชื่อไฟล์คีย์ลับพนักงานบอต .json ของคุณในโฟลเดอร์โครงการครับ
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'credentials.json'), 
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
 // ระบุขอสิทธิ์แก้ไขหน้าแผ่นงาน
        });

  // 2. เรียกเปิดระบบ Google Sheets เวอร์ชัน 4 พ่วงปลั๊กอินความปลอดภัยตัวแปร auth ด้านบน เข้าไปด้วย
          const client = await auth.getClient(); // ขอบัตรผ่านจากไฟล์ credentials
    const sheets = google.sheets({ version: 'v4', auth: client }); // นำบัตรผ่านไปใช้คุยกับชีต



        // เตรียมอาเรย์แถวข้อมูล 1 มิติ (A ถึง z) ตามลำดับเงื่อนไข 1-13 ของคุณ
        const newRow = [
            caseId,          // Col A: เคส ID
            autoDateTime,    // Col B: วันเวลาในระบบปัจจุบัน
            adminName,       // Col C: ชื่อแอดมินที่ Login
            treatmentDateTime, // Col D: วันที่กับเวลาที่เข้ารักษา (ที่นำมารวมกันแล้ว)
            company,         // Col E: ชื่อบริษัท
            workLocation,    // Col F: สถานที่ทำงาน
            hospital,        // Col G: สถานที่รักษา
            symptoms,        // Col H: อาการป่วย
            insuranceId,     // Col I: รหัสประกัน (ถ้าไม่มีระบบจะส่งค่าว่างหรือขีดไปให้)
            size,            // Col J: Size
            employeeName,    // Col K: ชื่อพนักงาน
            statusText,      // Col L: ขั้นตอนการรักษา
            DentalOPD,       // Col M: "ทำฟัน หักวงเงิน OPD"
            PPUsageOPD,        // Col N: "PP OPD"
            PPUsageIPD,       // Col O: "PP IPD"
            SLKUsageOpdThB,             // Col P: "OPD(THB)"
            SLKUsageIpdThB,             // Col Q: "IPD(THB)"
            SLKUsageOpdLkr,             // Col R: "OPD(LKR)"
            SLKUsageIpdLkr,             // Col S: "IPD(LKR)"
            OverLimitCreditInsThB,             // Col T: "ส่วนเกินวงเงินค่ารักษา (THB)"
            OverLimitCreditInsLkr,             // Col U: "ส่วนเกินวงเงินค่ารักษา (LKR)"
            ExchangeRatesIns,             // Col V "เรทค่าเงินที่ประกันคิดให้(THBLKR)"
            ExchangeRatesInt,             // Col W "เรทค่าเงินที่ประกันคิดให้(THBLKR)"
            ClinicianReportedOutcomes,             // Col X "ผลการรักษา"
            DocumentsAttached,             // Col Y "เอกสารที่ต้องแนบ"            
            notes           // Col Z: หมายเหตุ
        ];

        // ยิงคำสั่งเซฟลงบรรทัดล่าสุดของหน้าแผ่นงาน
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'บันทึกประวัติการรักษา!A:Z', 
            valueInputOption: 'USER_ENTERED', // รักษารูปแบบตัวเลขและวันที่ให้แสดงผลถูกต้องบนชีต
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [newRow] },

        });

        return res.json({ success: true, message: 'บันทึกข้อมูลเข้าสู่ประวัติการรักษาเรียบร้อยแล้ว' });

    } catch (error) {
        console.error("Save Error:", error);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงระบบหลังบ้าน' });
    }
});










































// =============================================================================================================================== //
// =================================== 📋 [ส่วนท้าย: สิ้นสุดระบบฟังก์ชันสำหรับการเคลม (กล่องที่ 3)] ===================================== //
// =============================================================================================================================== //




// เปิดสายท่อเชื่อมพอร์ตฟังคำสั่งส่งผ่านข้อมูล
const PORT = 3000;
app.listen(PORT, () => console.log(`Server กำลังรันที่ http://localhost:${PORT}`));
