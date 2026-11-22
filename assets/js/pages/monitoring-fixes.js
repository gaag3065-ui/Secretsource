document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('conversationList');
    const clearButton = document.getElementById('clearUnreadButton');

    list?.addEventListener('click', event => {
        event.target.closest('.conversation-item')
            ?.querySelector('.unread')
            ?.remove();
    });

    clearButton?.addEventListener('click', async () => {
        clearButton.disabled = true;

        try {
            const response = await window.authFetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/line-oa/monitoring/read-all`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                }
            );

            const contentType =
                response.headers.get('content-type') || '';

            if (!contentType.includes('application/json')) {
                throw new Error(
                    'Backend ยังไม่รองรับฟังก์ชันนี้ กรุณารีสตาร์ต Backend แล้วลองใหม่'
                );
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'ไม่สามารถปรับสถานะข้อความได้');
            }

            document
                .querySelectorAll('#conversationList .unread')
                .forEach(badge => badge.remove());

            clearButton.textContent = 'อ่านทั้งหมดแล้ว';
            window.setTimeout(() => {
                clearButton.textContent = 'ทำเครื่องหมายว่าอ่านทั้งหมด';
            }, 1800);
        } catch (error) {
            window.alert(error.message);
        } finally {
            clearButton.disabled = false;
        }
    });
});
