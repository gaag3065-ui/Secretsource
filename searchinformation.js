
// function initSearchBoxEvents() {
//#region
function initSearchBoxEvents() {
    // 👁️ ใช้เมาส์คลิกปุ่มค้นหา
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.onclick = function() {
            console.log("🔍 [System Trigger] ปุ่มค้นหากล่องฝั่งซ้ายตื่นขึ้นมาทำงานแล้ว!");
            performSearch();
        };
    }

    // 👁️ กดปุ่ม Enter บนคีย์บอร์ดในช่องกรอก
    const keywordInput = document.getElementById('keywordInput');
    if (keywordInput) {
        keywordInput.onkeypress = function(e) {
            if (e.key === 'Enter') {
                console.log("⌨️ [System Trigger] ตรวจพบการกดปุ่ม Enter ในช่องกรอก!");
                performSearch();
            }
        };
    }
    console.log("🔒 บันทึกสิทธิ์สำเร็จ: ปุ่มค้นหากล่องฝั่งซ้ายพร้อมสั่งการแล้วครับ");
}
//#endregion



// ล็อกหรือปลดล็อกฟอร์มเปิดเคส จนกว่าจะเลือกพนักงาน
//#region setTreatmentFormLocked
function setTreatmentFormLocked(locked) {
    const claimForm = document.getElementById('claimForm');

    if (!claimForm) return false;

    claimForm
        .querySelectorAll('input, select, textarea, button')
        .forEach((element) => {
            if (locked) {
                if (!element.dataset.originalDisabled) {
                    element.dataset.originalDisabled =
                        element.disabled ? 'true' : 'false';
                }

                element.disabled = true;
            } else {
                element.disabled =
                    element.dataset.originalDisabled === 'true';
            }
        });

    claimForm.classList.toggle(
        'employee-not-selected',
        locked
    );

    return true;
}
//#endregion

// ล็อกฟอร์มก่อนเลือกพนักงาน และเปิดช่องกรอกหลังเลือก โดยคงช่องระบบไว้
//#region setTreatmentFormLocked
function setTreatmentFormLocked(locked) {
    const claimForm =
        document.getElementById('claimForm');

    if (!claimForm) return false;

    const systemControlledIds = new Set([
        'treatmentDate',
        'treatmentTime',
        'caseId'
    ]);

    claimForm
        .querySelectorAll(
            'input, select, textarea, button'
        )
        .forEach((element) => {
            if (locked) {
                element.disabled = true;
                return;
            }

            element.disabled =
                systemControlledIds.has(element.id);
        });

    claimForm.classList.toggle(
        'employee-not-selected',
        locked
    );

    return true;
}
//#endregion

// คัดลอกข้อความ พร้อมแสดงผลบนปุ่มชั่วคราว
//#region copyEmployeeValue
async function copyEmployeeValue(value, button) {
    const text = String(value ?? '').trim();

    if (!text || text === '-') return;

    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        const temporaryInput =
            document.createElement('textarea');

        temporaryInput.value = text;
        temporaryInput.style.position = 'fixed';
        temporaryInput.style.opacity = '0';

        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        document.execCommand('copy');
        temporaryInput.remove();
    }

    const originalText = button.textContent;

    button.textContent = 'Copied';
    button.classList.add('copied');

    window.setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, 1200);
}
//#endregion


// ค้นหาพนักงาน แสดงรายการย่อ และเลือกก่อนเปิดใช้งานฟอร์ม
//#region performSearch
async function performSearch() {
    if (performSearch.isRunning) return;

    const keywordInput =
        document.getElementById('keywordInput');

    const messageDiv =
        document.getElementById('message');

    const resultsList =
        document.getElementById('resultsList');

    const tableBody =
        document.getElementById('tableBodyResult');

    const keyword =
        String(keywordInput?.value || '').trim();

    resultsList.innerHTML = '';

    if (tableBody) {
        tableBody.innerHTML = '';
    }

    setTreatmentFormLocked(true);

    if (
        typeof window.renderHistoryTable ===
        'function'
    ) {
        window.renderHistoryTable([]);
    }

    const hiddenInputIds = [
        'hiddenEmpName',
        'hiddenCompany',
        'hiddenSize',
        'hiddenWorkLocation',
        'hiddenInsuranceId'
    ];

    hiddenInputIds.forEach((id) => {
        const element = document.getElementById(id);

        if (element) {
            element.value = '';
        }
    });

    if (!keyword) {
        messageDiv.textContent =
            'กรุณากรอกคำที่ต้องการค้นหา';

        messageDiv.style.color = 'red';
        return;
    }

    performSearch.isRunning = true;

    messageDiv.textContent =
        'กำลังค้นหาข้อมูล...';

    messageDiv.style.color = '#4b5563';

    const searchButton =
        document.querySelector(
            '#employeeSearch button[type="submit"], ' +
            '#searchForm button[type="submit"], ' +
            '#keywordInput + button'
        );

    if (searchButton) {
        searchButton.disabled = true;
        searchButton.dataset.originalText =
            searchButton.textContent;

        searchButton.textContent = 'กำลังค้นหา...';
    }

    const escapeHtml = (value) =>
        String(value ?? '-')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');

    const createInformationRow = (
        label,
        value
    ) => {
        const displayValue =
            String(value ?? '').trim() || '-';

        return `
            <div class="employee-detail-row">
                <span class="employee-detail-label">
                    ${escapeHtml(label)}
                </span>

                <span class="employee-detail-value">
                    ${escapeHtml(displayValue)}
                </span>

                <button
                    type="button"
                    class="employee-copy-button"
                    data-copy-value="${escapeHtml(displayValue)}"
                    ${displayValue === '-' ? 'disabled' : ''}
                >
                    Copy
                </button>
            </div>
        `;
    };

    const selectEmployee = (
        employee,
        selectedItem
    ) => {
        document
            .querySelectorAll(
                '#resultsList .employee-result-option'
            )
            .forEach((item) => {
                item.classList.remove('selected');
                item.setAttribute(
                    'aria-selected',
                    'false'
                );

                const details =
                    item.querySelector(
                        '.employee-expanded-details'
                    );

                if (details) {
                    details.hidden = true;
                }
            });

        selectedItem.classList.add('selected');

        selectedItem.setAttribute(
            'aria-selected',
            'true'
        );

        const selectedDetails =
            selectedItem.querySelector(
                '.employee-expanded-details'
            );

        if (selectedDetails) {
            selectedDetails.hidden = false;
        }

        const hiddenEmployeeValues = {
            hiddenEmpName: employee.colG || '-',
            hiddenCompany: employee.colB || '-',
            hiddenSize: employee.colD || '-',
            hiddenWorkLocation: employee.colK || '-',
            hiddenInsuranceId: employee.colC || '-'
        };

        Object.entries(hiddenEmployeeValues)
            .forEach(([elementId, value]) => {
                const element =
                    document.getElementById(elementId);

                if (element) {
                    element.value = value;
                }
            });

        setTreatmentFormLocked(false);

        window.setSlkColumnsVisibility(
            window.isSlkWorkLocation(employee.colK)
        );

        if (
            typeof window.renderHistoryTable ===
            'function'
        ) {
            window.renderHistoryTable(
                Array.isArray(employee.history)
                    ? employee.history
                    : []
            );
        }

        messageDiv.textContent =
            `เลือก ${employee.colG || '-'} | ` +
            `${employee.colE || '-'} | ` +
            `${employee.colC || '-'}`;

        messageDiv.style.color = '#15803d';
    };

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/search`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({ keyword })
            }
        );

        const data = await response.json();

        const employees =
            Array.isArray(data.employees)
                ? data.employees
                : (
                    data.employee
                        ? [data.employee]
                        : []
                );

        if (
            !response.ok ||
            !data.success ||
            employees.length === 0
        ) {
            messageDiv.textContent =
                data.message ||
                'ไม่พบข้อมูลพนักงาน';

            messageDiv.style.color = 'red';
            return;
        }

        messageDiv.textContent =
            `พบ ${employees.length} รายการ ` +
            'กรุณาคลิกเลือกพนักงาน';

        messageDiv.style.color = '#166534';

        const instruction =
            document.createElement('div');

        instruction.className =
            'employee-selection-instruction';

        instruction.textContent =
            'กรุณาคลิกเลือกพนักงาน';

        resultsList.appendChild(instruction);

        employees.forEach((employee) => {
            const item =
                document.createElement('div');

            item.className =
                'employee-result-option';

            item.tabIndex = 0;
            item.setAttribute('role', 'option');
            item.setAttribute(
                'aria-selected',
                'false'
            );

            item.innerHTML = `
                <div class="employee-summary-line">
                    <span class="employee-summary-name">
                        ${escapeHtml(employee.colG)}
                    </span>

                    <span class="employee-summary-divider">
                        |
                    </span>

                    <span>
                        ${escapeHtml(employee.colE)}
                    </span>

                    <span class="employee-summary-divider">
                        |
                    </span>

                    <span>
                        ${escapeHtml(employee.colC)}
                    </span>

                    <span class="employee-summary-arrow">
                        ▾
                    </span>
                </div>

                <div
                    class="employee-expanded-details"
                    hidden
                >
                    <p class="employee-found-row">
                        ผลลัพธ์: เจอ
                        (แถวที่ ${escapeHtml(employee.foundRow)})
                    </p>

                    ${createInformationRow(
                        'ชื่อ',
                        employee.colG
                    )}

                    ${createInformationRow(
                        'บริษัท',
                        employee.colB
                    )}

                    ${createInformationRow(
                        'รหัสพนักงาน',
                        employee.colE
                    )}

                    ${createInformationRow(
                        'SIZE',
                        employee.colD
                    )}

                    ${createInformationRow(
                        'InsuranceId',
                        employee.colC
                    )}

                    ${createInformationRow(
                        'สถานที่ทำงาน',
                        employee.colK
                    )}

                    ${createInformationRow(
                        'วงเงิน OPD',
                        employee.colAV
                    )}

                    ${createInformationRow(
                        'วงเงิน IPD',
                        employee.colAW
                    )}

                    ${createInformationRow(
                        'วงเงิน OPD คงเหลือ',
                        employee.colBA
                    )}

                    ${createInformationRow(
                        'วงเงิน IPD คงเหลือ',
                        employee.colBB
                    )}
                </div>
            `;

            const selectCurrentEmployee = () => {
                selectEmployee(employee, item);
            };

            item.addEventListener(
                'click',
                (event) => {
                    const copyButton =
                        event.target.closest(
                            '.employee-copy-button'
                        );

                    if (copyButton) {
                        event.stopPropagation();

                        copyEmployeeValue(
                            copyButton.dataset.copyValue,
                            copyButton
                        );

                        return;
                    }

                    selectCurrentEmployee();
                }
            );

            item.addEventListener(
                'keydown',
                (event) => {
                    if (
                        event.key === 'Enter' ||
                        event.key === ' '
                    ) {
                        event.preventDefault();
                        selectCurrentEmployee();
                    }
                }
            );

            resultsList.appendChild(item);
        });

        /*
         * ไม่เลือกอัตโนมัติแม้พบเพียงหนึ่งคน
         * ผู้ใช้ต้องคลิกยืนยันพนักงานก่อนเสมอ
         */
        setTreatmentFormLocked(true);
    } catch (error) {
        console.error(
            'Employee search error:',
            error
        );

        messageDiv.textContent =
            'เกิดข้อผิดพลาดในการค้นหาข้อมูล';

        messageDiv.style.color = 'red';

        setTreatmentFormLocked(true);
    } finally {
        performSearch.isRunning = false;

        if (searchButton) {
            searchButton.disabled = false;

            searchButton.textContent =
                searchButton.dataset.originalText ||
                'ค้นหา';
        }
    }
}
//#endregion
