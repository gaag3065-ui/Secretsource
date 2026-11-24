// accommodation.js ส่วนที่ 10/10 (บรรทัดเดิม 2251–2471) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
//function openAccommodationReport() {
//#region
function openAccommodationReport() {
    const modal = document.getElementById(
        'accommodationReportModal'
    );

    const reportBody = document.getElementById(
        'accommodationReportBody'
    );

    if (!modal || !reportBody) return;

    reportBody.replaceChildren();

    const companyGroups = groupBy(
        accommodationState.records,
        employee => employee.company
    );

    const companyNames =
        Object.keys(companyGroups).sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    'th',
                    { numeric: true }
                )
        );

    if (companyNames.length === 0) {
        const emptyRow =
            document.createElement('tr');

        const emptyCell =
            document.createElement('td');

        emptyCell.colSpan = 6;
        emptyCell.textContent =
            'No accommodation data';

        emptyRow.appendChild(emptyCell);
        reportBody.appendChild(emptyRow);
    }

    companyNames.forEach((companyName) => {
        const employees =
            companyGroups[companyName].sort(
                (a, b) =>
                    a.workArea.localeCompare(
                        b.workArea,
                        'th',
                        { numeric: true }
                    ) ||
                    a.building.localeCompare(
                        b.building,
                        'th',
                        { numeric: true }
                    ) ||
                    a.floor.localeCompare(
                        b.floor,
                        'th',
                        { numeric: true }
                    ) ||
                    a.room.localeCompare(
                        b.room,
                        'th',
                        { numeric: true }
                    ) ||
                    a.employeeName.localeCompare(
                        b.employeeName,
                        'th'
                    )
            );

        employees.forEach((employee, index) => {
            const row = document.createElement('tr');

            if (index === 0) {
                row.classList.add(
                    'company-group-start'
                );

                const companyCell =
                    document.createElement('td');

                companyCell.rowSpan =
                    employees.length;

                companyCell.className =
                    'report-company-cell';

                companyCell.textContent =
                    `${companyName} ` +
                    `(${employees.length})`;

                row.appendChild(companyCell);
            }

            [
                employee.employeeName,
                employee.workArea,
                employee.building,
                employee.floor,
                employee.room
            ].forEach((value) => {
                const cell =
                    document.createElement('td');

                cell.textContent = value || '-';
                row.appendChild(cell);
            });

            reportBody.appendChild(row);
        });
    });

    showExclusiveOverlay('accommodationReportModal');
}

function closeAccommodationReport() {
    const modal = document.getElementById(
        'accommodationReportModal'
    );

    closeExclusiveOverlay('accommodationReportModal');
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (!document.getElementById('imagePreviewModal')?.hasAttribute('hidden')) closeImagePreview();
        else if (!document.getElementById('managementModal')?.hasAttribute('hidden')) closeManagementModal();
        else if (!document.getElementById('accommodationReportModal')?.hasAttribute('hidden')) closeAccommodationReport();
    }
});
//#endregion

//#region downloadAccommodationReports — ดาวน์โหลดรายงานห้องพักแยกบริษัท
async function downloadAccommodationReports() {
    const button =
        document.getElementById('accommodationReportButton');

    try {
        if (button?.disabled) return;

        if (button) {
            button.disabled = true;
            button.textContent = 'กำลังสร้างรายงาน...';
        }

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/accommodation/reports`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || 'ไม่สามารถสร้างรายงานได้'
            );
        }

        if (!Array.isArray(result.files) || !result.files.length) {
            throw new Error('ไม่พบข้อมูลพนักงาน ON WORK สำหรับสร้างรายงาน');
        }

        for (const file of result.files) {
            const binaryText = atob(file.contentBase64);
            const bytes = new Uint8Array(binaryText.length);

            for (let index = 0; index < binaryText.length; index += 1) {
                bytes[index] = binaryText.charCodeAt(index);
            }

            const blob = new Blob(
                [bytes],
                {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            );

            const fileUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');

            downloadLink.href = fileUrl;
            downloadLink.download = file.fileName;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();

            setTimeout(() => {
                URL.revokeObjectURL(fileUrl);
            }, 1000);

            await new Promise(resolve => {
                setTimeout(resolve, 350);
            });
        }

        alert(
            `สร้างรายงานสำเร็จ ${result.fileCount} ไฟล์\n` +
            `ประจำเดือน ${result.reportMonth} ${result.reportYear}`
        );
    } catch (error) {
        console.error('Download accommodation reports error:', error);
        alert(`ไม่สามารถสร้างรายงานได้: ${error.message}`);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'จัดทำรายงานส่งส่วนกลาง';
        }
    }
}
//#endregion downloadAccommodationReports
