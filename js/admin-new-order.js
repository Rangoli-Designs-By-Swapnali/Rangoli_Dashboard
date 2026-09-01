/* =========================================================
   ADMIN NEW ORDER MODULE
   Manual order creation + payment/advance calculations
========================================================= */
function renderNewOrderItems(){
  if(document.getElementById("newPayment")?.value==="Advanced Received") syncNewAdvanceFromPercent();
  const box=document.getElementById("newOrderItems");
  if(!newOrderItems.length){
    box.innerHTML="<div class='empty-admin'>No items yet. Click Add Item to choose designs from the shopping page.</div>";
    updateManualOrderTotal();
    return;
  }
  box.innerHTML=`<div class="order-items"><div class="order-items-header"><div class="header-image">Image</div><div class="header-details">Design Number</div><div class="header-quantity">Quantity</div><div class="header-subtotal">Subtotal</div></div>
    ${newOrderItems.map((x,i)=>`<div class="order-item"><div class="order-thumb-wrapper"><img class="order-thumb manual-order-thumb" data-manual-index="${i}" alt="${adminEsc(x.design)}"></div>
    <div class="order-details"><p class="order-design">${adminEsc(x.design)}</p><span class="order-size">Size: ${adminEsc(x.size)}</span><span class="order-price-each">Price each: ${adminMoney(x.price)}</span></div>
    <div class="order-quantity"><div class="preview-quantity-control"><button type="button" class="quantity-btn" onclick="changeManualItemQuantity(${i},-1,event)">−</button><span class="quantity-value">${Number(x.quantity)||1}</span><button type="button" class="quantity-btn" onclick="changeManualItemQuantity(${i},1,event)">+</button></div></div>
    <div class="order-price">${adminMoney((Number(x.price)||0)*(Number(x.quantity)||1))}</div></div>`).join("")}</div>`;
  box.querySelectorAll(".manual-order-thumb").forEach(img=>{const item=newOrderItems[Number(img.dataset.manualIndex)];if(item){img.src=resolveImageUrl(item.image||"");img.onerror=()=>{img.onerror=null;setupImageFallback(img,item.image||"")}}});
  updateManualOrderTotal();
}
function manualOrderSubtotal(){
  return newOrderItems.reduce((a,i)=>a+Number(i.price||0)*Number(i.quantity||0),0);
}
function manualOrderItemsTotal(){
  const s=Number(document.getElementById("newShipping")?.value)||0;
  const d=Number(document.getElementById("newDiscount")?.value)||0;
  return Math.max(0,manualOrderSubtotal()+s-d);
}
function updateManualOrderTotal(){
  const el=document.getElementById("newOrderTotalValue");
  if(el)el.textContent=adminMoney(manualOrderItemsTotal());
  const summary=document.getElementById("newAdvanceSummary");
  const payment=document.getElementById("newPayment")?.value;
  if(payment==="Advanced Received") syncNewAdvanceFromPercent();
}
function syncNewOrderTotals(){
  updateManualOrderTotal();
}
function handleNewPaymentChange(){
  const v=document.getElementById("newPayment")?.value,b=document.getElementById("newAdvancePaymentFields");
  if(!b)return;
  b.style.display=v==="Advanced Received"?"":"none";
  if(v==="Advanced Received") syncNewAdvanceFromPercent();
  else{
    document.getElementById("newAdvancePercent").value="";
    document.getElementById("newAdvanceAmount").value="";
    document.getElementById("newAdvanceSummary").textContent="";
  }
  updateManualOrderTotal();
}
function syncNewAdvanceFromPercent(){
  const t=manualOrderItemsTotal();
  const p=Math.min(100,Math.max(0,Number(document.getElementById("newAdvancePercent").value)||0));
  const a=t*p/100;
  document.getElementById("newAdvanceAmount").value=t?a.toFixed(2):"";
  document.getElementById("newAdvanceSummary").textContent=t?`Order total: ${adminMoney(t)} • Advance received: ${adminMoney(a)} • Remaining: ${adminMoney(t-a)}`:"Add items to calculate the advance.";
  const el=document.getElementById("newOrderTotalValue");
  if(el)el.textContent=adminMoney(t);
}
function syncNewAdvanceFromAmount(){
  const t=manualOrderItemsTotal();
  const a=Math.min(t,Math.max(0,Number(document.getElementById("newAdvanceAmount").value)||0));
  document.getElementById("newAdvanceAmount").value=a?a.toFixed(2):"";
  document.getElementById("newAdvancePercent").value=t?((a/t)*100).toFixed(2):"";
  document.getElementById("newAdvanceSummary").textContent=t?`Order total: ${adminMoney(t)} • Advance received: ${adminMoney(a)} • Remaining: ${adminMoney(t-a)}`:"Add items to calculate the advance.";
}
function validateNewAdvancePayment(){
  if(document.getElementById("newPayment").value!=="Advanced Received")return true;
  const t=manualOrderItemsTotal(),p=Number(document.getElementById("newAdvancePercent").value),a=Number(document.getElementById("newAdvanceAmount").value);
  if(!t){alert("Add at least one item before entering advance payment.");return false}
  if(!Number.isFinite(p)||p<0||p>100||!Number.isFinite(a)||a<0||a>t+0.01){alert("Enter a valid advance percentage and amount. Advance cannot exceed the order total.");return false}
  if(Math.abs((t*p/100)-a)>0.02){alert("Advance percentage and amount do not match.");return false}
  return true;
}
function editOrderItemsTotal(){const s=Number(document.getElementById("editShipping")?.value)||0;const d=Number(document.getElementById("editDiscount")?.value)||0;return Math.max(0,editOrderItemsDraft.reduce((a,i)=>a+Number(i.price||0)*Number(i.quantity||0),0)+s-d)}
function handleEditPaymentChange(){const v=document.getElementById("editPayment")?.value,b=document.getElementById("editAdvancePaymentFields");if(!b)return;b.style.display=v==="Advanced Received"?"":"none";if(v==="Advanced Received")syncEditAdvanceFromPercent()}
function syncEditAdvanceFromPercent(){const t=editOrderItemsTotal(),p=Math.min(100,Math.max(0,Number(document.getElementById("editAdvancePercent").value)||0)),a=t*p/100;document.getElementById("editAdvanceAmount").value=t?a.toFixed(2):"";document.getElementById("editAdvanceSummary").textContent=t?`Order total: ${adminMoney(t)} • Advance received: ${adminMoney(a)} • Remaining: ${adminMoney(t-a)}`:"Add items to calculate the advance."}
function syncEditAdvanceFromAmount(){const t=editOrderItemsTotal(),a=Math.min(t,Math.max(0,Number(document.getElementById("editAdvanceAmount").value)||0));document.getElementById("editAdvanceAmount").value=a?a.toFixed(2):"";document.getElementById("editAdvancePercent").value=t?((a/t)*100).toFixed(2):"";document.getElementById("editAdvanceSummary").textContent=t?`Order total: ${adminMoney(t)} • Advance received: ${adminMoney(a)} • Remaining: ${adminMoney(t-a)}`:"Add items to calculate the advance."}
function saveNewOrder(){
  if(!validateNewAdvancePayment()) return;
  if(!newOrderItems.length){alert("Add at least one item.");return}
  const valid=newOrderItems.filter(i=>i.design&&i.size&&Number(i.quantity)>0&&Number.isFinite(Number(i.price)));
  if(!valid.length){alert("Please enter valid order items.");return}

  const orderDate=document.getElementById("newOrderDate").value||localDateKey(new Date());
  const shipping=Math.max(0,Number(document.getElementById("newShipping").value)||0);
  const discount=Math.max(0,Number(document.getElementById("newDiscount").value)||0);
  const subtotal=valid.reduce((a,i)=>a+Number(i.price)*Number(i.quantity),0);
  const total=Math.max(0,subtotal+shipping-discount);
  const payment=document.getElementById("newPayment").value;
  const advancePercent=payment==="Advanced Received"?(Number(document.getElementById("newAdvancePercent").value)||0):0;
  const advanceAmount=payment==="Advanced Received"?(Number(document.getElementById("newAdvanceAmount").value)||0):0;

  const order={
    id:"o_"+Date.now()+Math.random().toString(36).slice(2,7),
    orderNo:"",orderDate,createdAt:new Date().toISOString(),
    customerName:document.getElementById("newCustomerName").value.trim(),
    phone:document.getElementById("newCustomerPhone").value.trim(),
    address:document.getElementById("newCustomerAddress").value.trim(),
    shipping,status:document.getElementById("newStatus").value,payment,
    advancePercent,advanceAmount,discount,
    notes:document.getElementById("newNotes").value.trim(),
    items:valid.map(i=>({...i,price:Number(i.price),quantity:Number(i.quantity)})),subtotal,total
  };

  const saveButton=document.querySelector('#admin-neworder button[onclick="saveNewOrder()"]');
  if(saveButton){saveButton.disabled=true;saveButton.dataset.originalText=saveButton.innerHTML;saveButton.innerHTML="⏳ Saving..."}

  apiCall("saveOrder",{order:JSON.stringify(order)},(result,error)=>{
    if(saveButton){saveButton.disabled=false;saveButton.innerHTML=saveButton.dataset.originalText||"💾 Save Order"}
    if(error||!result)return;
    if(result.ok===false){alert(result.error||"Order could not be saved.");return}

    adminOrders=result.orders||adminOrders;
    const saved=(result.orders||[]).find(x=>x.id===order.id);
    const no=saved?.orderNo||"R-?";

    clearNewOrder();
    refreshAdmin();
    adminTab("neworder");

    const msg=document.getElementById("manualSaveMessage");
    if(msg){msg.innerHTML=`✓ Order <strong>${adminEsc(no)}</strong> saved successfully.`+`<small>Ready for the next new order.</small>`;msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),6000)}
  });
}
