
//ทำตัวอย่างรูป “เปิดเคส” ก่อน
//function previewSelectedImage(input, previewId) {
//#region
function previewSelectedImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    preview.replaceChildren();

    const file = input.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('รองรับเฉพาะรูป JPG, PNG และ WEBP');
        input.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('ไฟล์มีขนาดเกิน 10 MB กรุณาเลือกรูปที่มีขนาดเล็กลง');
        input.value = '';
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = document.createElement('img');

    image.src = imageUrl;
    image.alt = file.name;
    image.className = 'upload-preview-thumbnail';
    image.title = 'คลิกเพื่อขยายรูป';
    image.addEventListener('click', () => {
        openImageViewer(imageUrl, file.name);
    });

    image.addEventListener('load', () => {
        image.dataset.objectUrl = imageUrl;
    });

    preview.appendChild(image);
}
//#endregion

//เพิ่มฟังก์ชันขยายรูป
//function openImageViewer(imageUrl, imageName = 'รูปภาพ') {
//#region
function openImageViewer(imageUrl, imageName = 'รูปภาพ') {
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer-overlay';

    const image = document.createElement('img');
    image.alt = imageName;
    image.className = 'image-viewer-full';
    const message = document.createElement('div');
    message.setAttribute('role', 'status');
    message.style.cssText = 'color:#fff;background:#252525;padding:18px;border-radius:8px;max-width:90vw;text-align:center';
    message.textContent = 'กำลังโหลดรูป…';
    image.addEventListener('load', () => message.remove(), { once: true });
    image.addEventListener('error', () => {
        image.style.display = 'none';
        message.textContent = (image.dataset.loadError || 'โหลดรูปไม่สำเร็จ กรุณาลองเปิดอีกครั้ง') + ' · คลิกเพื่อปิด';
    }, { once: true });

    viewer.append(image, message);
    document.body.appendChild(viewer);
    if (window.loadEvidenceImage) window.loadEvidenceImage(image, imageUrl);
    else image.src = imageUrl;

    const close = () => { viewer.remove(); document.removeEventListener('keydown', closeViewer); };
    viewer.addEventListener('click', close);

    function closeViewer(event) {
        if (event.key === 'Escape') {
            close();
        }
    }
    document.addEventListener('keydown', closeViewer);
}
//#endregion

//เพิ่มฟังก์ชันอัปโหลดรูปไป Google Drive
//function fileToDataUrl(file) {
//#region
function fileToDataUrl(file) {
    // รูปภาพ: ย่อ/บีบอัดก่อนส่ง (เล็กลงมาก อัปโหลดผ่านอุโมงค์เร็วขึ้น) — ไฟล์อื่นส่งตามเดิม
    return window.compressImageFile(file).then(prepared => new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(
            new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`)
        );

        reader.readAsDataURL(prepared);
    }));
}

// ย่อรูปฝั่ง browser: ด้านยาวสุด 1600px, JPEG คุณภาพ ~0.78 — ใช้เมื่อรูปใหญ่กว่า 350 KB เท่านั้น
// ถ้าย่อไม่ได้/ไม่เล็กลง ส่งไฟล์เดิม (ไม่ทำให้การอัปโหลดล้ม) · คืน File เสมอ (นามสกุล .jpg เมื่อถูกบีบอัด)
window.compressImageFile = async function compressImageFile(file, { maxEdge = 1600, quality = 0.78, minBytes = 350 * 1024 } = {}) {
    try {
        if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < minBytes || typeof createImageBitmap !== 'function') return file;
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';   // PNG โปร่งใส → พื้นขาว (JPEG ไม่มีช่องโปร่งใส)
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], String(file.name || 'image').replace(/\.[A-Za-z0-9]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    } catch {
        return file;
    }
};
//#endregion

// Shared non-blocking feedback for successful insurance operations.
window.showInsuranceToast = function (
    message,
    type = 'success',
    duration = 3500
) {
    let region = document.getElementById('insuranceToastRegion');

    if (!region) {
        region = document.createElement('div');
        region.id = 'insuranceToastRegion';
        region.className = 'insurance-toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        document.body.appendChild(region);
    }

    const toast = document.createElement('div');
    toast.className = `insurance-toast insurance-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.textContent = String(message || 'ดำเนินการสำเร็จ');

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'insurance-toast-close';
    closeButton.setAttribute('aria-label', 'ปิดข้อความแจ้งเตือน');
    closeButton.textContent = '×';

    const removeToast = () => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 180);
    };

    closeButton.addEventListener('click', removeToast);
    toast.append(text, closeButton);
    region.appendChild(toast);

    window.setTimeout(removeToast, duration);
    return toast;
};


//window.isSlkWorkLocation = function (value) {
//window.setSlkColumnsVisibility = function (show) {
//#region
window.isSlkWorkLocation = function (value) {
    const text =
        String(value || '')
            .trim()
            .toUpperCase();

    return (
        text.includes('SLK') ||
        text.includes('SL') ||
        text.includes('SRI LANKA') ||
        text.includes('ศรีลังกา')
    );
};

window.setSlkColumnsVisibility = function (show) {
    window.__slkColumnsShown = show;   // จำสถานะล่าสุด (ตารางที่วาดเพิ่มทีหลังใช้ค่านี้)
    document
        .querySelectorAll('.slk-column')
        .forEach(element => {
            element.style.display =
                show ? '' : 'none';
        });
};
//#endregion





