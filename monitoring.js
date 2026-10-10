document.addEventListener('DOMContentLoaded', async () => {
    const query = new URLSearchParams(window.location.search);
    const isConversationEmbed = query.get('view') === 'conversations';
    if (isConversationEmbed) document.body.classList.add('is-conversation-embed');
    const apiBase = window.APP_CONFIG?.API_BASE_URL || '';
    const state = { channels: [], conversations: [], activeChannel: 'all', activeConversation: null, messages: [], renderedKeys: [], canReply: false, canEdit: true, notes: [], profileSignature: '', noteDraft: '', editingNote: null, pendingFiles: [], profileTab: 'media', viewerItems: [], viewerIndex: 0 };
    const el = Object.fromEntries(['connectionState','refreshButton','conversationSearch','channelTabs','conversationList','conversationHeader','messageList','replyForm','replyInput','sendButton','replyHint','profileCard','toast','scrollToTopButton','scrollToBottomButton','newMessageIndicator','attachButton','stickerButton','fileInput','attachmentTray','stickerPicker','conversationPanel','dropOverlay','mediaViewer','viewerTitle','viewerMeta','viewerStage','viewerPrev','viewerNext','viewerRename','viewerDownload','viewerClose','renameDialog','renameForm','renameTitle','renameInput','renameHint','renameCancel'].map(id => [id, document.getElementById(id)]));

    // หน้านี้เปิดได้แบบ standalone/ฝังใน iframe โดยไม่ผ่านสคริปต์โหลดสิทธิ์ของ search.html เลย
    // จึงต้องเช็คสิทธิ์ ViewMonitoring/ReplyMonitoring เองจาก /api/session ก่อนแสดงข้อมูลใด ๆ
    // (ฝั่งหลังบ้านก็บังคับสิทธิ์เดียวกันนี้อยู่แล้ว จุดนี้เป็นแค่ชั้น UX ให้สอดคล้องกัน)
    let canView = false;
    try {
        const sessionResponse = await window.authFetch(`${apiBase}/api/session`, { cache: 'no-store' });
        const sessionData = await sessionResponse.json();
        if (sessionData.csrfToken) sessionStorage.setItem('csrfToken', sessionData.csrfToken);
        const isAdmin = String(sessionData.user?.role || '').trim().toUpperCase() === 'ADMIN';
        const perms = sessionData.permissions || {};
        canView = isAdmin || perms.ViewMonitoring === true;
        state.canReply = isAdmin || perms.ReplyMonitoring === true;
    } catch (error) {
        canView = false;
    }

    if (!canView) {
        document.querySelector('.monitoring-shell').innerHTML =
            '<div class="empty-state" style="margin:auto;"><b>ไม่มีสิทธิ์เข้าถึง</b><span>บัญชีนี้ยังไม่ได้รับสิทธิ์ดูข้อความ LINE OA กรุณาติดต่อผู้ดูแลระบบ</span></div>';
        return;
    }

    if (!state.canReply) {
        el.replyInput.placeholder = 'บัญชีนี้ไม่มีสิทธิ์ตอบกลับข้อความ';
        document.body.classList.add('is-read-only');
    }

    const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file']);
    const MESSAGE_TYPES = new Set(['text', 'image', 'video', 'audio', 'file', 'sticker', 'location', 'imagemap', 'template', 'flex']);
    // แพ็กสติกเกอร์ที่ LINE อนุญาตให้บัญชี OA ส่งผ่าน Messaging API ได้
    const STICKER_PACKAGES = [
        { packageId: '11537', from: 52002734, to: 52002773 },
        { packageId: '11538', from: 51626494, to: 51626533 },
        { packageId: '11539', from: 52114110, to: 52114149 },
        { packageId: '446', from: 1988, to: 2027 },
        { packageId: '789', from: 10855, to: 10894 },
        { packageId: '1070', from: 17839, to: 17878 }
    ];

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
    const linkify = value => escapeHtml(value).replace(/https?:\/\/[^\s<]+/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    const formatTime = value => value ? new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '';
    const formatDay = value => { const date = new Date(value); const today = new Date(); const yesterday = new Date(Date.now() - 864e5); if (date.toDateString() === today.toDateString()) return 'วันนี้'; if (date.toDateString() === yesterday.toDateString()) return 'เมื่อวาน'; return new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(date); };
    const formatSize = bytes => { const n = Number(bytes); if (!n && n !== 0 || Number.isNaN(n)) return ''; if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n/1024).toFixed(1)} KB`; return `${(n/1048576).toFixed(1)} MB`; };
    const formatDuration = ms => { const s = Math.round(Number(ms || 0) / 1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
    const avatar = (url, label, large = false) => url ? `<img class="avatar${large?' large':''}" src="${escapeHtml(url)}" alt="">` : `<div class="avatar${large?' large':''} placeholder">${escapeHtml(String(label||'OA').slice(0,2))}</div>`;
    const stickerUrl = id => `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(id)}/android/sticker.png`;
    function notify(message, error=false){ el.toast.textContent=message; el.toast.className=`toast is-visible${error?' is-error':''}`; clearTimeout(notify.timer); notify.timer=setTimeout(()=>el.toast.className='toast',2600); }
    async function request(path, options={}) { const response=await window.authFetch(`${apiBase}${path}`,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.message||'ไม่สามารถเชื่อมต่อระบบได้'); return data; }
    const conversationPath = (conversation = state.activeConversation) => `/api/line-oa/conversations/${encodeURIComponent(conversation.id)}`;
    const findMessage = id => state.messages.find(message => message.id === id);
    const extensionOf = name => (String(name).match(/\.([a-z0-9]{1,6})$/i)?.[1] || '').toLowerCase();
    const displayFileName = message => message.fileName || `LINE_${message.type}_${String(message.id).slice(-12)}.${{ image:'jpg', video:'mp4', audio:'m4a' }[message.type] || 'bin'}`;

    // ---------------------------------------------------------------- media (ต้องแนบ Bearer token จึงโหลดเป็น blob แทน <img src>)
    const blobCache = new Map();
    function mediaBlobUrl(message, variant = 'original', conversation = state.activeConversation) {
        const key = `${conversation.channelId}|${conversation.id}|${message.id}|${variant}`;
        if (!blobCache.has(key)) {
            const promise = (async () => {
                const response = await window.authFetch(`${apiBase}${conversationPath(conversation)}/messages/${encodeURIComponent(message.id)}/content?channelId=${encodeURIComponent(conversation.channelId)}&variant=${variant}&v=2`);
                if (!response.ok) { const data = await response.json().catch(() => ({})); const error = new Error(data.message || 'ไม่สามารถเปิดไฟล์ได้'); error.code = data.code; throw error; }
                const blob = await response.blob();
                return { url: URL.createObjectURL(blob), blob };
            })();
            promise.catch(() => blobCache.delete(key)); // ให้ลองใหม่ได้ (เช่น LINE ยังแปลงวิดีโอไม่เสร็จ)
            blobCache.set(key, promise);
        }
        return blobCache.get(key);
    }
    const lazyObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { lazyObserver.unobserve(entry.target); hydrateMedia(entry.target); } }), { rootMargin: '300px' });
    async function hydrateMedia(node) {
        const message = findMessage(node.dataset.load);
        if (!message || !state.activeConversation) return;
        node.classList.remove('is-error'); node.classList.add('is-loading');
        try {
            const { url } = await mediaBlobUrl(message, node.dataset.variant || 'original');
            if (node.tagName === 'IMG') node.src = url; else if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') node.src = url;
            node.classList.remove('is-loading');
        } catch (error) {
            node.classList.remove('is-loading'); node.classList.add('is-error');
            node.closest('.media-frame')?.setAttribute('data-error', error.code === 'MEDIA_PROCESSING' ? 'LINE กำลังเตรียมไฟล์ แตะเพื่อลองใหม่' : error.message);
        }
    }
    function observeMedia(root) { root.querySelectorAll('[data-load]').forEach(node => lazyObserver.observe(node)); }
    async function downloadMessage(message) {
        try {
            notify('กำลังดาวน์โหลด...');
            const { blob } = await mediaBlobUrl(message, 'original');
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url; link.download = message.fileName || displayFileName(message).replace(/\.[^.]+$/, `.${{ 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3' }[blob.type] || extensionOf(displayFileName(message))}`); document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) { notify(error.message, true); }
    }

    // ---------------------------------------------------------------- render
    function renderChannels(){ const items=[{id:'all',name:'ทั้งหมด'},...state.channels]; el.channelTabs.innerHTML=items.map(item=>`<button class="channel-tab${state.activeChannel===item.id?' is-active':''}" data-channel="${escapeHtml(item.id)}" type="button">${escapeHtml(item.name)}</button>`).join(''); }
    function filteredConversations(){ const query=el.conversationSearch.value.trim().toLocaleLowerCase('th'); return state.conversations.filter(item=>(state.activeChannel==='all'||item.channelId===state.activeChannel)&&(!query||`${item.displayName} ${item.lineDisplayName||''} ${item.lastMessage} ${item.note||''}`.toLocaleLowerCase('th').includes(query))); }
    function renderConversations(){ const rows=filteredConversations(); el.conversationList.innerHTML=rows.length?rows.map(item=>`<button type="button" class="conversation-item${state.activeConversation?.id===item.id&&state.activeConversation?.channelId===item.channelId?' is-active':''}" data-id="${escapeHtml(item.id)}" data-channel="${escapeHtml(item.channelId)}">${avatar(item.pictureUrl,item.displayName)}<span class="conversation-copy"><strong>${escapeHtml(item.displayName||'ไม่ทราบชื่อ')}</strong><span>${escapeHtml(item.lastMessage||'ไม่มีข้อความตัวอย่าง')}</span></span><span><span class="conversation-time">${formatTime(item.updatedAt)}</span>${item.unreadCount?`<i class="unread">${item.unreadCount}</i>`:''}</span></button>`).join(''):`<div class="empty-state"><b>ไม่พบห้องสนทนา</b><span>ลองเลือกบัญชีหรือเปลี่ยนคำค้นหา</span></div>`; }

    const fileIcon = name => { const ext = extensionOf(name); if (ext === 'pdf') return 'PDF'; if (['xls','xlsx','csv'].includes(ext)) return 'XLS'; if (['doc','docx'].includes(ext)) return 'DOC'; if (['ppt','pptx'].includes(ext)) return 'PPT'; if (['zip','rar','7z'].includes(ext)) return 'ZIP'; return (ext || 'FILE').slice(0,4).toUpperCase(); };
    const renameButton = message => state.canEdit ? `<button type="button" class="file-action" data-action="rename-file" data-id="${escapeHtml(message.id)}">เปลี่ยนชื่อ</button>` : '';
    function bubbleContent(message) {
        const payload = message.payload || {};
        const id = escapeHtml(message.id);
        if (message.unsent) return `<div class="bubble is-unsent">ข้อความนี้ถูกยกเลิกแล้ว<time>${formatTime(message.timestamp)}</time></div>`;
        if (message.type === 'image') return `<div class="bubble is-media"><button type="button" class="media-frame" data-action="view" data-id="${id}"><img data-load="${id}" data-variant="preview" alt="รูปภาพ"></button><time>${formatTime(message.timestamp)}</time></div>`;
        if (message.type === 'video') return `<div class="bubble is-media"><button type="button" class="media-frame is-video" data-action="view" data-id="${id}"><img data-load="${id}" data-variant="preview" alt="วิดีโอ"><span class="play-icon">▶</span>${payload.duration ? `<span class="media-duration">${formatDuration(payload.duration)}</span>` : ''}</button><time>${formatTime(message.timestamp)}</time></div>`;
        if (message.type === 'audio') return `<div class="bubble is-audio"><div class="media-frame audio-frame"><audio controls preload="none" data-load="${id}"></audio></div><div class="file-actions"><span>🎤 ${payload.duration ? formatDuration(payload.duration) : 'ข้อความเสียง'}</span><button type="button" class="file-action" data-action="download" data-id="${id}">ดาวน์โหลด</button></div><time>${formatTime(message.timestamp)}</time></div>`;
        if (message.type === 'file') { const name = displayFileName(message); return `<div class="bubble is-file"><button type="button" class="file-card" data-action="view" data-id="${id}"><span class="file-icon">${escapeHtml(fileIcon(name))}</span><span class="file-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(formatSize(message.fileSize))}${message.originalFileName && message.originalFileName !== name ? ` · เดิม: ${escapeHtml(message.originalFileName)}` : ''}</small></span></button><div class="file-actions"><button type="button" class="file-action" data-action="download" data-id="${id}">ดาวน์โหลด</button>${renameButton(message)}</div><time>${formatTime(message.timestamp)}</time></div>`; }
        if (message.type === 'sticker') return `<div class="bubble is-sticker"><img src="${stickerUrl(payload.stickerId)}" alt="สติกเกอร์" loading="lazy"><time>${formatTime(message.timestamp)}</time></div>`;
        if (message.type === 'location') { const map = `https://www.google.com/maps?q=${encodeURIComponent(`${payload.latitude},${payload.longitude}`)}`; return `<div class="bubble is-location"><a href="${map}" target="_blank" rel="noopener noreferrer" class="location-card"><span class="file-icon">📍</span><span class="file-copy"><strong>${escapeHtml(payload.title || 'ตำแหน่งที่ตั้ง')}</strong><small>${escapeHtml(payload.address || `${payload.latitude}, ${payload.longitude}`)}</small></span></a><time>${formatTime(message.timestamp)}</time></div>`; }
        return `<div class="bubble">${linkify(message.text || message.summary || '[ข้อความชนิดอื่น]')}<time>${formatTime(message.timestamp)}</time></div>`;
    }
    const messageKey = message => `${message.id}|${message.fileName}|${message.unsent ? 1 : 0}`;
    const dayKey = timestamp => new Date(timestamp).toDateString();
    function messagesHtml(messages, start) {
        return messages.slice(start).map((message, offset) => {
            const index = start + offset; const previous = messages[index - 1];
            const divider = !previous || dayKey(previous.timestamp) !== dayKey(message.timestamp) ? `<div class="day-divider"><span>${escapeHtml(formatDay(message.timestamp))}</span></div>` : '';
            if (!MESSAGE_TYPES.has(message.type)) return `${divider}<div class="system-event">${escapeHtml(message.summary || message.type)} · ${formatTime(message.timestamp)}</div>`;
            return `${divider}<div class="message-row ${message.direction==='outbound'?'outbound':'inbound'}" data-message="${escapeHtml(message.id)}">${bubbleContent(message)}</div>`;
        }).join('');
    }
    function renderHeader(info) {
        el.conversationHeader.innerHTML = `${avatar(info.pictureUrl,info.displayName)}<div class="header-copy"><strong>${escapeHtml(info.displayName)}${state.canEdit ? ' <button type="button" class="inline-edit" data-action="rename-contact" title="เปลี่ยนชื่อ">✎</button>' : ''}</strong><small>${escapeHtml(info.channelName)} · ${escapeHtml(info.status||'พร้อมสนทนา')}</small></div>`;
    }
    function renderProfile(info, keepDraft = false) {
        const focus = captureNoteFocus(); // วาดใหม่ได้โดยไม่ทำให้โน้ตที่กำลังพิมพ์หาย/เคอร์เซอร์หลุด
        const media = state.messages.filter(message => !message.unsent && ['image','video'].includes(message.type)).reverse();
        const files = state.messages.filter(message => !message.unsent && ['file','audio'].includes(message.type)).reverse();
        const gallery = state.profileTab === 'media'
            ? (media.length ? `<div class="media-grid">${media.map(message => `<button type="button" class="media-frame grid-item${message.type==='video'?' is-video':''}" data-action="view" data-id="${escapeHtml(message.id)}"><img data-load="${escapeHtml(message.id)}" data-variant="preview" alt="">${message.type==='video'?'<span class="play-icon">▶</span>':''}</button>`).join('')}</div>` : '<p class="muted">ยังไม่มีรูปภาพหรือวิดีโอ</p>')
            : (files.length ? `<ul class="file-list">${files.map(message => `<li><button type="button" class="file-link" data-action="view" data-id="${escapeHtml(message.id)}"><span class="file-icon small">${escapeHtml(message.type==='audio'?'🎤':fileIcon(displayFileName(message)))}</span><span class="file-copy"><strong>${escapeHtml(displayFileName(message))}</strong><small>${escapeHtml(formatSize(message.fileSize))} · ${escapeHtml(new Date(message.timestamp).toLocaleDateString('th-TH'))}</small></span></button><button type="button" class="icon-button" data-action="download" data-id="${escapeHtml(message.id)}" title="ดาวน์โหลด">⬇</button></li>`).join('')}</ul>` : '<p class="muted">ยังไม่มีไฟล์</p>');
        el.profileCard.innerHTML = `${avatar(info.pictureUrl,info.displayName,true)}<h2>${escapeHtml(info.displayName)}${state.canEdit ? ' <button type="button" class="inline-edit" data-action="rename-contact" title="เปลี่ยนชื่อ">✎</button>' : ''}</h2>${info.customName ? `<p class="muted">ชื่อใน LINE: ${escapeHtml(info.lineDisplayName)}</p>` : ''}<p>${escapeHtml(info.statusMessage||'ผู้ติดต่อ LINE OA')}</p><dl class="profile-data"><dt>บัญชีที่รับข้อความ</dt><dd>${escapeHtml(info.channelName)}</dd><dt>ประเภทห้องสนทนา</dt><dd>${escapeHtml(info.sourceType||'user')}</dd><dt>สถานะ</dt><dd>${escapeHtml(info.status||'เปิดใช้งาน')}</dd></dl>
            ${notesHtml()}
            <section class="profile-section"><div class="profile-tabs"><button type="button" data-tab="media" class="${state.profileTab==='media'?'is-active':''}">รูปภาพ/วิดีโอ (${media.length})</button><button type="button" data-tab="files" class="${state.profileTab==='files'?'is-active':''}">ไฟล์ (${files.length})</button></div><div class="profile-gallery">${gallery}</div></section>`;
        observeMedia(el.profileCard);
        restoreNoteFocus(focus);
    }
    // ---------------------------------------------------------------- notes (แบบ LINE OA: หลายรายการ ผู้เขียน/เวลา แก้ไข/ลบได้)
    const formatStamp = value => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    function notesHtml() {
        const items = state.notes.map(note => {
            const id = escapeHtml(note.id);
            if (state.editingNote?.id === note.id) return `<li class="note-item is-editing"><textarea id="noteEdit" data-note-input="edit" rows="3" maxlength="2000">${escapeHtml(state.editingNote.text)}</textarea><div class="note-actions"><button type="button" class="secondary-button small" data-action="note-cancel">ยกเลิก</button><button type="button" class="primary-button small" data-action="note-update" data-note="${id}">บันทึก</button></div></li>`;
            const edited = note.updatedAt ? ` · แก้ไขโดย ${escapeHtml(note.updatedByName || '')} ${escapeHtml(formatStamp(note.updatedAt))}` : '';
            return `<li class="note-item"><p>${linkify(note.body)}</p><div class="note-meta"><span>${escapeHtml(note.createdByName || 'ไม่ทราบชื่อ')} · ${escapeHtml(formatStamp(note.createdAt))}${edited}</span>${state.canEdit ? `<span class="note-buttons"><button type="button" data-action="note-edit" data-note="${id}">แก้ไข</button><button type="button" data-action="note-delete" data-note="${id}">ลบ</button></span>` : ''}</div></li>`;
        }).join('');
        const composer = state.canEdit ? `<div class="note-composer"><textarea id="noteNew" data-note-input="new" rows="2" maxlength="2000" placeholder="เพิ่มโน้ต (เห็นเฉพาะทีมงาน)">${escapeHtml(state.noteDraft)}</textarea><button type="button" class="primary-button small" data-action="note-add">บันทึก</button></div>` : '';
        return `<section class="profile-section notes-section"><h3>โน้ต (${state.notes.length})</h3>${composer}${items ? `<ul class="note-list">${items}</ul>` : '<p class="muted">ยังไม่มีโน้ต</p>'}</section>`;
    }
    function captureNoteFocus() {
        const active = document.activeElement;
        if (!active?.dataset?.noteInput || !el.profileCard.contains(active)) return null;
        return { id: active.id, start: active.selectionStart, end: active.selectionEnd };
    }
    function restoreNoteFocus(focus) {
        if (!focus) return;
        const node = document.getElementById(focus.id);
        if (!node) return;
        node.focus({ preventScroll: true });
        try { node.setSelectionRange(focus.start, focus.end); } catch { /* ignore */ }
    }
    const notesPath = () => `${conversationPath()}/notes`;
    async function addNote() {
        const body = state.noteDraft.trim(); if (!body || !state.activeConversation) return;
        try {
            const data = await request(notesPath(), { method: 'POST', body: JSON.stringify({ channelId: state.activeConversation.channelId, body }) });
            state.notes = [data.note, ...state.notes]; state.noteDraft = '';
            renderProfile(state.activeConversation); notify('บันทึกโน้ตแล้ว');
        } catch (error) { notify(error.message, true); }
    }
    async function updateNote(noteId) {
        const body = String(state.editingNote?.text || '').trim(); if (!body) return notify('โน้ตต้องไม่ว่าง', true);
        try {
            const data = await request(`${notesPath()}/${encodeURIComponent(noteId)}`, { method: 'PATCH', body: JSON.stringify({ channelId: state.activeConversation.channelId, body }) });
            state.notes = state.notes.map(note => note.id === noteId ? data.note : note); state.editingNote = null;
            renderProfile(state.activeConversation); notify('แก้ไขโน้ตแล้ว');
        } catch (error) { notify(error.message, true); }
    }
    async function deleteNote(noteId) {
        if (!window.confirm('ลบโน้ตนี้?')) return;
        try {
            await request(`${notesPath()}/${encodeURIComponent(noteId)}?channelId=${encodeURIComponent(state.activeConversation.channelId)}`, { method: 'DELETE' });
            state.notes = state.notes.filter(note => note.id !== noteId); if (state.editingNote?.id === noteId) state.editingNote = null;
            renderProfile(state.activeConversation); notify('ลบโน้ตแล้ว');
        } catch (error) { notify(error.message, true); }
    }
    // ใช้ตรวจว่าข้อมูลหัวห้อง/โปรไฟล์/โน้ตถูกผู้ใช้คนอื่นเปลี่ยนหรือไม่ จะได้วาดใหม่ทันที
    const profileSignatureOf = (info, notes) => JSON.stringify([info.displayName, info.customName, info.lineDisplayName, info.pictureUrl, info.statusMessage, info.status, info.channelName, notes.map(note => [note.id, note.body, note.updatedAt])]);
    function renderConversation(info, messages, options = {}) {
        const switched = !state.activeConversation || state.activeConversation.id !== info.id || state.activeConversation.channelId !== info.channelId;
        const oldTop = el.messageList.scrollTop;
        const wasNearBottom = el.messageList.scrollHeight - oldTop - el.messageList.clientHeight < 80;
        const previousKeys = switched ? [] : state.renderedKeys;
        const keys = messages.map(messageKey);
        state.activeConversation = info; state.messages = messages;
        if (options.notes) state.notes = options.notes;
        if (switched) { state.noteDraft = ''; state.editingNote = null; }
        const signature = profileSignatureOf(info, state.notes);
        const profileChanged = signature !== state.profileSignature;
        state.profileSignature = signature;
        renderHeader(info);
        const canAppend = previousKeys.length > 0 && previousKeys.length <= keys.length && previousKeys.every((key, index) => key === keys[index]);
        if (!messages.length) el.messageList.innerHTML = '<div class="empty-state"><b>ยังไม่มีข้อความ</b></div>';
        else if (canAppend) { if (keys.length > previousKeys.length) { el.messageList.insertAdjacentHTML('beforeend', messagesHtml(messages, previousKeys.length)); } }
        else el.messageList.innerHTML = messagesHtml(messages, 0); // วาดใหม่ทั้งหมดเฉพาะเมื่อเปลี่ยนห้อง/ข้อความเดิมถูกแก้ ไม่ให้วิดีโอ/เสียงที่กำลังเล่นหยุด
        const added = keys.length - previousKeys.length;
        state.renderedKeys = keys;
        observeMedia(el.messageList);
        if (!options.preserveScroll || wasNearBottom || switched) { el.messageList.scrollTop = el.messageList.scrollHeight; el.newMessageIndicator.hidden = true; }
        else { el.messageList.scrollTop = oldTop; if (added > 0) el.newMessageIndicator.hidden = false; }
        if (switched || added !== 0 || !canAppend || profileChanged || options.refreshProfile) renderProfile(info);
        const enabled = state.canReply;
        el.replyInput.disabled = !enabled; el.sendButton.disabled = !enabled; el.attachButton.disabled = !enabled; el.stickerButton.disabled = !enabled;
        renderConversations();
    }
    async function openConversation(id, channelId) {
        try {
            const switching = !state.activeConversation || state.activeConversation.id !== id || state.activeConversation.channelId !== channelId;
            if (switching) { state.activeConversation = null; state.renderedKeys = []; clearPendingFiles(); el.messageList.innerHTML = '<div class="empty-state"><b>กำลังโหลดข้อความ...</b></div>'; }
            const data = await request(`/api/line-oa/conversations/${encodeURIComponent(id)}?channelId=${encodeURIComponent(channelId)}`);
            renderConversation(data.conversation, data.messages || [], { preserveScroll: !switching, notes: data.notes || [] });
            if (data.conversation.unreadCount) await request(`/api/line-oa/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', body: JSON.stringify({ channelId }) });
        } catch (error) { notify(error.message, true); }
    }
    const reloadActive = () => state.activeConversation && openConversation(state.activeConversation.id, state.activeConversation.channelId);
    async function load(){ try{ const data=await request('/api/line-oa/monitoring'); state.channels=data.channels||[]; state.conversations=data.conversations||[]; el.connectionState.textContent=`เชื่อมต่อ ${state.channels.length} บัญชี`; el.connectionState.classList.add('is-online'); renderChannels(); renderConversations(); const conversationId=query.get('conversation'); const channelId=query.get('channel'); if(!isConversationEmbed&&conversationId&&channelId&&!state.activeConversation) await openConversation(conversationId,channelId); }catch(error){ el.connectionState.textContent='ยังไม่ได้เชื่อมต่อ LINE OA'; el.connectionState.classList.remove('is-online'); renderChannels(); renderConversations(); notify(error.message,true); } }

    // ---------------------------------------------------------------- viewer (ดูรูป/วิดีโอ/ไฟล์ เลื่อนดูรูปก่อนหน้า-ถัดไปได้)
    function openViewer(message) {
        const viewable = state.messages.filter(item => !item.unsent && MEDIA_TYPES.has(item.type));
        state.viewerItems = ['image', 'video'].includes(message.type) ? viewable.filter(item => ['image', 'video'].includes(item.type)) : [message];
        state.viewerIndex = Math.max(0, state.viewerItems.findIndex(item => item.id === message.id));
        el.mediaViewer.hidden = false; document.body.classList.add('viewer-open');
        renderViewer();
    }
    function closeViewer() { el.mediaViewer.hidden = true; document.body.classList.remove('viewer-open'); el.viewerStage.innerHTML = ''; }
    async function renderViewer() {
        const message = state.viewerItems[state.viewerIndex];
        if (!message) return closeViewer();
        const name = displayFileName(message);
        el.viewerTitle.textContent = name;
        el.viewerMeta.textContent = `${message.direction === 'outbound' ? 'ส่งโดยทีมงาน' : state.activeConversation?.displayName || ''} · ${new Date(message.timestamp).toLocaleString('th-TH')}${message.fileSize ? ` · ${formatSize(message.fileSize)}` : ''}${state.viewerItems.length > 1 ? ` · ${state.viewerIndex + 1}/${state.viewerItems.length}` : ''}`;
        el.viewerPrev.hidden = state.viewerIndex <= 0; el.viewerNext.hidden = state.viewerIndex >= state.viewerItems.length - 1;
        el.viewerRename.hidden = !state.canEdit;
        el.viewerStage.innerHTML = '<div class="viewer-loading">กำลังโหลด...</div>';
        try {
            const { url, blob } = await mediaBlobUrl(message, 'original');
            if (state.viewerItems[state.viewerIndex] !== message) return;
            const mime = blob.type || '';
            if (message.type === 'image' || mime.startsWith('image/')) el.viewerStage.innerHTML = `<img class="viewer-image" src="${url}" alt="${escapeHtml(name)}">`;
            else if (message.type === 'video' || mime.startsWith('video/')) el.viewerStage.innerHTML = `<video class="viewer-video" src="${url}" controls autoplay playsinline></video>`;
            else if (message.type === 'audio' || mime.startsWith('audio/')) el.viewerStage.innerHTML = `<audio src="${url}" controls autoplay></audio>`;
            else if (mime === 'application/pdf' || extensionOf(name) === 'pdf') el.viewerStage.innerHTML = `<iframe class="viewer-document" src="${url}" title="${escapeHtml(name)}"></iframe>`;
            else if (mime.startsWith('text/') || ['txt','csv','json','log'].includes(extensionOf(name))) { const text = await blob.slice(0, 2 * 1048576).text(); el.viewerStage.innerHTML = `<pre class="viewer-text">${escapeHtml(text)}</pre>`; }
            else el.viewerStage.innerHTML = `<div class="viewer-file"><span class="file-icon large">${escapeHtml(fileIcon(name))}</span><b>${escapeHtml(name)}</b><span>${escapeHtml(formatSize(blob.size))} · ไม่สามารถแสดงตัวอย่างไฟล์ชนิดนี้ได้</span><button type="button" class="primary-button" data-action="viewer-download">ดาวน์โหลดไฟล์</button></div>`;
        } catch (error) { el.viewerStage.innerHTML = `<div class="viewer-file"><b>เปิดไฟล์ไม่ได้</b><span>${escapeHtml(error.message)}</span><button type="button" class="secondary-button" data-action="viewer-retry">ลองใหม่</button></div>`; }
    }
    const moveViewer = step => { const next = state.viewerIndex + step; if (next < 0 || next >= state.viewerItems.length) return; state.viewerIndex = next; renderViewer(); };

    // ---------------------------------------------------------------- rename (ผู้ติดต่อ / ไฟล์) & note
    function askName({ title, value, placeholder, hint }) {
        return new Promise(resolve => {
            el.renameTitle.textContent = title; el.renameInput.value = value || ''; el.renameInput.placeholder = placeholder || ''; el.renameHint.textContent = hint || '';
            const finish = result => { el.renameForm.onsubmit = null; el.renameCancel.onclick = null; el.renameDialog.onclose = null; if (el.renameDialog.open) el.renameDialog.close(); resolve(result); };
            el.renameForm.onsubmit = event => { event.preventDefault(); finish(el.renameInput.value.trim()); };
            el.renameCancel.onclick = () => finish(null);
            el.renameDialog.onclose = () => finish(null);
            el.renameDialog.showModal(); el.renameInput.focus();
            const dot = el.renameInput.value.lastIndexOf('.'); el.renameInput.setSelectionRange(0, dot > 0 ? dot : el.renameInput.value.length);
        });
    }
    async function renameContact() {
        const info = state.activeConversation; if (!info) return;
        const name = await askName({ title: 'เปลี่ยนชื่อผู้ติดต่อ', value: info.customName || info.displayName, placeholder: info.lineDisplayName, hint: `ชื่อใน LINE: ${info.lineDisplayName} · เว้นว่างเพื่อกลับไปใช้ชื่อเดิม (ลูกค้าจะไม่เห็นชื่อนี้)` });
        if (name === null) return;
        try {
            const data = await request(conversationPath(info), { method: 'PATCH', body: JSON.stringify({ channelId: info.channelId, customName: name }) });
            Object.assign(info, data.conversation);
            const listItem = state.conversations.find(item => item.id === info.id && item.channelId === info.channelId); if (listItem) Object.assign(listItem, data.conversation);
            renderHeader(info); renderProfile(info); renderConversations(); notify('เปลี่ยนชื่อแล้ว');
        } catch (error) { notify(error.message, true); }
    }
    async function renameFile(message) {
        const current = displayFileName(message);
        const ext = extensionOf(current);
        let name = await askName({ title: 'เปลี่ยนชื่อไฟล์', value: current, hint: message.originalFileName ? `ชื่อเดิม: ${message.originalFileName}` : 'ชื่อนี้จะใช้ตอนแสดงผลและดาวน์โหลด' });
        if (!name || name === current) return;
        if (ext && !extensionOf(name)) name = `${name}.${ext}`; // กันนามสกุลไฟล์หายจนเปิดไม่ได้
        try {
            const data = await request(`${conversationPath()}/messages/${encodeURIComponent(message.id)}`, { method: 'PATCH', body: JSON.stringify({ channelId: state.activeConversation.channelId, fileName: name }) });
            Object.assign(message, { fileName: data.message.fileName });
            renderConversation(state.activeConversation, state.messages, { preserveScroll: true, refreshProfile: true });
            if (!el.mediaViewer.hidden) renderViewer();
            notify('เปลี่ยนชื่อไฟล์แล้ว');
        } catch (error) { notify(error.message, true); }
    }

    // ---------------------------------------------------------------- send files / stickers
    function renderTray() {
        el.attachmentTray.hidden = !state.pendingFiles.length;
        el.attachmentTray.innerHTML = state.pendingFiles.map((item, index) => `<div class="tray-item${item.status ? ` is-${item.status}` : ''}">${item.preview ? `<img src="${item.preview}" alt="">` : `<span class="file-icon small">${escapeHtml(fileIcon(item.file.name))}</span>`}<span class="tray-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}<small>${escapeHtml(item.status === 'uploading' ? 'กำลังส่ง...' : item.status === 'error' ? item.error : formatSize(item.file.size))}</small></span>${item.status === 'uploading' ? '' : `<button type="button" data-remove="${index}" title="นำออก">✕</button>`}</div>`).join('');
    }
    function addFiles(files) {
        if (!state.canReply || !state.activeConversation) return notify(state.canReply ? 'กรุณาเลือกห้องสนทนาก่อน' : 'บัญชีนี้ไม่มีสิทธิ์ส่งไฟล์', true);
        for (const file of files) {
            if (file.size > 100 * 1048576) { notify(`${file.name} มีขนาดเกิน 100 MB`, true); continue; }
            state.pendingFiles.push({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' });
        }
        renderTray(); el.replyInput.focus();
    }
    function clearPendingFiles() { state.pendingFiles.forEach(item => item.preview && URL.revokeObjectURL(item.preview)); state.pendingFiles = []; renderTray(); }
    const canvasToBlob = (canvas, quality) => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    async function resizeImage(source, maxSide, maxBytes) {
        const bitmap = await createImageBitmap(source);
        let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        for (let attempt = 0; attempt < 6; attempt++) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await canvasToBlob(canvas, 0.85);
            if (blob && blob.size <= maxBytes) return blob;
            scale *= 0.75;
        }
        throw new Error('ไม่สามารถย่อรูปได้');
    }
    function loadMediaElement(file, tag) {
        return new Promise((resolve, reject) => {
            const media = document.createElement(tag); const url = URL.createObjectURL(file);
            media.preload = 'metadata'; media.muted = true; media.playsInline = true;
            media.onloadeddata = () => resolve({ media, url }); media.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์ไม่ได้')); };
            if (tag === 'audio') media.onloadedmetadata = () => resolve({ media, url });
            media.src = url;
        });
    }
    async function videoThumbnail(file) {
        const { media, url } = await loadMediaElement(file, 'video');
        try {
            await new Promise(resolve => { media.onseeked = resolve; media.currentTime = Math.min(0.5, (media.duration || 1) / 2); setTimeout(resolve, 3000); });
            const canvas = document.createElement('canvas'); const scale = Math.min(1, 640 / Math.max(media.videoWidth, media.videoHeight));
            canvas.width = Math.round(media.videoWidth * scale); canvas.height = Math.round(media.videoHeight * scale);
            canvas.getContext('2d').drawImage(media, 0, 0, canvas.width, canvas.height);
            return { preview: await canvasToBlob(canvas, 0.8), durationMs: Math.round((media.duration || 0) * 1000) };
        } finally { URL.revokeObjectURL(url); }
    }
    async function audioDuration(file) { const { media, url } = await loadMediaElement(file, 'audio'); URL.revokeObjectURL(url); return Math.round((media.duration || 0) * 1000); }
    async function upload(blob, fileName, mimeType) {
        const conversation = state.activeConversation;
        const params = new URLSearchParams({ channelId: conversation.channelId, fileName, mimeType: mimeType || blob.type || 'application/octet-stream' });
        const response = await window.authFetch(`${apiBase}${conversationPath(conversation)}/uploads?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
        return data.upload;
    }
    // แปลงไฟล์ให้ตรงข้อกำหนดของ LINE: รูป JPEG/PNG ≤10MB + พรีวิว ≤1MB, วิดีโอ MP4 + ภาพปก, เสียง M4A/MP3 + ความยาว
    async function sendFile(file) {
        const type = file.type || ''; const ext = extensionOf(file.name);
        let kind = 'file'; let body = file; let mime = type; let name = file.name; let preview = null; let durationMs = 0;
        try {
            if (type.startsWith('image/') && type !== 'image/svg+xml') {
                kind = 'image';
                if (!['image/jpeg','image/png'].includes(type) || file.size > 10 * 1048576) { body = await resizeImage(file, 4096, 10 * 1048576); mime = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; }
                if (body.size > 1048576) preview = await resizeImage(body, 1024, 1048576);
            } else if (type === 'video/mp4' || ext === 'mp4') {
                kind = 'video'; mime = 'video/mp4'; ({ preview, durationMs } = await videoThumbnail(file));
            } else if (['audio/mp4','audio/x-m4a','audio/m4a','audio/mpeg','audio/mp3'].includes(type) || ['m4a','mp3'].includes(ext)) {
                kind = 'audio'; mime = type || (ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4'); durationMs = await audioDuration(file);
            }
        } catch { kind = 'file'; body = file; mime = type; name = file.name; preview = null; } // ประมวลผลไม่ได้ ส่งเป็นไฟล์แทน
        const uploaded = await upload(body, name, mime);
        const previewUpload = preview ? await upload(preview, name.replace(/\.[^.]+$/, '') + '_preview.jpg', 'image/jpeg') : null;
        await request(`${conversationPath()}/attachments`, { method: 'POST', body: JSON.stringify({ channelId: state.activeConversation.channelId, uploadId: uploaded.id, previewUploadId: previewUpload?.id, kind, durationMs }) });
    }
    async function sendSticker(packageId, stickerId) {
        if (!state.activeConversation) return;
        el.stickerPicker.hidden = true;
        try { await request(`${conversationPath()}/stickers`, { method: 'POST', body: JSON.stringify({ channelId: state.activeConversation.channelId, packageId, stickerId }) }); await reloadActive(); }
        catch (error) { notify(error.message, true); }
    }
    function renderStickerPicker(packageId = STICKER_PACKAGES[0].packageId) {
        const pack = STICKER_PACKAGES.find(item => item.packageId === packageId);
        const ids = Array.from({ length: pack.to - pack.from + 1 }, (_, index) => pack.from + index);
        el.stickerPicker.innerHTML = `<div class="sticker-tabs">${STICKER_PACKAGES.map(item => `<button type="button" data-package="${item.packageId}" class="${item.packageId === packageId ? 'is-active' : ''}"><img src="${stickerUrl(item.from)}" alt="" loading="lazy"></button>`).join('')}</div><div class="sticker-grid">${ids.map(id => `<button type="button" data-sticker="${id}" data-sticker-package="${packageId}"><img src="${stickerUrl(id)}" alt="" loading="lazy"></button>`).join('')}</div>`;
    }

    // ---------------------------------------------------------------- events
    el.channelTabs.addEventListener('click',event=>{const button=event.target.closest('[data-channel]');if(!button)return;state.activeChannel=button.dataset.channel;renderChannels();renderConversations();});
    el.conversationList.addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(!button)return;if(isConversationEmbed){window.parent.postMessage({type:'open-line-conversation',conversationId:button.dataset.id,channelId:button.dataset.channel},window.location.origin);return;}openConversation(button.dataset.id,button.dataset.channel);});
    el.conversationSearch.addEventListener('input',renderConversations); el.refreshButton.addEventListener('click',()=>{load();reloadActive();});
    el.scrollToTopButton.addEventListener('click',()=>el.messageList.scrollTo({top:0,behavior:'smooth'}));
    el.scrollToBottomButton.addEventListener('click',()=>{el.messageList.scrollTo({top:el.messageList.scrollHeight,behavior:'smooth'});el.newMessageIndicator.hidden=true;});
    el.messageList.addEventListener('scroll',()=>{const nearBottom=el.messageList.scrollHeight-el.messageList.scrollTop-el.messageList.clientHeight<80;if(nearBottom)el.newMessageIndicator.hidden=true;},{passive:true});
    function handleAction(event) {
        const target = event.target.closest('[data-action]'); if (!target) return;
        const action = target.dataset.action; const message = target.dataset.id ? findMessage(target.dataset.id) : null;
        const frame = target.closest('.media-frame');
        if (frame?.querySelector('.is-error') && action === 'view') { const node = frame.querySelector('[data-load]'); frame.removeAttribute('data-error'); hydrateMedia(node); return; }
        if (action === 'view' && message) openViewer(message);
        else if (action === 'download' && message) downloadMessage(message);
        else if (action === 'rename-file' && message) renameFile(message);
        else if (action === 'rename-contact') renameContact();
        else if (action === 'note-add') addNote();
        else if (action === 'note-edit') { const note = state.notes.find(item => item.id === target.dataset.note); if (note) { state.editingNote = { id: note.id, text: note.body }; renderProfile(state.activeConversation); document.getElementById('noteEdit')?.focus(); } }
        else if (action === 'note-cancel') { state.editingNote = null; renderProfile(state.activeConversation); }
        else if (action === 'note-update') updateNote(target.dataset.note);
        else if (action === 'note-delete') deleteNote(target.dataset.note);
    }
    el.messageList.addEventListener('click', handleAction);
    el.conversationHeader.addEventListener('click', handleAction);
    el.profileCard.addEventListener('input', event => { const kind = event.target.dataset?.noteInput; if (kind === 'new') state.noteDraft = event.target.value; else if (kind === 'edit' && state.editingNote) state.editingNote.text = event.target.value; });
    el.profileCard.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.target.dataset?.noteInput) { event.preventDefault(); if (event.target.dataset.noteInput === 'new') addNote(); else if (state.editingNote) updateNote(state.editingNote.id); } });
    el.profileCard.addEventListener('click', event => { const tab = event.target.closest('[data-tab]'); if (tab) { state.profileTab = tab.dataset.tab; if (state.activeConversation) renderProfile(state.activeConversation); return; } handleAction(event); });
    el.viewerClose.addEventListener('click', closeViewer);
    el.viewerPrev.addEventListener('click', () => moveViewer(-1));
    el.viewerNext.addEventListener('click', () => moveViewer(1));
    el.viewerDownload.addEventListener('click', () => downloadMessage(state.viewerItems[state.viewerIndex]));
    el.viewerRename.addEventListener('click', () => renameFile(state.viewerItems[state.viewerIndex]));
    el.viewerStage.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'viewer-download') downloadMessage(state.viewerItems[state.viewerIndex]);
        else if (action === 'viewer-retry') renderViewer();
        else if (event.target === el.viewerStage) closeViewer();
        else if (event.target.classList.contains('viewer-image')) event.target.classList.toggle('is-zoomed');
    });
    document.addEventListener('keydown', event => {
        if (el.mediaViewer.hidden || el.renameDialog.open) return;
        if (event.key === 'Escape') closeViewer(); else if (event.key === 'ArrowLeft') moveViewer(-1); else if (event.key === 'ArrowRight') moveViewer(1);
    });
    el.attachButton.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', () => { addFiles([...el.fileInput.files]); el.fileInput.value = ''; });
    el.attachmentTray.addEventListener('click', event => { const button = event.target.closest('[data-remove]'); if (!button) return; const [item] = state.pendingFiles.splice(Number(button.dataset.remove), 1); if (item?.preview) URL.revokeObjectURL(item.preview); renderTray(); });
    el.stickerButton.addEventListener('click', () => { el.stickerPicker.hidden = !el.stickerPicker.hidden; if (!el.stickerPicker.hidden && !el.stickerPicker.innerHTML) renderStickerPicker(); });
    el.stickerPicker.addEventListener('click', event => { const tab = event.target.closest('[data-package]'); if (tab) return renderStickerPicker(tab.dataset.package); const sticker = event.target.closest('[data-sticker]'); if (sticker) sendSticker(sticker.dataset.stickerPackage, sticker.dataset.sticker); });
    document.addEventListener('click', event => { if (!el.stickerPicker.hidden && !event.target.closest('#stickerPicker,#stickerButton')) el.stickerPicker.hidden = true; });
    el.replyInput.addEventListener('paste', event => { const files = [...(event.clipboardData?.files || [])]; if (files.length) { event.preventDefault(); addFiles(files); } });
    let dragDepth = 0;
    el.conversationPanel.addEventListener('dragenter', event => { if (!event.dataTransfer?.types.includes('Files') || !state.canReply || !state.activeConversation) return; event.preventDefault(); dragDepth++; el.dropOverlay.hidden = false; });
    el.conversationPanel.addEventListener('dragover', event => { if (!el.dropOverlay.hidden) event.preventDefault(); });
    el.conversationPanel.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) el.dropOverlay.hidden = true; });
    el.conversationPanel.addEventListener('drop', event => { if (el.dropOverlay.hidden) return; event.preventDefault(); dragDepth = 0; el.dropOverlay.hidden = true; addFiles([...event.dataTransfer.files]); });
    el.replyInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();el.replyForm.requestSubmit();}});
    el.replyForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!state.canReply) { notify('บัญชีนี้ไม่มีสิทธิ์ตอบกลับข้อความ', true); return; }
        const text = el.replyInput.value.trim();
        if ((!text && !state.pendingFiles.length) || !state.activeConversation) return;
        el.sendButton.disabled = true;
        try {
            if (text) { await request(`${conversationPath()}/messages`, { method: 'POST', body: JSON.stringify({ channelId: state.activeConversation.channelId, text }) }); el.replyInput.value = ''; }
            for (const item of [...state.pendingFiles]) {
                if (item.status === 'sent') continue;
                item.status = 'uploading'; renderTray();
                try { await sendFile(item.file); item.status = 'sent'; }
                catch (error) { item.status = 'error'; item.error = error.message; }
                renderTray();
            }
            const failed = state.pendingFiles.filter(item => item.status === 'error');
            state.pendingFiles.filter(item => item.status === 'sent').forEach(item => item.preview && URL.revokeObjectURL(item.preview));
            state.pendingFiles = failed.map(item => ({ ...item, status: 'error' }));
            renderTray();
            await reloadActive();
            notify(failed.length ? `ส่งไม่สำเร็จ ${failed.length} ไฟล์` : 'ส่งข้อความแล้ว', failed.length > 0);
        } catch (error) { notify(error.message, true); }
        finally { el.sendButton.disabled = false; }
    });
    load();

    async function syncNewMessages() {
        if (document.hidden) return;

        try {
            const data = await request('/api/line-oa/monitoring');
            state.channels = data.channels || [];
            state.conversations = data.conversations || [];
            renderChannels();
            renderConversations();

            const latestActive = state.activeConversation
                ? state.conversations.find(item =>
                    item.id === state.activeConversation.id &&
                    item.channelId === state.activeConversation.channelId
                )
                : null;

            if (
                !isConversationEmbed &&
                state.activeConversation &&
                latestActive &&
                (latestActive.updatedAt !== state.activeConversation.updatedAt ||
                 latestActive.modifiedAt !== state.activeConversation.modifiedAt)
            ) {
                const active = state.activeConversation;
                const detail = await request(
                    `/api/line-oa/conversations/${encodeURIComponent(active.id)}` +
                    `?channelId=${encodeURIComponent(active.channelId)}`
                );
                if (state.activeConversation !== active) return; // ผู้ใช้เปลี่ยนห้องระหว่างรอ
                renderConversation(
                    detail.conversation,
                    detail.messages || [],
                    { preserveScroll: true, notes: detail.notes || [] }
                );
            }
        } catch (error) {
            // การซิงก์รอบถัดไปจะลองใหม่ โดยไม่รบกวนข้อความที่กำลังพิมพ์
        }
    }

    const messageSyncTimer = window.setInterval(
        syncNewMessages,
        5000
    );

    // กลับมาที่แท็บนี้ = ซิงก์ทันที (ระหว่างแท็บถูกซ่อนจะหยุดซิงก์เพื่อลดภาระเซิร์ฟเวอร์)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNewMessages(); });
    window.addEventListener('pagehide', () => {
        window.clearInterval(messageSyncTimer);
    });
});
