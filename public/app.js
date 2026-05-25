const activeUser = document.querySelector("#activeUser");
const bidTableBody = document.querySelector("#bidTableBody");
const addBidForm = document.querySelector("#addBidForm");
const refreshButton = document.querySelector("#refreshButton");
const showAllDataButton = document.querySelector("#showAllDataButton");
const toggleLogsButton = document.querySelector("#toggleLogsButton");
const logsContainer = document.querySelector("#logs");
const message = document.querySelector("#message");
let logsVisible = false;

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function setMessage(text, type = "success") {
  message.textContent = text;
  message.className = `message ${type}`;
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

async function loadUsers() {
  const users = await requestJson("/api/users");
  activeUser.innerHTML = users
    .map((user) => `<option value="${user.id}">${user.id} - ${user.name}</option>`)
    .join("");
}

async function loadBids() {
  const params = new URLSearchParams();

  if (activeUser.value) {
    params.set("userId", activeUser.value);
  }

  const url = params.toString() ? `/api/plot-bids?${params.toString()}` : "/api/plot-bids";
  const bids = await requestJson(url);

  if (bids.length === 0) {
    bidTableBody.innerHTML = `
      <tr>
        <td colspan="6">No data added yet.</td>
      </tr>
    `;
    return;
  }

  bidTableBody.innerHTML = bids
    .map(
      (bid) => `
        <tr data-id="${bid._id}">
          <td>
            <input class="plot-id-input" value="${escapeHtml(bid.plotId || "")}" />
          </td>
          <td>
            <input class="details-input" value="${escapeHtml(bid.details || "")}" />
          </td>
          <td>
            <input class="amount-input" type="number" min="0" step="0.01" value="${bid.bidAmount}" />
          </td>
          <td>${bid.loggedBy.userId} - ${escapeHtml(bid.loggedBy.name)}</td>
          <td>${formatTime(bid.logTime)}</td>
          <td>
            <button type="button" data-action="save">Save / Lock</button>
          </td>
        </tr>
      `
    )
    .join("");
}

async function loadLogs() {
  const logs = await requestJson("/api/audit-logs");

  if (logs.length === 0) {
    logsContainer.innerHTML = "<p>No logs yet.</p>";
    return;
  }

  logsContainer.innerHTML = logs
    .map((log) => {
      const fieldText = log.changedFields
        .map(
          (change) =>
            `${escapeHtml(change.field)}: ${escapeHtml(String(change.oldValue ?? "empty"))} -> ${escapeHtml(
              String(change.newValue ?? "empty")
            )}`
        )
        .join(", ");

      const plotLabel =
        typeof log.plotBidId === "object" && log.plotBidId
          ? `${log.plotBidId.plotId || "Unknown plot"} - ${log.plotBidId.details || "No details"}`
          : log.plotBidId;

      return `
        <article class="log-entry">
          <p><strong>${log.action}</strong> on ${escapeHtml(String(plotLabel))}</p>
          <p>User: ${log.user.userId} - ${escapeHtml(log.user.name)}</p>
          <p>Time: ${formatTime(log.createdAt)}</p>
          <p>Changed: ${fieldText}</p>
        </article>
      `;
    })
    .join("");
}

async function refreshAll() {
  await loadBids();

  if (logsVisible) {
    await loadLogs();
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[char];
  });
}

addBidForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(addBidForm);

  try {
    await requestJson("/api/plot-bids", {
      method: "POST",
      body: JSON.stringify({
        userId: activeUser.value,
        plotId: formData.get("plotId"),
        details: formData.get("details"),
        bidAmount: formData.get("bidAmount")
      })
    });

    addBidForm.reset();
    await refreshAll();
    setMessage("Data added and logged.");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

bidTableBody.addEventListener("click", async (event) => {
  if (event.target.dataset.action !== "save") {
    return;
  }

  const row = event.target.closest("tr");

  try {
    await requestJson(`/api/plot-bids/${row.dataset.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: activeUser.value,
        plotId: row.querySelector(".plot-id-input").value,
        details: row.querySelector(".details-input").value,
        bidAmount: row.querySelector(".amount-input").value
      })
    });

    await refreshAll();
    setMessage("Entry updated and logged.");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

refreshButton.addEventListener("click", async () => {
  try {
    await refreshAll();
    setMessage("Data refreshed.");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

activeUser.addEventListener("change", async () => {
  try {
    await refreshAll();
    const selectedUser = activeUser.options[activeUser.selectedIndex]?.textContent || "selected user";
    setMessage(`Showing data for ${selectedUser}.`);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

showAllDataButton.addEventListener("click", () => {
  window.location.href = "/all-bids.html";
});

toggleLogsButton.addEventListener("click", async () => {
  logsVisible = !logsVisible;

  if (logsVisible) {
    logsContainer.classList.remove("hidden");
    toggleLogsButton.textContent = "Hide Logs";

    try {
      await loadLogs();
    } catch (error) {
      setMessage(error.message, "error");
    }
  } else {
    logsContainer.classList.add("hidden");
    toggleLogsButton.textContent = "Show Logs";
  }
});

(async function init() {
  try {
    await loadUsers();
    await refreshAll();
  } catch (error) {
    setMessage(error.message, "error");
  }
})();
