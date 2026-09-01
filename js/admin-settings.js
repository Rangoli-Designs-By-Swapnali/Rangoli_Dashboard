/* =========================================================
   ADMIN SETTINGS MODULE
   Settings + CSV export + clear orders
========================================================= */
function exportOrders(){
  const rows=[["Order No","Order Date","Dispatch Window","Created At","Customer","Phone","Address","Status","Payment","Items","Subtotal","Shipping","Total","Notes"]];
  adminOrders.forEach(o=>rows.push([o.orderNo,prettyDate(orderDateKey(o)),dispatchRange(orderDateKey(o)),adminDate(o.createdAt),o.customerName,o.phone,o.address,o.status,o.payment,(o.items||[]).map(i=>`${i.design} | ${i.size} | Qty ${i.quantity} | ₹${i.price} | ${i.image||""}`).join(" ; "),o.subtotal,o.shipping,o.total,o.notes]));
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`Swapnali_Rangoli_Orders_${localDateKey(new Date())}.csv`;a.click();URL.revokeObjectURL(a.href);
}
function loadAdminSettingsForm(){
  const s=adminSettings||{};
  if(document.getElementById("settingBusiness")){document.getElementById("settingBusiness").value=s.businessName||"Swapnali's Rangoli";document.getElementById("settingPin").value="";document.getElementById("settingFooter").value=s.footer||"Thank you for your order! 🌸"}
}
function saveAdminSettings(){
  const pin=document.getElementById("settingPin").value.trim();
  const payload={businessName:document.getElementById("settingBusiness").value.trim()||"Swapnali's Rangoli",footer:document.getElementById("settingFooter").value.trim()||"Thank you for your order! 🌸"};
  if(pin)payload.pin=pin;
  apiCall("saveSettings",{settings:JSON.stringify(payload)},result=>{if(result){adminSettings=result.settings||payload;document.getElementById("settingPin").value="";alert("Settings saved to Google Sheets.")}});
}
function clearAllOrders(){
  if(!adminOrders.length)return;
  if(confirm("Delete ALL recorded orders from Google Sheets? This cannot be undone.")){apiCall("clearOrders",{},result=>{if(result){adminOrders=[];refreshAdmin();alert("All recorded orders were deleted from Google Sheets.")}})}
}
