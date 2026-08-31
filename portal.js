document.addEventListener('DOMContentLoaded', async () => {
    const categoryNames = {
        all: 'ส่วนงาน',
        insurance: 'งานประกัน',
        people: 'งานบุคลากร',
        assets: 'งานทรัพย์สิน',
        wellbeing: 'งานสุขภาวะ',
        transport: 'งานการเดินทาง'
    };

    const insurancePermissions = [
        'SearchData',
        'CreateTreatment',
        'ViewHistory',
        'EditTreatment',
        'DeleteTreatment',
        'UploadFiles',
        'ViewAllHistory',
        'ExportHistoryReport'
    ];

const services = [
    {
        id: 'insurance',
        category: 'insurance',
        title: 'งานประกันและการรักษา',
        shortTitle: 'งานประกัน',
        icon: 'shield',
        color: '#635bff',
        soft: '#efedff',
        tags: [],
        tasks: [
            {
                route: 'open-treatment',
                title: 'เปิดเคส เข้ารักษา',
                icon: 'plus',
                page:
                    'search.html?v=20260831-insurance-31' +
                    '#treatment-box-placeholder'
            },
            {
                route: 'update-treatment',
                title:
                    'อัปเดตผลการรักษาหรือปิดเคส',
                icon: 'health',
                page:
                    'search.html?v=20260831-insurance-31' +
                    '#continuity-care-placeholder'
            },
            {
                route: 'treatment-history',
                title: 'ประวัติการรักษา',
                icon: 'home',
                page:
                    'search.html?v=20260831-insurance-31' +
                    '#table-box-placeholder'
            }
        ]
    },
    {
        id: 'accommodation',
        category: 'people',
        title: 'ห้องพักพนักงาน',
        shortTitle: 'ห้องพักพนักงาน',
        icon: 'building',
        color: '#087f74',
        soft: '#e5f7f4',
        tags: [],
        tasks: [
            {
                route: 'room-search',
                title: 'ค้นหาห้องพัก',
                icon: 'search',
                page:
                    'accommodation.html' +
                    '?view=search'
            },
            {
                route: 'room-pp',
                title: 'ห้องพักพื้นที่ PP',
                icon: 'building',
                page:
                    'accommodation.html' +
                    '?area=PP'
            },
            {
                route: 'room-sl',
                title: 'ห้องพักพื้นที่ SL',
                icon: 'building',
                page:
                    'accommodation.html' +
                    '?area=SL'
            },
            {
                route: 'room-ge',
                title: 'ห้องพักพื้นที่ GE',
                icon: 'building',
                page:
                    'accommodation.html' +
                    '?area=GE'
            }
        ]
    },
    {
        id: 'assets',
        category: 'assets',
        title: 'บริหารทรัพย์สิน',
        shortTitle: 'ทรัพย์สิน',
        icon: 'box',
        color: '#2563eb',
        soft: '#eaf2ff',
        tags: [],
        tasks: [
            {
                route: 'asset-search',
                title: 'ค้นหาทรัพย์สิน',
                icon: 'search',
                page:
                    'assets.html' +
                    '?view=search'
            },
            {
                route: 'asset-pp',
                title: 'ทรัพย์สิน PP',
                icon: 'box',
                page:
                    'assets.html' +
                    '?area=PP'
            },
            {
                route: 'asset-sl',
                title: 'ทรัพย์สิน SL',
                icon: 'box',
                page:
                    'assets.html' +
                    '?area=SL'
            },
            {
                route: 'asset-ge',
                title: 'ทรัพย์สิน GE',
                icon: 'box',
                page:
                    'assets.html' +
                    '?area=GE'
            }
        ]
    },
    {
        id: 'medication',
        category: 'wellbeing',
        title: 'จัดการยา',
        shortTitle: 'จัดการยา',
        icon: 'health',
        color: '#d92d20',
        soft: '#fff0ee',
        tags: [],
        planned: true,
        tasks: [
            {
                route: 'pending',
                title: 'รอดำเนินการ',
                icon: 'health',
                planned: true,
                page: ''
            }
        ]
    },
    {
        id: 'fitness',
        category: 'wellbeing',
        title: 'ฟิตเนส',
        shortTitle: 'ฟิตเนส',
        icon: 'health',
        color: '#e04f9a',
        soft: '#fff0f7',
        tags: [],
        planned: true,
        tasks: [
            {
                route: 'pending',
                title: 'รอดำเนินการ',
                icon: 'health',
                planned: true,
                page: ''
            }
        ]
    },
    {
        id: 'transport',
        category: 'transport',
        title: 'รถรับส่งพนักงาน',
        shortTitle: 'รถรับส่งพนักงาน',
        icon: 'bus',
        color: '#c26a12',
        soft: '#fff5e8',
        tags: [],
        planned: true,
        tasks: [
            {
                route: 'pending',
                title: 'รอดำเนินการ',
                icon: 'bus',
                planned: true,
                page: ''
            }
        ]
    }
];

const elements = {
    serviceGrid:
        document.getElementById(
            'serviceGrid'
        ),
    serviceSearch:
        document.getElementById(
            'serviceSearch'
        ),
    emptyState:
        document.getElementById(
            'emptyState'
        ),
    secondCategoryTitle:
        document.getElementById(
            'secondCategoryTitle'
        ),
    selectedServiceDetail:
        document.getElementById(
            'selectedServiceDetail'
        ),
    catalogView:
        document.getElementById(
            'catalogView'
        ),
    workspaceView:
        document.getElementById(
            'workspaceView'
        ),
    workspaceFrame:
        document.getElementById(
            'workspaceFrame'
        ),
    workspaceLoading:
        document.getElementById(
            'workspaceLoading'
        ),
    workspaceTitle:
        document.getElementById(
            'workspaceTitle'
        ),
    workspaceSubtitle:
        document.getElementById(
            'workspaceSubtitle'
        ),
    workspaceExternalLink:
        document.getElementById(
            'workspaceExternalLink'
        ),
    sidebarScrim:
        document.getElementById(
            'sidebarScrim'
        ),
    secondarySidebar:
        document.getElementById(
            'secondarySidebar'
        )
};

    let sessionUser = {};
    let permissions = {};
    let activeCategory = 'all';
    let selectedServiceId = null;
    let showReadyOnly = false;
    let activeTaskIndex = null;

    function iconMarkup(iconName) {
        return `
            <svg aria-hidden="true">
                <use href="#icon-${iconName}"></use>
            </svg>
        `;
    }

    function getBasePage(page) {
        return String(page || '').split(/[?#]/, 1)[0];
    }

    function canAccessPage(page) {
        const basePage = getBasePage(page);

        if (String(sessionUser.role || '').toUpperCase() === 'ADMIN') {
            return true;
        }

        if (basePage === 'search.html') {
            return insurancePermissions.some(
                permission => permissions[permission] === true
            );
        }

if (basePage === 'accommodation.html') {
    return (
        permissions.ManageAccommodation ===
        true
    );
}

if (basePage === 'assets.html') {
    return permissions.ViewAssets === true;
}

return false;
    }

    function getServiceState(service) {
        if (service.planned) {
            return {
                label: 'เตรียมระบบ',
                className: 'is-planned'
            };
        }

        const accessible = service.tasks.some(task => canAccessPage(task.page));

        if (!accessible) {
            return {
                label: 'ไม่มีสิทธิ์',
                className: 'is-locked'
            };
        }

        return {
            label: 'พร้อมใช้งาน',
            className: ''
        };
    }

    function matchesCurrentFilters(service) {
        const query = elements.serviceSearch.value.trim().toLowerCase();

        const matchesCategory =
            activeCategory === 'all' ||
            service.category === activeCategory;

        const matchesReady =
            !showReadyOnly ||
            getServiceState(service).label === 'พร้อมใช้งาน';

        const searchText = [
            service.title,
            service.shortTitle,
            service.description,
            ...service.tags,
            ...service.tasks.map(task => task.title)
        ]
            .join(' ')
            .toLowerCase();

        return (
            matchesCategory &&
            matchesReady &&
            (!query || searchText.includes(query))
        );
    }

    function renderServiceCards() {
        const visibleServices = services.filter(matchesCurrentFilters);

        elements.serviceGrid.innerHTML = visibleServices
            .map(service => {
                const state = getServiceState(service);
                const selectedClass =
                    service.id === selectedServiceId
                        ? ' is-selected'
                        : '';

                const taskCount = service.tasks.length
                    ? `${service.tasks.length} รายการงาน`
                    : '— รายการงาน';

                return `
                    <button
                        class="service-card${selectedClass}"
                        type="button"
                        data-service-id="${service.id}"
                        style="
                            --service-color:${service.color};
                            --service-soft:${service.soft};
                        "
                        aria-label="ดูรายละเอียด ${service.title}"
                    >
                        <span class="service-card-header">
                            <span class="service-card-icon">
                                ${iconMarkup(service.icon)}
                            </span>

                            <span class="service-state ${state.className}">
                                ${state.label}
                            </span>
                        </span>

                        <h2>${service.title}</h2>
                        <p class="service-description">${service.description}</p>

                        <span class="service-tags">
                            ${service.tags
                                .map(tag => `<span>${tag}</span>`)
                                .join('')}
                        </span>

                        <span class="service-card-footer">
                            <span>${taskCount}</span>
                            <strong>ดูรายละเอียด →</strong>
                        </span>
                    </button>
                `;
            })
            .join('');

        elements.emptyState.hidden = visibleServices.length > 0;

        elements.serviceGrid
            .querySelectorAll('.service-card')
            .forEach(card => {
                card.addEventListener('click', () => {
                    selectService(card.dataset.serviceId);
                });
            });
    }



function renderDynamicSubmenu(service) {
    elements.selectedServiceDetail.hidden = false;
    elements.selectedServiceDetail.innerHTML = `
        <div
            class="dynamic-submenu-list"
            role="navigation"
            aria-label="${service.shortTitle}"
        >
            ${service.tasks
                .map((task, index) => `
                    <button
                        class="dynamic-submenu-item"
                        type="button"
                        data-task-index="${index}"
                        aria-current="false"
                    >
                        <span
                            class="dynamic-submenu-icon"
                            aria-hidden="true"
                        >
                            ${iconMarkup(
                                task.icon ||
                                service.icon
                            )}
                        </span>

                        <span
                            class="dynamic-submenu-label"
                        >
                            ${task.title}
                        </span>

                        <svg
                            class="dynamic-submenu-arrow"
                            aria-hidden="true"
                        >
                            <use
                                href="#icon-arrow"
                            ></use>
                        </svg>
                    </button>
                `)
                .join('')}
        </div>
    `;

    elements.selectedServiceDetail
        .querySelectorAll(
            '.dynamic-submenu-item'
        )
        .forEach(button => {
            button.addEventListener(
                'click',
                () => {
                    const taskIndex = Number(
                        button.dataset.taskIndex
                    );
                    const task =
                        service.tasks[taskIndex];

                    if (!task) {
                        return;
                    }

                    openTask(
                        service,
                        task,
                        taskIndex
                    );
                }
            );
        });
}

function openSecondarySidebar(serviceId) {
    const service = services.find(
        item => item.id === serviceId
    );

    if (!service) {
        return;
    }

    selectedServiceId = service.id;
    activeTaskIndex = null;

    document.body.classList.add(
        'second-sidebar-open'
    );
    elements.secondarySidebar.setAttribute(
        'aria-hidden',
        'false'
    );

    document
        .querySelectorAll(
            '.first-menu-item[data-service-id]'
        )
        .forEach(button => {
            const isActive =
                button.dataset.serviceId ===
                service.id;

            button.classList.toggle(
                'is-active',
                isActive
            );
            button.setAttribute(
                'aria-expanded',
                String(isActive)
            );
        });

    elements.secondCategoryTitle.textContent =
        service.shortTitle;

    renderDynamicSubmenu(service);
}

function closeSecondarySidebar() {
    selectedServiceId = null;
    activeTaskIndex = null;

    document.body.classList.remove('second-sidebar-open');
    elements.secondarySidebar.setAttribute(
        'aria-hidden',
        'true'
    );

    document
        .querySelectorAll('.first-menu-item[data-service-id]')
        .forEach(button => {
            button.classList.remove('is-active');
            button.setAttribute(
                'aria-expanded',
                'false'
            );
        });

    elements.selectedServiceDetail.hidden = true;
}

function selectService(serviceId) {
    const service = services.find(
        item => item.id === serviceId
    );

    if (!service) {
        return;
    }

    openSecondarySidebar(service.id);
    renderServiceCards();
}

function closeServiceDetail() {
    closeSecondarySidebar();
    renderServiceCards();
}

function setCategory(category) {
    activeCategory =
        Object.prototype.hasOwnProperty.call(
            categoryNames,
            category
        )
            ? category
            : 'all';

    document
        .querySelectorAll(
            '.filter-button[data-category]'
        )
        .forEach(button => {
            button.classList.toggle(
                'is-active',
                button.dataset.category ===
                    activeCategory
            );
        });

    closeWorkspace();
    closeSecondarySidebar();
    renderServiceCards();
    closeMobileNavigation();
}


function openTask(service, task, taskIndex = 0) {
    renderTaskContent(
        service,
        task,
        taskIndex,
        true
    );
}

function renderTaskContent(
    service,
    task,
    taskIndex,
    updateHistory
) {
    if (
        !task.planned &&
        !canAccessPage(task.page)
    ) {
        alert(
            'บัญชีนี้ไม่มีสิทธิ์เข้าถึงส่วนงานดังกล่าว'
        );
        return;
    }

    activeTaskIndex = taskIndex;

    elements.selectedServiceDetail
        .querySelectorAll('.dynamic-submenu-item')
        .forEach((button, index) => {
            const isActive =
                index === activeTaskIndex;

            button.classList.toggle(
                'is-active',
                isActive
            );
            button.setAttribute(
                'aria-current',
                isActive ? 'page' : 'false'
            );
        });

    if (updateHistory) {
        window.history.pushState(
            {
                serviceId: service.id,
                taskIndex
            },
            '',
            `#/${service.id}/${task.route}`
        );
    }

    elements.catalogView.hidden = true;
    elements.workspaceView.hidden = false;
    elements.workspaceView.classList.toggle(
        'is-open-treatment',
        service.id === 'insurance' &&
        (
            task.route === 'open-treatment' ||
            task.route === 'update-treatment'
        )
    );
    elements.workspaceView.classList.toggle(
        'is-self-headered',
        task.page.startsWith('accommodation.html')
    );
    elements.workspaceLoading.hidden = false;

    elements.workspaceTitle.textContent =
        task.title;
    elements.workspaceSubtitle.textContent =
        service.title;

    elements.workspaceFrame.removeAttribute(
        'srcdoc'
    );

    if (task.planned) {
        elements.workspaceExternalLink.hidden = true;
        elements.workspaceLoading.hidden = true;
        elements.workspaceFrame.src = 'about:blank';
        elements.workspaceFrame.srcdoc = `
            <!doctype html>
            <html lang="th">
                <head>
                    <meta charset="utf-8">
                    <meta
                        name="viewport"
                        content="width=device-width,initial-scale=1"
                    >
                    <style>
                        * {
                            box-sizing: border-box;
                        }

                        html,
                        body {
                            width: 100%;
                            height: 100%;
                            margin: 0;
                        }

                        body {
                            display: grid;
                            place-items: center;
                            background: #f7f8fa;
                            color: #1d2939;
                            font-family:
                                "Noto Sans Thai",
                                Arial,
                                sans-serif;
                        }

                        .pending-card {
                            width: min(420px, calc(100% - 40px));
                            padding: 40px 32px;
                            border: 1px solid #e6e8eb;
                            border-radius: 18px;
                            background: #ffffff;
                            box-shadow:
                                0 12px 35px
                                rgba(16, 24, 40, 0.06);
                            text-align: center;
                        }

                        .pending-icon {
                            display: grid;
                            width: 52px;
                            height: 52px;
                            margin: 0 auto 18px;
                            place-items: center;
                            border-radius: 14px;
                            background: #eef3ff;
                            color: #3370ff;
                            font-size: 24px;
                            font-weight: 700;
                        }

                        h1 {
                            margin: 0 0 8px;
                            font-size: 20px;
                        }

                        p {
                            margin: 0;
                            color: #667085;
                            font-size: 14px;
                        }
                    </style>
                </head>

                <body>
                    <main class="pending-card">
                        <div class="pending-icon">⋯</div>
                        <h1>รอดำเนินการ</h1>
                        <p>
                            ฟังก์ชันนี้อยู่ระหว่างเตรียมระบบ
                        </p>
                    </main>
                </body>
            </html>
        `;

        closeMobileNavigation();
        return;
    }

    elements.workspaceExternalLink.hidden = false;
    elements.workspaceExternalLink.href =
        task.page;
    elements.workspaceFrame.title =
        `${task.title} — ${service.title}`;

    const targetUrl = new URL(
        task.page,
        window.location.href
    );
    const currentUrl = elements.workspaceFrame.src
        ? new URL(
            elements.workspaceFrame.src,
            window.location.href
        )
        : null;
    const isSameWorkspaceDocument =
        currentUrl &&
        currentUrl.pathname === targetUrl.pathname &&
        currentUrl.search === targetUrl.search &&
        elements.workspaceFrame.contentWindow;

    if (isSameWorkspaceDocument) {
        elements.workspaceFrame.contentWindow.location.hash =
            targetUrl.hash;
        elements.workspaceLoading.hidden = true;
    } else {
        elements.workspaceFrame.src = targetUrl.href;
    }

    closeMobileNavigation();
}

    function closeWorkspace() {
        elements.workspaceFrame.src = 'about:blank';
        elements.workspaceView.classList.remove(
            'is-open-treatment',
            'is-self-headered'
        );
        elements.workspaceView.hidden = true;
        elements.catalogView.hidden = false;
    }

    function openMobileNavigation() {
        document.body.classList.add('sidebar-open');
    }

    function closeMobileNavigation() {
        document.body.classList.remove('sidebar-open');
    }

    async function logout() {
        const confirmed = confirm('ยืนยันการออกจากระบบหรือไม่');

        if (!confirmed) {
            return;
        }

        if (typeof window.performSecureLogout === 'function') {
            await window.performSecureLogout();
            return;
        }

        sessionStorage.clear();
        window.location.replace('index.html');
    }

    async function loadSession() {
        const authFetch =
            typeof window.authFetch === 'function'
                ? window.authFetch
                : window.fetch.bind(window);

        const apiBaseUrl =
            window.APP_CONFIG?.API_BASE_URL || '';

        const response = await authFetch(
            `${apiBaseUrl}/api/session`
        );

        if (!response.ok) {
            throw new Error('Session invalid');
        }

        const data = await response.json();

        sessionUser = data.user || {};
        permissions = data.permissions || {};
    }

    function updateAccountInformation() {
        const displayName =
            sessionUser.username ||
            sessionUser.name ||
            sessionUser.employeeName ||
            'ผู้ใช้งาน';

        const isAdmin =
            String(sessionUser.role || '').toUpperCase() === 'ADMIN';

        document.getElementById('accountName').textContent =
            displayName;

        document.getElementById('accountRole').textContent =
            isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งานทั่วไป';

        document.getElementById('accountAvatar').textContent =
            String(displayName)
                .trim()
                .slice(0, 2)
                .toUpperCase() || 'GA';
    }

document
    .querySelectorAll('.first-menu-item[data-service-id]')
    .forEach(button => {
        button.addEventListener('click', () => {
            const serviceId = button.dataset.serviceId;
            const isAlreadyOpen =
                selectedServiceId === serviceId &&
                document.body.classList.contains(
                    'second-sidebar-open'
                );

            if (isAlreadyOpen) {
                closeSecondarySidebar();
                return;
            }

            openSecondarySidebar(serviceId);
        });
    });

document
    .querySelectorAll('.filter-button[data-category]')
    .forEach(button => {
        button.addEventListener('click', () => {
            setCategory(button.dataset.category);
        });
    });

    elements.serviceSearch.addEventListener(
        'input',
        renderServiceCards
    );



    document
        .getElementById('workspaceBackButton')
        .addEventListener('click', closeWorkspace);

    document
        .getElementById('mobileMenuButton')
        .addEventListener('click', openMobileNavigation);

    elements.sidebarScrim.addEventListener(
        'click',
        closeMobileNavigation
    );

    document
        .getElementById('logoutButton')
        .addEventListener('click', logout);

    document
        .getElementById('sidebarLogoutButton')
        .addEventListener('click', logout);

    elements.workspaceFrame.addEventListener('load', () => {
        elements.workspaceLoading.hidden = true;
    });

    document.addEventListener('keydown', event => {
        if (
            event.key === '/' &&
            document.activeElement !== elements.serviceSearch &&
            !elements.catalogView.hidden
        ) {
            event.preventDefault();
            elements.serviceSearch.focus();
        }

        if (event.key === 'Escape') {
            closeMobileNavigation();

            if (!elements.workspaceView.hidden) {
                closeWorkspace();
            } else if (!elements.selectedServiceDetail.hidden) {
                closeServiceDetail();
            }
        }
    });

window.addEventListener('popstate', event => {
    const state = event.state;

    if (!state?.serviceId) {
        closeWorkspace();
        return;
    }

    const service = services.find(
        item => item.id === state.serviceId
    );
    const task = service?.tasks?.[state.taskIndex];

    if (!service || !task) {
        return;
    }

    openSecondarySidebar(service.id);
    renderTaskContent(
        service,
        task,
        state.taskIndex,
        false
    );
});

    try {
        await loadSession();
    } catch (error) {
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }

updateAccountInformation();
renderServiceCards();
});
