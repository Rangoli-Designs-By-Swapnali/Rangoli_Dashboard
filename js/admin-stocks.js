/* =========================================================
   ADMIN STOCKS MODULE
   Variant-level stock, preparation queue, search, sort and filter
========================================================= */
let stockSavingKeys=new Set();
let stockPendingValues={};
let stockSaveTimers={};

function stockKey(design,size){return (String(design||'').trim().toLowerCase()+'||'+String(size||'').trim().toLowerCase())}
function getStockRecord(design,size){
  const key=stockKey(design,size);
  return (adminStocks||[]).find(x=>stockKey(x.design,x.size)===key)||{design,size,stock:0,needToPrepare:0,image:''};
}
function stockDisplayQuantity(record){return Math.max(0,Number(record?.stock)||0)}
function stockNeedQuantity(record){return Math.max(0,Number(record?.needToPrepare)||0)}
function stockLowestPrice(variants){
  const prices=(variants||[]).map(v=>Number(v.price)).filter(Number.isFinite);
  return prices.length?Math.min(...prices):Number.POSITIVE_INFINITY;
}
function stockVariantRows(design){
  return (design.variants||[]).map((variant,index)=>{
    const record=getStockRecord(design.name,variant.size);
    return {design:design.name,size:String(variant.size||'Standard'),price:Number(variant.price)||0,image:design.image||record.image||'',stock:stockDisplayQuantity(record),needToPrepare:stockNeedQuantity(record),variantIndex:index};
  });
}
function refreshStocks(){
  apiCall('listStocks',{},result=>{
    if(!result)return;
    adminStocks=Array.isArray(result.stocks)?result.stocks:[];
    renderStocks();
  });
}
function renderStocks(){
  const needBox=document.getElementById('needToPrepareGrid');
  const needEmpty=document.getElementById('needToPrepareEmpty');
  const availableBox=document.getElementById('availableStockGrid');
  const availableEmpty=document.getElementById('availableStockEmpty');
  if(!needBox||!availableBox)return;
  const q=(document.getElementById('stockSearch')?.value||'').toLowerCase().trim();
  const sort=document.getElementById('stockSort')?.value||'name';
  const filter=document.getElementById('stockFilter')?.value||'all';
  const records=[];
  (Array.isArray(designs)?designs:[]).forEach(d=>{
    if(q&&!String(d.name||'').toLowerCase().includes(q))return;
    (Array.isArray(d.variants)?d.variants:[]).forEach((variant,index)=>{
      const size=String(variant.size||'Standard').trim();
      const record=getStockRecord(d.name,size);
      records.push({design:d.name,size,price:Number(variant.price)||0,image:d.image||record.image||'',stock:stockDisplayQuantity(record),needToPrepare:stockNeedQuantity(record),variantIndex:index,designObject:d});
    });
  });
  const need=records.filter(x=>x.needToPrepare>0);
  let available=records.slice();
  if(filter==='available')available=available.filter(x=>x.stock>0);
  if(filter==='zero')available=available.filter(x=>x.stock<=0);
  if(filter==='need')available=available.filter(x=>x.needToPrepare>0);
  need.sort((a,b)=>b.needToPrepare-a.needToPrepare||a.design.localeCompare(b.design)||a.size.localeCompare(b.size));
  available.sort((a,b)=>{
    if(sort==='stockAsc')return a.stock-b.stock||a.design.localeCompare(b.design)||a.size.localeCompare(b.size);
    if(sort==='stockDesc')return b.stock-a.stock||a.design.localeCompare(b.design)||a.size.localeCompare(b.size);
    if(sort==='priceAsc')return a.price-b.price||a.design.localeCompare(b.design)||a.size.localeCompare(b.size);
    if(sort==='priceDesc')return b.price-a.price||a.design.localeCompare(b.design)||a.size.localeCompare(b.size);
    return a.design.localeCompare(b.design)||a.size.localeCompare(b.size);
  });
  needBox.innerHTML=need.length?need.map(stockNeedCardHTML).join(''):'';
  availableBox.innerHTML=available.length?available.map(stockCardHTML).join(''):'';
  needBox.querySelectorAll('img[data-stock-image]').forEach(img=>setDesignImage(img,img.dataset.imageSrc||''));
  availableBox.querySelectorAll('img[data-stock-image]').forEach(img=>setDesignImage(img,img.dataset.imageSrc||''));
  if(needEmpty)needEmpty.style.display=need.length?'none':'block';
  if(availableEmpty)availableEmpty.style.display=available.length?'none':'block';
}
function stockNeedCardHTML(x){
  return `<div class="stock-need-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||'')}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name" title="${adminEsc(x.design)}">${adminEsc(x.design)}</div>
    <div class="stock-need-number">${x.size?`Size: ${adminEsc(x.size)} · `:''}Prepare ${x.needToPrepare}</div>
  </div>`;
}
function stockCardHTML(x){
  const key=stockKey(x.design,x.size);
  const inputId='stock-'+encodeURIComponent(key);
  return `<div class="stock-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||'')}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name" title="${adminEsc(x.design)}">${adminEsc(x.design)}</div>
    <div class="stock-variants">${x.size?`Size: ${adminEsc(x.size)} — ${adminMoney(x.price)}`:'Size not specified'}</div>
    <div class="stock-quantity-label">Available Stock</div>
    <div class="stock-quantity-control">
      <button type="button" onclick="changeStockQuantity(${JSON.stringify(x.design)},${JSON.stringify(x.size)},-1,event)">−</button>
      <input id="${inputId}" type="number" min="0" step="1" value="${x.stock}" onchange="saveStockQuantity(${JSON.stringify(x.design)},${JSON.stringify(x.size)},this.value)">
      <button type="button" onclick="changeStockQuantity(${JSON.stringify(x.design)},${JSON.stringify(x.size)},1,event)">+</button>
    </div>
    ${x.needToPrepare>0?`<div class="stock-card-need">Need to prepare: ${x.needToPrepare}</div>`:''}
  </div>`;
}
function changeStockQuantity(design,size,delta,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const key=stockKey(design,size);
  const input=document.getElementById('stock-'+encodeURIComponent(key));
  const current=Object.prototype.hasOwnProperty.call(stockPendingValues,key)?Number(stockPendingValues[key]):(input?Number(input.value):stockDisplayQuantity(getStockRecord(design,size)));
  queueStockSave(design,size,Math.max(0,Math.floor(Number(current)||0)+delta));
}
function saveStockQuantity(design,size,value){queueStockSave(design,size,Math.max(0,Math.floor(Number(value)||0)))}
function queueStockSave(design,size,stock){
  const key=stockKey(design,size);
  const desired=Math.max(0,Math.floor(Number(stock)||0));
  stockPendingValues[key]=desired;
  const input=document.getElementById('stock-'+encodeURIComponent(key));
  if(input)input.value=String(desired);
  const existing=adminStocks.find(x=>stockKey(x.design,x.size)===key);
  if(existing)existing.stock=desired;
  else{const d=(Array.isArray(designs)?designs:[]).find(x=>stockKey(x.name,'')===stockKey(design,''));adminStocks.push({design:String(design),size:String(size||''),image:d?.image||'',stock:desired,needToPrepare:0})}
  if(stockSaveTimers[key])clearTimeout(stockSaveTimers[key]);
  stockSaveTimers[key]=setTimeout(()=>flushStockSave(design,size),180);
}
function flushStockSave(design,size){
  const key=stockKey(design,size);
  delete stockSaveTimers[key];
  if(stockSavingKeys.has(key))return;
  const stock=Math.max(0,Math.floor(Number(stockPendingValues[key])||0));
  stockSavingKeys.add(key);
  const input=document.getElementById('stock-'+encodeURIComponent(key));
  if(input)input.disabled=true;
  const d=(Array.isArray(designs)?designs:[]).find(x=>stockKey(x.name,'')===stockKey(design,''));
  apiCall('updateStock',{stock:{design:String(design),size:String(size||''),image:d?.image||'',stock}},(result,error)=>{
    stockSavingKeys.delete(key);
    if(input)input.disabled=false;
    if(error||!result)return;
    const latest=stockPendingValues[key];
    adminStocks=Array.isArray(result.stocks)?result.stocks:adminStocks;
    if(latest!==undefined && Number(latest)!==Number(stock)){
      stockSaveTimers[key]=setTimeout(()=>flushStockSave(design,size),0);
      return;
    }
    delete stockPendingValues[key];
    renderStocks();
  });
}

