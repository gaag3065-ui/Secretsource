// The server is authoritative. Show its validation on the relevant money fields without changing layout.
(() => {
    const original = window.authFetch;
    if (typeof original !== 'function' || original.insuranceBudgetGuard) return;
    const observed = new WeakSet();
    const clearWarnings = () => {
        for (const input of document.querySelectorAll('[data-insurance-budget-invalid]')) {
            input.setCustomValidity(''); input.removeAttribute('aria-invalid'); input.removeAttribute('data-insurance-budget-invalid');
        }
    };
    const wrapped = async function (url, options) {
        const response = await original.call(this, url, options);
        const path = new URL(String(url), location.href).pathname;
        if (response.status === 422 && ['/api/save-treatment', '/api/update-treatment'].includes(path)) {
            const result = await response.clone().json().catch(() => ({}));
            if (result.code === 'INSURANCE_LIMIT_EXCEEDED') {
                let first;
                for (const detail of result.details || []) for (const field of detail.fields || []) {
                    const inputs = document.querySelectorAll(`#ocInp${field}, #mdInp${field}, .inline-edit-field[data-field-key="${field}"]`);
                    for (const input of inputs) {
                        if (!input.getClientRects().length) continue;
                        input.setCustomValidity(result.message); input.setAttribute('aria-invalid', 'true');
                        input.setAttribute('data-insurance-budget-invalid', 'true');
                        if (!observed.has(input)) { input.addEventListener('input', clearWarnings); observed.add(input); }
                        first ||= input;
                    }
                }
                first?.focus(); first?.reportValidity();
                // The server rechecks every retry. Do not leave native validation stuck after reopening another case.
                for (const input of document.querySelectorAll('[data-insurance-budget-invalid]')) input.setCustomValidity('');
            }
        }
        return response;
    };
    wrapped.insuranceBudgetGuard = true;
    window.authFetch = wrapped;
})();
