/* =========================================================
   ADMIN SELECTION MODULE
   Catalogue selection for Manual Order / Edit Order
========================================================= */
let stockSelectionMode=false;

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
  if(total)total.textContent=adminMoney(getCartTotal());
}
async function startAddStock(){
  if(typeof loadDesignsPromise!=="undefined" && loadDesignsPromise){try{await loadDesignsPromise}catch(e){}}
  if(!Array.isArray(designs)||!designs.length){alert("Designs are still loading. Please try again.");return}
  stockSelectionMode=true;
  itemSelectionMode="stock";
  manualSelectionSavedCart=copyCart(cart);
  replaceCart({});
  manualItemSelectionActive=true;
  document.getElementById("adminScreen").classList.remove("show");
  document.body.style.overflow="";
  document.body.classList.add("manual-selection-active");
  document.getElementById("manualSelectionBar").classList.add("show");
  const cancel=document.getElementById("selectionCancelBtn");
  const confirmBtn=document.getElementById("selectionConfirmBtn");
  if(cancel)cancel.innerHTML="← Cancel";
  if(confirmBtn)confirmBtn.innerHTML='✓ Add Stock <span id="manualSelectionTotal">₹0</span>';
  updateManualSelectionBar();
  window.scrollTo({top:0,behavior:"auto"});
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
  updateManualSelectionBar();
  window.scrollTo({top:0,behavior:"auto"});
}
function finishManualSelectionUI(){
  manualItemSelectionActive=false;
  itemSelectionMode="";
  document.body.classList.remove("manual-selection-active");
  document.getElementById("manualSelectionBar").classList.remove("show");
  const confirmBtn=document.getElementById("selectionConfirmBtn");
  if(confirmBtn)confirmBtn.innerHTML='✓ Add Items <span id="manualSelectionTotal">₹0</span>';
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
  if(!manualItemSelectionActive)return;
  const wasStock=stockSelectionMode;
  const wasEdit=itemSelectionMode==="edit";
  replaceCart(manualSelectionSavedCart||{});
  manualSelectionSavedCart=null;
  finishManualSelectionUI();
  if(wasStock){stockSelectionMode=false;itemSelectionMode="";document.getElementById("adminScreen").classList.add("show");document.body.style.overflow="hidden";adminTab("stocks");return}
  if(wasEdit){document.getElementById("editOrderModal").classList.add("show");renderEditOrderItems()}
  else returnToManualOrder();
}
function confirmManualItemSelection(){
  if(!manualItemSelectionActive)return;
  const selected=selectedCatalogueItems();
  if(!selected.length){alert(stockSelectionMode?"Select at least one stock item.":"Select at least one item.");return}
  if(stockSelectionMode){
    const items=selected.map(x=>({design:x.design,size:x.size,price:x.price,quantity:x.quantity,image:x.image}));
    const btn=document.getElementById("selectionConfirmBtn");
    if(btn)btn.disabled=true;
    apiCall("addStock",{items:JSON.stringify(items)},(result,error)=>{
      if(btn)btn.disabled=false;
      if(error||!result)return;
      replaceCart(manualSelectionSavedCart||{});
      manualSelectionSavedCart=null;
      stockSelectionMode=false;
      finishManualSelectionUI();
      document.getElementById("adminScreen").classList.add("show");
      document.body.style.overflow="hidden";
      adminTab("stocks");
      const added=(result.added||[]).reduce((n,x)=>n+Number(x.quantity||0),0);
      alert(`Stock added successfully${added?`: ${added} unit${added===1?"":"s"}`:""}.`);
    });
    return;
  }
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
