let allData = [];
let serviceData = [];
let currentData = [];
let cityDistrictMap = {};
let currentPage = 1;
const pageSize = 50;
let currentFilterType = "全部";

function csvToJson(csv) {
  const lines = csv.split("\n").filter(x => x.trim());
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ? values[i].trim() : "";
    });
    return obj;
  });
}

function normalizeAddress(list) {
  list.forEach(d => {
    if (d["醫事機構地址"]) {
      d["醫事機構地址"] = d["醫事機構地址"]
        .replaceAll("臺", "台")
        .trim();
    }
  });
}

const allCities = [
  "台北市","新北市","桃園市","台中市","台南市","高雄市",
  "基隆市","新竹市","嘉義市","新竹縣","苗栗縣","彰化縣",
  "南投縣","雲林縣","嘉義縣","屏東縣","宜蘭縣","花蓮縣",
  "台東縣","澎湖縣","金門縣","連江縣"
];

function buildCityDistrictMap(list) {
  cityDistrictMap = {};

  list.forEach(d => {
    const addr = d["醫事機構地址"];
    if (!addr) return;

    const city = allCities.find(c => addr.startsWith(c)) || "其他";

    const after = addr.replace(city, "");
    const match = after.match(/[\u4e00-\u9fa5]{1,4}(區|鄉|鎮|市)/);
    const district = match ? match[0] : "其他";

    if (!cityDistrictMap[city]) cityDistrictMap[city] = new Set();
    cityDistrictMap[city].add(district);
  });
}

function populateCityList() {
  const sel = document.getElementById("citySelect");
  sel.innerHTML = `<option value="全部">全部</option>`;

  Object.keys(cityDistrictMap).forEach(city => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = city;
    sel.appendChild(opt);
  });
}



function populateDistrictList() {
  const city = document.getElementById("citySelect").value;
  const sel = document.getElementById("districtSelect");
  sel.innerHTML = `<option value="全部">全部</option>`;

  if (city !== "全部" && cityDistrictMap[city]) {
    [...cityDistrictMap[city]].forEach(d => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = d;
      sel.appendChild(opt);
    });
  }

  searchData();
}

function quickFilter(type) {
  currentFilterType = type; 

  document.querySelectorAll(".filter-btn").forEach(btn =>
    btn.classList.remove("active")
  );
  document
    .querySelector(`.filter-btn[data-type="${type}"]`)
    .classList.add("active");

  searchData(); 
}

function renderTablePage() {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  if (currentData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">查無資料</td></tr>`;
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, currentData.length);
  const pageData = currentData.slice(start, end);

  for (const d of pageData) {
    const addr = d["醫事機構地址"];
    const phone = d["醫事機構電話"];
    const mapUrl =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d["醫事機構名稱"]}</td>
      <td><a href="${mapUrl}" target="_blank">${addr}</a></td>
      <td><a href="tel:${phone}" style="color:var(--link-color);text-decoration:none;">
        ${phone}</a>
      </td>
      <td>${d["整合團隊名稱"]}</td>
      <td>${d["來源"]}</td>
    `;
    tbody.appendChild(tr);
  }

  renderPagination();
}

function renderPagination() {
  const pageCount = Math.ceil(currentData.length / pageSize);
  const box = document.getElementById("pagination");
  box.innerHTML = "";

  if (pageCount <= 1) return;

  const prev = document.createElement("button");
  prev.textContent = "← 上一頁";
  prev.disabled = currentPage === 1;
  prev.onclick = () => {
    currentPage--;
    smoothRender(renderTablePage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = document.createElement("button");
  next.textContent = "下一頁 →";
  next.disabled = currentPage === pageCount;
  next.onclick = () => {
    currentPage++;
    smoothRender(renderTablePage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const info = document.createElement("span");
  info.textContent = `第 ${currentPage} / ${pageCount} 頁`;

  box.appendChild(prev);
  box.appendChild(info);
  box.appendChild(next);
}

function smoothRender(callback) {
  const table = document.getElementById("resultTable");
  table.style.opacity = "0";
  table.style.transform = "translateY(12px)";

  setTimeout(() => {
    callback();
    requestAnimationFrame(() => {
      table.style.opacity = "1";
      table.style.transform = "translateY(0)";
    });
  }, 200);
}

function setupModal() {
  const modal = document.getElementById("detailModal");
  const closeBtn = document.getElementById("closeModal");

  closeBtn.onclick = () => (modal.style.display = "none");

  window.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

function showDetails(d) {
  const modal = document.getElementById("detailModal");

  document.getElementById("modalTitle").textContent =
    d["醫事機構名稱"] || "無";
  document.getElementById("modalCode").textContent =
    d["醫事機構代碼"] || "無";
  document.getElementById("modalTeam").textContent =
    d["整合團隊名稱"] || "無";
  document.getElementById("modalAddr").textContent =
    d["醫事機構地址"] || "無";

  const phone = d["醫事機構電話"] || "";
  document.getElementById("modalPhone").innerHTML = phone
    ? `<a href="tel:${phone}" style="color:var(--link-color);text-decoration:none;">${phone}</a>`
    : "無";

  document.getElementById("modalSource").textContent =
    d["來源"] || "無";

  const modalContent = modal.querySelector(".modal-content");

  modalContent.querySelectorAll(".service-table, .service-msg")
    .forEach(el => el.remove());

  const found = serviceData.find(s =>
    s["醫事機構名稱"] &&
    d["醫事機構名稱"] &&
    s["醫事機構名稱"].includes(d["醫事機構名稱"])
  );

  const container = document.createElement("div");

  if (found) {
    let table = `
      <table class="service-table">
        <thead>
          <tr><th>項目</th><th>提供</th></tr>
        </thead>
        <tbody>
    `;

    const keys = Object.keys(found).slice(4);

    keys.forEach(k => {
      if (!k.trim()) return;

      const value = found[k];

      const icon =
        value == 1
          ? "<span class='yes-icon'>✔</span>"
          : "<span class='no-icon'>✖</span>";

      table += `
        <tr>
          <td>${k}</td>
          <td>${icon}</td>
        </tr>
      `;
    });

    table += "</tbody></table>";
    container.innerHTML = table;
  } else {
    container.innerHTML =
      `<p class="service-msg" style="text-align:center;margin-top:10px;">
        無服務項目資料
      </p>`;
  }

  modalContent.appendChild(container);
  modal.style.display = "block";
}

function initTheme() {
  const btn = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme");

  if (saved === "dark") document.body.classList.add("dark");

  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  });
}

function setupAutocomplete() {
  const input = document.getElementById("keyword");
  const box = document.createElement("div");

  box.id = "suggestionBox";
  box.style.position = "absolute";
  box.style.background = "white";
  box.style.border = "1px solid #ccc";
  box.style.borderRadius = "5px";
  box.style.display = "none";
  box.style.zIndex = "999";
  box.style.boxShadow = "0 3px 6px rgba(0,0,0,0.2)";

  document.body.appendChild(box);

  input.addEventListener("input", () => {
    const val = input.value.trim();
    box.innerHTML = "";

    if (!val) return (box.style.display = "none");

    const matches = allData
      .flatMap(d => [
        d["醫事機構名稱"],
        d["醫事機構地址"],
        d["醫事機構電話"],
        d["整合團隊名稱"]
      ])
      .filter(x => x && x.includes(val));

    const unique = [...new Set(matches)].slice(0, 10);

    unique.forEach(name => {
      const div = document.createElement("div");
      div.style.padding = "8px";
      div.style.cursor = "pointer";
      div.textContent = name;

      div.addEventListener("mouseover", () =>
        (div.style.background = "#e6fffa")
      );
      div.addEventListener("mouseout", () =>
        (div.style.background = "transparent")
      );
      div.addEventListener("click", () => {
        input.value = name;
        box.style.display = "none";
        searchData();
      });

      box.appendChild(div);
    });

    if (unique.length) {
      const rect = input.getBoundingClientRect();
      box.style.left = rect.left + "px";
      box.style.top = rect.bottom + window.scrollY + "px";
      box.style.width = rect.width + "px";
      box.style.display = "block";
    } else {
      box.style.display = "none";
    }
  });

  document.addEventListener("click", e => {
    if (e.target !== input && e.target.parentNode !== box)
      box.style.display = "none";
  });
}

function searchData() {
  const city = document.getElementById("citySelect").value;
  const dist = document.getElementById("districtSelect").value;
  const key = document.getElementById("keyword").value.trim();

  let filteredByLocationAndKeyword = allData.filter(d => {
    const addr = d["醫事機構地址"] || "";
    const name = d["醫事機構名稱"] || "";
    const phone = d["醫事機構電話"] || "";
    const team = d["整合團隊名稱"] || "";

    return (
      (city === "全部" || addr.includes(city)) &&
      (dist === "全部" || addr.includes(dist)) &&
      (!key ||
        addr.includes(key) ||
        name.includes(key) ||
        phone.includes(key) ||
        team.includes(key))
    );
  });

  let finalFilteredData = filteredByLocationAndKeyword;

  if (currentFilterType !== "全部") {
    let keywords = [];

    if (currentFilterType === "醫院") {
      keywords = ["醫院"];
    } else if (currentFilterType === "診所") {
      keywords = ["診所", "醫療"];
    } else if (currentFilterType === "護理之家") {
      keywords = ["護理", "安養", "養護"];
    }

    finalFilteredData = filteredByLocationAndKeyword.filter(d =>
      keywords.some(k => (d["醫事機構名稱"] || "").includes(k))
    );
  }

  currentData = finalFilteredData;

  currentPage = 1;
  document.getElementById("status").textContent =
    `顯示類別：${currentFilterType}（共 ${currentData.length} 筆資料）`;

  smoothRender(renderTablePage);
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  setupModal();
  setupAutocomplete();

  const files = [
    { path: "A21030000I-D2000H-001.csv", source: "居家醫療機構" },
    { path: "A21030000I-D2000I-001.csv", source: "安寧照護／護理之家" }
  ];

  let merged = [];

  for (const f of files) {
    try {
      const r = await fetch(f.path);
      const t = await r.text();
      const json = csvToJson(t).map(x => ({ ...x, 來源: f.source }));
      merged = merged.concat(json);
    } catch (e) {
      console.error("資料載入失敗：", f.path, e);
    }
  }

  allData = merged;

  normalizeAddress(allData);
  buildCityDistrictMap(allData);

  populateCityList();
  populateDistrictList();

  try {
    const r = await fetch(
      "https://raw.githubusercontent.com/kileyou123-maker/health-dashboard/refs/heads/main/services.csv"
    );
    const t = await r.text();
    serviceData = csvToJson(t);
  } catch (e) {
    console.error("服務資料載入失敗：", e);
  }

  currentData = allData;
  renderTablePage();
  document.getElementById("status").textContent =
    `顯示類別：全部（共 ${currentData.length} 筆資料）`;
  
  document.querySelector(`.filter-btn[data-type="${currentFilterType}"]`).classList.add("active");


  document.getElementById("citySelect").addEventListener("change", () => {
    populateDistrictList();
  });

  document.getElementById("districtSelect").addEventListener("change", () => {
    searchData();
  });

  document.getElementById("searchBtn").addEventListener("click", searchData);

  document.getElementById("keyword").addEventListener("keypress", e => {
    if (e.key === "Enter") searchData();
  });

  document.addEventListener("click", e => {
    const row = e.target.closest("#resultTable tbody tr");
    if (!row) return;

    const name = row.children[0].innerText.trim();
    const found = currentData.find(d => d["醫事機構名稱"] === name); 

    if (found) showDetails(found);
  });

  document.querySelectorAll(".filter-btn").forEach(btn =>
    btn.addEventListener("click", () => quickFilter(btn.dataset.type))
  );
});