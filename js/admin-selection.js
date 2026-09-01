/* =========================================================
   ADMIN SELECTION MODULE
   Catalogue selection for Manual Order / Edit Order
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
  if(total)total.textContent=adminMoney(getCartTotal());
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
  replaceCart(manualSelectionSavedCart||{});
  manualSelectionSavedCart=null;
  const wasEdit=itemSelectionMode==="edit";
  finishManualSelectionUI();
  if(wasEdit){document.getElementById("editOrderModal").classList.add("show");renderEditOrderItems()}
  else returnToManualOrder();
}
function confirmManualItemSelection(){
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
