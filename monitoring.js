document.addEventListener('DOMContentLoaded', async () => {
    const query = new URLSearchParams(window.location.search);
    const isConversationEmbed = query.get('view') === 'conversations';
    if (isConversationEmbed) document.body.classList.add('is-conversation-embed');
    const apiBase = window.APP_CONFIG?.API_BASE_URL || '';
    const state = { channels: [], conversations: [], activeChannel: 'all', activeConversation: null, canReply: false };
    const el = Object.fromEntries(['connectionState','refreshButton','conversationSearch','channelTabs','conversationList','conversationHeader','messageList','replyForm','replyInput','sendButton','replyHint','profileCard','toast','scrollToTopButton','scrollToBottomButton','newMessageIndicator'].map(id => [id, document.getElementById(id)]));

    // หน้านี้เปิดได้แบบ standalone/ฝังใน iframe โดยไม่ผ่านสคริปต์โหลดสิทธิ์ของ search.html เลย
    // จึงต้องเช็คสิทธิ์ ViewMonitoring/ReplyMonitoring เองจาก /api/session ก่อนแสดงข้อมูลใด ๆ
    // (ฝั่งหลังบ้านก็บังคับสิทธิ์เดียวกันนี้อยู่แล้ว จุดนี้เป็นแค่ชั้น UX ให้สอดคล้องกัน)
    let canView = false;
    try {
        const sessionResponse = await window.authFetch(`${apiBase}/api/session`, { cache: 'no-store' });
        const sessionData = await sessionResponse.json();
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
    }

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
    const formatTime = value => value ? new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '';
    const avatar = (url, label, large = false) => url ? `<img class="avatar${large?' large':''}" src="${escapeHtml(url)}" alt="">` : `<div class="avatar${large?' large':''} placeholder">${escapeHtml(String(label||'OA').slice(0,2))}</div>`;
    function notify(message, error=false){ el.toast.textContent=message; el.toast.className=`toast is-visible${error?' is-error':''}`; clearTimeout(notify.timer); notify.timer=setTimeout(()=>el.toast.className='toast',2600); }
    async function request(path, options={}) { const response=await window.authFetch(`${apiBase}${path}`,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.message||'ไม่สามารถเชื่อมต่อระบบได้'); return data; }

    function renderChannels(){ const items=[{id:'all',name:'ทั้งหมด'},...state.channels]; el.channelTabs.innerHTML=items.map(item=>`<button class="channel-tab${state.activeChannel===item.id?' is-active':''}" data-channel="${escapeHtml(item.id)}" type="button">${escapeHtml(item.name)}</button>`).join(''); }
    function filteredConversations(){ const query=el.conversationSearch.value.trim().toLocaleLowerCase('th'); return state.conversations.filter(item=>(state.activeChannel==='all'||item.channelId===state.activeChannel)&&(!query||`${item.displayName} ${item.lastMessage}`.toLocaleLowerCase('th').includes(query))); }
    function renderConversations(){ const rows=filteredConversations(); el.conversationList.innerHTML=rows.length?rows.map(item=>`<button type="button" class="conversation-item${state.activeConversation?.id===item.id?' is-active':''}" data-id="${escapeHtml(item.id)}" data-channel="${escapeHtml(item.channelId)}">${avatar(item.pictureUrl,item.displayName)}<span class="conversation-copy"><strong>${escapeHtml(item.displayName||'ไม่ทราบชื่อ')}</strong><span>${escapeHtml(item.lastMessage||'ไม่มีข้อความตัวอย่าง')}</span></span><span><span class="conversation-time">${formatTime(item.updatedAt)}</span>${item.unreadCount?`<i class="unread">${item.unreadCount}</i>`:''}</span></button>`).join(''):`<div class="empty-state"><b>ไม่พบห้องสนทนา</b><span>ลองเลือกบัญชีหรือเปลี่ยนคำค้นหา</span></div>`; }
    function renderConversation(info,messages,options={}){ const oldTop=el.messageList.scrollTop;const oldHeight=el.messageList.scrollHeight;const distanceFromBottom=oldHeight-oldTop-el.messageList.clientHeight;const wasNearBottom=distanceFromBottom<80;const previousCount=Number(el.messageList.dataset.messageCount||0);state.activeConversation=info;el.conversationHeader.innerHTML=`${avatar(info.pictureUrl,info.displayName)}<div><strong>${escapeHtml(info.displayName)}</strong><small>${escapeHtml(info.channelName)} · ${escapeHtml(info.status||'พร้อมสนทนา')}</small></div>`;el.messageList.innerHTML=messages.length?messages.map(message=>`<div class="message-row ${message.direction==='outbound'?'outbound':'inbound'}"><div class="bubble">${escapeHtml(message.text||message.summary||'[ข้อความชนิดอื่น]')}<time>${formatTime(message.timestamp)}</time></div></div>`).join(''):`<div class="empty-state"><b>ยังไม่มีข้อความ</b></div>`;el.messageList.dataset.messageCount=String(messages.length);if(!options.preserveScroll||wasNearBottom){el.messageList.scrollTop=el.messageList.scrollHeight;el.newMessageIndicator.hidden=true;}else{el.messageList.scrollTop=oldTop;if(messages.length>previousCount)el.newMessageIndicator.hidden=false;}el.profileCard.innerHTML=`${avatar(info.pictureUrl,info.displayName,true)}<h2>${escapeHtml(info.displayName)}</h2><p>${escapeHtml(info.statusMessage||'ผู้ติดต่อ LINE OA')}</p><dl class="profile-data"><dt>บัญชีที่รับข้อความ</dt><dd>${escapeHtml(info.channelName)}</dd><dt>ประเภทห้องสนทนา</dt><dd>${escapeHtml(info.sourceType||'user')}</dd><dt>สถานะ</dt><dd>${escapeHtml(info.status||'เปิดใช้งาน')}</dd></dl>`;el.replyInput.disabled=!state.canReply;el.sendButton.disabled=!state.canReply;renderConversations();}
    async function openConversation(id,channelId){ try{ el.messageList.innerHTML='<div class="empty-state"><b>กำลังโหลดข้อความ...</b></div>'; const data=await request(`/api/line-oa/conversations/${encodeURIComponent(id)}?channelId=${encodeURIComponent(channelId)}`); renderConversation(data.conversation,data.messages||[]); if(data.conversation.unreadCount) await request(`/api/line-oa/conversations/${encodeURIComponent(id)}/read`,{method:'POST',body:JSON.stringify({channelId})}); }catch(error){notify(error.message,true);} }
    async function load(){ try{ const data=await request('/api/line-oa/monitoring'); state.channels=data.channels||[]; state.conversations=data.conversations||[]; el.connectionState.textContent=`เชื่อมต่อ ${state.channels.length} บัญชี`; el.connectionState.classList.add('is-online'); renderChannels(); renderConversations(); const conversationId=query.get('conversation'); const channelId=query.get('channel'); if(!isConversationEmbed&&conversationId&&channelId) await openConversation(conversationId,channelId); }catch(error){ el.connectionState.textContent='ยังไม่ได้เชื่อมต่อ LINE OA'; el.connectionState.classList.remove('is-online'); renderChannels(); renderConversations(); notify(error.message,true); } }
    el.channelTabs.addEventListener('click',event=>{const button=event.target.closest('[data-channel]');if(!button)return;state.activeChannel=button.dataset.channel;renderChannels();renderConversations();});
    el.conversationList.addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(!button)return;if(isConversationEmbed){window.parent.postMessage({type:'open-line-conversation',conversationId:button.dataset.id,channelId:button.dataset.channel},window.location.origin);return;}openConversation(button.dataset.id,button.dataset.channel);});
    el.conversationSearch.addEventListener('input',renderConversations); el.refreshButton.addEventListener('click',load);
    el.scrollToTopButton.addEventListener('click',()=>el.messageList.scrollTo({top:0,behavior:'smooth'}));
    el.scrollToBottomButton.addEventListener('click',()=>{el.messageList.scrollTo({top:el.messageList.scrollHeight,behavior:'smooth'});el.newMessageIndicator.hidden=true;});
    el.messageList.addEventListener('scroll',()=>{const nearBottom=el.messageList.scrollHeight-el.messageList.scrollTop-el.messageList.clientHeight<80;if(nearBottom)el.newMessageIndicator.hidden=true;},{passive:true});
    el.replyInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();el.replyForm.requestSubmit();}});
    el.replyForm.addEventListener('submit',async event=>{event.preventDefault();if(!state.canReply){notify('บัญชีนี้ไม่มีสิทธิ์ตอบกลับข้อความ',true);return;}const text=el.replyInput.value.trim();if(!text||!state.activeConversation)return;el.sendButton.disabled=true;try{await request(`/api/line-oa/conversations/${encodeURIComponent(state.activeConversation.id)}/messages`,{method:'POST',body:JSON.stringify({channelId:state.activeConversation.channelId,text})});el.replyInput.value='';await openConversation(state.activeConversation.id,state.activeConversation.channelId);notify('ส่งข้อความแล้ว');}catch(error){notify(error.message,true);}finally{el.sendButton.disabled=false;}});
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
                latestActive.updatedAt !== state.activeConversation.updatedAt
            ) {
                const active = state.activeConversation;
                const detail = await request(
                    `/api/line-oa/conversations/${encodeURIComponent(active.id)}` +
                    `?channelId=${encodeURIComponent(active.channelId)}`
                );
                renderConversation(
                    detail.conversation,
                    detail.messages || [],
                    { preserveScroll: true }
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

    window.addEventListener('pagehide', () => {
        window.clearInterval(messageSyncTimer);
    });
});
