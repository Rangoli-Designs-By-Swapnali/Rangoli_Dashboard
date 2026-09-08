/* =========================================================
ADMIN INVOICES MODULE
Invoice list + preview + printing
========================================================= */

/* =========================================================
ORDER ID SORT HELPER
Extracts numeric part from Order Number.

Examples:
R-1   -> 1
R-25  -> 25
R-100 -> 100

Used for descending order:
R-100 → R-99 → R-98 → ... → R-1
========================================================= */
function orderIdNumber(order){
const match=String(order.orderNo||order.id||"").match(/\d+/g);
return match?Number(match[match.length-1]):0;
}

/* =========================================================
POPULATE INVOICE SELECT DROPDOWN
========================================================= */
function populateInvoiceSelect(){

const s=document.getElementById("invoiceOrderSelect");

if(!s)return;

const month=
document.getElementById("invoiceMonthFilter")?.value||"";

/* Sort by Order ID descending */
const list=
filterByMonth(adminOrders,month)
.slice()
.sort((a,b)=>orderIdNumber(b)-orderIdNumber(a));

s.innerHTML=
'<option value="">Select an order to view invoice</option>'+
list.map(o=>`       <option
        value="${adminEsc(o.id)}"
        ${o.id===selectedInvoiceOrderId?"selected":""}       >
        ${adminEsc(o.orderNo)}
        —
        ${adminEsc(o.customerName||"Walk-in")}
        —
        ${adminMoney(o.total)}       </option>
    `).join("");
}

/* =========================================================
VIEW INVOICE
========================================================= */
function viewInvoice(id){

selectedInvoiceOrderId=id;

adminTab("invoice");

populateInvoiceSelect();

const sel=document.getElementById("invoiceOrderSelect");

if(sel){
sel.value=id;
}

renderInvoice();

renderInvoiceCards();
}

/* =========================================================
RENDER INVOICE CARDS
========================================================= */
function renderInvoiceCards(overrideList){

const box=document.getElementById("invoiceCards");

const pager=document.getElementById("invoicePagination");

if(!box)return;

const month=
document.getElementById("invoiceMonthFilter")?.value||"";

const payment=
document.getElementById("invoicePaymentFilter")?.value||"";

const base=
overrideList||filterByMonth(adminOrders,month);

/* =====================================================
FILTER + SORT BY ORDER ID DESCENDING
===================================================== */

const list=
base
.filter(o=>!payment||o.payment===payment)
.slice()
.sort((a,b)=>orderIdNumber(b)-orderIdNumber(a));

const pages=
Math.max(
1,
Math.ceil(list.length/INVOICE_PAGE_SIZE)
);

if(invoicePage>pages){
invoicePage=pages;
}

const start=
(invoicePage-1)*INVOICE_PAGE_SIZE;

const pageItems=
list.slice(
start,
start+INVOICE_PAGE_SIZE
);

/* =====================================================
INVOICE CARDS
===================================================== */

box.innerHTML=
pageItems.length


  ?pageItems.map(o=>`

    <div
      class="
        invoice-card
        ${selectedInvoiceOrderId===o.id?"is-selected ":""}
        ${orderVisualClass(o)}
      "

      onclick="viewInvoice('${adminEsc(o.id)}')"
    >


      <div class="invoice-card-line">

        <strong>
          ${adminEsc(o.orderNo)}
        </strong>


        <span>
          Order Date :
          ${adminEsc(prettyDate(orderDateKey(o)))}
        </span>


        <span
          class="
            status-pill
            status-${adminEsc(o.status)}
          "
        >
          ${adminEsc(o.status)}
        </span>

      </div>



      <div class="invoice-card-line">

        <span>
          Name :
          ${adminEsc(o.customerName||"Walk-in")}
        </span>


        <strong>
          Total Amount :
          ${adminMoney(o.total)}
        </strong>

      </div>



      ${orderRemaining(o)>0

        ?`

          <div class="invoice-card-due">

            Remaining Amount :
            ${adminMoney(orderRemaining(o))}

          </div>

        `

        :""

      }


    </div>

  `).join("")

  :"<div class='empty-admin'>No invoices found.</div>";


/* =====================================================
PAGINATION
===================================================== */

pager.innerHTML=
pages>1


  ?`

    <button
      onclick="invoicePageChange(${invoicePage-1})"
      ${invoicePage<=1?"disabled":""}
    >
      ←
    </button>


    ${Array.from(
      {length:pages},
      (_,i)=>`

        <button
          class="${i+1===invoicePage?"active":""}"

          onclick="invoicePageChange(${i+1})"
        >
          ${i+1}
        </button>

      `
    ).join("")}


    <button
      onclick="invoicePageChange(${invoicePage+1})"
      ${invoicePage>=pages?"disabled":""}
    >
      →
    </button>

  `

  :"";


}

/* =========================================================
CHANGE INVOICE PAGE
========================================================= */
function invoicePageChange(page){

invoicePage=Math.max(1,page);

renderInvoiceCards();

}

/* =========================================================
RENDER INVOICE PREVIEW
========================================================= */
function renderInvoice(){

const id=
document.getElementById("invoiceOrderSelect").value;

selectedInvoiceOrderId=id;

const o=
adminOrders.find(x=>x.id===id);

const box=
document.getElementById("invoicePreview");

/* =====================================================
NO INVOICE SELECTED
===================================================== */

if(!o){


box.innerHTML=
  "<div class='empty-admin'>Select an order above or click an invoice card.</div>";

return;


}

/* =====================================================
CALCULATIONS
===================================================== */

const set=
adminSettings||{};

const dk=
orderDateKey(o);

const itemsTotal=
Number(o.subtotal||0);

const shipping=
Number(o.shipping||0);

const discount=
Number(o.discount||0);

const grand=
Math.max(
0,
itemsTotal+shipping-discount
);

const deliveredDate=
o.status==="Delivered"&&o.updatedAt


  ?prettyDate(
    dateInputValue(o.updatedAt)
  )

  :"";


/* =====================================================
INVOICE HTML
===================================================== */

box.innerHTML=`


<div
  class="invoice-box"
  id="printInvoiceArea"
>


  <!-- ============================================
       INVOICE HEADER
  ============================================= -->

  <div class="invoice-head">


    <!-- CUSTOMER DETAILS -->

    <div class="invoice-head-col">


      <div class="invoice-customer-name">

        ${adminEsc(o.customerName||"Walk-in")}

      </div>


      <div class="invoice-meta">


        Payment:

        <strong>
          ${adminEsc(o.payment||"Pending")}
        </strong>


        ${o.payment==="Advanced Received"

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



    <!-- BUSINESS DETAILS -->

    <div class="invoice-head-col">


      <div class="invoice-brand">

        ${adminEsc(
          set.businessName||"Swapnali's Rangoli"
        )}

      </div>


      <div class="invoice-meta invoice-title-label">

        Order Invoice

      </div>


      <div
        class="invoice-meta"
        style="margin-top:4px"
      >

        @rangoli_by_swapnali
        &nbsp; | &nbsp;
        7972313283

      </div>


    </div>



    <!-- ORDER DETAILS -->

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


        ${deliveredDate

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



  <!-- ============================================
       CUSTOMER ADDRESS
  ============================================= -->

  <div class="invoice-address">

    ${adminEsc(
      o.address||"Address not provided"
    )}

  </div>



  <!-- ============================================
       ORDER ITEMS
  ============================================= -->

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


          <!-- IMAGE -->

          <td>

            ${i.image

              ?`

                <img
                  class="invoice-item-image"

                  src="${adminEsc(
                    resolveImageUrl(i.image)
                  )}"

                  alt=""
                >

              `

              :"—"

            }

          </td>



          <!-- DESIGN -->

          <td>

            ${adminEsc(i.design)}

          </td>



          <!-- SIZE -->

          <td>

            ${adminEsc(i.size)}

          </td>



          <!-- QUANTITY -->

          <td>

            ${Number(i.quantity)||0}

          </td>



          <!-- PRICE -->

          <td>

            ${adminMoney(i.price)}

          </td>



          <!-- SUBTOTAL -->

          <td>

            ${adminMoney(
              Number(i.price)*
              Number(i.quantity)
            )}

          </td>


        </tr>

      `).join("")}


    </tbody>


  </table>



  <!-- ============================================
       TOTAL SECTION
  ============================================= -->

  <div class="invoice-total">


    <div>

      Total:

      ${adminMoney(itemsTotal)}

    </div>



    <div>

      Shipping:

      ${adminMoney(shipping)}

    </div>



    ${discount>0

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



  <!-- ============================================
       ADVANCE PAYMENT
  ============================================= -->

  ${Number(o.advanceAmount||0)>0

    ?`

      <div
        style="
          text-align:right;
          margin-top:5px;
          font-size:11px;
          color:#6f1d45
        "
      >


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



  <!-- ============================================
       DISPATCH WINDOW
  ============================================= -->

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
      color:#5b1738
    "
  >


    Order Date:

    ${adminEsc(prettyDate(dk))}


    ·


    Dispatch Window:

    ${adminEsc(dispatchRange(dk))}


  </div>



  <!-- ============================================
       NOTES
  ============================================= -->

  ${o.notes

    ?`

      <div
        style="
          margin-top:10px;
          font-size:10px
        "
      >

        <strong>

          Notes:

        </strong>


        ${adminEsc(o.notes)}


      </div>

    `

    :""

  }



  <!-- ============================================
       FOOTER
  ============================================= -->

  <div
    style="
      margin-top:14px;
      border-top:1px solid #ead8e0;
      padding-top:8px;
      text-align:center;
      font-size:9px;
      color:#806b74
    "
  >

    ${adminEsc(
      set.footer||"Thank you for your order! 🌸"
    )}

  </div>


</div>


`;

}

/* =========================================================
PRINT INVOICE
========================================================= */
function printInvoice(){

/* CHECK INVOICE SELECTION */

if(!selectedInvoiceOrderId){


alert("Select an order first.");

return;


}

const area=
document.getElementById("printInvoiceArea");

if(!area)return;

/* OPEN PRINT WINDOW */

const w=
window.open(
"",
"_blank"
);

/* =====================================================
PRINT DOCUMENT
===================================================== */

w.document.write(`


<!doctype html>


<html>


  <head>


    <title>

      ${adminEsc(selectedInvoiceOrderId)}

    </title>



    <style>


      body{

        font-family:
          Arial,
          sans-serif;

        padding:25px;

        color:#3d2030;

      }



      .invoice-box{

        max-width:850px;

        margin:auto;

      }



      .invoice-head{

        display:flex;

        justify-content:space-between;

        border-bottom:
          2px solid #9b2d62;

        padding-bottom:12px;

      }



      .invoice-brand{

        font-size:22px;

        font-weight:800;

        color:#5b1738;

      }



      .invoice-meta{

        text-align:right;

        font-size:11px;

        color:#806b74;

      }



      .invoice-customer{

        margin:14px 0;

        font-size:12px;

      }



      .invoice-lines{

        width:100%;

        border-collapse:collapse;

      }



      .invoice-lines th,

      .invoice-lines td{

        padding:8px;

        border-bottom:
          1px solid #ddd;

        text-align:left;

        font-size:12px;

      }



      .invoice-item-image{

        width:46px;

        height:46px;

        object-fit:contain;

      }



      .invoice-total{

        text-align:right;

        font-size:18px;

        font-weight:800;

        margin-top:12px;

      }


    </style>


  </head>



  <body>


    ${area.outerHTML}


  </body>


</html>


`);

/* CLOSE DOCUMENT */

w.document.close();

/* FOCUS PRINT WINDOW */

w.focus();

/* OPEN PRINT DIALOG */

setTimeout(
()=>w.print(),
250
);

}
