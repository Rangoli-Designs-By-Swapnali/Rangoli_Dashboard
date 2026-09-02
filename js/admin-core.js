/* =========================================================
   ADMIN CORE MODULE
   Google Sheets API + authentication + navigation + shared state
========================================================= */
/* =========================================================
   ADMIN DASHBOARD — GOOGLE SHEETS + APPS SCRIPT
========================================================= */
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbxf_MeOG9cfDho7xNcagWAbj9zXOlwuXWuC6JHH6K6-R-aVdMu-Th9Jbt2MgCtOWfE7qw/exec";
const ADMIN_API_KEY = "ee0257ba72c1487e9c0ed77a0deeeb20";
const LOCAL_DEV_BYPASS_ADMIN = ["localhost", "127.0.0.1"].includes(location.hostname);

let adminOrders = [];
let adminStocks = [];
let adminSettings = {businessName:"Swapnali's Rangoli",footer:"Thank you for your order! 🌸"};
let newOrderItems = [];
let manualSelectionSavedCart = null;
let manualItemSelectionActive = false;
let itemSelectionMode = "";
let editOrderItemsDraft = [];
let selectedInvoiceOrderId = "";
let invoicePage = 1;
const INVOICE_PAGE_SIZE = 6;
let adminLoading = false;

function adminMoney(n){return `₹${Number(n||0).toLocaleString("en-IN")}`}
function adminEsc(v){return escapeHtml(v==null?"":String(v));}

function localDateKey(dateLike){
  const d=dateLike instanceof Date?dateLike:new Date(dateLike);
  if(isNaN(d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function orderDateKey(o){
  if(o && o.orderDate){
    const m=String(o.orderDate).match(/^(\d{4}-\d{2}-\d{2})/);
    if(m)return m[1];
  }
  return localDateKey(o&&o.createdAt);
}
function dateInputValue(v){
  if(!v)return "";
  const m=String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  if(m)return m[1];
  return localDateKey(v);
}
function prettyDate(dateKey){
  if(!dateKey)return "—";
  const d=new Date(dateKey+"T12:00:00");
  if(isNaN(d))return dateKey;
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function dispatchRange(dateKey){
  if(!dateKey)return "—";
  const d=new Date(dateKey+"T12:00:00");
  if(isNaN(d))return "—";
  const a=new Date(d); a.setDate(a.getDate()+10);
  const b=new Date(d); b.setDate(b.getDate()+12);
  const opts={day:"2-digit",month:"short",year:"numeric"};
  return `${a.toLocaleDateString("en-IN",opts)} – ${b.toLocaleDateString("en-IN",opts)}`;
}
function monthLabel(key){
  if(!key)return "All Months";
  const d=new Date(key+"-01T12:00:00");
  return isNaN(d)?key:d.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
}
function adminDate(iso){
  if(!iso)return "—";
  try{return new Date(iso).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch(e){return iso}
}
function orderRemaining(o){
  if(!o)return 0;
  if(String(o.payment||"")==="Paid")return 0;
  return Math.max(0,Number(o.total||0)-Number(o.advanceAmount||0));
}
function orderVisualClass(o){
  if(!o)return "";
  if(String(o.payment||"")!=="Paid" && orderRemaining(o)>0)return "order-row-pending";
  if(String(o.status||"")==="Delivered" && String(o.payment||"")==="Paid")return "order-row-paid";
  if(!["Delivered","Cancelled"].includes(String(o.status||"")))return "order-row-upcoming";
  return "";
}
function makeOrderNo(){return ""}

function apiCall(action, params={}, callback){
  if(!ADMIN_API_URL || ADMIN_API_URL.includes("PASTE_YOUR_")){
    alert("Google Sheets connection is not configured yet. Paste your Apps Script Web App URL and API key in the HTML.");
    return;
  }
  const cbName="swapnaliApiCb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  const script=document.createElement("script");
  const query=new URLSearchParams();
  query.set("action",action); query.set("key",ADMIN_API_KEY); query.set("callback",cbName);
  Object.keys(params||{}).forEach(k=>query.set(k,typeof params[k]==="string"?params[k]:JSON.stringify(params[k])));
  let finished=false;
  const cleanup=()=>{finished=true;try{delete window[cbName]}catch(e){}script.remove()};
  window[cbName]=(result)=>{if(finished)return;cleanup();if(result&&result.ok===false){alert(result.error||"Google Sheets request failed.");if(callback)callback(null,result);return}if(callback)callback(result||{},null)};
  script.onerror=()=>{if(finished)return;cleanup();alert("Could not connect to Google Sheets. Check the Apps Script Web App URL, deployment access and API key.");if(callback)callback(null,{error:"Connection failed"})};
  script.src=ADMIN_API_URL+(ADMIN_API_URL.includes("?")?"&":"?")+query.toString();
  document.head.appendChild(script);
}

function requestAdminAccess(){
  if(LOCAL_DEV_BYPASS_ADMIN){
    openAdmin();
    return;
  }
  document.getElementById("adminPinInput").value="";
  document.getElementById("pinModal").classList.add("show");
  setTimeout(()=>document.getElementById("adminPinInput").focus(),80);
}
function hidePinModal(){document.getElementById("pinModal").classList.remove("show")}
function checkAdminPin(){
  const pin=document.getElementById("adminPinInput").value.trim();
  if(!pin){alert("Enter your admin PIN.");return}
  apiCall("verifyPin",{pin},result=>{
    if(result&&result.valid){hidePinModal();openAdmin()}else alert("Incorrect admin PIN.");
  });
}
function getAdminTabFromHash(){
  const hash=String(location.hash||"");
  if(hash==="#admin" || hash==="#admin/") return "dashboard";
  const match=hash.match(/^#admin\/([a-z0-9_-]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function setAdminTabHash(tab){
  const safeTabs=["dashboard","orders","stocks","neworder","invoice","settings"];
  const safe=safeTabs.includes(tab) ? tab : "dashboard";
  const target=safe==="dashboard" ? "#admin" : "#admin/"+safe;
  if(location.hash!==target){
    history.replaceState(null,"",location.pathname+location.search+target);
  }
}

function openAdmin(){
  document.getElementById("adminScreen").classList.add("show");
  document.body.style.overflow="hidden";
  const requestedTab=getAdminTabFromHash() || "dashboard";
  refreshAdmin();
  adminTab(requestedTab,false);
}

function closeAdmin(){
  document.getElementById("adminScreen").classList.remove("show");
  document.body.style.overflow="";
  if(location.hash.indexOf("#admin")===0){
    history.replaceState(null,"",location.pathname+location.search);
  }
}

function adminTab(tab,syncUrl=true){
  const safeTabs=["dashboard","orders","stocks","neworder","invoice","settings"];
  if(!safeTabs.includes(tab)) tab="dashboard";

  document.querySelectorAll(".admin-panel").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".admin-tab-btn").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));
  const p=document.getElementById("admin-"+tab);if(p)p.classList.add("active");

  if(syncUrl)setAdminTabHash(tab);

  if(tab==="dashboard")renderAdminDashboard();
  if(tab==="orders"){populateMonthFilters();renderOrdersTable()}
  if(tab==="stocks"){refreshStocks()}
  if(tab==="neworder"){
    if(document.getElementById("newOrderDate")&&!document.getElementById("newOrderDate").value)
      document.getElementById("newOrderDate").value=localDateKey(new Date());
    renderNewOrderItems();
  }
  if(tab==="invoice"){populateInvoiceSelect();renderInvoiceCards()}
  if(tab==="settings")loadAdminSettingsForm();
}
function refreshAdmin(){
  if(adminLoading)return; adminLoading=true;
  apiCall("listOrders",{},result=>{adminLoading=false;if(result){adminOrders=Array.isArray(result.orders)?result.orders:[];adminSettings=result.settings||adminSettings;adminStocks=Array.isArray(result.stocks)?result.stocks:adminStocks;populateMonthFilters();populateDashboardPeriod();renderAdminDashboard();renderOrdersTable();populateInvoiceSelect();renderInvoiceCards();loadAdminSettingsForm();}});
}
function getMonthKeys(){const set=new Set();adminOrders.forEach(o=>{const k=orderDateKey(o);if(k)set.add(k.slice(0,7))});if(!set.size)set.add(localDateKey(new Date()).slice(0,7));return Array.from(set).sort().reverse()}
function getYearKeys(){const set=new Set();adminOrders.forEach(o=>{const k=orderDateKey(o);if(k)set.add(k.slice(0,4))});set.add(String(new Date().getFullYear()));return Array.from(set).sort().reverse()}
function populateDashboardPeriod(){const el=document.getElementById("dashboardPeriod");if(!el)return;const old=el.value||"all";const months=getMonthKeys(),years=getYearKeys();el.innerHTML='<option value="all">All Time</option><option value="month:'+localDateKey(new Date()).slice(0,7)+'">Monthly — Current</option><option value="year:'+new Date().getFullYear()+'">Yearly — Current</option><option disabled>──────────</option>'+months.map(k=>`<option value="month:${k}">Monthly — ${adminEsc(monthLabel(k))}</option>`).join("")+years.map(y=>`<option value="year:${y}">Yearly — ${y}</option>`).join("");if(Array.from(el.options).some(o=>o.value===old))el.value=old;else el.value="all"}
function setDashboardPeriod(v){renderAdminDashboard()}
function fillMonthSelect(id,allText){const el=document.getElementById(id);if(!el)return;const current=el.value;const keys=getMonthKeys();el.innerHTML=`<option value="">${allText||"All Months"}</option>`+keys.map(k=>`<option value="${k}">${adminEsc(monthLabel(k))}</option>`).join("");if(keys.includes(current))el.value=current}
function populateMonthFilters(){fillMonthSelect("orderMonthFilter","All months");fillMonthSelect("invoiceMonthFilter","All months");populateDashboardPeriod()}
function dashboardScopedOrders(){const v=document.getElementById("dashboardPeriod")?.value||"all";if(v==="all")return adminOrders.slice();if(v.startsWith("month:"))return filterByMonth(adminOrders,v.slice(6));if(v.startsWith("year:")){const y=v.slice(5);return adminOrders.filter(o=>orderDateKey(o).slice(0,4)===y)}return adminOrders.slice()}
function dashboardPeriodLabel(){const v=document.getElementById("dashboardPeriod")?.value||"all";if(v==="all")return "All time";if(v.startsWith("month:"))return monthLabel(v.slice(6));if(v.startsWith("year:"))return v.slice(5);return "All time"}
function renderAdminDashboard(){
  populateDashboardPeriod();
  const scoped=dashboardScopedOrders();
  const active=scoped.filter(o=>String(o.status||"")!=="Cancelled");
  const totalOrders=scoped.length, sales=active.reduce((a,o)=>a+Number(o.total||0),0), advance=active.reduce((a,o)=>a+Number(o.advanceAmount||0),0), balance=Math.max(0,sales-advance), units=active.reduce((a,o)=>a+(o.items||[]).reduce((b,i)=>b+Number(i.quantity||0),0),0);
  document.getElementById("aTotalOrders").textContent=totalOrders;document.getElementById("aSales").textContent=adminMoney(sales);document.getElementById("aAdvance").textContent=adminMoney(advance);document.getElementById("aBalance").textContent=adminMoney(balance);document.getElementById("aUnits").textContent=units;
  const label=dashboardPeriodLabel();document.getElementById("aOrdersNote").textContent=label+" orders";document.getElementById("aSalesNote").textContent=label+" final value";
  const statuses=["New","Confirmed","Dispatched","Delivered","Cancelled"];
  document.getElementById("statusSummary").innerHTML=statuses.map(st=>{const count=scoped.filter(o=>o.status===st).length;const disabled=count===0;const click=disabled?"":` onclick="openStatusInvoices('${st}')"`;const title=disabled?"No orders in this status":`View ${count} ${st} order${count===1?"":"s"}`;return `<div class="status-card status-${st}${disabled?" disabled":""}"${click} title="${title}"><span class="status-pill status-${st}">${st}</span><span class="status-count">${count}</span></div>`}).join("");
  const counts={};active.forEach(o=>(o.items||[]).forEach(i=>{const k=i.design+" — "+i.size;if(!counts[k])counts[k]={qty:0,image:i.image,design:i.design,size:i.size};counts[k].qty+=Number(i.quantity||0)}));
  const top=Object.values(counts).sort((a,b)=>b.qty-a.qty).slice(0,30);
  document.getElementById("topDesigns").innerHTML=top.length?top.map((x,idx)=>`<div class="top-design" title="${adminEsc(x.design)} — ${adminEsc(x.size)}" onclick="openTopDesignInvoice('${adminEsc(x.design)}','${adminEsc(x.size)}')"><img data-design-image="1" data-image-src="${adminEsc(x.image||'')}" alt=""><div class="top-design-name">${adminEsc(x.design)} · ${adminEsc(x.size)}</div><div class="top-design-count">${x.qty}</div></div>`).join(""):"<div class='empty-admin' style='grid-column:1/-1'>No sales for this period.</div>";
  document.querySelectorAll('#topDesigns img[data-design-image]').forEach(img=>setDesignImage(img,img.dataset.imageSrc||''));
  const upcoming=adminOrders.filter(o=>!['Delivered','Cancelled'].includes(o.status)).sort((a,b)=>orderDateKey(a).localeCompare(orderDateKey(b))).slice(0,9);document.getElementById("upcomingOrders").innerHTML=renderUpcomingOrders(upcoming);
  const recent=adminOrders.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);document.getElementById("recentOrders").innerHTML=renderOrderTableHTML(recent,false)||"<div class='empty-admin'>No orders recorded yet.</div>";
}
function openStatusInvoices(status){const list=adminOrders.filter(o=>o.status===status);if(!list.length)return;selectedInvoiceOrderId="";adminTab("invoice");setTimeout(()=>{const pm=document.getElementById("invoicePaymentFilter");if(pm)pm.value="";const sel=document.getElementById("invoiceOrderSelect");if(sel)sel.value="";const box=document.getElementById("invoicePreview");if(box)box.innerHTML="<div class='empty-admin'>Select an invoice card to view invoice details.</div>";renderInvoiceCards(list);},0)}
function openTopDesignInvoice(design,size){const o=dashboardScopedOrders().find(o=>o.status!=="Cancelled"&&(o.items||[]).some(i=>i.design===design&&i.size===size));if(o)viewInvoice(o.id);else alert("No invoice found for this design in the selected period.")}
function renderUpcomingOrders(list){
  if(!list.length)return "<div class='empty-admin'>No upcoming orders.</div>";
  return `<div class="upcoming-grid">${list.map(o=>{
    const dk=orderDateKey(o),due=orderRemaining(o),visual=orderVisualClass(o);
    const thumbs=(o.items||[]).slice(0,4).map(i=>i.image?`<img src="${adminEsc(resolveImageUrl(i.image))}" alt="">`:"").join("");
    const more=(o.items||[]).length>4?`<span class="upcoming-more">+${o.items.length-4}</span>`:"";
    return `<div class="upcoming-card status-${adminEsc(o.status)} ${visual}" onclick="viewInvoice('${adminEsc(o.id)}')"><div class="upcoming-head"><div><div class="upcoming-order-no">${adminEsc(o.orderNo)}</div><div class="upcoming-customer">${adminEsc(o.customerName||'Walk-in')}</div><div class="order-payment">Payment: ${adminEsc(o.payment||'Pending')}</div>${due>0?`<div class="remaining-amount">Remaining: ${adminMoney(due)}</div>`:""}</div><span class="status-pill status-${adminEsc(o.status)}">${adminEsc(o.status)}</span></div><div class="upcoming-thumbs">${thumbs}${more}</div><div class="upcoming-date">Dispatch: ${adminEsc(dispatchRange(dk))}</div><div class="upcoming-total">${adminMoney(o.total)}</div></div>`
  }).join("")}</div>`
}
function filterByMonth(list,key){if(!key)return list.slice();return list.filter(o=>orderDateKey(o).slice(0,7)===key)}
