
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
    image.src = imageUrl;
    image.alt = imageName;
    image.className = 'image-viewer-full';

    viewer.appendChild(image);
    document.body.appendChild(viewer);

    viewer.addEventListener('click', () => viewer.remove());

    document.addEventListener('keydown', function closeViewer(event) {
        if (event.key === 'Escape') {
            viewer.remove();
            document.removeEventListener('keydown', closeViewer);
        }
    });
}
//#endregion

//เพิ่มฟังก์ชันอัปโหลดรูปไป Google Drive
//function fileToDataUrl(file) {
//#region
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(
            new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`)
        );

        reader.readAsDataURL(file);
    });
}
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
    document
        .querySelectorAll('.slk-column')
        .forEach(element => {
            element.style.display =
                show ? '' : 'none';
        });
};
//#endregion





