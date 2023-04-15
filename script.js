let tabledata = [];

fetch("data.json")
  .then((response) => response.json())
  .then((data) => {
    tabledata = data;
    console.log(tabledata);
  })
  .catch((error) => {
    console.error("Error fetching data:", error);
  });

function fetchData() {
  const apiKey = document.getElementById("api-key").value;
  if (apiKey === "") {
    alert("Please enter an API key");
    return;
  }

  const tableBody = document.getElementById("table-body");
  tableBody.innerHTML = "";

  if (tabledata.length === 0) {
    const noDataMessage = document.getElementById("no-data-message");
    noDataMessage.classList.remove("hidden");
    const dataTable = document.getElementById("data-table");
    dataTable.classList.add("hidden");
    return;
  }

  tabledata.forEach((row) => {
    const apiUrl = `https://api.torn.com/user/${row.id}?selections=basic&key=${apiKey}`;
    fetch(apiUrl)
      .then((response) => response.json())
      .then((userData) => {
        let status = userData.status.state;
        if (status === "Hospital") {
          const remaining = userData.status.until - Date.now() / 1000;
          const minutes = Math.floor(remaining / 60);
          const seconds = Math.floor(remaining % 60);
          status = `Hospitalized (${minutes}m ${seconds}s)`;
        }
        const attackLink = `<a href="https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${row.id}">Attack Link</a>`;
        const newRow = `
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
        tableBody.innerHTML += newRow;
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  });

  const noDataMessage = document.getElementById("no-data-message");
  noDataMessage.classList.add("hidden");
  const dataTable = document.getElementById("data-table");
  dataTable.classList.remove("hidden");
}
