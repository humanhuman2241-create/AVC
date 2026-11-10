(() => {
  // Har page par pehle 2 buttons aate hain: "CP Balance" (pehla) aur "AVC" (doosra)
  const AVC_URL = "https://hrms1.mydecibel.com/TMS/AVCD_BulkLeaves.aspx";
  const CP_URL = "https://mydecibel.com/Tms/Tm_CplEntitlementAdd.aspx";
  const onCpPage = () => (location.origin + location.pathname).toLowerCase() === CP_URL.toLowerCase();

  const toast = (text, bg, ms) => {
    let p = document.createElement("div");
    p.textContent = text;
    p.style = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:" + bg + ";color:#fff;padding:12px 25px;border-radius:8px;font-family:sans-serif;font-size:16px;z-index:999999;";
    document.body.appendChild(p);
    setTimeout(() => p.remove(), ms);
  };

  ["avcLaunchWrap", "avcPanel", "cpPanel"].forEach(id => document.getElementById(id)?.remove());

  let wrap = document.createElement("div");
  wrap.id = "avcLaunchWrap";
  wrap.style = "position:fixed;top:15px;right:15px;display:flex;flex-direction:column;gap:8px;z-index:999999;";
  const mkBtn = (label, bg) => {
    let b = document.createElement("button");
    b.textContent = label;
    b.style = "background:" + bg + ";color:#fff;padding:10px 26px;border:none;border-radius:10px;font-family:sans-serif;font-size:18px;font-weight:bold;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.4);";
    wrap.appendChild(b);
    return b;
  };
  let launchCp = mkBtn("CP Balance", "#1565c0");
  let launch = mkBtn("AVC", "maroon");
  document.body.appendChild(wrap);

  launch.onclick = () => {
    wrap.remove();
    if (location.href !== AVC_URL) return toast("Not Allowed", "red", 2000);
    startUploader();
  };

  launchCp.onclick = () => {
    wrap.remove();
    if (!onCpPage()) {
      window.open(CP_URL + "#cpauto", "_blank");
      return toast("CP Balance page open ho raha hai - panel khud khulega (na khule to wahan extension icon ek baar click karein)", "#217346", 5000);
    }
    startCp();
  };

  const startCp = () => {
    let c = document.createElement("div");
    c.id = "cpPanel";
    c.style = "position:fixed;top:5%;left:50%;transform:translateX(-50%);background:#fff;padding:40px 30px 30px 30px;z-index:999999;box-shadow:0 0 40px 10px rgba(0,0,0,0.8);border-radius:20px;text-align:center;font-family:sans-serif;min-width:500px;";
    c.innerHTML =
      '<div style="margin-bottom:15px;"><span style="font-weight:bold;font-size:26px;color:#1565c0;">CP Balance</span></div>' +
      '<button id="cpDl" style="background:#000;color:#fff;padding:10px 14px;border:none;border-radius:8px;margin:8px 0;cursor:pointer;font-size:14px;">Download Template</button>' +
      '<input type="file" id="cpUp" accept=".csv" style="margin:8px;">' +
      '<button id="cpEx" style="background:#217346;color:#fff;padding:10px 14px;border:none;border-radius:8px;margin:8px;cursor:pointer;font-size:14px;">Export to Excel</button>' +
      '<div style="margin-top:15px;"><div id="cpProgressText" style="font-size:14px;margin-bottom:5px;">Progress: 0%</div>' +
      '<div style="width:100%;height:10px;background:#eee;border-radius:10px;overflow:hidden;"><div id="cpProgressBar" style="height:100%;width:0%;background:#1565c0;"></div></div></div>' +
      '<div style="text-align:left;position:relative;margin-top:20px;height:32px;"><button id="cpClose" style="background:maroon;color:#fff;padding:7px 14px;border:none;border-radius:8px;cursor:pointer;position:absolute;top:0;left:0;">Close</button></div>';
    document.body.appendChild(c);

    const $ = (id) => document.getElementById(id);
    const P = "ctl00_ContentPlaceHolder1_";
    const TABLE_ID = P + "gv_GetEmployees";
    const setProgress = (pct, text) => {
      $("cpProgressText").innerText = text;
      $("cpProgressBar").style.width = pct + "%";
    };
    const tick = () => new Promise(r => setTimeout(r, 0));
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    $("cpClose").onclick = () => c.remove();

    // ---------- background postback (page reload ke baghair, panel bacha rehta hai) ----------
    const postForm = async (eventTarget, isGet) => {
      let form = document.getElementById("aspnetForm");
      let params = new URLSearchParams(new FormData(form));
      if (isGet) params.set("ctl00$ContentPlaceHolder1$pb_Get", "GET");
      params.set("__EVENTTARGET", eventTarget || "");
      params.set("__EVENTARGUMENT", "");
      let res = await fetch(form.action, { method: "POST", body: params, credentials: "same-origin" });
      if (!res.ok) throw new Error("Request fail hui (HTTP " + res.status + ")");
      let doc = new DOMParser().parseFromString(await res.text(), "text/html");
      let newInput = doc.getElementById(P + "dv_Input"), oldInput = $(P + "dv_Input");
      if (!newInput || !oldInput) throw new Error("Server se sahi page nahi aaya (session expire?). Page refresh karke dobara try karein");
      ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__PREVIOUSPAGE", "__VIEWSTATEENCRYPTED", "__LASTFOCUS"].forEach(id => {
        let n = doc.getElementById(id), o = document.getElementById(id);
        if (n && o) o.value = n.value;
      });
      let em1 = doc.getElementById(P + "ErrMsg"), em0 = $(P + "ErrMsg");
      if (em1 && em0) em0.innerHTML = em1.innerHTML;
      oldInput.replaceWith(document.importNode(newInput, true));
    };

    // Client "Service Tyres Private Limited" auto select
    const ensureClient = async () => {
      let sel = $(P + "ddl_Client");
      if (!sel) throw new Error("Client dropdown nahi mila");
      let opt = [...sel.options].find(o => /service\s*tyres/i.test(o.text));
      if (!opt) throw new Error("Client 'Service Tyres Private Limited' list mein nahi mila");
      let emp = $(P + "ddl_Employee");
      if (sel.value === opt.value && emp && [...emp.options].some(o => o.value === "0")) return;
      sel.value = opt.value;
      await postForm(sel.name, false);
    };
    setProgress(0, "Client select ho raha hai...");
    let clientReady = ensureClient()
      .then(() => setProgress(0, "Client: Service Tyres Private Limited ✔ - ab template upload karein"))
      .catch(err => setProgress(0, "Client auto-select fail: " + err.message));

    // ---------- helpers ----------
    const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const fixY = (y) => (y < 100 ? y + 2000 : y);
    // koi bhi common date format: yyyy-mm-dd, dd-Mon-yyyy, Mon dd, yyyy, mm/dd/yyyy
    const findDate = (str) => {
      str = String(str || "");
      let m;
      if ((m = str.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return { y: +m[1], m: +m[2], d: +m[3] };
      if ((m = str.match(/(\d{1,2})[-\/. ]([A-Za-z]{3,9})[-\/. ,]*(\d{2,4})/)) && MON[m[2].slice(0, 3).toLowerCase()])
        return { y: fixY(+m[3]), m: MON[m[2].slice(0, 3).toLowerCase()], d: +m[1] };
      if ((m = str.match(/([A-Za-z]{3,9})[ .-]+(\d{1,2}),?[ .-]+(\d{4})/)) && MON[m[1].slice(0, 3).toLowerCase()])
        return { y: +m[3], m: MON[m[1].slice(0, 3).toLowerCase()], d: +m[2] };
      if ((m = str.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) {
        // slash format = mm/dd/yyyy (10/04/2026 => 4 Oct 2026)
        let mo = +m[1], d = +m[2];
        if (mo > 12 && d <= 12) { let t = d; d = mo; mo = t; }
        return { y: fixY(+m[3]), m: mo, d: d };
      }
      return null;
    };
    const dKey = (o) => o.y + "-" + o.m + "-" + o.d;
    const dNum = (o) => Date.UTC(o.y, o.m - 1, o.d);
    const isCP = (t) => /^(9|cpl?|compensatory(\s+leave)?)$/i.test(String(t).trim());

    const parseLine = (line, delim) => {
      let out = [], cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        let ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else {
          if (ch === '"') q = true;
          else if (ch === delim) { out.push(cur.trim()); cur = ""; }
          else cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };

    const setSel = (id, v) => {
      let s = $(P + id);
      if (!s) return false;
      const MN = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const byVal = () => [...s.options].find(o => o.value === String(v)) ||
                          [...s.options].find(o => /^\d+$/.test(o.value.trim()) && +o.value === +v);
      const byText = () => [...s.options].find(o => {
        let t = o.text.trim().toLowerCase();
        return t === MN[v - 1] || (/^\d+$/.test(t) && +t === +v);
      });
      let o = /Month/i.test(id) ? (byText() || byVal()) : (byVal() || byText());
      if (!o) return false;
      s.value = o.value;
      return true;
    };

    // ---------- template ----------
    $("cpDl").onclick = () => {
      let a = document.createElement("a");
      a.href = "data:text/csv," + encodeURIComponent("Emp ID,Leave Type,Leave Date,OT Date/Remarks");
      a.download = "CP_Balance_Template.csv";
      a.click();
    };

    // ---------- export (poori table header ke saath) ----------
    $("cpEx").onclick = () => {
      let t = $(TABLE_ID);
      if (!t) return alert("❌ Table not found - pehle template upload karein (GET ke baad table aati hai)");
      const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      let body = [...t.rows].map(r => "<tr>" + [...r.cells].map(cell => {
        let head = cell.tagName === "TH";
        let tx = cell.querySelector("input[type='text']");
        let v = tx ? tx.value : (cell.querySelector("input[type='checkbox']") ? "" : cell.innerText.trim());
        return (head ? "<th>" : "<td style=\"mso-number-format:'\\@'\">") + esc(v) + (head ? "</th>" : "</td>");
      }).join("") + "</tr>").join("");
      let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1">' + body + "</table></body></html>";
      let a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" }));
      a.download = "CP_Balance_Table.xls";
      a.click();
    };

    // generic CSV download
    const downloadCsv = (fileName, header, rows) => {
      let body = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      let a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + header + "\n" + body], { type: "text/csv" }));
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    // ---------- upload ----------
    $("cpUp").onchange = async (e) => {
      let input = e.target, f = input.files[0];
      if (!f) return;
      const fail = (msg) => { alert("❌ " + msg); setProgress(0, "Progress: 0%"); input.value = ""; };
      try {
        setProgress(5, "Reading file...");
        setProgress(3, "Client select ho raha hai...");
        await clientReady;
        await ensureClient();

        let text = (await f.text()).replace(/^\uFEFF/, "");
        let lines = text.split(/\r?\n/).filter(l => l.trim());
        let delim = lines[0] && lines[0].indexOf(",") < 0 && lines[0].indexOf(";") >= 0 ? ";" : ",";
        let items = lines.slice(1).map(l => parseLine(l, delim)).filter(x => x[0] && x[1]).map(x => ({
          id: x[0].trim(), type: x[1].trim(), leave: x[2] || "", ot: x[3] || "", otDate: findDate(x[3] || "")
        }));
        let cpItems = items.filter(i => isCP(i.type) && i.otDate);
        if (!cpItems.length) return fail("Template mein koi valid CP (9 / CP) row ya OT Date nahi mili");

        // From Date = sab se purani OT Date, To Date = aaj
        let from = cpItems.reduce((m, i) => (dNum(i.otDate) < dNum(m) ? i.otDate : m), cpItems[0].otDate);
        let now = new Date();
        let to = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
        if (dNum(to) < dNum(from)) to = from;

        setProgress(10, "Setting From / To date...");
        let okDates = setSel("ddl_FDay", from.d) && setSel("ddl_FMonth", from.m) && setSel("ddl_FYear", from.y) &&
                      setSel("ddl_TDay", to.d) && setSel("ddl_TMonth", to.m) && setSel("ddl_TYear", to.y);
        if (!okDates) return fail("From/To date dropdown mein set nahi ho saki (" + dKey(from) + " -> " + dKey(to) + ")");

        // Employee: "- All -" taake poori list aaye
        let empSel = $(P + "ddl_Employee");
        if (!empSel || ![...empSel.options].some(o => o.value === "0"))
          return fail("Employee list mein '- All -' nahi mila. Client select karne ke baad page load hone dein");
        empSel.value = "0";
        let searchBox = $(P + "tb_SearchUser");
        if (searchBox) searchBox.value = "";

        // GET button par auto click (background mein)
        setProgress(25, "GET ho raha hai...");
        await postForm("", true);
        setProgress(50, "Table load ho gayi...");

        // Table se ID + Attendance Date => checkbox
        // Jis row ke sath "Delete" likha ho (pehle se posted) us mein koi selection nahi hogi
        let table = $(TABLE_ID);
        let map = {}, posted = {};
        const isVisible = (el) => el.offsetParent !== null;
        if (table) {
          [...table.rows].forEach(r => {
            if (r.querySelector("th") || r.cells.length < 9) return;
            let id = r.cells[1].innerText.trim();
            let dateEl = r.querySelector("span[id$='gv_lbl_ATDate']");
            let d = findDate(dateEl ? dateEl.innerText : r.cells[8].innerText);
            if (!(id && d)) return;
            let key = id + "|" + dKey(d);
            let hasDelete = /delete/i.test(r.innerText) ||
              [...r.querySelectorAll("a,button,input[type='button'],input[type='submit'],input[type='image'],img")]
                .some(el => isVisible(el) && /delete/i.test((el.value || "") + " " + (el.title || "") + " " + (el.alt || "") + " " + (el.innerText || "")));
            let cb = r.querySelector("input[type='checkbox']");
            if (hasDelete) posted[key] = true;
            else if (cb && !map[key]) map[key] = cb;
          });
        }

        // avc = AVC upload file (ticked CP rows + baqi leave types as-is)
        // rej = CP Rejection file (CP rows jo table mein nahi mili / tick nahi hui)
        let avc = [], rej = [], done = 0;
        const dKey2 = (it) => it.id + "|" + dKey(it.otDate);
        for (let k = 0; k < items.length; k++) {
          let it = items[k];
          if (!isCP(it.type)) {
            // 9 / CP ke ilawa: CP balance tick nahi hoga, lekin AVC upload file mein jayegi
            avc.push([it.id, it.leave, it.type, it.ot]);
          } else if (!it.otDate) {
            rej.push([it.id, it.type, it.leave, it.ot, "OT Date missing / invalid"]);
          } else {
            let cb = map[it.id + "|" + dKey(it.otDate)];
            if (!cb) rej.push([it.id, it.type, it.leave, it.ot, posted[dKey2(it)] ? "Already posted (Delete likha hai) - selection nahi hui" : "Not Found in table (ID + OT Date)"]);
            else {
              if (!cb.checked) cb.click();
              if (cb.checked) { done++; avc.push([it.id, it.leave, "9", it.ot]); }
              else rej.push([it.id, it.type, it.leave, it.ot, "Could not tick"]);
            }
          }
          if (k % 25 === 0) { setProgress(50 + Math.floor((k / items.length) * 50), "Ticking " + (k + 1) + " / " + items.length); await tick(); }
        }

        setProgress(100, "Completed ✔ - " + done + " ticked / " + items.length + " rows | Rejected: " + rej.length);

        // 2 files auto download
        downloadCsv("AVC_Upload.csv", "Emp ID,Attendance Date,Leave Type,Remarks", avc);
        await wait(800);
        downloadCsv("CP_Balance_Rejection.csv", "Emp ID,Leave Type,Leave Date,OT Date/Remarks,Rejection Reason", rej);
      } catch (err) {
        fail("Error: " + (err && err.message ? err.message : err));
      }
    };
  };

  const startUploader = () => {
  let c = document.createElement("div");
  c.style = "position:fixed;top:5%;left:50%;transform:translateX(-50%);background:#fff;padding:40px 30px 30px 30px;z-index:999999;box-shadow:0 0 40px 10px rgba(0,0,0,0.8);border-radius:20px;text-align:center;font-family:sans-serif;min-width:500px;";
  c.innerHTML =
    '<div style="margin-bottom:15px;"><span style="font-weight:bold;font-size:26px;color:maroon;">AVC Leave Uploader</span></div>' +
    '<button id="dl" style="background:#000;color:#fff;padding:10px 14px;border:none;border-radius:8px;margin:8px 0;cursor:pointer;font-size:14px;">Download Template</button>' +
    '<input type="file" id="up" accept=".csv" style="margin:8px;">' +
    '<button id="ex" style="background:#217346;color:#fff;padding:10px 14px;border:none;border-radius:8px;margin:8px;cursor:pointer;font-size:14px;">Export to Excel</button>' +
    '<div style="margin-top:15px;"><div id="progressText" style="font-size:14px;margin-bottom:5px;">Progress: 0%</div>' +
    '<div style="width:100%;height:10px;background:#eee;border-radius:10px;overflow:hidden;"><div id="progressBar" style="height:100%;width:0%;background:#217346;"></div></div></div>' +
    '<div style="text-align:left;position:relative;margin-top:20px;"><button id="closeBtn" style="background:maroon;color:#fff;padding:7px 14px;border:none;border-radius:8px;cursor:pointer;position:absolute;top:0;left:0;">Close</button></div>' +
    '<div id="footerText" style="visibility:hidden;margin-top:20px;font-size:13px;color:#000;text-align:center;height:16px;">Prepared by Abdullah Shah and Mirza Laiq Ahmed</div>';
  c.id = "avcPanel";
  document.body.appendChild(c);

  let footer = document.getElementById("footerText"), timer = null;
  let hoverZone = document.createElement("div");
  hoverZone.style = "position:absolute;bottom:10px;right:10px;width:30px;height:30px;z-index:1;background:transparent;";
  c.appendChild(hoverZone);
  hoverZone.onmouseenter = () => {
    timer = setTimeout(() => {
      footer.style.visibility = "visible";
      footer.style.opacity = "1";
      footer.style.transition = "opacity 0.3s";
    }, 3000);
  };
  hoverZone.onmouseleave = () => {
    clearTimeout(timer);
    footer.style.opacity = "0";
    footer.style.visibility = "hidden";
  };

  closeBtn.onclick = () => c.remove();

  dl.onclick = () => {
    let a = document.createElement("a");
    a.href = "data:text/csv," + encodeURIComponent("Emp ID,Attendance Date,Leave Type,Remarks");
    a.download = "Leave_Template.csv";
    a.click();
  };

  ex.onclick = () => {
    let t = document.querySelector("table");
    if (!t) return alert("❌ Table not found");
    let csv = [...t.rows].map(r => [...r.cells].map(c => `"${c.innerText.trim().replace(/"/g, '""')}"`).join("\t")).join("\n");
    let a = document.createElement("a");
    a.href = "data:application/vnd.ms-excel," + encodeURIComponent(csv);
    a.download = "Crystal_Report_Export.xls";
    a.click();
  };

  // ---------- helpers ----------
  const TYPES = { "1": "casual", "2": "sick", "3": "annual", casual: "casual", sick: "sick", annual: "annual" };
  const LABEL = { casual: "Casual", sick: "Sick", annual: "Annual" };
  // Ye codes balance se related nahi hain: jo code aaye wahi dropdown mein as-is select hoga
  const FREE_CODES = { "5": "Leave Without Pay", "21": "Social Security Leave", "9": "Compensatory Leave", "84": "Lay Off Leave", "20": "Official Visit", "10": "Paternity Leave" };
  const findFreeOption = (select, code) => {
    let name = FREE_CODES[code].toLowerCase();
    return [...select.options].find(o => o.value.trim() === code) ||
           [...select.options].find(o => o.text.trim().toLowerCase().includes(name));
  };

  const parseCSVLine = (line) => {
    let out = [], cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      let ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ",") { out.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  // Table ke headers se Casual / Sick / Annual balance columns ka index nikalo
  const getBalanceCols = () => {
    let best = null, bestScore = 0;
    document.querySelectorAll("table").forEach(t => {
      let heads = [...t.querySelectorAll("th")].map(h => h.innerText.trim().toLowerCase());
      let cols = {};
      heads.forEach((h, idx) => {
        ["casual", "sick", "annual"].forEach(k => {
          if (h.includes(k) && !(k in cols)) cols[k] = idx;
        });
      });
      let score = Object.keys(cols).length;
      if (score > bestScore) { best = cols; bestScore = score; }
    });
    return best || {};
  };

  const cellValue = (cell) => {
    if (!cell) return null;
    let inp = cell.querySelector("input,select");
    let v = (inp ? inp.value : cell.innerText).trim();
    let m = v.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  const readBalances = (row, cols) => {
    let b = {};
    ["casual", "sick", "annual"].forEach(k => {
      b[k] = k in cols ? cellValue(row.cells[cols[k]]) : null;
    });
    return b;
  };

  // select me leave type ka option: value 1/2/3 ya text Casual/Sick/Annual
  const findOption = (select, type, rawCode) => {
    let code = Object.keys(TYPES).find(k => TYPES[k] === type && /^\d$/.test(k));
    return [...select.options].find(o => {
      let v = o.value.trim().toLowerCase(), t = o.text.trim().toLowerCase();
      return v === code || v === String(rawCode).toLowerCase() || t.includes(type);
    });
  };

  // Date string -> day number (dd/mm/yyyy, dd-mm-yyyy, dd-Mon-yyyy, yyyy-mm-dd)
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const parseDay = (str) => {
    let m = String(str).trim().match(/^(\d{1,4})[\/\-\.\s]([A-Za-z]{3,}|\d{1,2})[\/\-\.\s](\d{2,4})/);
    if (!m) return null;
    let d, mo, y;
    if (m[1].length === 4) { y = +m[1]; mo = m[2]; d = +m[3]; }
    else { d = +m[1]; mo = m[2]; y = +m[3]; }
    mo = /^\d+$/.test(mo) ? +mo : MONTHS[mo.slice(0, 3).toLowerCase()];
    if (!mo) return null;
    if (y < 100) y += 2000;
    return Math.round(Date.UTC(y, mo - 1, d) / 86400000);
  };

  const MAX_CONSECUTIVE_CASUAL = 2;

  const fmt = (v) => (v === null || v === undefined ? "N/A" : v);

  const downloadReport = (report) => {
    let header = "Emp ID,Attendance Date,Leave Type,Remarks,Status,Casual Balance,Sick Balance,Annual Balance\n";
    let body = report.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    let a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + header + body], { type: "text/csv" }));
    a.download = "Leave_Progress_Report.csv";
    a.click();
  };

  // ---------- upload ----------
  up.onchange = e => {
    let f = e.target.files[0];
    if (!f) return;
    let r = new FileReader();
    r.onload = () => {
      let rows = r.result.split(/\r?\n/).slice(1)
        .filter(l => l.trim())
        .map(parseCSVLine)
        .filter(x => x[0] && x[1] && x[2]);

      // Employee + date order mein process karo taake "3rd consecutive" date ke hisaab se tay ho
      rows = rows.map((x, idx) => ({ x, idx }))
        .sort((a, b) => {
          if (a.x[0] !== b.x[0]) return a.idx - b.idx; // different employees: original order
          let da = parseDay(a.x[1]), db = parseDay(b.x[1]);
          return da !== null && db !== null && da !== db ? da - db : a.idx - b.idx;
        }).map(o => o.x);

      let total = rows.length, i = 0, report = [];
      let casualDays = {}; // employee id -> Set of day numbers jin par Casual "Ready to Post" hui
      let used = {}; // same employee ke multiple rows ka hisaab: "id|type" -> kitni leaves is upload me lag chuki
      let search = document.querySelector("input.form-control.form-control-sm[type='search']");
      let progressText = document.getElementById("progressText");
      let progressBar = document.getElementById("progressBar");
      if (!search) return alert("❌ Search box not found");

      let origAlert = window.alert, lastAlert = "";
      window.alert = (msg) => { lastAlert = String(msg || ""); };

      (function next() {
        if (i >= total) {
          window.alert = origAlert;
          progressText.innerText = "Completed ✔";
          progressBar.style.width = "100%";
          downloadReport(report);
          return;
        }

        let [id, date, leaveRaw, remark = ""] = rows[i];
        let code = leaveRaw.trim();
        let free = Object.prototype.hasOwnProperty.call(FREE_CODES, code);
        let type = free ? undefined : TYPES[code.toLowerCase()];
        let percent = Math.floor((i / total) * 100);
        progressText.innerText = `Processing ${i + 1} / ${total} (${percent}%)`;
        progressBar.style.width = percent + "%";
        i++;

        if (!type && !free) {
          report.push([id, date, leaveRaw, remark, "Invalid leave type (1/2/3 ya 5/9/10/20/21/84 use karein)", "-", "-", "-"]);
          return next();
        }

        lastAlert = "";
        search.value = id.trim();
        search.dispatchEvent(new Event("input"));

        setTimeout(() => {
          let target = [...document.querySelectorAll("table tbody tr")].find(row => {
            let t = row.innerText.replace(/\s+/g, " ").trim();
            return t.includes(id.trim()) && t.includes(date.trim());
          });

          let typeName = free ? FREE_CODES[code] : LABEL[type];

          if (!target) {
            report.push([id, date, typeName, remark, "Not Found", "-", "-", "-"]);
            return next();
          }

          // Balance-free leave codes: koi balance / policy check nahi, bas select karo
          if (free) {
            let colsF = getBalanceCols(), balF = readBalances(target, colsF);
            let cbF = target.querySelector("input[type='checkbox']");
            let sF = target.querySelector("select");
            let optF = sF ? findFreeOption(sF, code) : null;
            const pushF = (status) => report.push([id, date, typeName, remark, status, fmt(balF.casual), fmt(balF.sick), fmt(balF.annual)]);
            if (!sF || !optF) {
              pushF("Leave type '" + typeName + "' (" + code + ") not found in dropdown");
              return next();
            }
            cbF && !cbF.checked && cbF.click();
            sF.value = optF.value;
            sF.dispatchEvent(new Event("change", { bubbles: true }));
            let inpF = target.querySelectorAll("input[type='text']");
            if (inpF.length) {
              let lastF = inpF[inpF.length - 1];
              lastF.value = remark;
              lastF.dispatchEvent(new Event("input", { bubbles: true }));
            }
            setTimeout(() => {
              if (sF.value !== optF.value) {
                if (cbF && cbF.checked) cbF.click();
                pushF("Could not select leave type '" + typeName + "'");
              } else {
                pushF("Ready to Post");
              }
              next();
            }, 300);
            return;
          }

          // Policy: max 2 consecutive Casual leaves
          let day = parseDay(date);
          if (type === "casual" && day !== null) {
            let set = casualDays[id.trim()] || (casualDays[id.trim()] = new Set());
            let before = 0, after = 0;
            while (set.has(day - 1 - before)) before++;
            while (set.has(day + 1 + after)) after++;
            if (before + after + 1 > MAX_CONSECUTIVE_CASUAL) {
              let cols0 = getBalanceCols(), b0 = readBalances(target, cols0);
              report.push([id, date, typeName, remark,
                "Not Posted - As per policy, 3rd consecutive Casual leave cannot be posted",
                fmt(b0.casual), fmt(b0.sick), fmt(b0.annual)]);
              return next();
            }
          }

          let cols = getBalanceCols();
          let bal = readBalances(target, cols);
          let key = id.trim() + "|" + type;
          let already = used[key] || 0;
          let available = bal[type] === null ? null : bal[type] - already;

          let cb = target.querySelector("input[type='checkbox']");
          let s = target.querySelector("select");
          let opt = s ? findOption(s, type, leaveRaw) : null;

          const pushRow = (status) => report.push([id, date, typeName, remark, status, fmt(bal.casual), fmt(bal.sick), fmt(bal.annual)]);

          // 1) Balance verification
          if (available !== null && available <= 0) {
            pushRow("Zero leave balance");
            return next();
          }
          // select me option hi nahi => aksar balance zero hone ki wajah se
          if (!s || !opt) {
            pushRow("Zero leave balance");
            return next();
          }

          // 2) Check + select + remarks
          cb && !cb.checked && cb.click();
          s.value = opt.value;
          s.dispatchEvent(new Event("change", { bubbles: true }));

          let inp = target.querySelectorAll("input[type='text']");
          if (inp.length) {
            let last = inp[inp.length - 1];
            last.value = remark;
            last.dispatchEvent(new Event("input", { bubbles: true }));
          }

          setTimeout(() => {
            let failed = /balance|insufficient|not available|exceed/i.test(lastAlert) || s.value !== opt.value;
            if (failed) {
              if (cb && cb.checked) cb.click();
              pushRow("Zero leave balance");
            } else {
              used[key] = already + 1;
              if (type === "casual" && day !== null) casualDays[id.trim()].add(day);
              pushRow("Ready to Post");
            }
            next();
          }, 300);
        }, 300);
      })();
    };
    r.readAsText(f);
  };
  };
  // Naya tab "#cpauto" ke sath khula ho to CP panel khud khul jaye
  if (onCpPage() && location.hash === "#cpauto") {
    history.replaceState(null, "", location.pathname + location.search);
    wrap.remove();
    startCp();
  }
})();
