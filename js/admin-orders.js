/* =========================================================
   ADMIN ORDERS MODULE
   Orders list + filtering + status + edit/delete
========================================================= */

function renderOrderTableHTML(list,all){
  if(!list.length)return"";
  return `<table class="order-table"><thead><tr><th>Order</th><th>Order Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th>${all?"<th>Actions</th>":""}</tr></thead><tbody>${list.map(o=>{
    const thumbs=(o.items||[]).slice(0,4).map(i=>i.image?`<img class="admin-thumb" src="${adminEsc(resolveImageUrl(i.image))}" alt="">`:"").join("");
    const more=(o.items||[]).length>4?`<span class="admin-thumb-more">+${o.items.length-4}</span>`:"";
    return `<tr>
      <td><strong>${adminEsc(o.orderNo)}</strong><br><span class="admin-mini">Dispatch: ${adminEsc(dispatchRange(orderDateKey(o)))}</span></td>
      <td>${prettyDate(orderDateKey(o))}<br><span class="admin-mini">${adminDate(o.createdAt)}</span></td>
      <td>${adminEsc(o.customerName||"—")}<br><span class="admin-mini">${adminEsc(o.phone||"")}</span></td>
      <td><div class="admin-thumb-stack">${thumbs}${more}</div><span class="admin-mini">${(o.items||[]).reduce((a,i)=>a+Number(i.quantity||0),0)} units</span></td>
      <td>${adminMoney(o.total)}</td>
      <td><span class="order-payment">${adminEsc(o.payment||"Pending")}</span></td>
      <td><select onchange="changeOrderStatus('${adminEsc(o.id)}',this.value)" style="padding:5px;border:1px solid #ead5df;border-radius:7px;font-size:10px">
        ${["New","Confirmed","Dispatched","Delivered","Cancelled"].map(st=>`<option ${o.status===st?"selected":""}>${st}</option>`).join("")}
      </select></td>
      ${all?`<td><button class="admin-btn" style="padding:5px 7px" onclick="editOrder('${adminEsc(o.id)}')">Edit</button> <button class="admin-btn" style="padding:5px 7px" onclick="viewInvoice('${adminEsc(o.id)}')">Invoice</button> <button class="admin-btn danger" style="padding:5px 7px" onclick="deleteOrder('${adminEsc(o.id)}')">Delete</button></td>`:""}
    </tr>`;
  }).join("")}</tbody></table>`;
}
function renderOrdersTable(){
  const q=(document.getElementById("orderSearch")?.value||"").toLowerCase().trim();
  const st=document.getElementById("orderStatusFilter")?.value||"";
  const month=document.getElementById("orderMonthFilter")?.value||"";
  const pay=document.getElementById("orderPaymentFilter")?.value||"";
  let list=filterByMonth(adminOrders,month).filter(o=>!st||o.status===st).filter(o=>!pay||o.payment===pay).filter(o=>!q||[o.orderNo,o.customerName,o.phone,o.address,...(o.items||[]).flatMap(i=>[i.design,i.size])].join(" ").toLowerCase().includes(q)).sort((a,b)=>orderDateKey(b).localeCompare(orderDateKey(a))||new Date(b.createdAt)-new Date(a.createdAt));
  document.getElementById("ordersTable").innerHTML=renderOrderTableHTML(list,true)||"<div class='empty-admin'>No matching orders.</div>";
}
function changeOrderStatus(id,status){
  apiCall("updateStatus",{id,status},result=>{
    if(result){adminOrders=result.orders||adminOrders;populateMonthFilters();renderAdminDashboard();renderOrdersTable();populateInvoiceSelect();renderInvoiceCards();if(selectedInvoiceOrderId===id)renderInvoice();}
  });
}

function deleteOrder(id){
  const order=adminOrders.find(x=>x.id===id);
  if(!order)return;
  if(!confirm(`Delete order ${order.orderNo||''} for ${order.customerName||'this customer'}? This cannot be undone.`))return;
  apiCall("deleteOrder",{id:String(id)},result=>{
    if(result){
      adminOrders=Array.isArray(result.orders)?result.orders:adminOrders.filter(x=>x.id!==id);
      if(selectedInvoiceOrderId===id){selectedInvoiceOrderId="";const sel=document.getElementById('invoiceOrderSelect');if(sel)sel.value="";}
      populateMonthFilters();
      renderAdminDashboard();
      renderOrdersTable();
      populateInvoiceSelect();
      renderInvoiceCards();
      renderInvoice();
      alert(`Order ${order.orderNo||''} deleted successfully.`);
    }
  });
}

function editOrder(id){
  const o=adminOrders.find(x=>x.id===id);if(!o)return;
  document.getElementById("editOrderId").value=o.id;document.getElementById("editCustomerName").value=o.customerName||"";document.getElementById("editCustomerPhone").value=o.phone||"";document.getElementById("editCustomerAddress").value=o.address||"";document.getElementById("editOrderDate").value=dateInputValue(orderDateKey(o));document.getElementById("editShipping").value=Number(o.shipping||0);document.getElementById("editDiscount").value=Number(o.discount||0);document.getElementById("editStatus").value=o.status||"New";document.getElementById("editPayment").value=o.payment||"Pending";document.getElementById("editAdvancePercent").value=Number(o.advancePercent||0)||"";document.getElementById("editAdvanceAmount").value=Number(o.advanceAmount||0)||"";handleEditPaymentChange();document.getElementById("editNotes").value=o.notes||"";editOrderItemsDraft=(o.items||[]).map(i=>({...i}));renderEditOrderItems();document.getElementById("editOrderModal").classList.add("show");
}
function hideEditOrder(){document.getElementById("editOrderModal").classList.remove("show")}
function renderEditOrderItems(){
  const box=document.getElementById("editOrderItems");
  if(!editOrderItemsDraft.length){box.innerHTML="<div class='empty-admin' style='grid-column:1/-1'>No items. Use + Add Item.</div>";document.getElementById("editOrderTotalValue").textContent=adminMoney(editOrderItemsTotal());return}
  box.innerHTML=editOrderItemsDraft.map((x,i)=>`<div class="edit-item-card"><button class="edit-remove" onclick="removeEditItem(${i})">×</button><img id="edit-thumb-${i}" alt="${adminEsc(x.design||'Design')}"><div class="edit-item-grid"><div><label>Design</label><input value="${adminEsc(x.design||'')}" onchange="editDraftField(${i},'design',this.value)"></div><div><label>Size</label><input value="${adminEsc(x.size||'')}" onchange="editDraftField(${i},'size',this.value)"></div><div><label>Price</label><input type="number" min="0" value="${Number(x.price)||0}" onchange="editDraftField(${i},'price',this.value);renderEditOrderItems()"></div><div><label>Quantity</label><input type="number" min="1" value="${Number(x.quantity)||1}" onchange="editDraftField(${i},'quantity',this.value);renderEditOrderItems()"></div></div><div class="manual-total-strip" style="justify-content:space-between;margin-top:6px"><span>Subtotal</span><span>${adminMoney((Number(x.price)||0)*(Number(x.quantity)||0))}</span></div></div>`).join("");
  editOrderItemsDraft.forEach((x,i)=>{const img=document.getElementById("edit-thumb-"+i);if(img){img.src=resolveImageUrl(x.image||"");img.onerror=()=>{img.onerror=null;setupImageFallback(img,x.image||"")}}});document.getElementById("editOrderTotalValue").textContent=adminMoney(editOrderItemsTotal());
}
function editDraftField(i,key,value){if(!editOrderItemsDraft[i])return;editOrderItemsDraft[i][key]=(key==="price"||key==="quantity")?Number(value):value;document.getElementById("editOrderTotalValue").textContent=adminMoney(editOrderItemsTotal())}
function removeEditItem(i){editOrderItemsDraft.splice(i,1);renderEditOrderItems()}
function addEditItemManually(){itemSelectionMode="edit";manualSelectionSavedCart=copyCart(cart);replaceCart({});manualItemSelectionActive=true;document.getElementById("editOrderModal").classList.remove("show");document.getElementById("adminScreen").classList.remove("show");document.body.style.overflow="";document.body.classList.add("manual-selection-active");document.getElementById("manualSelectionBar").classList.add("show");updateManualSelectionBar();window.scrollTo({top:0,behavior:"auto"})}
function validateEditAdvancePayment(){if(document.getElementById("editPayment").value!=="Advanced Received")return true;const t=editOrderItemsTotal(),p=Number(document.getElementById("editAdvancePercent").value),a=Number(document.getElementById("editAdvanceAmount").value);if(!t){alert("Add at least one item before entering advance payment.");return false}if(!Number.isFinite(p)||p<0||p>100||!Number.isFinite(a)||a<0||a>t+0.01){alert("Enter a valid advance percentage and amount.");return false}if(Math.abs(t*p/100-a)>0.02){alert("Advance percentage and amount do not match.");return false}return true}
function saveEditedOrder(){
  if(!validateEditAdvancePayment())return;const id=document.getElementById("editOrderId").value,original=adminOrders.find(x=>x.id===id);if(!original)return;const valid=editOrderItemsDraft.filter(i=>String(i.design||"").trim()&&String(i.size||"").trim()&&Number(i.quantity)>0&&Number.isFinite(Number(i.price)));if(!valid.length){alert("Add at least one valid item.");return}
  const shipping=Number(document.getElementById("editShipping").value)||0,discount=Number(document.getElementById("editDiscount").value)||0,subtotal=valid.reduce((a,i)=>a+Number(i.price)*Number(i.quantity),0),total=Math.max(0,subtotal+shipping-discount);
  const order={...original,customerName:document.getElementById("editCustomerName").value.trim(),phone:document.getElementById("editCustomerPhone").value.trim(),address:document.getElementById("editCustomerAddress").value.trim(),orderDate:document.getElementById("editOrderDate").value,shipping,discount,status:document.getElementById("editStatus").value,payment:document.getElementById("editPayment").value,advancePercent:Number(document.getElementById("editAdvancePercent").value)||0,advanceAmount:Number(document.getElementById("editAdvanceAmount").value)||0,notes:document.getElementById("editNotes").value.trim(),items:valid.map(i=>({...i,price:Number(i.price),quantity:Number(i.quantity),image:String(i.image||"")})),subtotal,total};
  apiCall("updateOrder",{order:JSON.stringify(order)},result=>{if(result){adminOrders=result.orders||adminOrders;hideEditOrder();refreshAdmin();selectedInvoiceOrderId=id;alert("Order updated successfully in Google Sheets.")}});
}
