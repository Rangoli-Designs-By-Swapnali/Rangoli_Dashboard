/* =========================================================
ADMIN ORDERS MODULE
Orders list + filtering + status + edit/delete
========================================================= */

/* =========================================================
ORDER ID SORT HELPER

Extracts numeric value from Order Number.

Examples:
R-1   = 1
R-25  = 25
R-100 = 100

This ensures correct descending sorting:

R-100
R-99
R-98
...
R-2
R-1
========================================================= */

function orderIdNumber(order){
const match=String(order.orderNo||order.id||"").match(/\d+/g);
return match?Number(match[match.length-1]):0;
}

/* =========================================================
RENDER ORDER TABLE HTML
========================================================= */

function renderOrderTableHTML(list,all){

if(!list.length)return"";

return `


<table class="order-table">

  <thead>

    <tr>

      <th>Order</th>

      <th>Order Date</th>

      <th>Customer</th>

      <th>Items</th>

      <th>Total</th>

      <th>Payment</th>

      <th>Status</th>

      ${all?"<th>Actions</th>":""}

    </tr>

  </thead>


  <tbody>


    ${list.map(o=>{


      /* ===============================================
         ITEM IMAGE THUMBNAILS
      =============================================== */

      const thumbs=(o.items||[])
        .slice(0,4)
        .map(i=>

          i.image

            ?`

              <img
                class="admin-thumb"
                src="${adminEsc(resolveImageUrl(i.image))}"
                alt=""
              >

            `

            :""

        )
        .join("");


      /* ===============================================
         MORE ITEMS COUNT
      =============================================== */

      const more=(o.items||[]).length>4

        ?`

          <span class="admin-thumb-more">

            +${o.items.length-4}

          </span>

        `

        :"";


      /* ===============================================
         ORDER ROW
      =============================================== */

      return `

        <tr class="${orderVisualClass(o)}">


          <!-- ORDER NUMBER -->

          <td>

            <strong>

              ${adminEsc(o.orderNo)}

            </strong>


            <br>


            <span class="admin-mini">

              Dispatch:

              ${adminEsc(
                dispatchRange(
                  orderDateKey(o)
                )
              )}

            </span>

          </td>



          <!-- ORDER DATE -->

          <td>

            ${prettyDate(orderDateKey(o))}


            <br>


            <span class="admin-mini">

              ${adminDate(o.createdAt)}

            </span>

          </td>



          <!-- CUSTOMER -->

          <td>

            ${adminEsc(
              o.customerName||"—"
            )}


            <br>


            <span class="admin-mini">

              ${adminEsc(
                o.phone||""
              )}

            </span>

          </td>



          <!-- ITEMS -->

          <td>


            <div class="admin-thumb-stack">

              ${thumbs}

              ${more}

            </div>


            <span class="admin-mini">

              ${(o.items||[])
                .reduce(
                  (a,i)=>a+Number(i.quantity||0),
                  0
                )
              }

              units

            </span>


          </td>



          <!-- TOTAL -->

          <td>

            ${adminMoney(o.total)}


            ${orderRemaining(o)>0

              ?`

                <br>


                <span class="remaining-amount">

                  Remaining:

                  ${adminMoney(
                    orderRemaining(o)
                  )}

                </span>

              `

              :""

            }


          </td>



          <!-- PAYMENT -->

          <td>


            <span class="order-payment">

              ${adminEsc(
                o.payment||"Pending"
              )}

            </span>


            ${orderRemaining(o)>0

              ?`

                <br>


                <span class="remaining-amount">

                  Due:

                  ${adminMoney(
                    orderRemaining(o)
                  )}

                </span>

              `

              :""

            }


          </td>



          <!-- STATUS -->

          <td>


            <select
              onchange="
                changeOrderStatus(
                  '${adminEsc(o.id)}',
                  this.value
                )
              "

              style="
                padding:5px;
                border:1px solid #ead5df;
                border-radius:7px;
                font-size:10px
              "
            >

              ${[
                "New",
                "Confirmed",
                "Dispatched",
                "Delivered",
                "Cancelled"
              ].map(st=>`

                <option
                  ${o.status===st?"selected":""}
                >

                  ${st}

                </option>

              `).join("")}

            </select>


          </td>



          <!-- ACTIONS -->

          ${all

            ?`

              <td>


                <button
                  class="admin-btn"

                  style="
                    padding:5px 7px
                  "

                  onclick="
                    editOrder(
                      '${adminEsc(o.id)}'
                    )
                  "
                >

                  Edit

                </button>



                <button
                  class="admin-btn"

                  style="
                    padding:5px 7px
                  "

                  onclick="
                    viewInvoice(
                      '${adminEsc(o.id)}'
                    )
                  "
                >

                  Invoice

                </button>



                <button
                  class="admin-btn danger"

                  style="
                    padding:5px 7px
                  "

                  onclick="
                    deleteOrder(
                      '${adminEsc(o.id)}'
                    )
                  "
                >

                  Delete

                </button>


              </td>

            `

            :""

          }


        </tr>

      `;


    }).join("")}


  </tbody>


</table>


`;

}

/* =========================================================
RENDER ORDERS TABLE

IMPORTANT:
Orders are sorted by Order Number / Order ID
in descending numeric order.

Example:

R-100
R-99
R-98
R-97
...
R-2
R-1
========================================================= */

function renderOrdersTable(){

const q=
(
document
.getElementById("orderSearch")
?.value||""
)
.toLowerCase()
.trim();

const st=
document
.getElementById("orderStatusFilter")
?.value||"";

const month=
document
.getElementById("orderMonthFilter")
?.value||"";

const pay=
document
.getElementById("orderPaymentFilter")
?.value||"";

/* ===============================================
FILTER ORDERS
=============================================== */

let list=
filterByMonth(
adminOrders,
month
)


/* STATUS FILTER */

.filter(
  o=>!st||o.status===st
)


/* PAYMENT FILTER */

.filter(
  o=>!pay||o.payment===pay
)


/* SEARCH FILTER */

.filter(

  o=>

    !q||

    [

      o.orderNo,

      o.customerName,

      o.phone,

      o.address,

      ...(o.items||[])
        .flatMap(
          i=>[
            i.design,
            i.size
          ]
        )

    ]

    .join(" ")

    .toLowerCase()

    .includes(q)

)


/* ===============================================
   SORT BY ORDER ID DESCENDING

   R-100
   R-99
   R-98
   ...
   R-1
=============================================== */

.sort(
  (a,b)=>
    orderIdNumber(b)-orderIdNumber(a)
);


/* ===============================================
DISPLAY ORDERS
=============================================== */

document
.getElementById("ordersTable")
.innerHTML=


  renderOrderTableHTML(
    list,
    true
  )

  ||

  "<div class='empty-admin'>No matching orders.</div>";


}

/* =========================================================
CHANGE ORDER STATUS
========================================================= */

function changeOrderStatus(id,status){

apiCall(


"updateStatus",

{
  id,
  status
},


result=>{


  if(result){


    adminOrders=
      result.orders||adminOrders;


    populateMonthFilters();


    renderAdminDashboard();


    renderOrdersTable();


    populateInvoiceSelect();


    renderInvoiceCards();


    if(
      selectedInvoiceOrderId===id
    ){

      renderInvoice();

    }


  }


}


);

}

/* =========================================================
DELETE ORDER
========================================================= */

function deleteOrder(id){

const order=
adminOrders.find(
x=>x.id===id
);

if(!order)return;

if(


!confirm(

  `Delete order ${order.orderNo||''} for ${order.customerName||'this customer'}? This cannot be undone.`

)


)return;

apiCall(


"deleteOrder",

{
  id:String(id)
},


result=>{


  if(result){


    adminOrders=

      Array.isArray(result.orders)

        ?result.orders

        :adminOrders.filter(
          x=>x.id!==id
        );


    if(
      selectedInvoiceOrderId===id
    ){

      selectedInvoiceOrderId="";


      const sel=
        document.getElementById(
          "invoiceOrderSelect"
        );


      if(sel){

        sel.value="";

      }


    }


    populateMonthFilters();


    renderAdminDashboard();


    renderOrdersTable();


    populateInvoiceSelect();


    renderInvoiceCards();


    renderInvoice();


    alert(

      `Order ${order.orderNo||''} deleted successfully.`

    );


  }


}


);

}

/* =========================================================
EDIT ORDER
========================================================= */

function editOrder(id){

const o=
adminOrders.find(
x=>x.id===id
);

if(!o)return;

document
.getElementById("editOrderId")
.value=o.id;

document
.getElementById("editCustomerName")
.value=o.customerName||"";

document
.getElementById("editCustomerPhone")
.value=o.phone||"";

document
.getElementById("editCustomerAddress")
.value=o.address||"";

document
.getElementById("editOrderDate")
.value=dateInputValue(
orderDateKey(o)
);

document
.getElementById("editShipping")
.value=Number(o.shipping||0);

document
.getElementById("editDiscount")
.value=Number(o.discount||0);

document
.getElementById("editStatus")
.value=o.status||"New";

document
.getElementById("editPayment")
.value=o.payment||"Pending";

document
.getElementById("editAdvanceAmount")
.value=
Number(o.advanceAmount||0)||"";

handleEditPaymentChange();

document
.getElementById("editNotes")
.value=o.notes||"";

editOrderItemsDraft=


(o.items||[])

  .map(
    i=>({...i})
  );


renderEditOrderItems();

document
.getElementById("editOrderModal")
.classList
.add("show");

}

/* =========================================================
HIDE EDIT ORDER
========================================================= */

function hideEditOrder(){

document
.getElementById("editOrderModal")
.classList
.remove("show");

}

/* =========================================================
RENDER EDIT ORDER ITEMS
========================================================= */

function renderEditOrderItems(){

const box=
document.getElementById(
"editOrderItems"
);

if(!editOrderItemsDraft.length){


box.innerHTML=

  "<div class='empty-admin' style='grid-column:1/-1'>No items. Use + Add Item.</div>";


document
  .getElementById("editOrderTotalValue")
  .textContent=

    adminMoney(
      editOrderItemsTotal()
    );


return;


}

box.innerHTML=


editOrderItemsDraft.map(
  (x,i)=>`

    <div class="edit-item-card">


      <button
        class="edit-remove"

        onclick="
          removeEditItem(${i})
        "
      >

        ×

      </button>


      <img
        id="edit-thumb-${i}"

        alt="${adminEsc(
          x.design||'Design'
        )}"
      >


      <div class="edit-item-grid">


        <!-- DESIGN -->

        <div>

          <label>

            Design

          </label>


          <input

            value="${adminEsc(x.design||'')}"

            onchange="
              editDraftField(
                ${i},
                'design',
                this.value
              )
            "

          >

        </div>



        <!-- SIZE -->

        <div>

          <label>

            Size

          </label>


          <input

            value="${adminEsc(x.size||'')}"

            onchange="
              editDraftField(
                ${i},
                'size',
                this.value
              )
            "

          >

        </div>



        <!-- PRICE -->

        <div>

          <label>

            Price

          </label>


          <input

            type="number"

            min="0"

            value="${Number(x.price)||0}"

            onchange="
              editDraftField(
                ${i},
                'price',
                this.value
              );

              renderEditOrderItems()
            "

          >

        </div>



        <!-- QUANTITY -->

        <div>

          <label>

            Quantity

          </label>


          <input

            type="number"

            min="1"

            value="${Number(x.quantity)||1}"

            onchange="
              editDraftField(
                ${i},
                'quantity',
                this.value
              );

              renderEditOrderItems()
            "

          >

        </div>


      </div>



      <!-- ITEM SUBTOTAL -->

      <div
        class="manual-total-strip"

        style="
          justify-content:space-between;
          margin-top:6px
        "
      >


        <span>

          Subtotal

        </span>


        <span>

          ${adminMoney(

            (Number(x.price)||0)*
            (Number(x.quantity)||0)

          )}

        </span>


      </div>


    </div>

  `
)
.join("");


/* ===============================================
LOAD ITEM IMAGES
=============================================== */

editOrderItemsDraft.forEach(


(x,i)=>{


  const img=
    document.getElementById(
      "edit-thumb-"+i
    );


  if(img){


    img.src=
      resolveImageUrl(
        x.image||""
      );


    img.onerror=()=>{


      img.onerror=null;


      setupImageFallback(
        img,
        x.image||""
      );


    };


  }


}


);

/* ===============================================
UPDATE TOTAL
=============================================== */

document
.getElementById("editOrderTotalValue")
.textContent=


  adminMoney(
    editOrderItemsTotal()
  );


}

/* =========================================================
UPDATE EDIT ITEM FIELD
========================================================= */

function editDraftField(i,key,value){

if(!editOrderItemsDraft[i])return;

editOrderItemsDraft[i][key]=


(
  key==="price"||
  key==="quantity"
)

  ?Number(value)

  :value;


document
.getElementById("editOrderTotalValue")
.textContent=


  adminMoney(
    editOrderItemsTotal()
  );


}

/* =========================================================
REMOVE EDIT ITEM
========================================================= */

function removeEditItem(i){

editOrderItemsDraft.splice(i,1);

renderEditOrderItems();

}

/* =========================================================
ADD EDIT ITEM MANUALLY
========================================================= */

function addEditItemManually(){

itemSelectionMode="edit";

manualSelectionSavedCart=
copyCart(cart);

replaceCart({});

manualItemSelectionActive=true;

document
.getElementById("editOrderModal")
.classList
.remove("show");

document
.getElementById("adminScreen")
.classList
.remove("show");

document.body.style.overflow="";

document.body.classList.add(
"manual-selection-active"
);

document
.getElementById("manualSelectionBar")
.classList
.add("show");

updateManualSelectionBar();

window.scrollTo({
top:0,
behavior:"auto"
});

}

/* =========================================================
VALIDATE ADVANCE PAYMENT
========================================================= */

function validateEditAdvancePayment(){

const payment=
document
.getElementById("editPayment")
.value;

if(


payment!=="Advanced Received"&&
payment!=="Partially Paid"


)return true;

const t=
editOrderItemsTotal();

const a=
Number(


  document
    .getElementById("editAdvanceAmount")
    .value

);


if(!t){


alert(
  "Add at least one item before entering advance received amount."
);

return false;


}

if(


!Number.isFinite(a)||
a<0||
a>t+0.01


){


alert(
  "Enter a valid advance received amount. It cannot exceed the order total."
);

return false;


}

return true;

}

/* =========================================================
SAVE EDITED ORDER
========================================================= */

function saveEditedOrder(){

if(!validateEditAdvancePayment())return;

const id=
document
.getElementById("editOrderId")
.value;

const original=
adminOrders.find(
x=>x.id===id
);

if(!original)return;

const valid=


editOrderItemsDraft.filter(

  i=>

    String(i.design||"").trim()&&

    String(i.size||"").trim()&&

    Number(i.quantity)>0&&

    Number.isFinite(
      Number(i.price)
    )

);


if(!valid.length){


alert(
  "Add at least one valid item."
);

return;


}

/* ===============================================
CALCULATE TOTALS
=============================================== */

const shipping=
Number(
document
.getElementById("editShipping")
.value
)||0;

const discount=
Number(
document
.getElementById("editDiscount")
.value
)||0;

const subtotal=


valid.reduce(

  (a,i)=>

    a+
    Number(i.price)*
    Number(i.quantity),

  0

);


const total=


Math.max(
  0,
  subtotal+
  shipping-
  discount
);


/* ===============================================
CREATE UPDATED ORDER OBJECT
=============================================== */

const order={


...original,


customerName:

  document
    .getElementById("editCustomerName")
    .value
    .trim(),


phone:

  document
    .getElementById("editCustomerPhone")
    .value
    .trim(),


address:

  document
    .getElementById("editCustomerAddress")
    .value
    .trim(),


orderDate:

  document
    .getElementById("editOrderDate")
    .value,


shipping,


discount,


status:

  document
    .getElementById("editStatus")
    .value,


payment:

  document
    .getElementById("editPayment")
    .value,


advancePercent:

  total

    ?Math.min(

      100,

      (
        Number(

          document
            .getElementById("editAdvanceAmount")
            .value

        )||0
      )

      /total

      *100

    )

    :0,


advanceAmount:

  Number(

    document
      .getElementById("editAdvanceAmount")
      .value

  )||0,


notes:

  document
    .getElementById("editNotes")
    .value
    .trim(),


items:

  valid.map(

    i=>({

      ...i,

      price:Number(i.price),

      quantity:Number(i.quantity),

      image:String(i.image||"")

    })

  ),


subtotal,


total


};

/* ===============================================
SAVE TO GOOGLE SHEETS
=============================================== */

apiCall(


"updateOrder",

{
  order:JSON.stringify(order)
},


result=>{


  if(result){


    adminOrders=
      result.orders||adminOrders;


    hideEditOrder();


    refreshAdmin();


    selectedInvoiceOrderId=id;


    alert(
      "Order updated successfully in Google Sheets."
    );


  }


}


);

}
