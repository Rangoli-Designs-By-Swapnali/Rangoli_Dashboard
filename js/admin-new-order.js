/* =========================================================
   ADMIN NEW ORDER MODULE

   Manual order creation
   Payment status
   Advance Received Amount

   IMPORTANT:
   - Advance amount is editable for:
       Advanced Received
       Partially Paid

   - Paid hides the advance field.

   - Existing order prices are NOT touched here.
     New orders receive the current catalogue price.
========================================================= */


/* =========================================================
   RENDER NEW ORDER ITEMS
========================================================= */

function renderNewOrderItems() {

  const box =
    document.getElementById(
      "newOrderItems"
    );

  if (!box) return;


  /*
   * Do NOT call syncNewAdvanceFromAmount()
   * here.
   *
   * Calling it while rendering can overwrite
   * whatever the user is typing.
   */

  if (!newOrderItems.length) {

    box.innerHTML =
      "<div class='empty-admin'>" +
      "No items yet. Click Add Item to choose designs from the shopping page." +
      "</div>";

    updateManualOrderTotal();

    return;
  }


  box.innerHTML = `

    <div class="order-items">

      <div class="order-items-header">

        <div class="header-image">
          Image
        </div>

        <div class="header-details">
          Design Number
        </div>

        <div class="header-quantity">
          Quantity
        </div>

        <div class="header-subtotal">
          Subtotal
        </div>

      </div>


      ${newOrderItems.map(
        function(x, i) {

          return `

            <div class="order-item">

              <div class="order-thumb-wrapper">

                <img
                  class="order-thumb manual-order-thumb"
                  data-manual-index="${i}"
                  alt="${adminEsc(x.design)}"
                >

              </div>


              <div class="order-details">

                <p class="order-design">
                  ${adminEsc(x.design)}
                </p>

                <span class="order-size">
                  Size: ${adminEsc(x.size)}
                </span>

                <span class="order-price-each">
                  Price each: ${adminMoney(x.price)}
                </span>

              </div>


              <div class="order-quantity">

                <div class="preview-quantity-control">

                  <button
                    type="button"
                    class="quantity-btn"
                    onclick="changeManualItemQuantity(${i},-1,event)"
                  >
                    −
                  </button>

                  <span class="quantity-value">
                    ${Number(x.quantity) || 1}
                  </span>

                  <button
                    type="button"
                    class="quantity-btn"
                    onclick="changeManualItemQuantity(${i},1,event)"
                  >
                    +
                  </button>

                </div>

              </div>


              <div class="order-price">

                ${adminMoney(
                  (Number(x.price) || 0) *
                  (Number(x.quantity) || 1)
                )}

              </div>

            </div>

          `;

        }
      ).join("")}

    </div>

  `;


  /*
   * Load item images.
   */

  box
    .querySelectorAll(
      ".manual-order-thumb"
    )
    .forEach(
      function(img) {

        const item =
          newOrderItems[
            Number(
              img.dataset.manualIndex
            )
          ];

        if (!item) return;


        img.src =
          resolveImageUrl(
            item.image || ""
          );


        img.onerror =
          function() {

            img.onerror = null;

            setupImageFallback(
              img,
              item.image || ""
            );

          };

      }
    );


  updateManualOrderTotal();

}


/* =========================================================
   SUBTOTAL
========================================================= */

function manualOrderSubtotal() {

  return newOrderItems.reduce(
    function(total, item) {

      return total +
        Number(item.price || 0) *
        Number(item.quantity || 0);

    },
    0
  );

}


/* =========================================================
   ORDER TOTAL
========================================================= */

function manualOrderItemsTotal() {

  const shipping =
    Number(
      document.getElementById(
        "newShipping"
      )?.value
    ) || 0;


  const discount =
    Number(
      document.getElementById(
        "newDiscount"
      )?.value
    ) || 0;


  return Math.max(
    0,
    manualOrderSubtotal() +
    shipping -
    discount
  );

}


/* =========================================================
   UPDATE MANUAL ORDER TOTAL
========================================================= */

function updateManualOrderTotal() {

  const total =
    manualOrderItemsTotal();


  const el =
    document.getElementById(
      "newOrderTotalValue"
    );


  if (el) {

    el.textContent =
      adminMoney(total);

  }


  /*
   * Only refresh the summary.
   *
   * IMPORTANT:
   * Do NOT modify the amount input here.
   * Otherwise typing into the amount field
   * can be interrupted.
   */

  refreshNewAdvanceSummary();

}


/* =========================================================
   SHIPPING / DISCOUNT CHANGE
========================================================= */

function syncNewOrderTotals() {

  updateManualOrderTotal();

}


/* =========================================================
   PAYMENT STATUS CHANGE
=========================================================

   Visible for:

   - Advanced Received
   - Partially Paid

   Hidden for:

   - Pending
   - Paid
   - COD
========================================================= */

function handleNewPaymentChange() {

  const payment =
    document.getElementById(
      "newPayment"
    )?.value;


  const box =
    document.getElementById(
      "newAdvancePaymentFields"
    );


  if (!box) return;


  const show =
    payment === "Advanced Received" ||
    payment === "Partially Paid";


  box.style.display =
    show
      ? ""
      : "none";


  if (!show) {

    const amount =
      document.getElementById(
        "newAdvanceAmount"
      );

    if (amount) {

      amount.value = "";

    }


    const summary =
      document.getElementById(
        "newAdvanceSummary"
      );

    if (summary) {

      summary.textContent = "";

    }

  }

  else {

    /*
     * Do NOT overwrite the amount.
     *
     * If the user already entered an amount,
     * keep it.
     */

    refreshNewAdvanceSummary();

  }


  updateManualOrderTotal();

}


/* =========================================================
   REFRESH ADVANCE SUMMARY
========================================================= */

function refreshNewAdvanceSummary() {

  const payment =
    document.getElementById(
      "newPayment"
    )?.value;


  const amountInput =
    document.getElementById(
      "newAdvanceAmount"
    );


  const summary =
    document.getElementById(
      "newAdvanceSummary"
    );


  if (!amountInput || !summary) {

    return;

  }


  const allowed =
    payment === "Advanced Received" ||
    payment === "Partially Paid";


  if (!allowed) {

    summary.textContent = "";

    return;

  }


  const total =
    manualOrderItemsTotal();


  const amount =
    Number(
      amountInput.value
    ) || 0;


  if (!total) {

    summary.textContent =
      "Add items to calculate the amount.";

    return;

  }


  const safeAmount =
    Math.max(
      0,
      Math.min(
        total,
        amount
      )
    );


  summary.textContent =
    `Order total: ${adminMoney(total)} • ` +
    `Amount received: ${adminMoney(safeAmount)} • ` +
    `Remaining: ${adminMoney(
      Math.max(
        0,
        total - safeAmount
      )
    )}`;

}


/* =========================================================
   ADVANCE AMOUNT INPUT
=========================================================

   IMPORTANT:
   While typing, do NOT replace the value.

   Example:

   User types:

   1
   10
   100
   1000

   The browser keeps the input exactly as typed.

========================================================= */

function syncNewAdvanceFromAmount() {

  refreshNewAdvanceSummary();

}


/* =========================================================
   ADVANCE AMOUNT BLUR
=========================================================

   When user leaves the field, validate/clamp
   the amount to the order total.
========================================================= */

function normalizeNewAdvanceAmount() {

  const input =
    document.getElementById(
      "newAdvanceAmount"
    );


  if (!input) return;


  const total =
    manualOrderItemsTotal();


  let amount =
    Number(
      input.value
    );


  if (!Number.isFinite(amount)) {

    amount = 0;

  }


  amount =
    Math.max(
      0,
      amount
    );


  if (total > 0) {

    amount =
      Math.min(
        total,
        amount
      );

  }


  if (amount > 0) {

    input.value =
      amount.toFixed(2);

  }

  else {

    input.value = "";

  }


  refreshNewAdvanceSummary();

}


/* =========================================================
   VALIDATE ADVANCE PAYMENT
========================================================= */

function validateNewAdvancePayment() {

  const payment =
    document.getElementById(
      "newPayment"
    )?.value;


  /*
   * Advance is relevant only for
   * Advanced Received / Partially Paid.
   */

  const requiresAdvance =
    payment === "Advanced Received" ||
    payment === "Partially Paid";


  if (!requiresAdvance) {

    return true;

  }


  const total =
    manualOrderItemsTotal();


  const input =
    document.getElementById(
      "newAdvanceAmount"
    );


  const amount =
    Number(
      input?.value
    );


  /*
   * No items yet.
   */

  if (!total) {

    alert(
      "Add at least one item before entering advance received amount."
    );

    return false;

  }


  /*
   * Empty amount is allowed.
   *
   * It means zero received.
   */

  if (
    input &&
    String(input.value).trim() === ""
  ) {

    return true;

  }


  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > total + 0.01
  ) {

    alert(
      "Enter a valid advance received amount. " +
      "It cannot exceed the order total."
    );

    return false;

  }


  return true;

}


/* =========================================================
   EDIT ORDER TOTAL
========================================================= */

function editOrderItemsTotal() {

  const shipping =
    Number(
      document.getElementById(
        "editShipping"
      )?.value
    ) || 0;


  const discount =
    Number(
      document.getElementById(
        "editDiscount"
      )?.value
    ) || 0;


  return Math.max(
    0,

    editOrderItemsDraft.reduce(
      function(total, item) {

        return total +
          Number(item.price || 0) *
          Number(item.quantity || 0);

      },
      0
    ) +

    shipping -

    discount
  );

}


/* =========================================================
   EDIT PAYMENT STATUS
========================================================= */

function handleEditPaymentChange() {

  const payment =
    document.getElementById(
      "editPayment"
    )?.value;


  const box =
    document.getElementById(
      "editAdvancePaymentFields"
    );


  if (!box) return;


  const show =
    payment === "Advanced Received" ||
    payment === "Partially Paid";


  box.style.display =
    show
      ? ""
      : "none";


  if (show) {

    refreshEditAdvanceSummary();

  }

  else {

    const amount =
      document.getElementById(
        "editAdvanceAmount"
      );


    if (amount) {

      amount.value = "";

    }


    const summary =
      document.getElementById(
        "editAdvanceSummary"
      );


    if (summary) {

      summary.textContent = "";

    }

  }

}


/* =========================================================
   EDIT ADVANCE SUMMARY
========================================================= */

function refreshEditAdvanceSummary() {

  const payment =
    document.getElementById(
      "editPayment"
    )?.value;


  const amount =
    document.getElementById(
      "editAdvanceAmount"
    );


  const summary =
    document.getElementById(
      "editAdvanceSummary"
    );


  if (!amount || !summary) {

    return;

  }


  const allowed =
    payment === "Advanced Received" ||
    payment === "Partially Paid";


  if (!allowed) {

    summary.textContent = "";

    return;

  }


  const total =
    editOrderItemsTotal();


  const received =
    Number(
      amount.value
    ) || 0;


  if (!total) {

    summary.textContent =
      "Add items to calculate the amount.";

    return;

  }


  const safe =
    Math.max(
      0,
      Math.min(
        total,
        received
      )
    );


  summary.textContent =
    `Order total: ${adminMoney(total)} • ` +
    `Amount received: ${adminMoney(safe)} • ` +
    `Remaining: ${adminMoney(
      Math.max(
        0,
        total - safe
      )
    )}`;

}


/* =========================================================
   EDIT ADVANCE AMOUNT
========================================================= */

function syncEditAdvanceFromAmount() {

  refreshEditAdvanceSummary();

}


/* =========================================================
   NORMALIZE EDIT ADVANCE AMOUNT
========================================================= */

function normalizeEditAdvanceAmount() {

  const input =
    document.getElementById(
      "editAdvanceAmount"
    );


  if (!input) return;


  const total =
    editOrderItemsTotal();


  let amount =
    Number(
      input.value
    );


  if (!Number.isFinite(amount)) {

    amount = 0;

  }


  amount =
    Math.max(
      0,
      amount
    );


  if (total > 0) {

    amount =
      Math.min(
        total,
        amount
      );

  }


  input.value =
    amount > 0
      ? amount.toFixed(2)
      : "";


  refreshEditAdvanceSummary();

}


/* =========================================================
   CLEAR NEW ORDER
========================================================= */

function clearNewOrder() {

  newOrderItems = [];


  [
    "newCustomerName",
    "newCustomerPhone",
    "newCustomerAddress",
    "newNotes",
    "newAdvanceAmount"
  ]
    .forEach(
      function(id) {

        const el =
          document.getElementById(
            id
          );

        if (el) {

          el.value = "";

        }

      }
    );


  const date =
    document.getElementById(
      "newOrderDate"
    );


  if (date) {

    date.value =
      localDateKey(
        new Date()
      );

  }


  const shipping =
    document.getElementById(
      "newShipping"
    );


  if (shipping) {

    shipping.value = "0";

  }


  const discount =
    document.getElementById(
      "newDiscount"
    );


  if (discount) {

    discount.value = "0";

  }


  const payment =
    document.getElementById(
      "newPayment"
    );


  if (payment) {

    payment.value =
      "Pending";

  }


  const status =
    document.getElementById(
      "newStatus"
    );


  if (status) {

    status.value =
      "New";

  }


  const box =
    document.getElementById(
      "newAdvancePaymentFields"
    );


  if (box) {

    box.style.display =
      "none";

  }


  const summary =
    document.getElementById(
      "newAdvanceSummary"
    );


  if (summary) {

    summary.textContent = "";

  }


  renderNewOrderItems();

}


/* =========================================================
   SAVE NEW ORDER
========================================================= */

function saveNewOrder() {

  /*
   * Validate payment first.
   */

  if (
    !validateNewAdvancePayment()
  ) {

    return;

  }


  /*
   * Items required.
   */

  if (!newOrderItems.length) {

    alert(
      "Add at least one item."
    );

    return;

  }


  /*
   * Validate every item.
   */

  const valid =
    newOrderItems.filter(
      function(item) {

        return (
          item.design &&
          item.size &&
          Number(item.quantity) > 0 &&
          Number.isFinite(
            Number(item.price)
          )
        );

      }
    );


  if (!valid.length) {

    alert(
      "Please enter valid order items."
    );

    return;

  }


  /* =====================================================
     ORDER VALUES
  ===================================================== */

  const orderDate =
    document.getElementById(
      "newOrderDate"
    ).value ||
    localDateKey(
      new Date()
    );


  const shipping =
    Math.max(
      0,
      Number(
        document.getElementById(
          "newShipping"
        ).value
      ) || 0
    );


  const discount =
    Math.max(
      0,
      Number(
        document.getElementById(
          "newDiscount"
        ).value
      ) || 0
    );


  /*
   * IMPORTANT:
   *
   * Prices here come from newOrderItems.
   *
   * These are the CURRENT catalogue prices
   * when the new order is created.
   *
   * They are stored in the order itself.
   */

  const subtotal =
    valid.reduce(
      function(total, item) {

        return total +
          Number(item.price) *
          Number(item.quantity);

      },
      0
    );


  const total =
    Math.max(
      0,
      subtotal +
      shipping -
      discount
    );


  const payment =
    document.getElementById(
      "newPayment"
    ).value;


  const requiresAdvance =
    payment === "Advanced Received" ||
    payment === "Partially Paid";


  let advanceAmount =
    requiresAdvance
      ? Number(
          document.getElementById(
            "newAdvanceAmount"
          ).value
        ) || 0
      : 0;


  advanceAmount =
    Math.max(
      0,
      Math.min(
        total,
        advanceAmount
      )
    );


  /*
   * Percentage is calculated from the
   * actual amount received.
   */

  const advancePercent =
    total
      ? Math.min(
          100,
          (
            advanceAmount /
            total
          ) *
          100
        )
      : 0;


  /* =====================================================
     ORDER OBJECT
     
     IMPORTANT:
     Every item stores its price.
     This becomes the historical price snapshot.
  ===================================================== */

  const order = {

    id:
      "o_" +
      Date.now() +
      Math.random()
        .toString(36)
        .slice(2, 7),

    orderNo: "",

    orderDate,

    createdAt:
      new Date().toISOString(),

    customerName:
      document.getElementById(
        "newCustomerName"
      ).value.trim(),

    phone:
      document.getElementById(
        "newCustomerPhone"
      ).value.trim(),

    address:
      document.getElementById(
        "newCustomerAddress"
      ).value.trim(),

    shipping,

    status:
      document.getElementById(
        "newStatus"
      ).value,

    payment,

    advancePercent,

    advanceAmount,

    discount,

    notes:
      document.getElementById(
        "newNotes"
      ).value.trim(),


    /*
     * HISTORICAL PRICE SNAPSHOT
     *
     * The price saved here will NOT change
     * when designs.json is changed later.
     */

    items:
      valid.map(
        function(item) {

          return {

            ...item,

            price:
              Number(
                item.price
              ),

            quantity:
              Number(
                item.quantity
              )

          };

        }
      ),


    subtotal,

    total

  };


  /* =====================================================
     SAVE BUTTON
  ===================================================== */

  const saveButton =
    document.querySelector(
      '#admin-neworder button[onclick="saveNewOrder()"]'
    );


  if (saveButton) {

    saveButton.disabled = true;

    saveButton.dataset.originalText =
      saveButton.innerHTML;

    saveButton.innerHTML =
      "⏳ Saving...";

  }


  /* =====================================================
     SAVE TO GOOGLE SHEETS
  ===================================================== */

  apiCall(
    "saveOrder",
    {
      order:
        JSON.stringify(
          order
        )
    },

    function(result, error) {

      if (saveButton) {

        saveButton.disabled = false;

        saveButton.innerHTML =
          saveButton.dataset.originalText ||
          "💾 Save Order";

      }


      if (
        error ||
        !result
      ) {

        return;

      }


      if (
        result.ok === false
      ) {

        alert(
          result.error ||
          "Order could not be saved."
        );

        return;

      }


      adminOrders =
        result.orders ||
        adminOrders;


      const saved =
        (
          result.orders ||
          []
        ).find(
          function(item) {

            return item.id === order.id;

          }
        );


      const no =
        saved?.orderNo ||
        "R-?";


      clearNewOrder();

      refreshAdmin();

      adminTab(
        "neworder"
      );


      const msg =
        document.getElementById(
          "manualSaveMessage"
        );


      const shortageText =
        (
          result.stockShortages ||
          []
        )
          .map(
            function(item) {

              return (
                `${adminEsc(item.design)}: ` +
                `${Number(item.quantity) || 0}`
              );

            }
          )
          .join(", ");


      if (msg) {

        msg.innerHTML =
          `✓ Order <strong>${adminEsc(no)}</strong> saved successfully.` +

          (
            shortageText
              ? `
                <small class="manual-stock-warning">
                  Stock preparation required:
                  ${shortageText}
                </small>
              `
              : `
                <small>
                  Stock reserved successfully.
                </small>
              `
          );


        msg.classList.add(
          "show"
        );


        setTimeout(
          function() {

            msg.classList.remove(
              "show"
            );

          },
          8000
        );

      }

    }
  );

}