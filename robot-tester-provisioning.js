(() => {
  const form=document.getElementById('robotForm'), message=document.getElementById('robotStatus'), button=document.getElementById('robotCreate');
  let busy=false, confirmed=false, finished=false, uncertain=false;
  form.addEventListener('input',()=>{
    if(busy||finished||uncertain)return;
    confirmed=false;button.textContent='สร้างบัญชี robot-tester';
  });
  form.addEventListener('invalid',()=>{
    message.textContent='กรุณากรอกรหัสผ่านอย่างน้อย 12 ตัวอักษร ไม่เกิน 72 ไบต์';
  },true);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||finished||uncertain||!form.reportValidity())return;
    const password=form.elements.robotPassword.value;
    if(password!==password.trim()||new TextEncoder().encode(password).length>72){
      message.textContent='รหัสผ่านต้องไม่มีช่องว่างหัวท้าย และไม่เกิน 72 ไบต์';return;
    }
    if(!confirmed){
      confirmed=true;
      message.textContent='ยืนยันสร้าง robot-tester เป็น STAFF พร้อมทุกสิทธิ์ที่รองรับ และยังต้องตั้ง MFA: กดปุ่มยืนยันอีกครั้ง';
      button.textContent='ยืนยันสร้าง robot-tester';
      return;
    }
    busy=true;button.disabled=true;message.textContent='กำลังสร้างบัญชี…';
    try{
      const response=await authFetch(APP_CONFIG.API_BASE_URL+'/api/admin/robot-tester',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const result=await response.json();
      if(!response.ok||!result.success){
        uncertain=![400,401,403].includes(response.status);
        message.textContent=result.message||'ยังยืนยันผลไม่ได้ ให้ตรวจบัญชีก่อนลองใหม่';
        return;
      }
      finished=true;
      message.textContent='สร้าง robot-tester แล้ว พร้อม '+result.permissionCount+' สิทธิ์ — ต้องเข้าสู่ระบบและตั้ง MFA ก่อนทดสอบจริง';
      form.reset();
    }catch{
      uncertain=true;
      message.textContent='ยังยืนยันผลไม่ได้ อาจบันทึกบางส่วนแล้ว ให้ตรวจบัญชีและสิทธิ์ก่อนลองใหม่';
    }finally{
      form.elements.robotPassword.value='';
      busy=false;confirmed=false;
      button.disabled=finished||uncertain;
      button.textContent=finished?'สร้างบัญชีแล้ว':uncertain?'ตรวจผลบัญชีก่อนลองใหม่':'สร้างบัญชี robot-tester';
    }
  });
})();
