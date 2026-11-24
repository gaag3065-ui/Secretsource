// Add whole-case deletion independently of the compact-view/report modules.
(() => {
    let busy = false;
    const clean = value => String(value ?? '').trim();
    const caseOf = modal => clean(modal.querySelector('.hc-head h3')?.firstChild?.textContent).replace(/^เคส\s*#/, '').trim();
    const allowed = () => typeof window.hasPermission === 'function' && window.hasPermission('DeleteTreatment');
    const endpoint = async (suffix, body) => {
        const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/history/case-delete${suffix}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error([data.message || 'ลบเคสไม่สำเร็จ', data.recoveryWarning].filter(Boolean).join('\n'));
        return data;
    };
    function removeLocal(data) {
        const deleted = data.deletedRowNumbers.map(Number).sort((a, b) => a - b);
        const remap = list => (Array.isArray(list) ? list : []).filter(item => clean(item.CaseIdNew) !== data.caseId).map(item => {
            const number = Number(item.targetRowNumber);
            return { ...item, targetRowNumber: number - deleted.filter(row => row < number).length };
        });
        window.currentFilteredHistory = remap(window.currentFilteredHistory);
        window.currentIndividualHistory = remap(window.currentIndividualHistory);
        for (const name of ['currentCaseTreatmentEvents', 'currentCaseDocuments']) {
            const index = window[name] || {};
            delete index[data.caseId];
            for (const id of Object.keys(index)) index[id] = remap(index[id]);
        }
        if (window.currentCaseLatest) {
            delete window.currentCaseLatest[data.caseId];
            for (const item of Object.values(window.currentCaseLatest)) {
                const n = Number(item.targetRowNumber); item.targetRowNumber = n - deleted.filter(row => row < n).length;
            }
        }
    }
    async function removeCase(button) {
        if (busy || !allowed()) return;
        const modal = button.closest('#hcModal'), caseId = caseOf(modal);
        const lists = [window.currentFilteredHistory, window.currentIndividualHistory, window.currentCaseTreatmentEvents?.[caseId]];
        const item = lists.flatMap(list => Array.isArray(list) ? list : []).find(row => clean(row.CaseIdNew) === caseId);
        if (!caseId || !clean(item?.insuranceId)) return alert('ไม่พบข้อมูลเคส กรุณารีเฟรชประวัติก่อนลบ');
        busy = true; button.disabled = true; button.textContent = 'กำลังตรวจสอบเคส…'; button.setAttribute('aria-busy', 'true');
        try {
            const body = { caseId, insuranceId: clean(item.insuranceId) };
            const plan = await endpoint('/preview', body);
            const answer = prompt(`ลบทั้งเคส #${caseId} จำนวน ${plan.steps} ขั้นตอน และย้ายไฟล์แนบ ${plan.fileCount} ไฟล์ลงถังขยะ Google Drive\nไฟล์ที่มีเคสอื่นใช้ร่วม ${plan.sharedFileCount} ไฟล์จะเก็บไว้\nพิมพ์เลขเคส ${caseId} เพื่อยืนยัน (ยกเลิกเพื่อกลับ)`);
            if (answer === null) return;
            if (clean(answer) !== caseId) return alert('เลขเคสไม่ตรง ระบบยังไม่ได้ลบข้อมูล');
            button.textContent = 'กำลังลบทั้งเคสและไฟล์…';
            const result = await endpoint('', { ...body, fingerprint: plan.fingerprint, confirmation: clean(answer) });
            removeLocal(result);
            modal.querySelector('[data-hc-close]')?.click();
            window.HistoryCompact?.refresh();
            let warning = '';
            try {
                if (window.historyDisplayMode === 'filtered' && typeof loadFilteredAllHistory === 'function') await loadFilteredAllHistory();
                else if (typeof renderHistoryTable === 'function') renderHistoryTable(window.currentIndividualHistory);
            } catch { warning = '\nลบสำเร็จแล้ว แต่โหลดตารางใหม่ไม่สำเร็จ กรุณากรองประวัติอีกครั้ง'; }
            Promise.resolve(window.refreshSelectedTreatmentLimits?.(body.insuranceId)).catch(() => {});
            Promise.resolve(window.refreshContinuitySummary?.()).catch(() => {});
            alert(`ลบเคส #${caseId} ครบ ${result.deletedRows} ขั้นตอนแล้ว\nย้ายไฟล์ลงถังขยะ Drive ${result.trashedFiles} ไฟล์${result.sharedFiles ? `\nเก็บไฟล์ที่ใช้ร่วมกับเคสอื่น ${result.sharedFiles} ไฟล์` : ''}${result.missingFiles ? `\nไม่พบไฟล์ต้นทาง ${result.missingFiles} ไฟล์` : ''}${result.logWarning ? `\n${result.logWarning}` : ''}${warning}`);
        } catch (error) { alert(error.message || 'ติดต่อระบบลบเคสไม่สำเร็จ'); }
        finally { busy = false; button.disabled = false; button.textContent = '🗑️ ลบทั้งเคส'; button.removeAttribute('aria-busy'); }
    }
    function attach() {
        const modal = document.getElementById('hcModal'), heading = modal?.querySelector('#hcTimeline h4');
        if (!heading || heading.querySelector('[data-delete-whole-case]') || !allowed()) return;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'hc-btn is-del'; button.dataset.deleteWholeCase = '';
        button.textContent = '🗑️ ลบทั้งเคส'; button.addEventListener('click', () => removeCase(button));
        // Local action row wraps on phones; do not inherit the legacy floated update button.
        const update = heading.querySelector('[data-hc-update-modal]');
        heading.style.display = 'flex'; heading.style.flexWrap = 'wrap'; heading.style.alignItems = 'center'; heading.style.gap = '8px';
        if (update) { update.style.float = 'none'; update.style.setProperty('margin', '0', 'important'); }
        heading.insertBefore(button, update);
    }
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
    attach();
})();
