/* =========================================================
   ADMIN STOCKS MODULE
   Design-level stock, preparation queue and stock sorting
========================================================= */
let adminStocks=[];
let stockSavingKeys=new Set();

function stockKey(design){return String(design||"").trim().toLowerCase()}
function getStockRecord(design){
  const key=stockKey(design);
  return adminStocks.find(x=>stockKey(x.design)===key)||{design,stock:0,needToPrepare:0,image:""};
}
function stockDisplayQuantity(record){return Math.max(0,Number(record?.stock)||0)}
function stockNeedQuantity(record){return Math.max(0,Number(record?.needToPrepare)||0)}
function refreshStocks(){
  apiCall("listStocks",{},result=>{
    if(!result)return;
    adminStocks=Array.isArray(result.stocks)?result.stocks:[];
    renderStocks();
  });
}
function renderStocks(){
  const needBox=document.getElementById("needToPrepareGrid");
  const needEmpty=document.getElementById("needToPrepareEmpty");
  const availableBox=document.getElementById("availableStockGrid");
  const availableEmpty=document.getElementById("availableStockEmpty");
  if(!needBox||!availableBox)return;

  const q=(document.getElementById("stockSearch")?.value||"").toLowerCase().trim();
  const sort=document.getElementById("stockSort")?.value||"name";
  const records=designs.map(d=>{
    const r=getStockRecord(d.name);
    return {design:d.name,image:d.image,variants:d.variants||[],stock:stockDisplayQuantity(r),needToPrepare:stockNeedQuantity(r)};
  }).filter(x=>!q||x.design.toLowerCase().includes(q));

  const need=records.filter(x=>x.needToPrepare>0).sort((a,b)=>b.needToPrepare-a.needToPrepare||a.design.localeCompare(b.design));
  needBox.innerHTML=need.map(x=>stockNeedCardHTML(x)).join("");
  needBox.querySelectorAll("img[data-stock-image]").forEach(img=>setDesignImage(img,img.dataset.imageSrc||""));
  needEmpty.style.display=need.length?"none":"block";

  const available=records.slice().sort((a,b)=>{
    if(sort==="stockAsc")return a.stock-b.stock||a.design.localeCompare(b.design);
    if(sort==="stockDesc")return b.stock-a.stock||a.design.localeCompare(b.design);
    return a.design.localeCompare(b.design);
  });
  availableBox.innerHTML=available.map(x=>stockCardHTML(x)).join("");
  availableBox.querySelectorAll("img[data-stock-image]").forEach(img=>setDesignImage(img,img.dataset.imageSrc||""));
  availableEmpty.style.display=available.length?"none":"block";
}
function stockNeedCardHTML(x){
  return `<div class="stock-need-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||"")}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name">${adminEsc(x.design)}</div>
    <div class="stock-need-number">Prepare ${x.needToPrepare}</div>
  </div>`;
}
function stockCardHTML(x){
  const variants=x.variants.map(v=>`${adminEsc(v.size)} — ${adminMoney(v.price)}`).join("<br>");
  const key=stockKey(x.design);
  return `<div class="stock-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||"")}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name" title="${adminEsc(x.design)}">${adminEsc(x.design)}</div>
    <div class="stock-variants">${variants||"No variants"}</div>
    <div class="stock-quantity-label">Available Stock</div>
    <div class="stock-quantity-control">
      <button type="button" onclick="changeStockQuantity('${adminEsc(x.design)}',-1,event)">−</button>
      <input id="stock-${encodeURIComponent(key)}" type="number" min="0" step="1" value="${x.stock}" onchange="saveStockQuantity('${adminEsc(x.design)}',this.value)">
      <button type="button" onclick="changeStockQuantity('${adminEsc(x.design)}',1,event)">+</button>
    </div>
    ${x.needToPrepare>0?`<div class="stock-card-need">Need to prepare: ${x.needToPrepare}</div>`:""}
  </div>`;
}
function changeStockQuantity(design,delta,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const input=document.getElementById("stock-"+encodeURIComponent(stockKey(design)));
  if(!input)return;
  const next=Math.max(0,(Number(input.value)||0)+delta);
  input.value=String(Math.round(next));
  saveStockQuantity(design,next);
}
function saveStockQuantity(design,value){
  const stock=Math.max(0,Math.floor(Number(value)||0));
  const key=stockKey(design);
  if(stockSavingKeys.has(key))return;
  stockSavingKeys.add(key);
  const input=document.getElementById("stock-"+encodeURIComponent(key));
  if(input)input.disabled=true;
  apiCall("updateStock",{stock:{design:String(design),stock}},(result,error)=>{
    stockSavingKeys.delete(key);
    if(input)input.disabled=false;
    if(error||!result)return;
    adminStocks=Array.isArray(result.stocks)?result.stocks:adminStocks;
    renderStocks();
  });
}
