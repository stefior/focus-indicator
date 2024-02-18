const disabledMessage = document.getElementById('disabledMessage');
const toggleCurrentSiteBtn = document.getElementById('toggleCurrentSiteBtn');
const reloadBtn = document.getElementById('reloadBtn');
const siteListTextArea = document.getElementById('siteListTextArea');
const saveSiteListBtn = document.getElementById('saveSiteListBtn');
const toggleListTypeBtn = document.getElementById('toggleListTypeBtn');
const listLabel = document.getElementById('listLabel');
const body = document.querySelector('body');

let listType;

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    const currentHost = new URL(currentTab.url).host;

    reloadBtn.onclick = () => {
        chrome.tabs.reload(currentTab.id);
        window.close();
    }

    chrome.storage.sync.get(['siteList', 'listType'], function(data) {
        let siteList = data.siteList || [];
        listType = data.listType || 'blacklist';

        toggleTheme();

        if (siteList.includes(currentHost)) {
            toggleCurrentSiteBtn.textContent = `Remove current site`;
        } else {
            toggleCurrentSiteBtn.textContent = `Add current site`;
        }

        siteListTextArea.value = siteList.join('\n');

        // Show message on browser-protected pages
        if (currentHost === "chromewebstore.google.com" ||
            currentHost === "chrome.google.com" ||
            !currentHost.includes('.')) {

            console.log(currentHost)
            disabledMessage.style.display = 'block';
            if (listType === 'blacklist') {
                disabledMessage.style.backgroundColor = 'white';
                disabledMessage.style.color = 'black';
            } else {
                disabledMessage.style.backgroundColor = 'black';
                disabledMessage.style.color = 'white';
            }

            toggleCurrentSiteBtn.disabled = true;
            reloadBtn.disabled = true;
            siteListTextArea.disabled = true;
            saveSiteListBtn.disabled = true;
            toggleListTypeBtn.disabled = true;

            body.style.color = 'lightgray';
            toggleCurrentSiteBtn.style.color = 'lightgray';
            reloadBtn.style.color = 'lightgray';
            siteListTextArea.style.color = 'lightgray';
            saveSiteListBtn.style.color = 'lightgray';
            toggleListTypeBtn.style.color = 'lightgray';
            return;
        }

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

            saveSiteListBtn.textContent = 'Saved';
            setTimeout(() => {
                saveSiteListBtn.textContent = 'Save list';
            }, 1000);

            reloadBtn.classList.remove('hidden');
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
        reloadBtn.classList.add('dark')
        saveSiteListBtn.classList.add('dark');
        toggleListTypeBtn.classList.add('dark');
    } else {
        body.classList.remove('dark');
        reloadBtn.classList.remove('dark')
        toggleCurrentSiteBtn.classList.remove('dark');
        saveSiteListBtn.classList.remove('dark');
        toggleListTypeBtn.classList.remove('dark');
    }

    saveSiteListBtn.textContent = `Save list`;
    toggleListTypeBtn.textContent = `Switch to ${getOppositeType()}`;
    listLabel.textContent = `Manage ${listType}:`;
}
