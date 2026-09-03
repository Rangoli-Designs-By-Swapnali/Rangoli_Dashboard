/* =========================================================
   ADMIN STOCKS MODULE
   Variant-level stock, preparation queue and stock sorting
========================================================= */
let adminStocks=[];
const stockSaveQueues={};

function stockKey(design,size){
  return `${String(design||'').trim().toLowerCase()}||${String(size||'').trim().toLowerCase()}`;
}
function getStockRecord(design,size){
  const key=stockKey(design,size);
  return adminStocks.find(x=>stockKey(x.design,x.size)===key)||{design,size,stock:0,needToPrepare:0,image:""};
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
function naturalDesignCompare(a,b){
  const aa=String(a||'').trim(),bb=String(b||'').trim();
  const ma=aa.match(/^(.*?)(\d+)(?:-([A-Za-z]+))?$/), mb=bb.match(/^(.*?)(\d+)(?:-([A-Za-z]+))?$/);
  if(ma&&mb){
    const prefix=ma[1].localeCompare(mb[1],undefined,{sensitivity:'base'});
    if(prefix!==0)return prefix;
    const num=Number(ma[2])-Number(mb[2]);
    if(num!==0)return num;
    const sa=(ma[3]||'').toUpperCase(),sb=(mb[3]||'').toUpperCase();
    if(!sa&&!sb)return 0;
    if(!sa)return -1;
    if(!sb)return 1;
    return sa.localeCompare(sb,undefined,{numeric:true,sensitivity:'base'});
  }
  return aa.localeCompare(bb,undefined,{numeric:true,sensitivity:'base'});
}
function renderStocks(){
  const needBox=document.getElementById("needToPrepareGrid");
  const needEmpty=document.getElementById("needToPrepareEmpty");
  const availableBox=document.getElementById("availableStockGrid");
  const availableEmpty=document.getElementById("availableStockEmpty");
  if(!needBox||!availableBox)return;

  const q=(document.getElementById("stockSearch")?.value||"").toLowerCase().trim();
  const sort=document.getElementById("stockSort")?.value||"name";
  const filter=document.getElementById("stockFilter")?.value||"all";

  /* designs.json is the source of truth for which designs and sizes exist. */
  let records=[];
  (Array.isArray(designs)?designs:[]).forEach(d=>{
    (d.variants||[]).forEach(v=>{
      const r=getStockRecord(d.name,v.size);
      records.push({design:d.name,size:v.size,price:Number(v.price)||0,image:d.image,stock:stockDisplayQuantity(r),needToPrepare:stockNeedQuantity(r)});
    });
  });

  records=records.filter(x=>!q||x.design.toLowerCase().includes(q)||String(x.size).toLowerCase().includes(q));
  if(filter==='available')records=records.filter(x=>x.stock>0);
  if(filter==='zero')records=records.filter(x=>x.stock<=0);
  if(filter==='need')records=records.filter(x=>x.needToPrepare>0);

  const need=records.filter(x=>x.needToPrepare>0).sort((a,b)=>b.needToPrepare-a.needToPrepare||naturalDesignCompare(a.design,b.design)||String(a.size).localeCompare(String(b.size),undefined,{numeric:true}));
  needBox.innerHTML=need.map(x=>stockNeedCardHTML(x)).join("");
  needBox.querySelectorAll("img[data-stock-image]").forEach(img=>setDesignImage(img,img.dataset.imageSrc||""));
  needEmpty.style.display=need.length?"none":"block";

  const available=records.slice().sort((a,b)=>{
    if(sort==='stockAsc')return a.stock-b.stock||naturalDesignCompare(a.design,b.design)||String(a.size).localeCompare(String(b.size),undefined,{numeric:true});
    if(sort==='stockDesc')return b.stock-a.stock||naturalDesignCompare(a.design,b.design)||String(a.size).localeCompare(String(b.size),undefined,{numeric:true});
    if(sort==='priceAsc')return a.price-b.price||naturalDesignCompare(a.design,b.design);
    if(sort==='priceDesc')return b.price-a.price||naturalDesignCompare(a.design,b.design);
    return naturalDesignCompare(a.design,b.design)||String(a.size).localeCompare(String(b.size),undefined,{numeric:true});
  });
  availableBox.innerHTML=available.map(x=>stockCardHTML(x)).join("");
  availableBox.querySelectorAll("img[data-stock-image]").forEach(img=>setDesignImage(img,img.dataset.imageSrc||""));
  availableEmpty.style.display=available.length?"none":"block";
}
function stockNeedCardHTML(x){
  return `<div class="stock-need-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||"")}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name">${adminEsc(x.design)}</div>
    <div class="stock-variants">${adminEsc(x.size)} — ${adminMoney(x.price)}</div>
    <div class="stock-need-number">Prepare ${x.needToPrepare}</div>
  </div>`;
}
function stockCardHTML(x){
  const key=encodeURIComponent(stockKey(x.design,x.size));
  return `<div class="stock-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||"")}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name" title="${adminEsc(x.design)}">${adminEsc(x.design)}</div>
    <div class="stock-variants">${adminEsc(x.size)} — ${adminMoney(x.price)}</div>
    <div class="stock-quantity-label">Available Stock</div>
    <div class="stock-quantity-control">
      <button type="button" onclick="changeStockQuantity('${adminEsc(x.design)}','${adminEsc(x.size)}',-1,event)">−</button>
      <input id="stock-${key}" type="number" min="0" step="1" value="${x.stock}" onchange="saveStockQuantity('${adminEsc(x.design)}','${adminEsc(x.size)}',this.value)">
      <button type="button" onclick="changeStockQuantity('${adminEsc(x.design)}','${adminEsc(x.size)}',1,event)">+</button>
    </div>
    ${x.needToPrepare>0?`<div class="stock-card-need">Need to prepare: ${x.needToPrepare}</div>`:""}
  </div>`;
}
function changeStockQuantity(design,size,delta,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const input=document.getElementById("stock-"+encodeURIComponent(stockKey(design,size)));
  if(!input)return;
  const next=Math.max(0,Math.floor(Number(input.value)||0)+delta);
  input.value=String(next);
  saveStockQuantity(design,size,next);
}
function saveStockQuantity(design,size,value){
  const stock=Math.max(0,Math.floor(Number(value)||0));
  const key=stockKey(design,size);
  const input=document.getElementById("stock-"+encodeURIComponent(key));
  if(input)input.value=String(stock);

  /* Queue rapid clicks so no + / - click is lost while a request is in flight. */
  stockSaveQueues[key]=stock;
  if(stockSaveQueues[key+"__busy"])return;
  stockSaveQueues[key+"__busy"]=true;

  const sendNext=()=>{
    if(!(key in stockSaveQueues)){
      stockSaveQueues[key+"__busy"]=false;
      return;
    }
    const next=stockSaveQueues[key];
    delete stockSaveQueues[key];
    apiCall("updateStock",{stock:{design:String(design),size:String(size),stock:next,image:""}},(result,error)=>{
      if(error||!result){
        stockSaveQueues[key]=next;
        stockSaveQueues[key+"__busy"]=false;
        return;
      }
      adminStocks=Array.isArray(result.stocks)?result.stocks:adminStocks;
      /* If another click happened while saving, send that newer value first. */
      if(key in stockSaveQueues){sendNext();return;}
      stockSaveQueues[key+"__busy"]=false;
      renderStocks();
    });
  };
  sendNext();
}
function startAddStock(){
  if(!Array.isArray(designs)||!designs.length){
    alert("Designs are still loading. Please wait a moment and try again.");
    return;
  }
  stockSelectionMode=true;
  stockSelection={};
  manualSelectionSavedCart=copyCart(cart);
  Object.keys(cart).forEach(k=>delete cart[k]);
  renderDesigns();
  updateStockSelectionBar();
  document.getElementById("adminScreen")?.classList.remove("show");
  document.body.style.overflow="";
  document.body.classList.add("manual-selection-active");
  document.getElementById("manualSelectionBar")?.classList.add("show");
  const confirm=document.getElementById("selectionConfirmBtn");
  if(confirm)confirm.innerHTML='✓ Add Stock <span id="manualSelectionTotal">0 items</span>';
  window.scrollTo({top:0,behavior:"auto"});
}
function cancelStockSelection(){
  if(!stockSelectionMode)return;
  const saved=manualSelectionSavedCart||{};
  stockSelectionMode=false;stockSelection={};manualSelectionSavedCart=null;
  Object.keys(cart).forEach(k=>delete cart[k]);
  Object.keys(saved).forEach(k=>cart[k]=saved[k]);
  document.body.classList.remove("manual-selection-active");
  document.getElementById("manualSelectionBar")?.classList.remove("show");
  renderDesigns();updateCart();
  document.getElementById("adminScreen")?.classList.add("show");
  document.body.style.overflow="hidden";
  adminTab("stocks");
}
function selectedStockItems(){
  const items=[];
  (Array.isArray(designs)?designs:[]).forEach(d=>(d.variants||[]).forEach((v,vi)=>{
    const qty=Number(stockSelection[getCartKey(d.id,vi)]||0);
    if(qty>0)items.push({design:d.name,size:v.size,price:Number(v.price)||0,quantity:qty,image:d.image,designId:d.id,variantIndex:vi});
  }));
  return items;
}
function confirmStockSelection(){
  if(!stockSelectionMode)return;
  const items=selectedStockItems();
  if(!items.length){alert("Select at least one size and quantity to add stock.");return}
  const btn=document.getElementById("selectionConfirmBtn");
  if(btn)btn.disabled=true;
  apiCall("addStock",{items},(result,error)=>{
    if(btn)btn.disabled=false;
    if(error||!result)return;
    stockSelectionMode=false;stockSelection={};manualSelectionSavedCart=null;
    Object.keys(cart).forEach(k=>delete cart[k]);
    document.body.classList.remove("manual-selection-active");
    document.getElementById("manualSelectionBar")?.classList.remove("show");
    const confirm=document.getElementById("selectionConfirmBtn");
    if(confirm)confirm.innerHTML='✓ Add Items <span id="manualSelectionTotal">₹0</span>';
    document.getElementById("adminScreen")?.classList.add("show");
    document.body.style.overflow="hidden";
    refreshAdmin();
    adminTab("stocks");
  });
}
