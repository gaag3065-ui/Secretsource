(() => {
  const form=document.getElementById('robotForm'), message=document.getElementById('robotStatus'), button=document.getElementById('robotCreate');
  let busy=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!form.reportValidity())return;
    const password=form.elements.robotPassword.value;
    if(password!==password.trim()||new TextEncoder().encode(password).length>72){
      message.textContent='รหัสผ่านต้องไม่มีช่องว่างหัวท้าย และไม่เกิน 72 ไบต์';return;
    }
    if(!confirm('สร้าง robot-tester เป็น STAFF พร้อมสิทธิ์ทุกโมดูลที่รองรับ โดยยังต้องตั้ง MFA ตามระบบเดิมหรือไม่?'))return;
    busy=true;button.disabled=true;message.textContent='กำลังสร้างบัญชี…';
    try{
      const response=await authFetch(APP_CONFIG.API_BASE_URL+'/api/admin/robot-tester',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const result=await response.json();
      if(!response.ok||!result.success){message.textContent=result.message||'ยังยืนยันผลไม่ได้ ให้ตรวจบัญชีก่อนลองใหม่';return;}
      message.textContent='สร้าง robot-tester แล้ว พร้อม '+result.permissionCount+' สิทธิ์ — ต้องเข้าสู่ระบบและตั้ง MFA ก่อนทดสอบจริง';
      form.reset();
      button.disabled=true;
      // Refresh account metadata through the existing admin page on explicit reload.
    }catch{message.textContent='ยังยืนยันผลไม่ได้ อาจบันทึกบางส่วนแล้ว ให้ตรวจบัญชีและสิทธิ์ก่อนลองใหม่';}
    finally{form.elements.robotPassword.value='';busy=false;}
  });
})();
