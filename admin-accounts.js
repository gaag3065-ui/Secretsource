// ศูนย์จัดการสิทธิ์: จัดการบัญชีผู้ใช้งาน (เพิ่ม / แก้ไขชื่อ-ยูสเซอร์-บทบาท-ตำแหน่ง / ตั้งรหัสผ่านใหม่ / ลบ)
// รหัสผ่านส่งไปเข้ารหัส bcrypt ที่เครื่องหลังบ้านก่อนบันทึกลงชีต AdminUsers — หน้าเว็บไม่เก็บและไม่แสดงรหัสผ่าน
(() => {
    const API = `${APP_CONFIG.API_BASE_URL}/api/admin/accounts`;
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    let accounts = [], me = '', editing = null;

    const say = (text, type = '') => { $('accStatus').textContent = text; $('accStatus').dataset.type = type; };

    async function call(method, path, body) {
        const response = await authFetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)');
        if (!response.ok || !data.success) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }

    function render() {
        $('accRows').innerHTML = accounts.map(a => `<tr>
            <td><strong>${esc(a.name)}</strong><small>${esc(a.username)}${a.username.toLowerCase() === me.toLowerCase() ? ' · บัญชีของคุณ' : ''}</small></td>
            <td>${esc(a.position || '-')}</td>
            <td><span class="acc-role ${a.role === 'ADMIN' ? 'is-admin' : ''}">${esc(a.role)}</span></td>
            <td>${a.mfa ? '✅ ตั้งแล้ว' : '⏳ ยังไม่ตั้ง'}</td>
            <td class="acc-act"><button type="button" class="btn" data-edit="${esc(a.username)}">แก้ไข</button>
                <button type="button" class="btn" data-pass="${esc(a.username)}">ตั้งรหัสผ่านใหม่</button>
                <button type="button" class="btn acc-del" data-del="${esc(a.username)}" ${a.username.toLowerCase() === me.toLowerCase() ? 'disabled' : ''}>ลบ</button></td></tr>`).join('')
            || '<tr><td colspan="5">ยังไม่มีบัญชี</td></tr>';
    }

    async function load() {
        try {
            const data = await call('GET', '');
            accounts = data.accounts || []; me = data.me || '';
            render(); say(`ทั้งหมด ${accounts.length} บัญชี`);
        } catch (error) { say(error.message, 'error'); }
    }

    function openForm(account) {
        editing = account || null;
        const form = $('accForm');
        form.reset();
        $('accFormTitle').textContent = account ? `แก้ไขบัญชี ${account.username}` : 'เพิ่มบัญชีใหม่';
        form.elements.username.value = account?.username || '';
        form.elements.name.value = account?.name || '';
        form.elements.position.value = account?.position || '';
        form.elements.role.value = account?.role || 'STAFF';
        $('accPasswordField').hidden = Boolean(account);
        form.elements.password.required = !account;
        $('accDialog').showModal();
    }

    function checkPassword(value) {
        if (value !== value.trim()) return 'รหัสผ่านต้องไม่มีช่องว่างหัวท้าย';
        if (value.length < 12) return 'รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร';
        if (new TextEncoder().encode(value).length > 72) return 'รหัสผ่านยาวเกิน 72 ไบต์';
        return '';
    }

    $('accAdd').onclick = () => openForm(null);
    $('accCancel').onclick = () => $('accDialog').close();
    $('accForm').onsubmit = async event => {
        event.preventDefault();
        const f = event.target.elements;
        const body = { username: f.username.value.trim(), name: f.name.value.trim(), position: f.position.value.trim(), role: f.role.value };
        if (!editing) {
            const problem = checkPassword(f.password.value);
            if (problem) { alert(problem); return; }
            if (f.password.value !== f.password2.value) { alert('รหัสผ่านทั้ง 2 ช่องไม่ตรงกัน'); return; }
            body.password = f.password.value;
        }
        $('accSave').disabled = true;
        try {
            const data = editing ? await call('PUT', `/${encodeURIComponent(editing.username)}`, body) : await call('POST', '', body);
            $('accDialog').close();
            await load();
            say(data.message, 'success');
            window.reloadStaffPermissions?.();
        } catch (error) { alert(error.message); }
        finally { $('accSave').disabled = false; f.password.value = ''; f.password2.value = ''; }
    };

    $('accRows').onclick = async event => {
        const edit = event.target.closest('[data-edit]'), pass = event.target.closest('[data-pass]'), del = event.target.closest('[data-del]');
        if (edit) openForm(accounts.find(a => a.username === edit.dataset.edit));
        if (pass) {
            const username = pass.dataset.pass;
            const password = prompt(`ตั้งรหัสผ่านใหม่ให้ ${username}\n(อย่างน้อย 12 ตัวอักษร ระบบเก็บแบบเข้ารหัส ไม่มีใครเห็นรหัสเดิม)`);
            if (password === null) return;
            const problem = checkPassword(password);
            if (problem) { alert(problem); return; }
            if (prompt('พิมพ์รหัสผ่านใหม่อีกครั้งเพื่อยืนยัน') !== password) { alert('รหัสผ่านไม่ตรงกัน'); return; }
            try { say((await call('PUT', `/${encodeURIComponent(username)}/password`, { password })).message, 'success'); }
            catch (error) { say(error.message, 'error'); }
        }
        if (del) {
            const username = del.dataset.del;
            if (prompt(`ลบบัญชีนี้ถาวร (รวมสิทธิ์และตำแหน่ง)\nพิมพ์ยูสเซอร์ "${username}" เพื่อยืนยัน`) !== username) return;
            try { const done = await call('DELETE', `/${encodeURIComponent(username)}`); await load(); say(done.message, 'success'); window.reloadStaffPermissions?.(); }
            catch (error) { say(error.message, 'error'); }
        }
    };

    addEventListener('DOMContentLoaded', load);
})();
