const filterUser = document.querySelector("#filterUser");
const allBidTableBody = document.querySelector("#allBidTableBody");
const refreshButton = document.querySelector("#refreshButton");
const backButton = document.querySelector("#backButton");
const message = document.querySelector("#message");

function setMessage(text, type = "success") {
  message.textContent = text;
  message.className = `message ${type}`;
}

function getSelectedUserLabel() {
  return filterUser.options[filterUser.selectedIndex]?.textContent || "All Users";
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

async function loadUsers() {
  const users = await requestJson("/api/users");
  const options = ['<option value="">All Users</option>'].concat(
    users.map((user) => `<option value="${user.id}">${user.id} - ${user.name}</option>`)
  );
  filterUser.innerHTML = options.join("");
}

async function loadBids() {
  const params = new URLSearchParams();

  if (filterUser.value) {
    params.set("userId", filterUser.value);
  }

  const url = params.toString() ? `/api/plot-bids?${params.toString()}` : "/api/plot-bids";
  const bids = await requestJson(url);

  if (bids.length === 0) {
    allBidTableBody.innerHTML = `
      <tr>
        <td colspan="3">No data found for selected filter.</td>
      </tr>
    `;
    return;
  }

  allBidTableBody.innerHTML = bids
    .map(
      (bid) => `
        <tr>
          <td>${escapeHtml(bid.plotId || "")}</td>
          <td>${escapeHtml(bid.details || "")}</td>
          <td>${escapeHtml(String(bid.bidAmount ?? ""))}</td>
        </tr>
      `
    )
    .join("");
}

filterUser.addEventListener("change", async () => {
  try {
    await loadBids();
    const selectedUser = getSelectedUserLabel();
    const text =
      filterUser.value === ""
        ? "Showing bids by all users."
        : `Showing bids by ${selectedUser}.`;
    setMessage(text);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

refreshButton.addEventListener("click", async () => {
  try {
    await loadBids();
    const selectedUser = getSelectedUserLabel();
    const text =
      filterUser.value === ""
        ? "Showing bids by all users."
        : `Showing bids by ${selectedUser}.`;
    setMessage(text);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

backButton.addEventListener("click", () => {
  window.location.href = "/";
});

(async function init() {
  try {
    await loadUsers();
    await loadBids();
  } catch (error) {
    setMessage(error.message, "error");
  }
})();
