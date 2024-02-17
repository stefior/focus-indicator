const toggleCurrentSiteBtn = document.getElementById('toggleCurrentSiteBtn');
const siteListTextArea = document.getElementById('siteListTextArea');
const saveSiteListBtn = document.getElementById('saveSiteListBtn');
const toggleListTypeBtn = document.getElementById('toggleListTypeBtn');
const listLabel = document.getElementById('listLabel');
const body = document.querySelector('body');

let listType;

chrome.tabs.query({ active: true, currentWindow: true }, function() {
    const currentHost = location.host;

    chrome.storage.sync.get(['siteList', 'listType'], function(data) {
        let siteList = data.siteList || [];
        listType = data.listType || 'blacklist';
        console.log(listType);

        toggleTheme();

        if (siteList.includes(currentHost)) {
            toggleCurrentSiteBtn.textContent = `Remove current site`;
        } else {
            toggleCurrentSiteBtn.textContent = `Add current site`;
        }

        siteListTextArea.value = siteList.join('\n');

        toggleCurrentSiteBtn.addEventListener('click', function() {
            siteList = siteListTextArea.value.split('\n').filter(Boolean);

            if (siteList.includes(currentHost)) {
                siteList.splice(siteList.indexOf(currentHost), 1);
                toggleCurrentSiteBtn.textContent = 'Add current site';
            } else {
                siteList.push(currentHost);
                toggleCurrentSiteBtn.textContent = 'Remove current site';
            }

            siteList = [...new Set(siteList)];

            chrome.storage.sync.set({ siteList });
            siteListTextArea.value = siteList.join('\n');

            saveSiteListBtn.textContent = 'List saved';
            setTimeout(() => {
                saveSiteListBtn.textContent = 'Save list';
            }, 1000);
        });

        saveSiteListBtn.addEventListener('click', function() {
            siteList = siteListTextArea.value.split('\n').filter(Boolean);

            siteList = [...new Set(siteList)];

            chrome.storage.sync.set({ siteList });
            siteListTextArea.value = siteList.join('\n');

            saveSiteListBtn.textContent = 'List saved';
            setTimeout(() => {
                saveSiteListBtn.textContent = 'Save list';
            }, 1000);
        });

        toggleListTypeBtn.addEventListener('click', function() {
            listType = getOppositeType();
            toggleTheme();
            chrome.storage.sync.set({ listType });
            console.log('changed: ', listType);
        });
    });
});

function getOppositeType() {
    if (listType === 'blacklist') {
        return 'whitelist';
    } else {
        return 'blacklist';
    }
}

function toggleTheme() {
    if (listType === 'blacklist') {
        body.classList.add('dark');
        toggleCurrentSiteBtn.classList.add('dark');
        saveSiteListBtn.classList.add('dark');
        toggleListTypeBtn.classList.add('dark');
    } else {
        body.classList.remove('dark');
        toggleCurrentSiteBtn.classList.remove('dark');
        saveSiteListBtn.classList.remove('dark');
        toggleListTypeBtn.classList.remove('dark');
    }

    saveSiteListBtn.textContent = `Save list`;
    toggleListTypeBtn.textContent = `Switch to ${getOppositeType()}`;
    listLabel.textContent = `Manage ${listType}:`;
}
