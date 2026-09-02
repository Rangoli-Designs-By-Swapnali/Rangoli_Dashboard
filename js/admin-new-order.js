/* =========================================================
   ADMIN NEW ORDER MODULE
   Manual order creation + payment/advance calculations
========================================================= */
function renderNewOrderItems(){
  if(["Advanced Received","Partially Paid"].includes(document.getElementById("newPayment")?.value)) syncNewAdvanceFromAmount();
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
  if(payment!=="Paid") syncNewAdvanceFromAmount();
}
function syncNewOrderTotals(){
  updateManualOrderTotal();
}
function handleNewPaymentChange(){
  const v=document.getElementById("newPayment")?.value,b=document.getElementById("newAdvancePaymentFields");
  if(!b)return;
  const show=v!=="Paid";
  b.style.display=show?"":"none";
  if(show)syncNewAdvanceFromAmount();
  else{
    document.getElementById("newAdvanceAmount").value="";
    document.getElementById("newAdvanceSummary").textContent="";
  }
  updateManualOrderTotal();
}
function syncNewAdvanceFromAmount(){
  const t=manualOrderItemsTotal();
  let a=Math.max(0,Number(document.getElementById("newAdvanceAmount").value)||0);
  if(a>t)a=t;
  document.getElementById("newAdvanceAmount").value=a?a.toFixed(2):"";
  document.getElementById("newAdvanceSummary").textContent=t?`Order total: ${adminMoney(t)} • Advance received: ${adminMoney(a)} • Remaining: ${adminMoney(Math.max(0,t-a))}`:"Add items to calculate the amount.";
}
function validateNewAdvancePayment(){
  const payment=document.getElementById("newPayment").value;
  if(payment==="Paid")return true;
  const t=manualOrderItemsTotal(),a=Number(document.getElementById("newAdvanceAmount").value);
  if(!t){alert("Add at least one item before entering advance received amount.");return false}
  if(!Number.isFinite(a)||a<0||a>t+0.01){alert("Enter a valid advance received amount. It cannot exceed the order total.");return false}
  return true;
}
function editOrderItemsTotal(){const s=Number(document.getElementById("editShipping")?.value)||0;const d=Number(document.getElementById("editDiscount")?.value)||0;return Math.max(0,editOrderItemsDraft.reduce((a,i)=>a+Number(i.price||0)*Number(i.quantity||0),0)+s-d)}
function handleEditPaymentChange(){const v=document.getElementById("editPayment")?.value,b=document.getElementById("editAdvancePaymentFields");if(!b)return;const show=v!=="Paid";b.style.display=show?"":"none";if(show)syncEditAdvanceFromAmount();else{document.getElementById("editAdvanceAmount").value="";document.getElementById("editAdvanceSummary").textContent=""}}
function syncEditAdvanceFromAmount(){
  const t=editOrderItemsTotal();
  let a=Math.max(0,Number(document.getElementById("editAdvanceAmount").value)||0);
  if(a>t)a=t;
  document.getElementById("editAdvanceAmount").value=a?a.toFixed(2):"";
  document.getElementById("editAdvanceSummary").textContent=t?`Order total: ${adminMoney(t)} • Advance received: ${adminMoney(a)} • Remaining: ${adminMoney(Math.max(0,t-a))}`:"Add items to calculate the amount.";
}
function clearNewOrder(){
  newOrderItems=[];
  ["newCustomerName","newCustomerPhone","newCustomerAddress","newNotes","newAdvanceAmount"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
  const d=document.getElementById("newOrderDate");if(d)d.value=localDateKey(new Date());
  const shipping=document.getElementById("newShipping");if(shipping)shipping.value="0";
  const discount=document.getElementById("newDiscount");if(discount)discount.value="0";
  const payment=document.getElementById("newPayment");if(payment)payment.value="Pending";
  const status=document.getElementById("newStatus");if(status)status.value="New";
  const box=document.getElementById("newAdvancePaymentFields");if(box)box.style.display="none";
  const summary=document.getElementById("newAdvanceSummary");if(summary)summary.textContent="";
  renderNewOrderItems();
}
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
  const advanceAmount=payment!=="Paid"?(Number(document.getElementById("newAdvanceAmount").value)||0):0;
  const advancePercent=total?Math.min(100,(advanceAmount/total)*100):0;

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
    const shortageText=(result.stockShortages||[]).map(x=>`${adminEsc(x.design)}: ${Number(x.quantity)||0}`).join(", ");
    if(msg){msg.innerHTML=`✓ Order <strong>${adminEsc(no)}</strong> saved successfully.`+(shortageText?`<small class="manual-stock-warning">Stock preparation required: ${shortageText}</small>`:`<small>Stock reserved successfully.</small>`);msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),8000)}
  });
}
