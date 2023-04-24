let tableData = [];

function fetchData() {
  const apiKey = document.getElementById("api-key").value;
  if (apiKey === "") {
    alert("Please enter an API key");
    return;
  }

  const tableBody = document.getElementById("table-body");
  tableBody.innerHTML = "";

  const dataSelect = document.getElementById("data-select");
  const dataUrl = dataSelect.options[dataSelect.selectedIndex].value;

  fetch(dataUrl)
    .then((response) => response.json())
    .then((data) => {
      tableData = data;
      if (tableData.length === 0) {
        displayNoDataMessage();
        return;
      }

      tableData.forEach((row) => {
        const apiUrl = `https://api.torn.com/user/${row.id}?selections=basic&key=${apiKey}`;
        fetch(apiUrl)
          .then((response) => response.json())
          .then((userData) => {
            const status = formatStatus(userData.status);
            const attackLink = createAttackLink(row.id);
            const newRow = createTableRow(row, status, attackLink);
            tableBody.innerHTML += newRow;
          })
          .catch((error) => {
            console.error("Error fetching data:", error);
          });
      });

      hideNoDataMessage();
      displayDataTable();
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
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
  return `<a href="https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${id}">Attack Link</a>`;
}

function createTableRow(row, status, attackLink) {
  return `
    <tr>
      <td class="pl-2"><a href="https://www.torn.com/profiles.php?XID=${row.id}" target="_blank">${row.name}</a></td>
      <td>${row.id}</td>
      <td>${row.lvl}</td>
      <td>${row.total}</td>
      <td>${row.str}</td>
      <td>${row.def}</td>
      <td>${row.spd}</td>
      <td>${row.dex}</td>
      <td>${status}</td>
      <td class="text-blue-300">${attackLink}</td>
    </tr>
  `;
}
