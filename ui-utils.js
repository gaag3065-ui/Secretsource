
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





