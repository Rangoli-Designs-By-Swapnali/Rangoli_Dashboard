/* =========================================================
   ADMIN INVOICES MODULE
   Invoice list + preview + printing
========================================================= */

function populateInvoiceSelect(){
  const s=document.getElementById("invoiceOrderSelect");
  if(!s)return;

  const month=document.getElementById("invoiceMonthFilter")?.value||"";
  const list=filterByMonth(adminOrders,month)
    .slice()
    .sort((a,b)=>orderDateKey(b).localeCompare(orderDateKey(a)));

  s.innerHTML=
    '<option value="">Select an order to view invoice</option>'+
    list.map(o=>
      `<option value="${adminEsc(o.id)}"
        ${o.id===selectedInvoiceOrderId?"selected":""}>
        ${adminEsc(o.orderNo)} — ${adminEsc(o.customerName||"Walk-in")} — ${adminMoney(o.total)}
      </option>`
    ).join("");
}


function viewInvoice(id){
  selectedInvoiceOrderId=id;

  adminTab("invoice");

  populateInvoiceSelect();

  const sel=document.getElementById("invoiceOrderSelect");
  if(sel)sel.value=id;

  renderInvoice();
  renderInvoiceCards();
}


function renderInvoiceCards(overrideList){

  const box=document.getElementById("invoiceCards");
  const pager=document.getElementById("invoicePagination");

  if(!box)return;

  const month=document.getElementById("invoiceMonthFilter")?.value||"";
  const payment=document.getElementById("invoicePaymentFilter")?.value||"";

  const base=overrideList||filterByMonth(adminOrders,month);

  const list=base
    .filter(o=>!payment||o.payment===payment)
    .slice()
    .sort((a,b)=>orderDateKey(b).localeCompare(orderDateKey(a)));

  const pages=Math.max(1,Math.ceil(list.length/INVOICE_PAGE_SIZE));

  if(invoicePage>pages)invoicePage=pages;

  const start=(invoicePage-1)*INVOICE_PAGE_SIZE;
  const pageItems=list.slice(start,start+INVOICE_PAGE_SIZE);


  box.innerHTML=pageItems.length
    ?pageItems.map(o=>`
      <div class="invoice-card
        ${selectedInvoiceOrderId===o.id?"is-selected ":""}
        ${orderVisualClass(o)}"
        onclick="viewInvoice('${adminEsc(o.id)}')">

        <div class="invoice-card-line">

          <strong>${adminEsc(o.orderNo)}</strong>

          <span>
            Order Date : ${adminEsc(prettyDate(orderDateKey(o)))}
          </span>

          <span class="status-pill status-${adminEsc(o.status)}">
            ${adminEsc(o.status)}
          </span>

        </div>


        <div class="invoice-card-line">

          <!-- NAME IS BOLD -->
          <strong>
            Name : ${adminEsc(o.customerName||"Walk-in")}
          </strong>

          <strong>
            Total Amount : ${adminMoney(o.total)}
          </strong>

        </div>


        ${
          orderRemaining(o)>0
            ?`
              <div class="invoice-card-due">
                Remaining Amount : ${adminMoney(orderRemaining(o))}
              </div>
            `
            :""
        }

      </div>
    `).join("")

    :"<div class='empty-admin'>No invoices found.</div>";


  if(pager){
    pager.innerHTML=pages>1
      ?`
        <button
          onclick="invoicePageChange(${invoicePage-1})"
          ${invoicePage<=1?"disabled":""}>
          ←
        </button>

        ${
          Array.from(
            {length:pages},
            (_,i)=>`
              <button
                class="${i+1===invoicePage?"active":""}"
                onclick="invoicePageChange(${i+1})">
                ${i+1}
              </button>
            `
          ).join("")
        }

        <button
          onclick="invoicePageChange(${invoicePage+1})"
          ${invoicePage>=pages?"disabled":""}>
          →
        </button>
      `
      :"";
  }
}


function invoicePageChange(page){
  invoicePage=Math.max(1,page);
  renderInvoiceCards();
}


function renderInvoice(){

  const id=document.getElementById("invoiceOrderSelect").value;

  selectedInvoiceOrderId=id;

  const o=adminOrders.find(x=>x.id===id);
  const box=document.getElementById("invoicePreview");

  if(!o){
    box.innerHTML=
      "<div class='empty-admin'>Select an order above or click an invoice card.</div>";
    return;
  }


  const set=adminSettings||{};

  const dk=orderDateKey(o);

  const itemsTotal=Number(o.subtotal||0);
  const shipping=Number(o.shipping||0);
  const discount=Number(o.discount||0);

  const grand=Math.max(
    0,
    itemsTotal+shipping-discount
  );

  const deliveredDate=
    o.status==="Delivered"&&o.updatedAt
      ?prettyDate(dateInputValue(o.updatedAt))
      :"";


  box.innerHTML=`

  <div class="invoice-box" id="printInvoiceArea">


    <div class="invoice-head">


      <div class="invoice-head-col">

        <div class="invoice-customer-name">
          ${adminEsc(o.customerName||"Walk-in")}
        </div>


        <div class="invoice-meta">

          Payment:
          <strong>
            ${adminEsc(o.payment||"Pending")}
          </strong>

          ${
            o.payment==="Advanced Received"
              ?`
                <br>
                Advance:
                ${Number(o.advancePercent||0).toFixed(2)}%
                (${adminMoney(o.advanceAmount||0)})
              `
              :""
          }

        </div>

      </div>



      <div class="invoice-head-col">

        <div class="invoice-brand">
          ${adminEsc(set.businessName||"Swapnali's Rangoli")}
        </div>

        <div class="invoice-meta invoice-title-label">
          Order Invoice
        </div>

        <div
          class="invoice-meta"
          style="margin-top:4px">

          @rangoli_by_swapnali&nbsp; | &nbsp;7972313283

        </div>

      </div>



      <div class="invoice-head-col">

        <div class="invoice-meta">

          <strong>
            ${adminEsc(o.orderNo)}
          </strong>

          <br>

          Order Date:
          ${adminEsc(prettyDate(dk))}

          <br>

          Status:
          <strong>
            ${adminEsc(o.status)}
          </strong>

          ${
            deliveredDate
              ?`
                <br>
                Delivered Date:
                ${adminEsc(deliveredDate)}
              `
              :""
          }

        </div>

      </div>


    </div>



    <div class="invoice-address">
      ${adminEsc(o.address||"Address not provided")}
    </div>



    <table class="invoice-lines">

      <thead>

        <tr>
          <th>Image</th>
          <th>Design</th>
          <th>Size</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Subtotal</th>
        </tr>

      </thead>


      <tbody>

        ${(o.items||[]).map(i=>`

          <tr>

            <td>
              ${
                i.image
                  ?`
                    <img
                      class="invoice-item-image"
                      src="${adminEsc(resolveImageUrl(i.image))}"
                      alt="">
                  `
                  :"—"
              }
            </td>

            <td>${adminEsc(i.design)}</td>

            <td>${adminEsc(i.size)}</td>

            <td>${Number(i.quantity)||0}</td>

            <td>${adminMoney(i.price)}</td>

            <td>
              ${adminMoney(
                Number(i.price)*Number(i.quantity)
              )}
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>



    <!-- TOTALS -->
    <!-- Discount is shown ONLY when greater than 0 -->

    <div class="invoice-total">

      <div>
        Total:
        ${adminMoney(itemsTotal)}
      </div>

      <div>
        Shipping:
        ${adminMoney(shipping)}
      </div>

      ${
        discount>0
          ?`
            <div>
              Discount:
              −${adminMoney(discount)}
            </div>
          `
          :""
      }

      <div class="grand">
        Grand Total:
        ${adminMoney(grand)}
      </div>

    </div>



    ${
      Number(o.advanceAmount||0)>0
        ?`

          <div
            style="
              text-align:right;
              margin-top:5px;
              font-size:11px;
              color:#6f1d45">

            Advance Received:
            ${adminMoney(o.advanceAmount)}

            ·

            Balance Due:
            ${adminMoney(
              Math.max(
                0,
                grand-Number(o.advanceAmount||0)
              )
            )}

          </div>

        `
        :""
    }



    <div
      style="
        margin-top:10px;
        padding:7px;
        background:#f8edf2;
        border:1px solid #ead5df;
        border-radius:8px;
        text-align:center;
        font-size:9px;
        font-weight:700;
        color:#5b1738">

      Order Date:
      ${adminEsc(prettyDate(dk))}

      ·

      Dispatch Window:
      ${adminEsc(dispatchRange(dk))}

    </div>



    ${
      o.notes
        ?`

          <div
            style="
              margin-top:10px;
              font-size:10px">

            <strong>Notes:</strong>
            ${adminEsc(o.notes)}

          </div>

        `
        :""
    }



    <div
      style="
        margin-top:14px;
        border-top:1px solid #ead8e0;
        padding-top:8px;
        text-align:center;
        font-size:9px;
        color:#806b74">

      ${adminEsc(
        set.footer||"Thank you for your order! 🌸"
      )}

    </div>


  </div>
  `;
}


function printInvoice(){

  if(!selectedInvoiceOrderId){
    alert("Select an order first.");
    return;
  }


  const area=document.getElementById("printInvoiceArea");

  if(!area)return;


  const w=window.open("","_blank");


  w.document.write(`

<!doctype html>

<html>

<head>

<title>
${adminEsc(selectedInvoiceOrderId)}
</title>


<style>

body{
  font-family:Arial,sans-serif;
  padding:25px;
  color:#3d2030
}

.invoice-box{
  max-width:850px;
  margin:auto
}

.invoice-head{
  display:flex;
  justify-content:space-between;
  border-bottom:2px solid #9b2d62;
  padding-bottom:12px
}

.invoice-brand{
  font-size:22px;
  font-weight:800;
  color:#5b1738
}

.invoice-meta{
  text-align:right;
  font-size:11px;
  color:#806b74
}

.invoice-customer{
  margin:14px 0;
  font-size:12px
}

.invoice-lines{
  width:100%;
  border-collapse:collapse
}

.invoice-lines th,
.invoice-lines td{
  padding:8px;
  border-bottom:1px solid #ddd;
  text-align:left;
  font-size:12px
}

.invoice-item-image{
  width:46px;
  height:46px;
  object-fit:contain
}

.invoice-total{
  text-align:right;
  font-size:18px;
  font-weight:800;
  margin-top:12px
}

</style>

</head>


<body>

${area.outerHTML}

</body>

</html>

  `);


  w.document.close();

  w.focus();

  setTimeout(
    ()=>w.print(),
    250
  );

}