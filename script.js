let tableData = [];
let timer;

async function fetchData() {
  const apiKey = document.getElementById("api-key").value;
  if (apiKey === "") {
    alert("Please enter an API key");
    return;
  }

  const fetchButton = document.getElementById("fetch-button");
  fetchButton.disabled = true;
  startCountdown();

  const tableBody = document.getElementById("table-body");
  tableBody.innerHTML = "";

  const dataSelect = document.getElementById("data-select");
  const dataUrl = dataSelect.options[dataSelect.selectedIndex].value;

  try {
    const response = await fetch(dataUrl);
    const data = await response.json();
    tableData = data;
    if (tableData.length === 0) {
      displayNoDataMessage();
      return;
    }

    const userPromises = tableData.map(async (row) => {
      const apiUrl = `https://api.torn.com/user/${row.id}?selections=basic&key=${apiKey}`;
      try {
        const userResponse = await fetch(apiUrl);
        const userData = await userResponse.json();
        const status = formatStatus(userData.status);
        return { ...row, status };
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    });

    const usersWithStatus = await Promise.all(userPromises);

    const sortedUsers = usersWithStatus.sort((a, b) => {
      if (a.status === "Okay" && b.status !== "Okay") return -1;
      if (a.status !== "Okay" && b.status === "Okay") return 1;
      if (a.status === "Okay" && b.status === "Okay") return 0;

      const aRemaining = parseHospitalTime(a.status);
      const bRemaining = parseHospitalTime(b.status);

      return aRemaining - bRemaining;
    });

    sortedUsers.forEach((user, index) => {
      const attackLink = createAttackLink(user.id);
      const newRow = createTableRow(user, user.status, attackLink, index);
      tableBody.innerHTML += newRow;
    });

    hideNoDataMessage();
    displayDataTable();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function startCountdown() {
  const fetchButton = document.getElementById("fetch-button");
  let remainingTime = 30;

  clearInterval(timer);
  timer = setInterval(() => {
    remainingTime--;
    fetchButton.textContent = `Fetch (${remainingTime}s)`;

    if (remainingTime <= 0) {
      clearInterval(timer);
      fetchButton.textContent = "Fetch";
      fetchButton.disabled = false;
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
}

function hideNoDataMessage() {
  const noDataMessage = document.getElementById("no-data-message");
  noDataMessage.classList.add("hidden");
}

function displayDataTable() {
  const dataTable = document.getElementById("data-table");
  dataTable.classList.remove("hidden");
}

function formatStatus(status) {
  let formattedStatus = status.state;
  if (formattedStatus === "Hospital") {
    const remaining = status.until - Date.now() / 1000;
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    formattedStatus = `Hospitalized (${minutes}m ${seconds}s)`;
  }
  return formattedStatus;
}

function createAttackLink(id) {
  return `<a target="_blank" href="https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${id}" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white">Attack</a>`;
}

function createTableRow(row, status, attackLink, index) {
  const isNotFirstOrLast = index > 0 && index < tableData.length - 1;
  const borderClass = isNotFirstOrLast ? 'border-t border-gray-200' : '';

  return `
    <tr>
      <td class="relative py-4 pl-4 pr-3 text-sm sm:pl-6 min-w-0 ${borderClass}">
        <div class="font-medium text-gray-900 dark:text-gray-300">
            <a href="https://www.torn.com/profiles.php?XID=${row.id}" target="_blank">
              ${row.name}
              <span class="ml-1 text-blue-600">[${row.id}]</span>
            </a>
        </div>
        <div class="mt-1 flex flex-col text-gray-500 dark:text-gray-300 sm:block lg:hidden">
            <span>Level: ${row.lvl}</span>
            <span>Total: ${row.total}</span>
        </div>
      </td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 lg:table-cell min-w-0 ${borderClass}">${row.lvl}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 lg:table-cell min-w-0 ${borderClass}">${row.total}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 lg:table-cell min-w-0 ${borderClass}">${row.str}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 lg:table-cell min-w-0 ${borderClass}">${row.def}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 lg:table-cell min-w-0 ${borderClass}">${row.spd}</td>
      <td class="hidden px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 lg:table-cell min-w-0 ${borderClass}">${row.dex}</td>
      <td class="px-3 py-3.5 text-sm text-gray-500 dark:text-gray-300 min-w-0 ${borderClass}">
        <div class="sm:hidden">${status}</div>
        <div class="hidden sm:block">${status}</div>
      </td>
      <td class="relative py-3.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 min-w-0">
        ${attackLink}
      </td>
    </tr>
  `;
}