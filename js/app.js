(function () {
  "use strict";

  var STORAGE_KEY = "a700_regulations_v1";
  var COMPLIANCE_OPTIONS = ["", "○", "╳", "△", "-"];
  var COL_WIDTHS = { law: 22, article: 9, req: 74, status: 12.3, comp: 11.8, trend: 14 };

  // ---------- helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function isoToDisplay(iso) {
    if (!iso) return "";
    return iso.replace(/-/g, "/");
  }

  function blankItem() {
    return {
      id: uid(),
      lawName: "",
      article: "",
      requirement: "",
      currentStatus: "",
      compliance: "",
      futureTrend: ""
    };
  }

  function blankCategory() {
    return {
      id: uid(),
      name: "",
      date: todayISO(),
      approver: "",
      reviewer: "",
      drafter: "",
      formNo: "",
      items: [blankItem()]
    };
  }

  function defaultState() {
    return {
      companyName: "宏全國際股份有限公司",
      categories: [],
      activeCategoryId: null
    };
  }

  // ---------- state ----------
  var state = loadState();
  if (!state.activeCategoryId && state.categories.length) {
    state.activeCategoryId = state.categories[0].id;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.categories)) return defaultState();
      return parsed;
    } catch (e) {
      console.warn("讀取本機資料失敗，改用空白範本", e);
      return defaultState();
    }
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSaveIndicator();
    }, 400);
  }

  function showToast(message, type) {
    var stack = document.getElementById("toastStack");
    if (!stack) { console.log(message); return; }
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "info");
    el.textContent = message;
    stack.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  function flashSaveIndicator() {
    var el = document.getElementById("saveIndicator");
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 1200);
  }

  function getActiveCategory() {
    return state.categories.find(function (c) { return c.id === state.activeCategoryId; }) || null;
  }

  // ---------- DOM refs ----------
  var els = {};
  function cacheEls() {
    [
      "companyNameInput", "categoryTabs", "addCategoryBtn",
      "exportExcelBtn", "exportPdfBtn", "clearAllBtn",
      "lawUrlInput", "fetchLawBtn", "helpBtn", "helpModalBackdrop", "helpModalClose",
      "categoryNameInput", "renameCategoryDone", "categoryDateInput", "categoryDatePrint",
      "regTableBody", "emptyState", "sheet",
      "approverInput", "reviewerInput", "drafterInput", "formNoInput"
    ].forEach(function (id) { els[id] = document.getElementById(id); });
  }

  // ---------- render ----------
  function render() {
    els.companyNameInput.value = state.companyName || "";

    // tabs
    els.categoryTabs.innerHTML = "";
    state.categories.forEach(function (cat) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "category-tab" + (cat.id === state.activeCategoryId ? " active" : "");
      tab.textContent = cat.name && cat.name.trim() ? cat.name : "（未命名類別）";
      tab.addEventListener("click", function () {
        state.activeCategoryId = cat.id;
        render();
      });
      els.categoryTabs.appendChild(tab);
    });

    var cat = getActiveCategory();

    if (!cat) {
      els.sheet.querySelector(".sheet-meta").hidden = true;
      document.getElementById("regTable").hidden = true;
      document.querySelector(".sheet-footer").hidden = true;
      els.emptyState.hidden = false;
      return;
    }

    els.sheet.querySelector(".sheet-meta").hidden = false;
    document.getElementById("regTable").hidden = false;
    document.querySelector(".sheet-footer").hidden = false;
    els.emptyState.hidden = true;

    els.categoryNameInput.value = cat.name || "";
    els.categoryDateInput.value = cat.date || "";
    els.categoryDatePrint.textContent = isoToDisplay(cat.date);
    els.approverInput.value = cat.approver || "";
    els.reviewerInput.value = cat.reviewer || "";
    els.drafterInput.value = cat.drafter || "";
    els.formNoInput.value = cat.formNo || "";

    renderRows(cat);
  }

  function renderRows(cat) {
    var tbody = els.regTableBody;
    tbody.innerHTML = "";
    cat.items.forEach(function (item) {
      tbody.appendChild(buildRow(item));
    });
  }

  function buildEditableCell(item, field, extraClass) {
    var td = document.createElement("td");
    if (extraClass) td.className = extraClass;
    td.contentEditable = "true";
    td.textContent = item[field] || "";
    td.addEventListener("input", function () {
      item[field] = td.textContent;
      scheduleSave();
    });
    td.addEventListener("paste", function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
    });
    return td;
  }

  function buildRow(item) {
    var tr = document.createElement("tr");
    tr.dataset.id = item.id;

    tr.appendChild(buildEditableCell(item, "lawName"));
    tr.appendChild(buildEditableCell(item, "article", "cell-article"));
    tr.appendChild(buildEditableCell(item, "requirement"));
    tr.appendChild(buildEditableCell(item, "currentStatus"));

    var compTd = document.createElement("td");
    compTd.className = "cell-compliance-wrap";
    var select = document.createElement("select");
    select.className = "compliance-select";
    COMPLIANCE_OPTIONS.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt;
      o.textContent = opt === "" ? "（未填）" : opt;
      if (item.compliance === opt) o.selected = true;
      select.appendChild(o);
    });
    var compPrint = document.createElement("span");
    compPrint.className = "print-only";
    compPrint.textContent = item.compliance || "";
    select.addEventListener("change", function () {
      item.compliance = select.value;
      compPrint.textContent = select.value || "";
      scheduleSave();
    });
    compTd.appendChild(select);
    compTd.appendChild(compPrint);
    tr.appendChild(compTd);

    tr.appendChild(buildEditableCell(item, "futureTrend"));

    var opTd = document.createElement("td");
    opTd.className = "no-print";
    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "row-delete-btn";
    delBtn.title = "刪除此列";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", function () {
      var cat = getActiveCategory();
      cat.items = cat.items.filter(function (i) { return i.id !== item.id; });
      scheduleSave();
      render();
    });
    opTd.appendChild(delBtn);
    tr.appendChild(opTd);

    return tr;
  }

  // ---------- event bindings ----------
  function bindEvents() {
    els.companyNameInput.addEventListener("input", function () {
      state.companyName = els.companyNameInput.value;
      scheduleSave();
    });

    els.addCategoryBtn.addEventListener("click", function () {
      var cat = blankCategory();
      state.categories.push(cat);
      state.activeCategoryId = cat.id;
      scheduleSave();
      render();
      els.categoryNameInput.focus();
    });

    els.renameCategoryDone.addEventListener("click", function () {
      var cat = getActiveCategory();
      if (!cat) return;
      if (!confirm("確定要刪除「" + (cat.name || "未命名類別") + "」這個類別嗎？此動作無法復原。")) return;
      state.categories = state.categories.filter(function (c) { return c.id !== cat.id; });
      state.activeCategoryId = state.categories.length ? state.categories[0].id : null;
      scheduleSave();
      render();
    });

    els.categoryNameInput.addEventListener("input", function () {
      var cat = getActiveCategory();
      if (!cat) return;
      cat.name = els.categoryNameInput.value;
      scheduleSave();
      // update tab label live without full rerender of table
      var tabs = els.categoryTabs.children;
      var idx = state.categories.findIndex(function (c) { return c.id === cat.id; });
      if (tabs[idx]) tabs[idx].textContent = cat.name.trim() ? cat.name : "（未命名類別）";
    });

    els.categoryDateInput.addEventListener("input", function () {
      var cat = getActiveCategory();
      if (!cat) return;
      cat.date = els.categoryDateInput.value;
      els.categoryDatePrint.textContent = isoToDisplay(cat.date);
      scheduleSave();
    });

    ["approverInput", "reviewerInput", "drafterInput", "formNoInput"].forEach(function (id) {
      var fieldMap = {
        approverInput: "approver",
        reviewerInput: "reviewer",
        drafterInput: "drafter",
        formNoInput: "formNo"
      };
      els[id].addEventListener("input", function () {
        var cat = getActiveCategory();
        if (!cat) return;
        cat[fieldMap[id]] = els[id].value;
        scheduleSave();
      });
    });

    els.exportExcelBtn.addEventListener("click", exportExcel);
    els.exportPdfBtn.addEventListener("click", function () { window.print(); });

    els.fetchLawBtn.addEventListener("click", fetchLawFromUrl);
    els.lawUrlInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") fetchLawFromUrl();
    });

    els.clearAllBtn.addEventListener("click", function () {
      if (!confirm("確定要清空目前畫面上的所有資料嗎？此動作無法復原。")) return;
      state = defaultState();
      scheduleSave();
      render();
      showToast("已清空，可提供給下一位同仁使用。", "success");
    });

    els.helpBtn.addEventListener("click", function () { els.helpModalBackdrop.hidden = false; });
    els.helpModalClose.addEventListener("click", function () { els.helpModalBackdrop.hidden = true; });
    els.helpModalBackdrop.addEventListener("click", function (e) {
      if (e.target === els.helpModalBackdrop) els.helpModalBackdrop.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.helpModalBackdrop.hidden) els.helpModalBackdrop.hidden = true;
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // ---------- Excel export ----------
  function estimateLines(text, colWidthUnits) {
    if (!text) return 1;
    var capacity = Math.max(4, Math.round(colWidthUnits * 0.45));
    var segments = String(text).split("\n");
    var total = 0;
    segments.forEach(function (seg) {
      total += Math.max(1, Math.ceil(seg.length / capacity));
    });
    return Math.max(1, total);
  }

  function estimateRowHeight(item) {
    var lines = Math.max(
      estimateLines(item.requirement, COL_WIDTHS.req),
      estimateLines(item.currentStatus, COL_WIDTHS.status),
      estimateLines(item.futureTrend, COL_WIDTHS.trend),
      estimateLines(item.lawName, COL_WIDTHS.law)
    );
    return Math.min(600, Math.max(30, lines * 16 + 8));
  }

  function safeSheetName(name) {
    var n = (name || "工作表").replace(/[\\/*?:\[\]]/g, " ").trim();
    if (!n) n = "工作表";
    return n.slice(0, 31);
  }

  var THIN_BORDER = {
    top: { style: "thin" }, left: { style: "thin" },
    bottom: { style: "thin" }, right: { style: "thin" }
  };

  function isItemBlank(item) {
    return !item.lawName && !item.article && !item.requirement &&
      !item.currentStatus && !item.compliance && !item.futureTrend;
  }

  function isCategoryBlank(cat) {
    return !cat.name.trim() && cat.items.every(isItemBlank);
  }

  function exportExcel() {
    if (typeof ExcelJS === "undefined") {
      showToast("匯出元件尚未載入完成，請稍候再試一次。", "error");
      return;
    }
    var categoriesToExport = state.categories.filter(function (c) { return !isCategoryBlank(c); });
    if (!categoriesToExport.length) {
      showToast("目前沒有任何類別可以匯出。", "error");
      return;
    }

    var workbook = new ExcelJS.Workbook();
    workbook.creator = "法規鑑定登錄表系統";
    workbook.created = new Date();

    var usedNames = {};
    categoriesToExport.forEach(function (cat) {
      var baseName = safeSheetName(cat.name);
      var name = baseName, n = 2;
      while (usedNames[name]) { name = safeSheetName(baseName.slice(0, 28) + "_" + n); n++; }
      usedNames[name] = true;

      var ws = workbook.addWorksheet(name, {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      ws.columns = [
        { width: COL_WIDTHS.law }, { width: COL_WIDTHS.article }, { width: COL_WIDTHS.req },
        { width: COL_WIDTHS.status }, { width: COL_WIDTHS.comp }, { width: COL_WIDTHS.trend }
      ];

      // row1: company + title
      ws.mergeCells("A1:F1");
      var titleCell = ws.getCell("A1");
      titleCell.value = (state.companyName ? state.companyName + "\n" : "") + "法規鑑定登錄表";
      titleCell.font = { name: "標楷體", size: 16, bold: true };
      titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      ws.getRow(1).height = 40;

      // row2: category + date
      ws.mergeCells("A2:C2");
      var catCell = ws.getCell("A2");
      catCell.value = "類別：" + (cat.name || "");
      catCell.font = { name: "標楷體", size: 12 };
      catCell.alignment = { horizontal: "left", vertical: "middle" };

      ws.mergeCells("D2:F2");
      var dateCell = ws.getCell("D2");
      dateCell.value = "日期：" + isoToDisplay(cat.date);
      dateCell.font = { name: "標楷體", size: 12 };
      dateCell.alignment = { horizontal: "right", vertical: "middle" };
      ws.getRow(2).height = 20;

      // row3: header
      var headers = [
        "法令名稱", "條項", "法 規 要 求 及 標 準", "工廠目前執行現況",
        "法規符合性\n(符合:○、不符合:╳、參考:△、不適用:-", "未來趨勢之機會或風險說明"
      ];
      var headerRow = ws.getRow(3);
      headers.forEach(function (h, i) {
        var cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: "標楷體", size: 12, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = THIN_BORDER;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8ECF3" } };
      });
      headerRow.height = 34;

      // data rows
      var rowIdx = 4;
      cat.items.forEach(function (item) {
        var row = ws.getRow(rowIdx);
        var values = [item.lawName, item.article, item.requirement, item.currentStatus, item.compliance, item.futureTrend];
        var aligns = ["left", "center", "left", "left", "center", "left"];
        values.forEach(function (v, i) {
          var cell = row.getCell(i + 1);
          cell.value = v || "";
          cell.font = { name: "標楷體", size: 11 };
          cell.alignment = { horizontal: aligns[i], vertical: "middle", wrapText: true };
          cell.border = THIN_BORDER;
        });
        row.height = estimateRowHeight(item);
        rowIdx++;
      });

      // footer
      rowIdx += 1;
      var f1 = ws.getRow(rowIdx);
      ws.mergeCells("A" + rowIdx + ":F" + rowIdx);
      f1.getCell(1).value = "核准：" + (cat.approver || "") + "　　　審查：" + (cat.reviewer || "") + "　　　制訂：" + (cat.drafter || "");
      f1.getCell(1).font = { name: "標楷體", size: 11 };
      rowIdx++;

      var f2 = ws.getRow(rowIdx);
      ws.mergeCells("A" + rowIdx + ":F" + rowIdx);
      f2.getCell(1).value = "表單編號：" + (cat.formNo || "");
      f2.getCell(1).font = { name: "標楷體", size: 11 };
    });

    workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      downloadBlob(blob, "法規鑑定登錄表_" + todayISO() + ".xlsx");
    }).catch(function (err) {
      console.error(err);
      showToast("匯出 Excel 失敗：" + err.message, "error");
    });
  }

  // ---------- law URL import ----------
  var CORS_PROXIES = [
    function (u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
    function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); }
  ];

  function fetchViaProxies(url) {
    var attempt = function (i) {
      if (i >= CORS_PROXIES.length) {
        return Promise.reject(new Error("所有轉接服務目前都無法連線，請稍後再試。"));
      }
      return fetch(CORS_PROXIES[i](url), { headers: { "Accept": "text/html" } })
        .then(function (resp) {
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          return resp.text();
        })
        .then(function (text) {
          if (!text || text.indexOf("col-data") === -1) throw new Error("內容格式無法辨識");
          return text;
        })
        .catch(function () { return attempt(i + 1); });
    };
    return attempt(0);
  }

  var CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  var CN_UNITS = ["", "十", "百", "千"];

  function chineseNumeral(num) {
    if (num === 0) return CN_DIGITS[0];
    var s = String(num);
    var len = s.length;
    var result = "";
    var zeroFlag = false;
    for (var i = 0; i < len; i++) {
      var d = parseInt(s[i], 10);
      var unitIndex = len - i - 1;
      if (d === 0) {
        zeroFlag = true;
      } else {
        if (zeroFlag) { result += CN_DIGITS[0]; zeroFlag = false; }
        if (d === 1 && unitIndex === 1 && i === 0) {
          result += CN_UNITS[unitIndex];
        } else {
          result += CN_DIGITS[d] + CN_UNITS[unitIndex];
        }
      }
    }
    return result;
  }

  function formatArticleLabel(rawLabel) {
    var m = String(rawLabel || "").match(/第\s*(\d+)\s*(?:[-之]\s*(\d+))?\s*條/);
    if (!m) return String(rawLabel || "").replace(/\s+/g, "");
    var label = "第" + chineseNumeral(parseInt(m[1], 10)) + "條";
    if (m[2]) label += "之" + chineseNumeral(parseInt(m[2], 10));
    return label;
  }

  var TERMINAL_PUNCT = /[。：:；;]$/;

  function cleanArticleText(rawText) {
    var lines = String(rawText || "").replace(/\r\n/g, "\n").split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
    var out = [];
    lines.forEach(function (line) {
      if (out.length && !TERMINAL_PUNCT.test(out[out.length - 1])) {
        out[out.length - 1] += line;
      } else {
        out.push(line);
      }
    });
    return out.join("\n");
  }

  var LAW_CATEGORY_RULES = [
    {
      category: "職業安全衛生目",
      laws: [
        "職業安全衛生法", "職業災害勞工保護法", "地方主管機關受理最高負責人職場霸凌事件申訴處理辦法",
        "職場霸凌防治措施準則", "職業災害勞工申請器具照護失能及死亡補助辦法", "危險性機械及設備安全檢查規則",
        "職業災害勞工職能復健專業機構認可管理及補助辦法", "妊娠與分娩後女性及未滿十八歲勞工禁止從事危險性或有害性工作認定標準",
        "碼頭裝卸安全衛生設施標準", "職業安全衛生教育訓練規則", "新化學物質登記管理辦法", "有機溶劑中毒預防規則",
        "勞工作業場所容許暴露標準", "職業災害預防及職業災害勞工重建補助辦法", "職業傷病診治醫療機構認可管理補助及職業傷病通報辦法",
        "職業安全衛生顧問服務機構與其顧問服務人員之認可及管理規則", "職業安全衛生設施規則", "鉛中毒預防規則",
        "優先管理化學品之指定及運作管理辦法", "女性勞工母性健康保護實施辦法", "直轄市及縣市政府辦理協助職業災害勞工重返職場補助辦法",
        "職業安全衛生顧問服務機構審查收費標準", "辦理勞工體格與健康檢查醫療機構認可審查收費標準", "機械類產品申請先行放行辦法",
        "機械類產品申請免驗證辦法", "高壓氣體勞工安全規則", "辦理勞工體格與健康檢查醫療機構認可及管理辦法",
        "四烷基鉛中毒預防規則", "機械設備器具安全標準", "勞工職業災害保險職業病鑑定作業實施辦法",
        "財團法人職業災害預防及重建中心監督及管理辦法", "勞工職業災害保險預防職業病健康檢查及健康追蹤檢查辦法",
        "職業安全衛生管理辦法", "勞工健康保護規則", "特定化學物質危害預防標準", "船舶清艙解體職業安全規則",
        "營造安全衛生設施標準", "管制性化學品許可申請收費標準", "機械設備器具安全資訊申報登錄辦法", "起重升降機具安全規則",
        "製程安全評估定期實施辦法", "產品安全資訊申報登錄及型式驗證規費收費標準", "職業安全衛生法施行細則",
        "職業災害勞工補助及核發辦法", "職業災害勞工保護法施行細則", "危害性化學品標示及通識規則", "工業用機器人危害預防標準",
        "安全標示與驗證合格標章使用及管理辦法", "勞工作業環境監測實施辦法", "危害性化學品評估及分級管理辦法",
        "管制性化學品之指定及運作許可管理辦法", "機械設備器具監督管理辦法", "促進職業安全衛生文化獎勵及補助辦法",
        "機械類產品型式驗證實施及監督管理辦法", "政府機關推動職業安全衛生業務績效評核及獎勵辦法",
        "構造規格特殊產品安全評估報告及檢驗辦法", "職業災害勞工職業重建補助辦法", "職業災害預防補助辦法",
        "既有危險性機械及設備安全檢查規則", "職業安全衛生標示設置準則", "林場安全衛生設施規則", "高溫作業勞工作息時間標準",
        "鍋爐及壓力容器安全規則", "重體力勞動作業勞工保護措施標準", "精密作業勞工視機能保護設施標準",
        "壓力容器安全檢查構造標準", "缺氧症預防規則", "粉塵危害預防標準", "高架作業勞工保護措施標準",
        "異常氣壓危害預防標準", "礦場職業衛生設施標準"
      ]
    }
  ];

  function resolveCategoryName(lawName) {
    for (var i = 0; i < LAW_CATEGORY_RULES.length; i++) {
      if (LAW_CATEGORY_RULES[i].laws.indexOf(lawName) !== -1) return LAW_CATEGORY_RULES[i].category;
    }
    return lawName;
  }

  function extractLawName(doc) {
    var selectors = [
      ".law-header-simple .col-td a",
      "[id$='lawheader_hlkLNNAME']",
      "#hlLawName",
      ".table-title a"
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = doc.querySelector(selectors[i]);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return "";
  }

  function extractArticleText(row) {
    var pre = row.querySelector(".col-data pre");
    if (pre) return cleanArticleText(pre.textContent);

    var lawArticle = row.querySelector(".col-data .law-article");
    if (lawArticle) {
      var lines = [];
      Array.prototype.forEach.call(lawArticle.children, function (child) {
        var t = child.textContent.trim();
        if (t) lines.push(t);
      });
      if (lines.length) return lines.join("\n");
      return lawArticle.textContent.trim();
    }

    var dataEl = row.querySelector(".col-data");
    return dataEl ? cleanArticleText(dataEl.textContent) : "";
  }

  function parseLawHtmlToItems(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var lawName = extractLawName(doc);

    var rows = doc.querySelectorAll(".law-content .row");
    var items = [];
    rows.forEach(function (row) {
      var noEl = row.querySelector(".col-no a");
      var dataEl = row.querySelector(".col-data");
      if (!noEl || !dataEl) return;
      items.push({
        id: uid(),
        lawName: lawName,
        article: formatArticleLabel(noEl.textContent),
        requirement: extractArticleText(row),
        currentStatus: "",
        compliance: "",
        futureTrend: ""
      });
    });

    if (!lawName || items.length === 0) return null;
    return { lawName: lawName, items: items };
  }

  function fetchLawFromUrl() {
    var url = els.lawUrlInput.value.trim();
    if (!url) {
      showToast("請先輸入法規網址。", "error");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      showToast("請輸入完整的網址（需以 http:// 或 https:// 開頭）。", "error");
      return;
    }

    els.fetchLawBtn.disabled = true;
    var originalLabel = els.fetchLawBtn.textContent;
    els.fetchLawBtn.textContent = "讀取中...";

    fetchViaProxies(url).then(function (html) {
      var parsed = parseLawHtmlToItems(html);
      if (!parsed) {
        showToast("無法從這個網址辨識出法規條文，請確認網址是否為法規「所有條文」頁面。", "error");
        return;
      }
      var categoryName = resolveCategoryName(parsed.lawName);
      var cat = state.categories.find(function (c) { return c.name === categoryName; });
      if (cat) {
        cat.items = cat.items.concat(parsed.items);
      } else {
        cat = {
          id: uid(), name: categoryName, date: todayISO(),
          approver: "", reviewer: "", drafter: "", formNo: "",
          items: parsed.items
        };
        state.categories.push(cat);
      }
      state.activeCategoryId = cat.id;
      scheduleSave();
      render();
      els.lawUrlInput.value = "";
      showToast("已轉換「" + parsed.lawName + "」，共 " + parsed.items.length + " 條條文，已加入「" + categoryName + "」。", "success");
    }).catch(function (err) {
      console.error(err);
      showToast("讀取失敗：" + err.message, "error");
    }).finally(function () {
      els.fetchLawBtn.disabled = false;
      els.fetchLawBtn.textContent = originalLabel;
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    bindEvents();
    render();
  });
})();
