let tableData = [];
let timer;
let statusUpdateInterval;

function getValidStoredUserInfo() {
    const storedTimestampStr = localStorage.getItem('userInfoTimestamp');
    let storedName = null;
    let storedLevel = null;

    if (storedTimestampStr) {
        const storedTimestamp = parseInt(storedTimestampStr);
        const oneHourInMillis = 60 * 60 * 1000;
        const currentTime = Date.now();

        if (currentTime - storedTimestamp < oneHourInMillis) {
            storedName = localStorage.getItem('userName');
            const storedLevelStr = localStorage.getItem('userLevel');
            if (storedLevelStr) {
                storedLevel = parseInt(storedLevelStr);
            }
        } else {
            localStorage.removeItem('userName');
            localStorage.removeItem('userLevel');
            localStorage.removeItem('userInfoTimestamp');
            localStorage.removeItem('welcomeMessageShown');
            console.log("Stored user info expired and removed.");
        }
    }
    return { name: storedName, level: storedLevel };
}


async function loadListNames() {
  try {
    const response = await fetch("data.json");
    const data = await response.json();
    const listSelect = document.getElementById("list-select");
    for (const listName in data) {
      const option = document.createElement("option");
      option.value = listName;
      option.textContent = listName;
      listSelect.appendChild(option);
    }
  } catch (error) {
    console.error("Error loading list names:", error);
  }
}

async function fetchData() {
    const apiKey = document.getElementById("api-key").value;

    const listSelectForError = document.getElementById("list-select");
    const selectedListForError = listSelectForError.value || 'None Selected';
    const validStoredInfo = getValidStoredUserInfo();

    if (apiKey === "") {
        alert("Please enter an API key");
        errorLogly(validStoredInfo.name, validStoredInfo.level, "API key was missing", selectedListForError);
        return;
    }

    localStorage.setItem("apiKey", apiKey);

    const listSelect = document.getElementById("list-select");
    const selectedList = listSelect.value;

    if (!selectedList) {
        alert("Please select a list.");
        errorLogly(validStoredInfo.name, validStoredInfo.level, "No list selected", 'None Selected');
        return;
    }


    const fetchButton = document.getElementById("fetch-button");
    fetchButton.disabled = true;
    startCountdown();

    const tableBody = document.getElementById("table-body");
    tableBody.innerHTML = "";

    showLoadingIndicator();
    hideDataTable();

    let currentFetchUserName = null;
    let currentFetchUserLevel = null;
    let fetchError = null;

    let welcomeMessageShown = localStorage.getItem('welcomeMessageShown') === 'true';

    try {

        let fetchUserInfoAttempted = false;

         if (apiKey.length >= 10) {
             fetchUserInfoAttempted = true;
             try {
                const userCheckUrl = `https://api.torn.com/user/?selections=basic&key=${apiKey}`;
                const userCheckResponse = await fetch(userCheckUrl);
                const userCheckData = await userCheckResponse.json();

                if (userCheckData.error) {
                    console.error("Error fetching user data:", userCheckData.error.error);
                    fetchError = `User info fetch failed: ${userCheckData.error.error}`;
                } else {
                    currentFetchUserName = userCheckData.name;
                    currentFetchUserLevel = userCheckData.level;

                    localStorage.setItem('userName', currentFetchUserName);
                    localStorage.setItem('userLevel', currentFetchUserLevel.toString());
                    localStorage.setItem('userInfoTimestamp', Date.now().toString());

                    if (!welcomeMessageShown) {
                        let welcomeMsg = "";
                        if (currentFetchUserLevel <= 14) {
                            welcomeMsg = `Welcome ${currentFetchUserName}, you are currently level ${currentFetchUserLevel} - It typically takes between 120 to 200 attacks to hit level 15.`;
                        } else {
                            welcomeMsg = `Welcome ${currentFetchUserName}, you are currently level ${currentFetchUserLevel} - You no longer need to use this tool. Please avoid hitting these targets so others can level up <3 `;
                        }
                        showCustomPopup(welcomeMsg);
                        localStorage.setItem('welcomeMessageShown', 'true');
                    }
                }
            } catch (error) {
                console.error("Network error fetching user data:", error);
                fetchError = `User info fetch network error: ${error.message}`;
            }
        }


        const response = await fetch("data.json");
        const data = await response.json();
        tableData = data[selectedList];

        if (!tableData || tableData.length === 0) {
            displayNoDataMessage();
            hideLoadingIndicator();
            if (!fetchError) fetchError = `No data found for list: ${selectedList}`;
            return;
        }


        const userPromises = tableData.map(async (row) => {
            const apiUrl = `https://api.torn.com/user/${row.id}?selections=basic&key=${apiKey}`;
            try {
                const userResponse = await fetch(apiUrl);
                const userData = await userResponse.json();

                if (userData.error) {
                     console.error(`Error fetching data for user ${row.id}:`, userData.error.error);
                     if (userData.error.code === 2 && !fetchError) {
                        fetchError = `Invalid API Key used for target fetch (Code ${userData.error.code})`;
                     } else if (!fetchError) {
                         fetchError = `Target fetch error for ${row.id}: ${userData.error.error} (Code ${userData.error.code})`;
                     }
                     return { ...row, status: `Error (${userData.error.code})` };
                }

                const status = formatStatus(userData.status);
                return { ...row, status };
            } catch (error) {
                console.error(`Network error fetching data for user ${row.id}:`, error);
                 if (!fetchError) fetchError = `Network error during target fetch for ${row.id}: ${error.message}`;
                return { ...row, status: "Network Error" };
            }
        });

        const usersWithStatus = await Promise.all(userPromises);


        const sortedUsers = usersWithStatus.sort((a, b) => {
            if (a.status === "Okay" && b.status !== "Okay") return -1;
            if (a.status !== "Okay" && b.status === "Okay") return 1;
            if (a.status === "Okay" && b.status === "Okay") return 0;

            const aRemaining = parseHospitalTime(a.status);
            const bRemaining = parseHospitalTime(b.status);

            if (aRemaining === Infinity && bRemaining !== Infinity) return 1;
            if (aRemaining !== Infinity && bRemaining === Infinity) return -1;

            return aRemaining - bRemaining;
        });

        sortedUsers.forEach((user, index) => {
            const attackLink = createAttackLink(user.id, user.status);
            const newRow = createTableRow(user, user.status, attackLink, index);
            tableBody.innerHTML += newRow;
        });

        hideNoDataMessage();
        displayDataTable();

        clearInterval(statusUpdateInterval);
        statusUpdateInterval = setInterval(() => {
            updateStatus();
        }, 1000);

    } catch (error) {
        console.error("Error fetching list data:", error);
         if (!fetchError) fetchError = `Main list data fetch error: ${error.message}`;
        displayNoDataMessage();
    } finally {
        hideLoadingIndicator();

        const finalStoredInfo = getValidStoredUserInfo();

        const finalName = currentFetchUserName || finalStoredInfo.name || null;
        const finalLevel = currentFetchUserLevel !== null ? currentFetchUserLevel : finalStoredInfo.level;
        const finalError = fetchError || null;

        errorLogly(finalName, finalLevel, finalError, selectedList);
    }
}

function startCountdown() {
  const fetchButton = document.getElementById("fetch-button");
  const startTime = Date.now();
  const countdownSeconds = 30;

  clearInterval(timer);
  timer = setInterval(() => {
    const secondsSinceStart = Math.floor((Date.now() - startTime) / 1000);
    const remainingTime = countdownSeconds - secondsSinceStart;

    if (remainingTime <= 0) {
      clearInterval(timer);
      fetchButton.textContent = "Fetch";
      fetchButton.disabled = false;
    } else {
      fetchButton.textContent = `Fetch (${remainingTime}s)`;
    }
  }, 1000);
}

function parseHospitalTime(status) {
  const timeMatch = status.match(/\((\d+)m (\d+)s\)/);
  if (!timeMatch) return Infinity;
  const [_, minutes, seconds] = timeMatch;
  return parseInt(minutes) * 60 + parseInt(seconds);
}

function displayNoDataMessage() {
  const noDataMessage = document.getElementById("no-data-message");
  noDataMessage.classList.remove("hidden");

  const dataTable = document.getElementById("data-table");
  dataTable.classList.add("hidden");

  const apiMessage = document.getElementById("api-message");
  apiMessage.classList.add("hidden");
}

function hideNoDataMessage() {
  const noDataMessage = document.getElementById("no-data-message");
  noDataMessage.classList.add("hidden");
}

function displayDataTable() {
  const dataTable = document.getElementById("data-table");
  dataTable.classList.remove("hidden");

  const apiMessage = document.getElementById("api-message");
  apiMessage.classList.add("hidden");
}

function formatStatus(status) {
  let formattedStatus = status.state;
  if (formattedStatus === "Hospital") {
    const remaining = status.until - Date.now() / 1000;
    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        formattedStatus = `Hospitalized (${minutes}m ${seconds}s)`;
    } else {
        formattedStatus = "Okay";
    }
  }
  return formattedStatus;
}

function updateStatus() {
  const rows = document.querySelectorAll("#table-body tr");
  rows.forEach((row) => {
    const statusCell = row.querySelector("td:nth-child(8)");
    if (!statusCell) return;

    const currentStatus = statusCell.textContent.trim();
    const remaining = parseHospitalTime(currentStatus);

    if (remaining === Infinity) return;

    const updatedRemaining = remaining - 1;

    if (updatedRemaining <= 0) {
      statusCell.textContent = "Okay";
      const profileLink = row.querySelector("td:first-child a[href*='XID']");
      if (profileLink) {
          const userIdMatch = profileLink.href.match(/XID=(\d+)/);
           if (userIdMatch && userIdMatch[1]) {
                const userId = userIdMatch[1];
                const attackLinkCell = row.querySelector("td:nth-child(9)");
                if (attackLinkCell) {
                   attackLinkCell.innerHTML = createAttackLink(userId, "Okay");
                }
           }
      }
    } else {
      const updatedMinutes = Math.floor(updatedRemaining / 60);
      const updatedSeconds = updatedRemaining % 60;
      statusCell.textContent = `Hospitalized (${updatedMinutes}m ${updatedSeconds}s)`;
    }
  });
}

function showLoadingIndicator() {
  const loadingIndicator = document.getElementById("loading-indicator");
  loadingIndicator.classList.remove("hidden");
}

function hideLoadingIndicator() {
  const loadingIndicator = document.getElementById("loading-indicator");
  loadingIndicator.classList.add("hidden");
}

function hideDataTable() {
  const dataTable = document.getElementById("data-table");
  dataTable.classList.add("hidden");
}

function createAttackLink(id, status) {
  const isDisabled = status !== "Okay";
  const disabledClass = isDisabled ? "cursor-not-allowed opacity-30 hover:bg-white dark:hover:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-700";
  const onClick = isDisabled ? "event.preventDefault();" : "";

  return `<a target="_blank" href="https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${id}" class="inline-flex items-center rounded-md bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 ${disabledClass}" onclick="${onClick}">Attack</a>`;
}

function populateAPIKey() {
  const urlParams = new URLSearchParams(window.location.search);
  const apiKey = urlParams.get('apiKey');
  if (apiKey) {
    document.getElementById("api-key").value = apiKey;
    localStorage.setItem("apiKey", apiKey);
  } else {
    const storedApiKey = localStorage.getItem("apiKey");
    if (storedApiKey)
      document.getElementById("api-key").value = storedApiKey;
  }
}

function createTableRow(row, status, attackLink, index) {
  const isNotFirst = index > 0;
  const borderClass = isNotFirst ? 'border-t border-gray-200 dark:border-gray-700' : '';

  return `
    <tr>
      <td class="relative py-4 pl-4 pr-3 text-sm sm:pl-6 min-w-0 ${borderClass}">
        <div class="font-medium text-gray-900 dark:text-gray-300">
            <a href="https://www.torn.com/profiles.php?XID=${row.id}" target="_blank">
              ${row.name}
              <span class="ml-1 text-blue-600">[${row.id}]</span>
            </a>
        </div>
        <div class="mt-1 flex flex-col text-gray-500 dark:text-gray-400 sm:block lg:hidden">
            <span>Level: ${row.lvl}</span>
            <span>Total: ${row.total}</span>
        </div>
      </td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell min-w-0 ${borderClass}">${row.lvl}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell min-w-0 ${borderClass}">${row.total}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell min-w-0 ${borderClass}">${row.str}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell min-w-0 ${borderClass}">${row.def}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell min-w-0 ${borderClass}">${row.spd}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell min-w-0 ${borderClass}">${row.dex}</td>
      <td class="px-3 py-3.5 text-sm text-gray-500 dark:text-gray-400 min-w-0 ${borderClass}">
        <div class="sm:hidden w-40">${status}</div>
        <div class="hidden sm:block w-40">${status}</div>
      </td>
      <td class="relative py-3.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 min-w-0 ${borderClass}">
        ${attackLink}
      </td>
    </tr>
  `;
}

function showCustomPopup(message) {
    const overlay = document.getElementById('custom-popup-overlay');
    const messageElement = document.getElementById('custom-popup-message');
    const closeButton = document.getElementById('custom-popup-close');

    if (!overlay || !messageElement || !closeButton) {
        console.error("Popup elements not found in the DOM. Falling back to alert.");
        alert(message);
        return;
    }

    messageElement.textContent = message;
    overlay.classList.remove('hidden');

    closeButton.onclick = () => {
        overlay.classList.add('hidden');
    };

    overlay.onclick = (event) => {
        if (event.target === overlay) {
             overlay.classList.add('hidden');
        }
    };
}


async function errorLogly(name, level, error, listName) {
    const reportUrl = 'https://oran.pw/baldrstargets/error.php';
    const reportData = {
        name: name || 'N/A',
        level: level !== null ? level : 'N/A',
        error: error || null,
        listName: listName || 'N/A',
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(reportUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reportData)
        });

        if (!response.ok) {
            console.error(`Error logging error: ${response.status} ${response.statusText}`);
        } else {
           console.log("Error logged");
        }
    } catch (networkError) {
        console.error('Network error:', networkError);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateAPIKey();
    loadListNames();
});
