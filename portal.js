document.addEventListener('DOMContentLoaded', async () => {
    const categoryNames = {
        all: 'à¸ªà¹ˆà¸§à¸™à¸‡à¸²à¸™',
        insurance: 'à¸‡à¸²à¸™à¸›à¸£à¸°à¸à¸±à¸™',
        people: 'à¸‡à¸²à¸™à¸šà¸¸à¸„à¸¥à¸²à¸à¸£',
        assets: 'à¸‡à¸²à¸™à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™',
        wellbeing: 'à¸‡à¸²à¸™à¸ªà¸¸à¸‚à¸ à¸²à¸§à¸°',
        transport: 'à¸‡à¸²à¸™à¸à¸²à¸£à¹€à¸”à¸´à¸™à¸—à¸²à¸‡'
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
        id: 'internal-support',
        category: 'people',
        title: 'à¸ªà¸™à¸±à¸šà¸ªà¸™à¸¸à¸™à¸à¸´à¸ˆà¸à¸²à¸£à¸ à¸²à¸¢à¹ƒà¸™',
        shortTitle: 'à¸ªà¸™à¸±à¸šà¸ªà¸™à¸¸à¸™à¸à¸´à¸ˆà¸à¸²à¸£à¸ à¸²à¸¢à¹ƒà¸™',
        description: 'à¸•à¸´à¸”à¸•à¸²à¸¡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡ LINE OA à¹à¸¥à¸°à¸‡à¸²à¸™à¸ªà¸™à¸±à¸šà¸ªà¸™à¸¸à¸™à¸à¸´à¸ˆà¸à¸²à¸£à¸ à¸²à¸¢à¹ƒà¸™',
        icon: 'message',
        color: '#06a86b',
        soft: '#e9fbf3',
        tags: [],
        tasks: [
            {
                route: 'monitoring',
                title: 'Monitoring',
                icon: 'message',
                page: 'monitoring.html?v=20261025-1'
            },
            {
                route: 'new-work-update',
                title: 'à¸­à¸±à¸›à¹€à¸”à¸•à¸‡à¸²à¸™à¹ƒà¸«à¸¡à¹ˆ',
                icon: 'plus',
                planned: true,
                page: ''
            },
            {
                route: 'business-overview',
                title: 'à¸ à¸²à¸žà¸£à¸§à¸¡à¸à¸´à¸ˆà¸à¸²à¸£',
                icon: 'home',
                planned: true,
                page: ''
            }
        ]
    },
    {
        id: 'insurance',
        category: 'insurance',
        title: 'à¸‡à¸²à¸™à¸›à¸£à¸°à¸à¸±à¸™à¹à¸¥à¸°à¸à¸²à¸£à¸£à¸±à¸à¸©à¸²',
        shortTitle: 'à¸‡à¸²à¸™à¸›à¸£à¸°à¸à¸±à¸™',
        description: 'à¹€à¸›à¸´à¸”à¹€à¸„à¸ª à¸šà¸±à¸™à¸—à¸¶à¸à¸œà¸¥à¸à¸²à¸£à¸£à¸±à¸à¸©à¸² à¹à¸¥à¸°à¸”à¸¹à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¹€à¸šà¸´à¸à¸›à¸£à¸°à¸à¸±à¸™',
        icon: 'shield',
        color: '#635bff',
        soft: '#efedff',
        tags: [],
        // à¸£à¸§à¸¡ 3 à¸«à¸™à¹‰à¸² (à¹€à¸›à¸´à¸”à¹€à¸„à¸ª / à¸­à¸±à¸›à¹€à¸”à¸•-à¸›à¸´à¸”à¹€à¸„à¸ª / à¸›à¸£à¸°à¸§à¸±à¸•à¸´) à¹€à¸›à¹‡à¸™à¸«à¸™à¹‰à¸²à¹€à¸”à¸µà¸¢à¸§à¹€à¸¥à¸·à¹ˆà¸­à¸™à¸•à¹ˆà¸­à¸à¸±à¸™ â€” à¸à¸”à¹€à¸¡à¸™à¸¹à¸«à¸¥à¸±à¸à¸„à¸£à¸±à¹‰à¸‡à¹€à¸”à¸µà¸¢à¸§à¹€à¸›à¸´à¸”à¹€à¸¥à¸¢
        directOpen: true,
        tasks: [
            {
                route: 'insurance-all',
                title: 'à¸‡à¸²à¸™à¸›à¸£à¸°à¸à¸±à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”',
                icon: 'shield',
                page:
                    'search.html?v=20261016-contact-01' +
                    '#all'
            }
        ]
    },
    {
        id: 'accommodation',
        category: 'people',
        title: 'à¸«à¹‰à¸­à¸‡à¸žà¸±à¸à¸žà¸™à¸±à¸à¸‡à¸²à¸™',
        shortTitle: 'à¸«à¹‰à¸­à¸‡à¸žà¸±à¸à¸žà¸™à¸±à¸à¸‡à¸²à¸™',
        description: 'à¸„à¹‰à¸™à¸«à¸²à¹à¸¥à¸°à¸ˆà¸±à¸”à¸à¸²à¸£à¸«à¹‰à¸­à¸‡à¸žà¸±à¸à¸žà¸™à¸±à¸à¸‡à¸²à¸™à¸—à¸¸à¸à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆ',
        icon: 'building',
        color: '#087f74',
        soft: '#e5f7f4',
        tags: [],
        // à¸à¸”à¸à¸²à¸£à¹Œà¸”à¹à¸¥à¹‰à¸§à¹€à¸‚à¹‰à¸² "à¸ˆà¸±à¸”à¸à¸²à¸£à¸«à¹‰à¸­à¸‡à¸žà¸±à¸à¸žà¸™à¸±à¸à¸‡à¸²à¸™" à¸—à¸±à¸™à¸—à¸µ à¹„à¸¡à¹ˆà¹à¸ªà¸”à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¸”à¹‰à¸²à¸™à¸‹à¹‰à¸²à¸¢
        // ("à¸•à¸£à¸§à¸ˆà¸£à¸±à¸šà¸«à¹‰à¸­à¸‡à¸žà¸±à¸" à¹€à¸‚à¹‰à¸²à¸ˆà¸²à¸à¸›à¸¸à¹ˆà¸¡ "à¹€à¸Šà¹ˆà¸²à¸—à¸µà¹ˆà¸žà¸±à¸à¹ƒà¸«à¸¡à¹ˆ" à¹ƒà¸™à¸«à¸™à¹‰à¸²à¸™à¸±à¹‰à¸™ â€” à¸ªà¹ˆà¸‡ postMessage open-task à¸¡à¸²)
        directOpen: true,
        directTask: 'room-search',
        tasks: [
            {
                route: 'room-search',
                // à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹€à¸›à¹‡à¸™à¸ à¸²à¸žà¸£à¸§à¸¡à¸ˆà¸²à¸ Google Sheet (à¹€à¸”à¸´à¸¡à¹€à¸›à¹‡à¸™à¹€à¸¡à¸™à¸¹ "à¸ à¸²à¸žà¸£à¸§à¸¡à¸—à¸µà¹ˆà¸žà¸±à¸ (Google Sheet)" à¹à¸¢à¸)
                title: 'à¸ˆà¸±à¸”à¸à¸²à¸£à¸«à¹‰à¸­à¸‡à¸žà¸±à¸à¸žà¸™à¸±à¸à¸‡à¸²à¸™',
                icon: 'building',
                page: 'accommodation.html?v=20261026-5'
            },
            {
                // à¹à¸šà¸šà¸•à¸£à¸§à¸ˆà¸£à¸±à¸šà¸«à¹‰à¸­à¸‡à¸žà¸±à¸ + à¸£à¸²à¸¢à¸‡à¸²à¸™à¸£à¸¹à¸›à¸ à¸²à¸ž â†’ PDF (à¸¢à¹‰à¸²à¸¢à¸¡à¸²à¸ˆà¸²à¸à¸£à¸°à¸šà¸šà¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡ "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸—à¸µà¹ˆà¸žà¸±à¸")
                route: 'room-inspection',
                title: 'à¸•à¸£à¸§à¸ˆà¸£à¸±à¸šà¸«à¹‰à¸­à¸‡à¸žà¸±à¸',
                icon: 'shield',
                page: 'room-inspection.html?v=20261027-1'
            }
        ]
    },
    {
        id: 'assets',
        category: 'assets',
        title: 'à¸šà¸£à¸´à¸«à¸²à¸£à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™',
        shortTitle: 'à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™',
        description: 'à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™ à¸•à¸´à¸”à¸•à¸²à¸¡à¸ªà¸–à¸²à¸™à¸°à¹à¸¥à¸°à¸à¸²à¸£à¹‚à¸¢à¸à¸¢à¹‰à¸²à¸¢',
        icon: 'box',
        color: '#2563eb',
        soft: '#eaf2ff',
        tags: [],
        // à¸à¸”à¸à¸²à¸£à¹Œà¸”à¹à¸¥à¹‰à¸§à¹€à¸‚à¹‰à¸² "à¸„à¹‰à¸™à¸«à¸²à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™" à¸—à¸±à¸™à¸—à¸µ à¹„à¸¡à¹ˆà¹à¸ªà¸”à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¸”à¹‰à¸²à¸™à¸‹à¹‰à¸²à¸¢
        directOpen: true,
        directTask: 'asset-search',
        // à¸«à¸™à¹‰à¸²à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™à¸¡à¸µà¸«à¸±à¸§à¹à¸¥à¸°à¸›à¸¸à¹ˆà¸¡à¸à¸¥à¸±à¸š/à¸­à¸­à¸à¸ˆà¸²à¸à¸£à¸°à¸šà¸šà¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡ â†’ à¹€à¸›à¸´à¸”à¹€à¸•à¹‡à¸¡à¸«à¸™à¹‰à¸²à¸•à¹ˆà¸²à¸‡à¹à¸—à¸™à¸à¸²à¸£à¸à¸±à¸‡à¹ƒà¸™à¸à¸£à¸­à¸š
        fullPage: true,
        tasks: [
            {
                route: 'asset-search',
                title: 'à¸„à¹‰à¸™à¸«à¸²à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™',
                icon: 'search',
                page:
                    'assets.html' +
                    '?view=search'
            },
            {
                route: 'asset-pp',
                title: 'à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™ PP',
                icon: 'box',
                page:
                    'assets.html' +
                    '?area=PP'
            },
            {
                route: 'asset-sl',
                title: 'à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™ SL',
                icon: 'box',
                page:
                    'assets.html' +
                    '?area=SL'
            },
            {
                route: 'asset-ge',
                title: 'à¸—à¸£à¸±à¸žà¸¢à¹Œà¸ªà¸´à¸™ GE',
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
        title: 'à¸ˆà¸±à¸”à¸à¸²à¸£à¸¢à¸²',
        shortTitle: 'à¸ˆà¸±à¸”à¸à¸²à¸£à¸¢à¸²',
        description: 'à¸£à¸°à¸šà¸šà¸ˆà¸±à¸”à¸à¸²à¸£à¸¢à¸²à¹à¸¥à¸°à¹€à¸§à¸Šà¸ à¸±à¸“à¸‘à¹Œ (à¹€à¸•à¸£à¸µà¸¢à¸¡à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™)',
        icon: 'health',
        color: '#d92d20',
        soft: '#fff0ee',
        tags: [],
        planned: true,
        tasks: [
            {
                route: 'pending',
                title: 'à¸£à¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£',
                icon: 'health',
                planned: true,
                page: ''
            }
        ]
    },
    {
        id: 'fitness',
        category: 'wellbeing',
        title: 'à¸­à¸­à¸à¸à¸³à¸¥à¸±à¸‡à¸à¸²à¸¢à¹à¸¥à¸°à¸Ÿà¸´à¸•à¹€à¸™à¸ª 15 à¸„à¸£à¸±à¹‰à¸‡',
        shortTitle: 'à¸­à¸­à¸à¸à¸³à¸¥à¸±à¸‡à¸à¸²à¸¢à¹à¸¥à¸°à¸Ÿà¸´à¸•à¹€à¸™à¸ª',
        description: 'à¸•à¸£à¸§à¸ˆà¸£à¸¹à¸›à¹à¸¥à¸°à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸­à¸­à¸à¸à¸³à¸¥à¸±à¸‡à¸à¸²à¸¢ 15 à¸„à¸£à¸±à¹‰à¸‡ / à¸à¸´à¸ˆà¸à¸£à¸£à¸¡ 30 à¸§à¸±à¸™ / à¸Ÿà¸´à¸•à¹€à¸™à¸ªà¸£à¸²à¸¢à¹€à¸”à¸·à¸­à¸™à¸‚à¸­à¸‡à¸žà¸™à¸±à¸à¸‡à¸²à¸™',
        icon: 'health',
        color: '#e04f9a',
        soft: '#fff0f7',
        tags: [],
        // à¸«à¸¥à¸±à¸‡à¸šà¹‰à¸²à¸™à¸‚à¸­à¸‡à¸«à¸™à¹‰à¸²à¸žà¸™à¸±à¸à¸‡à¸²à¸™ exercise.html (à¸¢à¹‰à¸²à¸¢à¸¡à¸²à¸ˆà¸²à¸ Google Apps Script à¹€à¸”à¸´à¸¡) â€” à¸à¸”à¸à¸²à¸£à¹Œà¸”à¹à¸¥à¹‰à¸§à¹€à¸›à¸´à¸”à¹€à¸¥à¸¢
        directOpen: true,
        tasks: [
            {
                route: 'fitness-admin',
                title: 'à¸­à¸­à¸à¸à¸³à¸¥à¸±à¸‡à¸à¸²à¸¢à¹à¸¥à¸°à¸Ÿà¸´à¸•à¹€à¸™à¸ª 15 à¸„à¸£à¸±à¹‰à¸‡',
                icon: 'health',
                page: 'fitness-admin.html?v=20261027-5'
            }
        ]
    },
    {
        id: 'transport',
        category: 'transport',
        title: 'à¸£à¸–à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸žà¸™à¸±à¸à¸‡à¸²à¸™',
        shortTitle: 'à¸£à¸–à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸žà¸™à¸±à¸à¸‡à¸²à¸™',
        description: 'à¸£à¸°à¸šà¸šà¸£à¸–à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸žà¸™à¸±à¸à¸‡à¸²à¸™ (à¹€à¸•à¸£à¸µà¸¢à¸¡à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™)',
        icon: 'bus',
        color: '#c26a12',
        soft: '#fff5e8',
        tags: [],
        planned: true,
        tasks: [
            {
                route: 'pending',
                title: 'à¸£à¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£',
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
    accommodationReportTopbarButton:
        document.getElementById(
            'accommodationReportTopbarButton'
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

    function isAdminSession() {
        return String(sessionUser.role || '')
            .trim()
            .toUpperCase() === 'ADMIN';
    }

    function canAccessPage(page) {
        const basePage = getBasePage(page);

        if (isAdminSession()) {
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

if (basePage === 'fitness-admin.html') {
    return permissions.ManageFitness === true;
}

if (basePage === 'room-inspection.html') {
    return permissions.ManageAccommodation === true;
}

if (basePage === 'assets.html') {
    return permissions.ViewAssets === true;
}

if (basePage === 'monitoring.html') {
    return permissions.ViewMonitoring === true;
}

return false;
    }

    function getServiceState(service) {
        if (service.planned) {
            return {
                label: 'à¹€à¸•à¸£à¸µà¸¢à¸¡à¸£à¸°à¸šà¸š',
                className: 'is-planned'
            };
        }

        const accessible = service.tasks.some(task => canAccessPage(task.page));

        if (!accessible) {
            return {
                label: 'à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œ',
                className: 'is-locked'
            };
        }

        return {
            label: 'à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™',
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
            getServiceState(service).label === 'à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™';

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
                    ? `${service.tasks.length} à¸£à¸²à¸¢à¸à¸²à¸£à¸‡à¸²à¸™`
                    : 'â€” à¸£à¸²à¸¢à¸à¸²à¸£à¸‡à¸²à¸™';

                return `
                    <button
                        class="service-card${selectedClass}"
                        type="button"
                        data-service-id="${service.id}"
                        style="
                            --service-color:${service.color};
                            --service-soft:${service.soft};
                        "
                        aria-label="à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸” ${service.title}"
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
                            <strong>à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸” â†’</strong>
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

// à¹€à¸‰à¸žà¸²à¸°à¸ˆà¸­à¸¡à¸·à¸­à¸–à¸·à¸­ (à¸•à¸£à¸‡à¸à¸±à¸š breakpoint à¸—à¸µà¹ˆà¸ªà¸¥à¸±à¸šà¹€à¸›à¹‡à¸™à¹€à¸¡à¸™à¸¹à¸¥à¹‰à¸™à¸ˆà¸­à¹€à¸•à¹‡à¸¡à¸«à¸™à¹‰à¸²à¹ƒà¸™ portal.css) â€” à¸‡à¸²à¸™à¸—à¸µà¹ˆ
// à¹€à¸¥à¸·à¸­à¸à¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡ (à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ planned/à¹€à¸•à¸£à¸µà¸¢à¸¡à¸£à¸°à¸šà¸š à¹à¸¥à¸°à¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¹€à¸‚à¹‰à¸²à¸–à¸¶à¸‡) à¹„à¸¡à¹ˆà¸™à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡
function getAccessibleTasks(service) {
    return service.tasks.filter(
        task => !task.planned && canAccessPage(task.page)
    );
}

function isMobileNavigationViewport() {
    return window.matchMedia('(max-width: 820px)').matches;
}

// à¸¡à¸·à¸­à¸–à¸·à¸­: à¸–à¹‰à¸²à¸à¸¥à¹ˆà¸­à¸‡à¸ªà¹ˆà¸§à¸™à¸‡à¸²à¸™à¸™à¸µà¹‰à¸¡à¸µà¸‡à¸²à¸™à¸—à¸µà¹ˆà¸à¸”à¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡à¹à¸„à¹ˆà¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸”à¸µà¸¢à¸§ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹ƒà¸«à¹‰à¸œà¹ˆà¸²à¸™à¸«à¸™à¹‰à¸²à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¸—à¸µà¹ˆà¸¡à¸µ
// à¸•à¸±à¸§à¹€à¸¥à¸·à¸­à¸à¹€à¸”à¸µà¸¢à¸§à¹ƒà¸«à¹‰à¸à¸”à¸‹à¹‰à¸³à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡ â€” à¹€à¸›à¸´à¸”à¹€à¸‚à¹‰à¸²à¹„à¸›à¸—à¸µà¹ˆà¸‡à¸²à¸™à¸™à¸±à¹‰à¸™à¹ƒà¸«à¹‰à¹€à¸¥à¸¢à¹ƒà¸™à¸„à¸¥à¸´à¸à¹€à¸”à¸µà¸¢à¸§ (à¹€à¸”à¸ªà¸à¹Œà¸—à¹‡à¸­à¸›à¸¢à¸±à¸‡à¸„à¸‡
// à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¹€à¸”à¸´à¸¡ à¹€à¸žà¸£à¸²à¸°à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¸à¸±à¹ˆà¸‡à¸™à¸±à¹‰à¸™à¹€à¸›à¹‡à¸™à¹à¸œà¸‡à¸‚à¹‰à¸²à¸‡à¸—à¸µà¹ˆà¹€à¸«à¹‡à¸™à¸•à¸¥à¸­à¸”à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸«à¸™à¹‰à¸²à¸¥à¹‰à¸™à¸ˆà¸­) à¹ƒà¸Šà¹‰à¸£à¹ˆà¸§à¸¡à¸à¸±à¸™
// à¸—à¸±à¹‰à¸‡à¸—à¸²à¸‡à¹€à¸‚à¹‰à¸²à¸ˆà¸²à¸à¸à¸²à¸£à¹Œà¸”à¸«à¸™à¹‰à¸²à¹à¸£à¸à¹à¸¥à¸°à¹€à¸¡à¸™à¸¹à¹à¸®à¸¡à¹€à¸šà¸­à¸£à¹Œà¹€à¸à¸­à¸£à¹Œ (à¸£à¸°à¸”à¸±à¸š 1) â€” à¸„à¸·à¸™à¸„à¹ˆà¸² true à¸–à¹‰à¸²à¸ˆà¸±à¸”à¸à¸²à¸£à¹ƒà¸«à¹‰à¹à¸¥à¹‰à¸§
function tryAutoOpenOnlyAccessibleTask(service) {
    // directOpen: à¸ªà¹ˆà¸§à¸™à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸£à¸§à¸¡à¹€à¸›à¹‡à¸™à¸«à¸™à¹‰à¸²à¹€à¸”à¸µà¸¢à¸§à¹à¸¥à¹‰à¸§ (à¹€à¸Šà¹ˆà¸™ à¸‡à¸²à¸™à¸›à¸£à¸°à¸à¸±à¸™) à¹€à¸›à¸´à¸”à¸•à¸£à¸‡à¹ƒà¸™à¸„à¸¥à¸´à¸à¹€à¸”à¸µà¸¢à¸§à¸—à¸±à¹‰à¸‡à¸¡à¸·à¸­à¸–à¸·à¸­à¹à¸¥à¸°à¹€à¸”à¸ªà¸à¹Œà¸—à¹‡à¸­à¸›
    if (!isMobileNavigationViewport() && !service.directOpen) {
        return false;
    }

    const accessibleTasks = getAccessibleTasks(service);
    // directTask: à¸¡à¸µà¸«à¸¥à¸²à¸¢à¸‡à¸²à¸™à¹à¸•à¹ˆà¹ƒà¸«à¹‰à¹€à¸›à¸´à¸”à¸‡à¸²à¸™à¸«à¸¥à¸±à¸à¸—à¸±à¸™à¸—à¸µ (à¸‡à¸²à¸™à¸­à¸·à¹ˆà¸™à¹€à¸›à¸´à¸”à¸ˆà¸²à¸à¸›à¸¸à¹ˆà¸¡à¸ à¸²à¸¢à¹ƒà¸™à¸«à¸™à¹‰à¸²)
    const directTask = service.directTask &&
        accessibleTasks.find(task => task.route === service.directTask);
    if (!directTask && accessibleTasks.length !== 1) {
        return false;
    }

    const onlyTask = directTask || accessibleTasks[0];
    const taskIndex = service.tasks.indexOf(onlyTask);
    openSecondarySidebar(service.id);
    openTask(service, onlyTask, taskIndex);
    if (service.directOpen && !isMobileNavigationViewport()) {
        // à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹à¸ªà¸”à¸‡à¹à¸œà¸‡à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¸—à¸µà¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸”à¸µà¸¢à¸§ â€” à¹ƒà¸«à¹‰à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆà¸«à¸™à¹‰à¸²à¸‡à¸²à¸™à¸à¸§à¹‰à¸²à¸‡à¸‚à¸¶à¹‰à¸™
        document.body.classList.remove('second-sidebar-open');
        elements.secondarySidebar.setAttribute('aria-hidden', 'true');
    }
    return true;
}

function selectService(serviceId) {
    const service = services.find(
        item => item.id === serviceId
    );

    if (!service) {
        return;
    }

    if (tryAutoOpenOnlyAccessibleTask(service)) {
        renderServiceCards();
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
    if (service.fullPage && !task.planned) {
        window.location.href = task.page;
        return;
    }
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
            'à¸šà¸±à¸à¸Šà¸µà¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¹€à¸‚à¹‰à¸²à¸–à¸¶à¸‡à¸ªà¹ˆà¸§à¸™à¸‡à¸²à¸™à¸”à¸±à¸‡à¸à¸¥à¹ˆà¸²à¸§'
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
    document.getElementById('topbarBackButton').hidden = false;
    elements.workspaceView.classList.toggle(
        'is-open-treatment',
        service.id === 'insurance' &&
        (
            task.route === 'insurance-all'
        )
    );
    elements.workspaceView.classList.toggle(
        'is-self-headered',
        task.page.startsWith('accommodation.html') ||
        task.page.startsWith('monitoring.html')
    );
    elements.workspaceLoading.hidden = false;

    if (elements.accommodationReportTopbarButton) {
        elements.accommodationReportTopbarButton.hidden =
            !task.page.startsWith('accommodation.html');
    }

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
                        <div class="pending-icon">â‹¯</div>
                        <h1>à¸£à¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£</h1>
                        <p>
                            à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™à¸™à¸µà¹‰à¸­à¸¢à¸¹à¹ˆà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¹€à¸•à¸£à¸µà¸¢à¸¡à¸£à¸°à¸šà¸š
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
        `${task.title} â€” ${service.title}`;

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
        if (elements.accommodationReportTopbarButton) {
            elements.accommodationReportTopbarButton.hidden = true;
        }
        elements.workspaceFrame.src = 'about:blank';
        elements.workspaceView.classList.remove(
            'is-open-treatment',
            'is-self-headered'
        );
        elements.workspaceView.hidden = true;
        elements.catalogView.hidden = false;
        document.getElementById('topbarBackButton').hidden = true;
    }

    function openMobileNavigation() {
        document.body.classList.add('sidebar-open');
    }

    function closeMobileNavigation() {
        // à¹€à¸”à¸´à¸¡à¸›à¸´à¸”à¹à¸„à¹ˆà¹€à¸¡à¸™à¸¹à¸«à¸¥à¸±à¸ (à¸£à¸°à¸”à¸±à¸š 1) à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ â€” à¸žà¸­à¹€à¸›à¸´à¸”à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢ (à¸£à¸°à¸”à¸±à¸š 2) à¹à¸¥à¹‰à¸§à¸à¸”à¹€à¸¥à¸·à¸­à¸à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡
        // renderTaskContent() à¹€à¸£à¸µà¸¢à¸à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™à¸™à¸µà¹‰à¹€à¸žà¸·à¹ˆà¸­à¹€à¸à¹‡à¸šà¹€à¸¡à¸™à¸¹à¹ƒà¸«à¹‰à¸«à¸¡à¸” à¹à¸•à¹ˆà¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸›à¸´à¸”à¹„à¸›à¸”à¹‰à¸§à¸¢
        // à¸ˆà¸­à¸¡à¸·à¸­à¸–à¸·à¸­à¹€à¸¥à¸¢à¸–à¸¹à¸à¹€à¸¡à¸™à¸¹à¸¢à¹ˆà¸­à¸¢à¸šà¸±à¸‡à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆà¸—à¸³à¸‡à¸²à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸„à¹‰à¸²à¸‡à¸­à¸¢à¸¹à¹ˆà¸•à¸¥à¸­à¸” (à¸à¸”à¹€à¸‚à¹‰à¸²à¹„à¸›à¹à¸¥à¹‰à¸§à¹„à¸¡à¹ˆà¸žà¸±à¸šà¹€à¸à¹‡à¸š)
        // à¹à¸à¹‰à¹ƒà¸«à¹‰à¸›à¸´à¸”à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸£à¸°à¸”à¸±à¸š à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸¥à¹‰à¸²à¸‡à¸„à¹ˆà¸² selectedServiceId/activeTaskIndex à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¸­à¸¢à¸¹à¹ˆ
        // (à¸•à¹ˆà¸²à¸‡à¸ˆà¸²à¸ closeSecondarySidebar() à¸—à¸µà¹ˆà¸£à¸µà¹€à¸‹à¹‡à¸•à¸„à¹ˆà¸²à¸”à¹‰à¸§à¸¢ à¸‹à¸¶à¹ˆà¸‡à¹„à¸¡à¹ˆà¹€à¸«à¸¡à¸²à¸°à¸•à¸£à¸‡à¸™à¸µà¹‰à¹€à¸žà¸£à¸²à¸°à¹€à¸žà¸´à¹ˆà¸‡à¹€à¸¥à¸·à¸­à¸à¸‡à¸²à¸™à¹„à¸›)
        document.body.classList.remove('sidebar-open', 'second-sidebar-open');
        elements.secondarySidebar.setAttribute('aria-hidden', 'true');
    }

    async function logout() {
        const confirmed = confirm('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸­à¸­à¸à¸ˆà¸²à¸à¸£à¸°à¸šà¸šà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ');

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
            'à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™';

        const isAdmin = isAdminSession();

        document.getElementById('accountName').textContent =
            displayName;

        document.getElementById('accountRole').textContent =
            isAdmin ? 'à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸£à¸°à¸šà¸š' : 'à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸—à¸±à¹ˆà¸§à¹„à¸›';

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
            const clickedService = services.find(item => item.id === serviceId);
            const isAlreadyOpen =
                !clickedService?.directOpen &&
                selectedServiceId === serviceId &&
                document.body.classList.contains(
                    'second-sidebar-open'
                );

            if (isAlreadyOpen) {
                closeSecondarySidebar();
                return;
            }

            // à¸—à¸²à¸‡à¹€à¸‚à¹‰à¸²à¸ˆà¸²à¸à¹€à¸¡à¸™à¸¹à¹à¸®à¸¡à¹€à¸šà¸­à¸£à¹Œà¹€à¸à¸­à¸£à¹Œ (à¸£à¸°à¸”à¸±à¸š 1) à¹€à¸›à¹‡à¸™à¸­à¸µà¸à¸ˆà¸¸à¸”à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸œà¹ˆà¸²à¸™ selectService()
            // à¹€à¸£à¸µà¸¢à¸à¸•à¸±à¸§à¸Šà¹ˆà¸§à¸¢à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™à¸‹à¹‰à¸³à¸­à¸µà¸à¸ˆà¸¸à¸”à¸”à¹‰à¸§à¸¢ à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¸•à¸£à¸‡à¸à¸±à¸™à¹„à¸¡à¹ˆà¸§à¹ˆà¸²à¸ˆà¸°à¹€à¸‚à¹‰à¸²à¸—à¸²à¸‡à¹„à¸«à¸™
            // (à¸à¸²à¸£à¹Œà¸”à¸«à¸™à¹‰à¸²à¹à¸£à¸ à¸«à¸£à¸·à¸­à¹€à¸¡à¸™à¸¹à¹à¸®à¸¡à¹€à¸šà¸­à¸£à¹Œà¹€à¸à¸­à¸£à¹Œ)
            const service = services.find(item => item.id === serviceId);
            if (service && tryAutoOpenOnlyAccessibleTask(service)) {
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

    // à¸›à¸¸à¹ˆà¸¡à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¸šà¸™à¹à¸–à¸šà¸šà¸™ (à¹à¸—à¸™à¹€à¸¡à¸™à¸¹à¸‹à¹‰à¸²à¸¢à¸—à¸µà¹ˆà¸–à¸¹à¸à¸‹à¹ˆà¸­à¸™) â€” à¸à¸¥à¸±à¸šà¹„à¸›à¸«à¸™à¹‰à¸²à¸¨à¸¹à¸™à¸¢à¹Œà¸£à¸§à¸¡à¸‡à¸²à¸™
    document
        .getElementById('topbarBackButton')
        .addEventListener('click', closeWorkspace);

    document
        .getElementById('mobileMenuButton')
        .addEventListener('click', openMobileNavigation);

    elements.sidebarScrim.addEventListener(
        'click',
        closeMobileNavigation
    );

    elements.accommodationReportTopbarButton
        ?.addEventListener('click', async () => {
            const button = elements.accommodationReportTopbarButton;
            const frameWindow = elements.workspaceFrame.contentWindow;

            if (typeof frameWindow?.downloadAccommodationReports !== 'function') {
                alert('à¸«à¸™à¹‰à¸²à¸£à¸°à¸šà¸šà¸«à¹‰à¸­à¸‡à¸žà¸±à¸à¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¹€à¸ªà¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
                return;
            }

            button.disabled = true;
            try {
                await frameWindow.downloadAccommodationReports();
            } finally {
                button.disabled = false;
            }
        });

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

// à¸«à¸™à¹‰à¸²à¹ƒà¸™à¸à¸£à¸­à¸šà¸‚à¸­à¹€à¸›à¸´à¸”à¸‡à¸²à¸™à¸­à¸·à¹ˆà¸™ à¹€à¸Šà¹ˆà¸™ à¸›à¸¸à¹ˆà¸¡ "à¹€à¸Šà¹ˆà¸²à¸—à¸µà¹ˆà¸žà¸±à¸à¹ƒà¸«à¸¡à¹ˆ" â†’ à¸•à¸£à¸§à¸ˆà¸£à¸±à¸šà¸«à¹‰à¸­à¸‡à¸žà¸±à¸ (à¹€à¸‰à¸žà¸²à¸°à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œ)
window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'open-task') return;
    const service = services.find(item => item.id === event.data.serviceId);
    const task = service && getAccessibleTasks(service).find(item => item.route === event.data.route);
    if (!task) return;
    openTask(service, task, service.tasks.indexOf(task));
});

window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'open-line-conversation') return;

    const service = services.find(item => item.id === 'internal-support');
    const monitoringTask = service?.tasks.find(task => task.route === 'monitoring');
    if (!service || !monitoringTask) return;

    const conversationId = encodeURIComponent(String(event.data.conversationId || ''));
    const channelId = encodeURIComponent(String(event.data.channelId || ''));
    if (!conversationId || !channelId) return;

    openSecondarySidebar(service.id);
    renderTaskContent(
        service,
        { ...monitoringTask, page: `monitoring.html?conversation=${conversationId}&channel=${channelId}` },
        service.tasks.indexOf(monitoringTask),
        true
    );
});

    // à¹ƒà¸«à¹‰ portal-split.js (à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸­à¸·à¹ˆà¸™à¸„à¸¹à¹ˆà¸à¸±à¸šà¹à¸Šà¸—) à¹ƒà¸Šà¹‰à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¹ˆà¸§à¸™à¸‡à¸²à¸™à¹à¸¥à¸°à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸Šà¸¸à¸”à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™
    window.PortalApi = { services, getAccessibleTasks };

    try {
        await loadSession();
    } catch (error) {
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }

updateAccountInformation();
renderServiceCards();

// à¹à¸–à¸šà¸«à¹‰à¸­à¸‡à¸ªà¸™à¸—à¸™à¸² LINE OA à¸à¸±à¸‡à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸«à¸™à¹‰à¸²à¹à¸„à¸•à¸•à¸²à¸¥à¹‡à¸­à¸à¸«à¸¥à¸±à¸à¸•à¸²à¸¢à¸•à¸±à¸§ (à¹„à¸¡à¹ˆà¸œà¹ˆà¸²à¸™ canAccessPage à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸•à¸­à¸™à¹€à¸›à¸´à¸”
// à¸à¸²à¸£à¹Œà¸”à¸šà¸£à¸´à¸à¸²à¸£) à¹€à¸”à¸´à¸¡à¸ˆà¸¶à¸‡à¹‚à¸Šà¸§à¹Œà¹ƒà¸«à¹‰à¸—à¸¸à¸à¸šà¸±à¸à¸Šà¸µà¹€à¸«à¹‡à¸™à¹€à¸ªà¸¡à¸­à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¹€à¸Šà¹‡à¸„à¸ªà¸´à¸—à¸˜à¸´à¹Œà¹€à¸¥à¸¢ â€” à¸‹à¹ˆà¸­à¸™à¸–à¹‰à¸²à¹„à¸¡à¹ˆà¸¡à¸µ ViewMonitoring
const conversationRail = document.querySelector('.catalog-conversation-rail');
if (conversationRail && !isAdminSession() && permissions.ViewMonitoring !== true) {
    conversationRail.hidden = true;
}
});
