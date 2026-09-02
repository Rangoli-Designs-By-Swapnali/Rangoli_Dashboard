/* =========================================================
   SITE MODULE
   Catalogue + cart + customer order + WhatsApp
========================================================= */
/* =========================================================
   DATA
========================================================= */

let designs = [];

const cart = {};
let pendingCustomerOrderMode="";
function fitViewport(){document.documentElement.style.setProperty("--vh",(window.innerHeight*0.01)+"px");}
window.addEventListener("resize",fitViewport,{passive:true});
window.addEventListener("orientationchange",fitViewport,{passive:true});
fitViewport();


/* =========================================================
   LOAD JSON
========================================================= */

async function loadDesigns() {

  try {

    const response =
      await fetch(
        "designs.json",
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        `Unable to load designs.json (${response.status})`
      );

    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        "designs.json must contain a JSON array."
      );

    }


    designs =
      normalizeDesigns(data);


    renderDesigns();

    updateCart();

    if(document.getElementById("adminScreen")?.classList.contains("show") && typeof renderStocks === "function") renderStocks();

  }

  catch (error) {

    console.error(error);


    document.getElementById(
      "designGrid"
    ).innerHTML = `

      <div style="
        padding:25px;
        text-align:center;
        background:#fff;
        border-radius:16px;
        color:#8b5268;
      ">

        <strong>
          Unable to load designs.
        </strong>

        <br><br>

        Make sure
        <b>designs.json</b>
        is in the same folder as this HTML.

        <br><br>

        <small>
          ${escapeHtml(error.message)}
        </small>

      </div>

    `;

  }

}


/* =========================================================
   NORMALIZE JSON
========================================================= */

function normalizeDesigns(data) {

  return data

    .map(
      (item, index) => {

        if (
          !item ||
          typeof item !== "object"
        ) {

          return null;

        }


        const designName =
          String(
            item.design || ""
          ).trim();


        const image =
          String(
            item.image || ""
          ).trim();


        if (
          !designName ||
          !image
        ) {

          return null;

        }


        const variants =
          Array.isArray(item.variants)

            ? item.variants
                .map(
                  variant => {

                    if (
                      !variant ||
                      typeof variant !== "object"
                    ) {

                      return null;

                    }


                    const size =
                      String(
                        variant.size ||
                        "Standard"
                      ).trim();


                    const price =
                      Number(
                        String(
                          variant.price ?? ""
                        )
                          .replace(/,/g, "")
                          .replace(/[₹$]/g, "")
                          .trim()
                      );


                    if (
                      !Number.isFinite(price)
                    ) {

                      return null;

                    }


                    return {
                      size,
                      price
                    };

                  }
                )
                .filter(Boolean)

            : [];


        return {

          id: index + 1,

          name: designName,

          image,

          variants

        };

      }
    )

    .filter(Boolean);

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   IMAGE FALLBACK
========================================================= */

function setupImageFallback(
  img,
  filename
) {

  const base="https://raw.githubusercontent.com/Rangoli-Designs-By-Swapnali/Rangoli_Dashboard/main/Images/";
  const clean=String(filename||"").split("/").pop();
  img.src=base+encodeURIComponent(clean);


  img.onerror =
    function() {

      img.onerror = null;

      img.style.display =
        "none";


      const wrapper =
        img.parentElement;


      if (wrapper) {

        wrapper.classList.add(
          "image-missing"
        );


        const message =
          document.createElement(
            "span"
          );


        message.textContent =
          "Image unavailable";


        wrapper.appendChild(
          message
        );

      }

    };

}


/* =========================================================
   RENDER DESIGNS
========================================================= */

function renderDesigns() {
  const grid=document.getElementById("designGrid");
  if(!grid)return;
  grid.innerHTML="";

  designs.forEach(design=>{
    const card=document.createElement("div");
    card.className="design-card";
    card.id=`card-${design.id}`;
    if(stockSelectionMode)card.dataset.stockDesignKey=stockKeyForSite(design.name);

    const imageWrapper=document.createElement("div");
    imageWrapper.className="design-image-wrapper";
    const image=document.createElement("img");
    image.className="design-image";
    image.alt=design.name;
    image.loading="lazy";
    imageWrapper.appendChild(image);
    setupImageFallback(image,design.image);
    card.appendChild(imageWrapper);

    const title=document.createElement("div");
    title.className="design-title";
    title.textContent=design.name;
    card.appendChild(title);

    const bottom=document.createElement("div");
    bottom.className="design-bottom";

    if(stockSelectionMode){
      design.variants.forEach((variant,variantIndex)=>{
        const key=stockVariantKeyForSite(design.name,variant.size);
        const quantity=Math.max(0,Math.floor(Number(stockSelection[key])||0));
        const row=document.createElement("div");
        row.className="variant-row";
        row.innerHTML=`
          <label class="select-label" title="Select size">
            <input type="checkbox" ${quantity>0?"checked":""} onchange="toggleStockVariant(${JSON.stringify(design.name)},${JSON.stringify(variant.size)},this.checked)">
          </label>
          <span class="design-size">Size: ${escapeHtml(variant.size)}</span>
          <span class="design-price">₹${formatPrice(variant.price)}</span>
          <div class="quantity-controls">
            <button type="button" class="quantity-btn" onclick="changeStockSelectionQuantity(${JSON.stringify(design.name)},${JSON.stringify(variant.size)},-1,event)">−</button>
            <input type="number" min="0" step="1" value="${quantity}" style="width:42px;text-align:center;border:0;background:transparent;font-weight:700;color:#5b1738" onchange="setStockSelectionQuantity(${JSON.stringify(design.name)},${JSON.stringify(variant.size)},this.value)">
            <button type="button" class="quantity-btn" onclick="changeStockSelectionQuantity(${JSON.stringify(design.name)},${JSON.stringify(variant.size)},1,event)">+</button>
          </div>
        `;
        bottom.appendChild(row);
      });
      card.classList.toggle("selected",design.variants.some(v=>Number(stockSelection[stockVariantKeyForSite(design.name,v.size)])>0));
    }else{
      design.variants.forEach((variant,variantIndex)=>{
        const row=document.createElement("div");
        row.className="variant-row";
        row.innerHTML=`
          <label class="select-label" title="Select design">
            <input type="checkbox" data-design-id="${design.id}" data-variant-index="${variantIndex}" onchange="toggleVariant(${design.id},${variantIndex},this.checked)">
          </label>
          <span class="design-size">Size: ${escapeHtml(variant.size)}</span>
          <span class="design-price">₹${formatPrice(variant.price)}</span>
          <div class="quantity-controls">
            <button type="button" class="quantity-btn" onclick="changeQuantity(${design.id},${variantIndex},-1)">−</button>
            <span class="quantity-value" id="qty-${design.id}-${variantIndex}">0</span>
            <button type="button" class="quantity-btn" onclick="changeQuantity(${design.id},${variantIndex},1)">+</button>
          </div>
        `;
        bottom.appendChild(row);
      });
    }

    card.appendChild(bottom);
    grid.appendChild(card);
  });
}
function stockKeyForSite(design){return String(design||"").trim().toLowerCase()}
function stockVariantKeyForSite(design,size){return String(design||"").trim().toLowerCase()+"||"+String(size||"").trim().toLowerCase()}
function toggleStockVariant(designName,size,checked){
  const key=stockVariantKeyForSite(designName,size);
  if(checked)stockSelection[key]=Math.max(1,Number(stockSelection[key])||1);
  else delete stockSelection[key];
  updateStockSelectionCard(designName,size);
  updateStockSelectionBar();
}
function setStockSelectionQuantity(designName,size,value){
  const key=stockVariantKeyForSite(designName,size);
  const quantity=Math.max(0,Math.floor(Number(value)||0));
  if(quantity<=0)delete stockSelection[key];
  else stockSelection[key]=quantity;
  updateStockSelectionCard(designName,size);
  updateStockSelectionBar();
}
function changeStockSelectionQuantity(designName,size,amount,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const key=stockVariantKeyForSite(designName,size);
  const next=Math.max(0,(Number(stockSelection[key])||0)+amount);
  setStockSelectionQuantity(designName,size,next);
}
function updateStockSelectionCard(designName,size){
  const designKey=String(designName||"").trim().toLowerCase();
  const card=document.querySelector(`[data-stock-design-key="${CSS.escape(designKey)}"]`);
  if(!card)return;
  const key=stockVariantKeyForSite(designName,size);
  const qty=Math.max(0,Number(stockSelection[key])||0);
  const rows=card.querySelectorAll('.variant-row');
  let target=null;
  rows.forEach(row=>{const label=row.querySelector('.design-size');if(label&&label.textContent.trim().toLowerCase()===('size: '+String(size||'').trim().toLowerCase()))target=row});
  if(!target)return;
  const checkbox=target.querySelector('input[type="checkbox"]');
  const input=target.querySelector('input[type="number"]');
  if(checkbox)checkbox.checked=qty>0;
  if(input)input.value=String(qty);
  card.classList.toggle('selected',Array.from(card.querySelectorAll('input[type="number"]')).some(i=>Number(i.value)>0));
}
function selectedStockItems(){
  const selected=[];
  designs.forEach(d=>d.variants.forEach(v=>{
    const quantity=Math.max(0,Math.floor(Number(stockSelection[stockVariantKeyForSite(d.name,v.size)]||0)));
    if(quantity>0)selected.push({design:d.name,size:v.size,price:Number(v.price)||0,image:d.image||"",quantity,designId:d.id,variantIndex:d.variants.indexOf(v)});
  }));
  return selected;
}
function updateStockSelectionBar(){
  const total=selectedStockItems().reduce((sum,item)=>sum+item.quantity,0);
  const el=document.getElementById('manualSelectionTotal');
  if(el)el.textContent=String(total);
}
/* =========================================================
   PRICE
========================================================= */

function formatPrice(price) {

  return Number(price)
    .toLocaleString(
      "en-IN"
    );

}


/* =========================================================
   CART KEY
========================================================= */

function getCartKey(
  designId,
  variantIndex
) {

  return `${designId}-${variantIndex}`;

}


/* =========================================================
   SELECT / UNSELECT
========================================================= */

function toggleVariant(
  designId,
  variantIndex,
  selected
) {

  const key =
    getCartKey(
      designId,
      variantIndex
    );


  if (selected) {

    cart[key] =
      cart[key] || 1;

  }

  else {

    delete cart[key];

  }


  updateVariantUI(
    designId,
    variantIndex
  );


  updateCardSelection(
    designId
  );


  updateCart();
  updateManualSelectionBar();

}


/* =========================================================
   QUANTITY
========================================================= */

function changeQuantity(
  designId,
  variantIndex,
  amount
) {

  const key =
    getCartKey(
      designId,
      variantIndex
    );


  let quantity =
    cart[key] || 0;


  quantity += amount;


  if (quantity <= 0) {

    delete cart[key];

  }

  else {

    cart[key] =
      quantity;

  }


  updateVariantUI(
    designId,
    variantIndex
  );


  updateCardSelection(
    designId
  );


  updateCart();
  updateManualSelectionBar();

}


/* =========================================================
   UPDATE VARIANT UI
========================================================= */

function updateVariantUI(
  designId,
  variantIndex
) {

  const key =
    getCartKey(
      designId,
      variantIndex
    );


  const quantity =
    cart[key] || 0;


  const quantityElement =
    document.getElementById(
      `qty-${designId}-${variantIndex}`
    );


  if (quantityElement) {

    quantityElement.textContent =
      String(quantity);

  }


  const card =
    document.getElementById(
      `card-${designId}`
    );


  if (!card) {

    return;

  }


  const rows =
    card.querySelectorAll(
      ".variant-row"
    );


  const row =
    rows[variantIndex];


  if (!row) {

    return;

  }


  const checkbox =
    row.querySelector(
      'input[type="checkbox"]'
    );


  if (checkbox) {

    checkbox.checked =
      quantity > 0;

  }

}


/* =========================================================
   CARD SELECTION
========================================================= */

function updateCardSelection(
  designId
) {

  const card =
    document.getElementById(
      `card-${designId}`
    );


  if (!card) {

    return;

  }


  const design =
    designs.find(
      item =>
        item.id === designId
    );


  if (!design) {

    return;

  }


  let selected =
    false;


  design.variants.forEach(
    (
      variant,
      variantIndex
    ) => {

      const key =
        getCartKey(
          designId,
          variantIndex
        );


      if (
        (cart[key] || 0) > 0
      ) {

        selected = true;

      }

    }
  );


  card.classList.toggle(
    "selected",
    selected
  );

}


/* =========================================================
   TOTAL
========================================================= */

function getCartTotal() {

  let total = 0;


  designs.forEach(
    design => {

      design.variants.forEach(
        (
          variant,
          variantIndex
        ) => {

          const key =
            getCartKey(
              design.id,
              variantIndex
            );


          const quantity =
            cart[key] || 0;


          total +=
            variant.price *
            quantity;

        }
      );

    }
  );


  return total;

}


/* =========================================================
   ITEM COUNT
========================================================= */

function getCartItemCount() {

  let count = 0;


  Object.values(
    cart
  ).forEach(
    quantity => {

      count += quantity;

    }
  );


  return count;

}


/* =========================================================
   UPDATE CART
========================================================= */

function updateCart() {

  const total =
    getCartTotal();


  const count =
    getCartItemCount();


  const cartCount =
    document.getElementById(
      "cartCount"
    );


  const cartTotal =
    document.getElementById(
      "cartTotal"
    );


  const modalTotal =
    document.getElementById(
      "modalTotal"
    );


  if (cartCount) {

    cartCount.textContent =
      count === 1
        ? "1 item"
        : `${count} items`;

  }


  if (cartTotal) {

    cartTotal.textContent =
      `₹${formatPrice(total)}`;

  }


  if (modalTotal) {

    modalTotal.textContent =
      `₹${formatPrice(total)}`;

  }

}


/* =========================================================
   RENDER CART PREVIEW
========================================================= */

function renderCartPreview() {
  const orderItems = document.getElementById("orderItems");
  orderItems.innerHTML = "";

  const hasItems = Object.keys(cart).some(key => (cart[key] || 0) > 0);

  if (!hasItems) {
    orderItems.innerHTML = `
      <div class="empty-cart">
        Your cart is empty.
        <br><br>
        Select a design to start your order.
      </div>
    `;
    updateCart();
    return;
  }

  orderItems.innerHTML = `
    <div class="order-items-header">
      <div class="header-image">Image</div>
      <div class="header-details">Design Number</div>
      <div class="header-quantity">Quantity</div>
      <div class="header-subtotal">Subtotal</div>
    </div>
  `;

  designs.forEach(design => {
    design.variants.forEach((variant, variantIndex) => {
      const key = getCartKey(design.id, variantIndex);
      const quantity = cart[key] || 0;
      if (quantity <= 0) return;

      const subtotal = variant.price * quantity;
      const item = document.createElement("div");
      item.className = "order-item";
      item.dataset.cartKey = key;

      item.innerHTML = `
        <div class="order-thumb-wrapper">
          <img class="order-thumb" alt="${escapeHtml(design.name)}">
        </div>

        <div class="order-details">
          <p class="order-design">${escapeHtml(design.name)}</p>
          <span class="order-size">Size: ${escapeHtml(variant.size)}</span>
          <span class="order-price-each">Price each: ₹${formatPrice(variant.price)}</span>
        </div>

        <div class="order-quantity">
          <div class="preview-quantity-control">
            <button type="button" class="quantity-btn" aria-label="Decrease quantity" onclick="changePreviewQuantity(${design.id}, ${variantIndex}, -1, event)">−</button>
            <span class="quantity-value">${quantity}</span>
            <button type="button" class="quantity-btn" aria-label="Increase quantity" onclick="changePreviewQuantity(${design.id}, ${variantIndex}, 1, event)">+</button>
          </div>
        </div>

        <div class="order-price">₹${formatPrice(subtotal)}</div>
      `;

      orderItems.appendChild(item);
      setupImageFallback(item.querySelector(".order-thumb"), design.image);
    });
  });

  updateCart();
}


/* =========================================================
   CHANGE QUANTITY FROM CART PREVIEW
========================================================= */

function changePreviewQuantity(designId, variantIndex, amount, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const key = getCartKey(designId, variantIndex);
  let quantity = cart[key] || 0;
  quantity += amount;

  if (quantity <= 0) delete cart[key];
  else cart[key] = quantity;

  updateVariantUI(designId, variantIndex);
  updateCardSelection(designId);
  updateCart();
  updateManualSelectionBar();
  renderCartPreview();
}


/* =========================================================
   OPEN CART
========================================================= */

function openCart() {
  renderCartPreview();
  document.getElementById("orderModal").classList.add("show");
}


/* =========================================================
   CLOSE CART
========================================================= */

let cartPreviewHistoryActive = false;

function showCartModal() {

  document
    .getElementById(
      "orderModal"
    )
    .classList.add(
      "show"
    );

}

function hideCartModal() {

  document
    .getElementById(
      "orderModal"
    )
    .classList.remove(
      "show"
    );

}

function closeCart(fromBrowserBack = false) {

  /*
     IMPORTANT:
     Closing the preview cart must NEVER clear the cart object.
     The modal is hidden immediately so the button responds on the
     first click. The temporary history entry is then removed.
  */

  const wasOpenInHistory =
    cartPreviewHistoryActive;

  // Close the preview immediately.
  hideCartModal();

  // Mark it inactive BEFORE history.back() so the popstate handler
  // does not try to close it a second time.
  cartPreviewHistoryActive = false;

  // If this was a normal UI close (× / Continue Shopping), remove
  // the temporary history entry. Do not do this for browser Back.
  if (
    !fromBrowserBack &&
    wasOpenInHistory
  ) {

    history.back();

  }

}

function continueShopping(event) {

  // Prevent any default button/form behaviour.
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Close immediately on the FIRST click.
  closeCart(false);

}

/*
   Create one temporary browser-history entry whenever the preview cart
   opens. This makes the browser Back button behave like "close preview"
   instead of navigating away/reloading the shopping page.
*/
window.addEventListener(
  "popstate",
  function() {

    if (
      cartPreviewHistoryActive
    ) {

      cartPreviewHistoryActive = false;

      hideCartModal();

      updateCart();

    }

  }
);


/* =========================================================
   PLACE ORDER
========================================================= */

let orderSaving = false;

function resolveImageUrl(src) {
  if (!src) return "";
  const value=String(src).trim();
  if(/github\.com\/Rangoli-Designs-By-Swapnali\/Rangoli_Dashboard\/blob\/main\/Images\//i.test(value)){
    const filename=decodeURIComponent(value.split('/Images/').pop()||'').split('?')[0];
    return "https://raw.githubusercontent.com/Rangoli-Designs-By-Swapnali/Rangoli_Dashboard/main/Images/"+encodeURIComponent(filename);
  }
  if(/^https?:\/\//i.test(value)) return value;
  const filename=decodeURIComponent(value.split("/").pop()||"").trim();
  if(filename) return "https://raw.githubusercontent.com/Rangoli-Designs-By-Swapnali/Rangoli_Dashboard/main/Images/"+encodeURIComponent(filename);
  return value;
}

function setDesignImage(img, src){
  if(!img)return;
  const value=String(src||"").trim();
  const filename=decodeURIComponent(value.split("/").pop()||"").trim();
  const candidates=[];
  if(/^https?:\/\//i.test(value)) candidates.push(value);
  if(filename){
    const base="https://raw.githubusercontent.com/Rangoli-Designs-By-Swapnali/Rangoli_Dashboard/main/Images/";
    candidates.push(base+encodeURIComponent(filename));
    const noExt=filename.replace(/\.[^.]+$/,'');
    if(noExt!==filename){
      ['.jpg','.jpeg','.png','.webp','.JPG','.JPEG','.PNG','.WEBP'].forEach(ext=>candidates.push(base+encodeURIComponent(noExt+ext)));
    }
  }
  let n=0;
  const tryNext=()=>{ if(n>=candidates.length){img.style.display='none';return;} img.style.display=''; img.src=candidates[n++]; };
  img.onerror=tryNext; tryNext();
}

function getCartOrderItems() {
  const items = [];
  designs.forEach(design => {
    design.variants.forEach((variant, variantIndex) => {
      const key = getCartKey(design.id, variantIndex);
      const quantity = Number(cart[key] || 0);
      if (quantity <= 0) return;
      items.push({
        design: design.name,
        size: variant.size,
        price: Number(variant.price),
        quantity,
        image: resolveImageUrl(design.image),
        designId: design.id,
        variantIndex
      });
    });
  });
  return items;
}

function buildWhatsAppMessage(items) {
  let message = "Hi @Rangoli_By_Swapnali 👋\n\n";
  message += "I would like to place an order for these Rangoli designs:\n\n";
  items.forEach(item => {
    const subtotal = item.price * item.quantity;
    message += `${item.design}\n`;
    message += `Size: ${item.size}\n`;
    message += `Quantity: ${item.quantity}\n`;
    message += `Price: ₹${formatPrice(item.price)} each\n`;
    message += `Subtotal: ₹${formatPrice(subtotal)}\n\n`;
  });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  message += `Total Order Value (Excluding Shipping Charges): ₹${formatPrice(total)}\n\n`;
  message += "* Shipping Charges Applicable as per location.\n\n";
  message += "Order will be dispatched within 10 to 12 days.\n\n";
  message += "Please confirm availability and final shipping charges. Thank you! 🌸";
  return message;
}

function placeOrder(){
  if(orderSaving)return;
  const items=getCartOrderItems();
  if(!items.length){alert("Please select at least one design before placing your order.");return}
  pendingCustomerOrderMode="whatsapp";
  openCustomerDetails();
}
function openCustomerDetails(){
  const m=document.getElementById("customerDetailsModal");
  if(!m)return;
  m.classList.add("show");
  setTimeout(()=>document.getElementById("customerOrderName")?.focus(),80);
}
function closeCustomerDetails(){document.getElementById("customerDetailsModal")?.classList.remove("show")}
function confirmCustomerDetails(){
  const name=document.getElementById("customerOrderName").value.trim();
  const phone=document.getElementById("customerOrderPhone").value.trim();
  const address=document.getElementById("customerOrderAddress").value.trim();
  if(!name||!phone||!address){alert("Please enter Name, Phone Number and Address.");return}
  const items=getCartOrderItems(); if(!items.length){closeCustomerDetails();alert("Your cart is empty.");return}
  const orderId="o_"+Date.now()+Math.random().toString(36).slice(2,8);
  const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  const order={id:orderId,orderNo:"",orderDate:localDateKey(new Date()),createdAt:new Date().toISOString(),customerName:name,phone:phone,address:address,shipping:0,status:"New",payment:"Pending",advancePercent:0,advanceAmount:0,discount:0,notes:"Created from shopping page.",items,subtotal,total:subtotal};
  closeCustomerDetails();
  orderSaving=true;
  apiCall("saveOrder",{order:JSON.stringify(order)},result=>{
    orderSaving=false;
    if(!result)return;
    adminOrders=result.orders||adminOrders;
    const saved=adminOrders.find(x=>x.id===orderId);
    if(pendingCustomerOrderMode==="whatsapp"){
      const whatsappURL="https://wa.me/917972313283?text="+encodeURIComponent(buildWhatsAppMessage(items));
      window.open(whatsappURL,"_blank");
    }
    Object.keys(cart).forEach(k=>delete cart[k]);
    designs.forEach(d=>d.variants.forEach((v,vi)=>updateVariantUI(d.id,vi)));
    designs.forEach(d=>updateCardSelection(d.id));
    updateCart();hideCartModal();pendingCustomerOrderMode="";
    const shortageText=(result.stockShortages||[]).map(x=>`${x.design}: ${x.quantity}`).join(", ");
    alert(`Order ${saved?.orderNo||"R-?"} has been recorded in Google Sheets.`+(shortageText?`\n\nStock preparation required: ${shortageText}`:""));
  });
}


/* =========================================================
   CLOSE MODAL BY CLICKING OUTSIDE
========================================================= */

document
  .getElementById(
    "orderModal"
  )
  .addEventListener(
    "click",
    function(event) {

      if (
        event.target === this
      ) {

        closeCart();

      }

    }
  );
