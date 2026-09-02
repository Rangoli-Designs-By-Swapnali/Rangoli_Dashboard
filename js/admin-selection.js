/* =========================================================
   ADMIN SELECTION MODULE
   Catalogue selection for Manual Order / Edit Order / Add Stock
========================================================= */
function copyCart(source){const copy={};Object.keys(source||{}).forEach(k=>{copy[k]=Number(source[k])||0});return copy}
function replaceCart(source){
  Object.keys(cart).forEach(key=>delete cart[key]);
  Object.keys(source||{}).forEach(key=>{const quantity=Number(source[key])||0;if(quantity>0)cart[key]=quantity});
  designs.forEach(d=>d.variants.forEach((v,vi)=>updateVariantUI(d.id,vi)));
  designs.forEach(d=>updateCardSelection(d.id));
  updateCart();
  updateManualSelectionBar();
}
function updateManualSelectionBar(){
  const total=document.getElementById("manualSelectionTotal");
  if(total)total.textContent=stockSelectionMode?String(selectedStockItems().reduce((s,x)=>s+(Number(x.quantity)||0),0)):adminMoney(getCartTotal());
}
function setSelectionBarMode(isStock){
  const cancel=document.getElementById("selectionCancelBtn");
  const confirm=document.getElementById("selectionConfirmBtn");
  if(cancel)cancel.textContent=isStock?"← Cancel":"← Cancel";
  if(confirm)confirm.innerHTML=isStock?'✓ Add Stock <span id="manualSelectionTotal">0</span>':'✓ Add Items <span id="manualSelectionTotal">₹0</span>';
}
function addManualItem(){
  itemSelectionMode="new";
  manualSelectionSavedCart=copyCart(cart);
  const selectionCart={};
  newOrderItems.forEach(item=>{
    if(item.designId!=null&&item.variantIndex!=null)selectionCart[getCartKey(item.designId,item.variantIndex)]=Number(item.quantity)||1;
  });
  manualItemSelectionActive=true;
  replaceCart(selectionCart);
  document.getElementById("adminScreen").classList.remove("show");
  document.body.style.overflow="";
  document.body.classList.add("manual-selection-active");
  document.getElementById("manualSelectionBar").classList.add("show");
  setSelectionBarMode(false);
  updateManualSelectionBar();
  window.scrollTo({top:0,behavior:"auto"});
}
function finishManualSelectionUI(){
  manualItemSelectionActive=false;
  itemSelectionMode="";
  document.body.classList.remove("manual-selection-active");
  document.getElementById("manualSelectionBar").classList.remove("show");
  setSelectionBarMode(false);
}
function returnToManualOrder(){
  document.getElementById("adminScreen").classList.add("show");
  document.body.style.overflow="hidden";
  if(itemSelectionMode==="edit")document.getElementById("editOrderModal").classList.add("show");
  else adminTab("neworder");
}
function selectedCatalogueItems(){
  const selected=[];
  designs.forEach(design=>design.variants.forEach((variant,variantIndex)=>{
    const quantity=Number(cart[getCartKey(design.id,variantIndex)]||0);
    if(quantity>0)selected.push({design:design.name,size:variant.size,price:Number(variant.price)||0,quantity,image:design.image,designId:design.id,variantIndex});
  }));
  return selected;
}
function cancelManualItemSelection(){
  if(stockSelectionMode){cancelStockSelection();return}
  if(!manualItemSelectionActive)return;
  replaceCart(manualSelectionSavedCart||{});
  manualSelectionSavedCart=null;
  const wasEdit=itemSelectionMode==="edit";
  finishManualSelectionUI();
  if(wasEdit){document.getElementById("editOrderModal").classList.add("show");renderEditOrderItems()}
  else returnToManualOrder();
}
function confirmManualItemSelection(){
  if(stockSelectionMode){confirmStockSelection();return}
  if(!manualItemSelectionActive)return;
  const selected=selectedCatalogueItems();
  if(!selected.length){alert("Select at least one item.");return}
  if(itemSelectionMode==="edit"){
    selected.forEach(item=>{
      const existing=editOrderItemsDraft.find(x=>x.designId===item.designId&&Number(x.variantIndex)===Number(item.variantIndex)&&x.size===item.size);
      if(existing)existing.quantity=(Number(existing.quantity)||0)+item.quantity;
      else editOrderItemsDraft.push(item);
    });
  }else{
    newOrderItems=selected;
  }
  const saved=manualSelectionSavedCart||{};
  manualSelectionSavedCart=null;
  const wasEdit=itemSelectionMode==="edit";
  finishManualSelectionUI();
  replaceCart(saved);
  if(wasEdit){document.getElementById("adminScreen").classList.add("show");document.body.style.overflow="hidden";document.getElementById("editOrderModal").classList.add("show");renderEditOrderItems()}
  else{document.getElementById("adminScreen").classList.add("show");document.body.style.overflow="hidden";adminTab("neworder");renderNewOrderItems();updateManualOrderTotal()}
}
function removeNewItem(i){newOrderItems.splice(i,1);renderNewOrderItems()}
function changeManualItemQuantity(i,amount,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const item=newOrderItems[i];if(!item)return;
  const next=(Number(item.quantity)||0)+amount;
  if(next<=0)newOrderItems.splice(i,1);else item.quantity=next;
  renderNewOrderItems();
  updateManualOrderTotal();
}

/* =========================================================
   ADD STOCK SELECTION
========================================================= */
function startAddStock(){
  stockSelectionMode=true;
  stockSelection={};
  manualItemSelectionActive=false;
  itemSelectionMode="stock";
  const admin=document.getElementById("adminScreen");
  if(admin)admin.classList.remove("show");
  document.body.style.overflow="";
  document.body.classList.add("manual-selection-active");
  const bar=document.getElementById("manualSelectionBar");
  if(bar)bar.classList.add("show");
  setSelectionBarMode(true);
  renderDesigns();
  updateStockSelectionBar();
  window.scrollTo({top:0,behavior:"auto"});
}
function cancelStockSelection(){
  stockSelectionMode=false;
  stockSelection={};
  itemSelectionMode="";
  document.body.classList.remove("manual-selection-active");
  document.getElementById("manualSelectionBar")?.classList.remove("show");
  setSelectionBarMode(false);
  renderDesigns();
  document.getElementById("adminScreen")?.classList.add("show");
  document.body.style.overflow="hidden";
  adminTab("stocks");
}
function updateStockSelectionBar(){
  const total=selectedStockItems().reduce((sum,item)=>sum+item.quantity,0);
  const el=document.getElementById("manualSelectionTotal");
  if(el)el.textContent=String(total);
}
function toggleStockDesign(designName,checked){
  const key=stockKey(designName);
  if(checked)stockSelection[key]=Math.max(1,Number(stockSelection[key])||1);
  else delete stockSelection[key];
  updateStockSelectionCard(designName);
  updateStockSelectionBar();
}
function setStockSelectionQuantity(designName,value){
  const key=stockKey(designName);
  const quantity=Math.max(0,Math.floor(Number(value)||0));
  if(quantity<=0)delete stockSelection[key];
  else stockSelection[key]=quantity;
  updateStockSelectionCard(designName);
  updateStockSelectionBar();
}
function changeStockSelectionQuantity(designName,amount,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const key=stockKey(designName);
  const next=Math.max(0,(Number(stockSelection[key])||0)+amount);
  setStockSelectionQuantity(designName,next);
}
function updateStockSelectionCard(designName){
  const key=stockKey(designName);
  const card=document.querySelector(`[data-stock-design-key="${CSS.escape(key)}"]`);
  if(!card)return;
  const qty=Math.max(0,Number(stockSelection[key])||0);
  const checkbox=card.querySelector('input[type="checkbox"]');
  const input=card.querySelector('input[type="number"]');
  if(checkbox)checkbox.checked=qty>0;
  if(input)input.value=String(qty);
  card.classList.toggle("selected",qty>0);
}
function confirmStockSelection(){
  if(!stockSelectionMode)return;
  const items=selectedStockItems();
  if(!items.length){alert("Select at least one design and quantity.");return}
  apiCall("addStock",{items},(result,error)=>{
    if(error||!result)return;
    adminStocks=Array.isArray(result.stocks)?result.stocks:adminStocks;
    stockSelectionMode=false;
    stockSelection={};
    itemSelectionMode="";
    document.body.classList.remove("manual-selection-active");
    document.getElementById("manualSelectionBar")?.classList.remove("show");
    setSelectionBarMode(false);
    document.getElementById("adminScreen")?.classList.add("show");
    document.body.style.overflow="hidden";
    adminTab("stocks");
    renderStocks();
  });
}
