/* =========================================================
   ADMIN STOCKS MODULE
   Variant-level stock, preparation queue, natural design order
========================================================= */
// adminStocks is declared globally in admin-core.js and shared by this module.
const stockSavingKeys=new Set();
const stockPendingValues={};

function stockNaturalCompare(a,b){
  const A=String(a||"").trim(),B=String(b||"").trim();
  const rx=/^(.*?)(\d+)(?:-([A-Za-z]+))?$/;
  const ma=A.match(rx),mb=B.match(rx);
  if(ma&&mb){
    const p=ma[1].localeCompare(mb[1],undefined,{sensitivity:"base"});
    if(p)return p;
    const n=Number(ma[2])-Number(mb[2]);
    if(n)return n;
    const sa=ma[3]||"",sb=mb[3]||"";
    if(!sa&&!sb)return A.localeCompare(B,undefined,{numeric:true,sensitivity:"base"});
    if(!sa)return -1;if(!sb)return 1;
    return sa.localeCompare(sb,undefined,{numeric:true,sensitivity:"base"});
  }
  return A.localeCompare(B,undefined,{numeric:true,sensitivity:"base"});
}
function stockKey(design,size){return (String(design||"").trim()+"||"+String(size||"").trim()).toLowerCase()}
function getStockRecord(design,size){
  const key=stockKey(design,size);
  return adminStocks.find(x=>stockKey(x.design,x.size)===key)||{design,size,stock:0,needToPrepare:0,image:""};
}
function stockDisplayQuantity(record){return Math.max(0,Number(record?.stock)||0)}
function stockNeedQuantity(record){return Math.max(0,Number(record?.needToPrepare)||0)}
function refreshStocks(){
  apiCall("listStocks",{},result=>{
    if(!result)return;
    adminStocks=Array.isArray(result.stocks)?result.stocks:[];
    renderStocks();
  });
}
function stockRecordsFromDesigns(){
  /*
   * Google Sheets is the source of truth for actual stock quantities.
   * designs.json is only used to enrich rows with image/price and to show
   * zero-stock variants that exist in the catalogue.
   *
   * This is intentionally resilient: if designs.json is temporarily
   * unavailable, existing Google Sheet stock rows are still displayed.
   */
  const records=[];
  const seen=new Set();
  const catalogue=Array.isArray(designs)?designs:[];

  catalogue.forEach(d=>{
    (Array.isArray(d.variants)?d.variants:[]).forEach((v,vi)=>{
      const design=String(d.name||'').trim();
      const size=String(v.size||'').trim();
      if(!design||!size)return;
      const key=stockKey(design,size);
      const r=getStockRecord(design,size);
      seen.add(key);
      records.push({
        design,
        image:String(d.image||r.image||''),
        size,
        price:Number(v.price)||0,
        variantIndex:vi,
        stock:stockDisplayQuantity(r),
        needToPrepare:stockNeedQuantity(r)
      });
    });
  });

  /* Add stock rows that exist in Google Sheets but are not present in the
     currently loaded designs.json. This fixes the "No designs found" case
     on Available Stocks and also makes the page reflect real sheet data. */
  adminStocks.forEach(r=>{
    const design=String(r.design||'').trim();
    const size=String(r.size||'').trim();
    if(!design||!size)return;
    const key=stockKey(design,size);
    if(seen.has(key))return;

    records.push({
      design,
      image:String(r.image||''),
      size,
      price:0,
      variantIndex:-1,
      stock:stockDisplayQuantity(r),
      needToPrepare:stockNeedQuantity(r)
    });
    seen.add(key);
  });

  return records;
}

function renderStocks(){
  const needBox=document.getElementById("needToPrepareGrid");
  const needEmpty=document.getElementById("needToPrepareEmpty");
  const availableBox=document.getElementById("availableStockGrid");
  const availableEmpty=document.getElementById("availableStockEmpty");
  if(!needBox||!availableBox)return;

  const q=(document.getElementById("stockSearch")?.value||"").toLowerCase().trim();
  const sort=document.getElementById("stockSort")?.value||"name";
  const filter=document.getElementById("stockFilter")?.value||"all";
  let records=stockRecordsFromDesigns().filter(x=>!q||x.design.toLowerCase().includes(q)||String(x.size).toLowerCase().includes(q));
  const matchesFilter=x=>filter==="all"||(filter==="available"&&x.stock>0)||(filter==="zero"&&x.stock<=0)||(filter==="need"&&x.needToPrepare>0);
  records=records.filter(matchesFilter);

  const need=records.filter(x=>x.needToPrepare>0).sort((a,b)=>b.needToPrepare-a.needToPrepare||stockNaturalCompare(a.design,b.design)||a.size.localeCompare(b.size,undefined,{numeric:true}));
  needBox.innerHTML=need.map(stockNeedCardHTML).join("");
  needBox.querySelectorAll("img[data-stock-image]").forEach(img=>setDesignImage(img,img.dataset.imageSrc||""));
  needEmpty.style.display=need.length?"none":"block";

  const available=records.slice().sort((a,b)=>{
    if(sort==="stockAsc")return a.stock-b.stock||stockNaturalCompare(a.design,b.design)||a.size.localeCompare(b.size,undefined,{numeric:true});
    if(sort==="stockDesc")return b.stock-a.stock||stockNaturalCompare(a.design,b.design)||a.size.localeCompare(b.size,undefined,{numeric:true});
    if(sort==="priceAsc")return a.price-b.price||stockNaturalCompare(a.design,b.design)||a.size.localeCompare(b.size,undefined,{numeric:true});
    if(sort==="priceDesc")return b.price-a.price||stockNaturalCompare(a.design,b.design)||a.size.localeCompare(b.size,undefined,{numeric:true});
    return stockNaturalCompare(a.design,b.design)||a.size.localeCompare(b.size,undefined,{numeric:true});
  });
  availableBox.innerHTML=available.map(stockCardHTML).join("");
  availableBox.querySelectorAll("img[data-stock-image]").forEach(img=>setDesignImage(img,img.dataset.imageSrc||""));
  availableEmpty.style.display=available.length?"none":"block";
}
function stockNeedCardHTML(x){
  return `<div class="stock-need-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||"")}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name" title="${adminEsc(x.design)}">${adminEsc(x.design)}</div>
    <div class="stock-size-line">${adminEsc(x.size)}</div>
    <div class="stock-price-line">${adminMoney(x.price)}</div>
    <div class="stock-need-number">Prepare ${x.needToPrepare}</div>
  </div>`;
}
function stockCardHTML(x){
  const key=stockKey(x.design,x.size);
  return `<div class="stock-card">
    <div class="stock-thumb-wrap"><img class="stock-thumb" data-stock-image="1" data-image-src="${adminEsc(x.image||"")}" alt="${adminEsc(x.design)}"></div>
    <div class="stock-card-name" title="${adminEsc(x.design)}">${adminEsc(x.design)}</div>
    <div class="stock-size-line" title="${adminEsc(x.size)}">${adminEsc(x.size)}</div>
    <div class="stock-price-line">${adminMoney(x.price)}</div>
    <div class="stock-quantity-label">Available Stock</div>
    <div class="stock-quantity-control">
      <button type="button" onclick="changeStockQuantity('${adminEsc(x.design)}','${adminEsc(x.size)}',-1,event)">−</button>
      <input id="stock-${encodeURIComponent(key)}" type="number" min="0" step="1" value="${x.stock}" onchange="saveStockQuantity('${adminEsc(x.design)}','${adminEsc(x.size)}',this.value)">
      <button type="button" onclick="changeStockQuantity('${adminEsc(x.design)}','${adminEsc(x.size)}',1,event)">+</button>
    </div>
    ${x.needToPrepare>0?`<div class="stock-card-need">Need to prepare: ${x.needToPrepare}</div>`:""}
  </div>`;
}
function getStockInput(design,size){return document.getElementById("stock-"+encodeURIComponent(stockKey(design,size)))}
function changeStockQuantity(design,size,delta,event){
  if(event){event.preventDefault();event.stopPropagation()}
  const input=getStockInput(design,size);if(!input)return;
  const next=Math.max(0,Math.round((Number(input.value)||0)+delta));
  input.value=String(next);
  saveStockQuantity(design,size,next);
}
function saveStockQuantity(design,size,value){
  const stock=Math.max(0,Math.floor(Number(value)||0));
  const key=stockKey(design,size);
  stockPendingValues[key]=stock;
  processStockSave(design,size,key);
}
function processStockSave(design,size,key){
  if(stockSavingKeys.has(key))return;
  const stock=stockPendingValues[key];
  if(stock===undefined)return;
  delete stockPendingValues[key];
  stockSavingKeys.add(key);
  const input=getStockInput(design,size);if(input)input.disabled=true;
  apiCall("updateStock",{stock:{design:String(design),size:String(size),stock}},(result,error)=>{
    stockSavingKeys.delete(key);
    if(error||!result){
      stockPendingValues[key]=stock;
      if(input)input.disabled=false;
      return;
    }
    adminStocks=Array.isArray(result.stocks)?result.stocks:adminStocks;
    if(input)input.disabled=false;
    if(stockPendingValues[key]!==undefined)processStockSave(design,size,key);
    else renderStocks();
  });
}

/* =========================================================
   PRINT ALL DESIGNS
   Prints: Design Name + Image + Size + Price
   ========================================================= */
/* =========================================================
   PRINT ALL DESIGNS
   Layout:
   IMAGE | DESIGN NAME | SIZE | PRICE
   ========================================================= */

async function printAllDesigns() {

  if (!Array.isArray(designs) || !designs.length) {
    alert("Designs are not loaded yet. Please wait and try again.");
    return;
  }

  const printWindow = window.open(
    "",
    "_blank",
    "width=1200,height=900"
  );

  if (!printWindow) {
    alert("Please allow pop-ups for this website to print the designs.");
    return;
  }

  /* Show loading message while images are prepared */
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Preparing Designs...</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }

        .loading {
          text-align: center;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="loading">
        Preparing design images for printing...<br>
        Please wait.
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();

  /*
   * Convert an image URL to a data URL.
   * This embeds the actual image inside the print document.
   */
  async function imageToDataURL(url) {

    if (!url) return "";

    try {

      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Image request failed");
      }

      const blob = await response.blob();

      return await new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onloadend = function () {
          resolve(reader.result);
        };

        reader.onerror = reject;

        reader.readAsDataURL(blob);

      });

    } catch (error) {

      console.warn(
        "Could not load image:",
        url,
        error
      );

      return "";

    }
  }


  /*
   * Prepare every design image before opening
   * the final print layout.
   */
  const preparedDesigns = [];

  for (const design of designs) {

    const variants = Array.isArray(design.variants)
      ? design.variants
      : [];

    const designName =
      design.name ||
      design.design ||
      "";

    let imageURL = design.image || "";

    /*
     * Resolve relative image paths correctly.
     */
    if (imageURL) {

      try {

        imageURL = new URL(
          imageURL,
          window.location.href
        ).href;

      } catch (e) {

        console.warn(
          "Invalid image path:",
          imageURL
        );

      }
    }

    /*
     * Convert image to embedded data URL.
     */
    const imageData = imageURL
      ? await imageToDataURL(imageURL)
      : "";

    preparedDesigns.push({
      name: designName,
      image: imageData,
      variants: variants
    });
  }


  /*
   * Build print cards.
   */
  const cards = preparedDesigns.map((design, index) => {

    const variants = design.variants || [];

    let variantRows = "";

    if (variants.length) {

      variantRows = variants.map(v => {

        const size = escapePrintText(
          v.size || ""
        );

        const price = Number(
          v.price || 0
        ).toLocaleString("en-IN");

        return `
          <div class="variant-row">

            <div class="size-cell">
              ${size}
            </div>

            <div class="price-cell">
              ₹${price}
            </div>

          </div>
        `;

      }).join("");

    } else {

      variantRows = `
        <div class="variant-row">

          <div class="size-cell">
            —
          </div>

          <div class="price-cell">
            —
          </div>

        </div>
      `;
    }


    return `
      <div class="design-card">

        <!-- IMAGE -->
        <div class="image-cell">

          ${
            design.image
              ? `
                <img
                  src="${design.image}"
                  alt=""
                  class="design-image"
                >
              `
              : `
                <div class="no-image">
                  No Image
                </div>
              `
          }

        </div>


        <!-- DESIGN NAME -->
        <div class="design-info">

          <div class="design-name">
            ${escapePrintText(design.name)}
          </div>


          <!-- SIZE / PRICE -->
          <div class="variant-table">

            <div class="variant-header">

              <div>
                Size
              </div>

              <div>
                Price
              </div>

            </div>

            ${variantRows}

          </div>

        </div>

      </div>
    `;

  }).join("");


  /*
   * Final print document.
   */
  const html = `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>Swapnali's Rangoli - Designs</title>

<style>

/* =========================
   PAGE
   ========================= */

@page {
  size: A4 portrait;
  margin: 10mm;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #111111;
  font-family: Arial, Helvetica, sans-serif;
}


/* =========================
   HEADER
   ========================= */

.print-header {
  text-align: center;
  margin-bottom: 10px;
  padding-bottom: 7px;
  border-bottom: 2px solid #111;
}

.print-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.print-header p {
  margin: 3px 0 0;
  font-size: 10px;
}


/* =========================
   DESIGN GRID
   ========================= */

.design-grid {

  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: 6mm;

}


/* =========================
   DESIGN CARD
   ========================= */

.design-card {

  display: grid;

  grid-template-columns:
    35mm minmax(0, 1fr);

  min-height: 38mm;

  border: 1px solid #222;

  border-radius: 4px;

  overflow: hidden;

  background: #fff;

  break-inside: avoid;

  page-break-inside: avoid;

}


/* =========================
   IMAGE
   ========================= */

.image-cell {

  width: 35mm;

  height: 38mm;

  display: flex;

  align-items: center;

  justify-content: center;

  overflow: hidden;

  background: #fff;

  border-right: 1px solid #ddd;

}


.design-image {

  display: block;

  width: 100%;

  height: 100%;

  object-fit: contain;

}


.no-image {

  font-size: 9px;

  color: #777;

  text-align: center;

}


/* =========================
   DESIGN INFORMATION
   ========================= */

.design-info {

  min-width: 0;

  padding: 5px;

}


/* =========================
   DESIGN NAME
   ========================= */

.design-name {

  font-size: 12px;

  font-weight: 700;

  margin-bottom: 5px;

  line-height: 1.2;

  word-break: break-word;

}


/* =========================
   SIZE / PRICE TABLE
   ========================= */

.variant-table {

  width: 100%;

  border-top: 1px solid #222;

}


.variant-header,
.variant-row {

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    24mm;

}


.variant-header {

  font-size: 9px;

  font-weight: 700;

  border-bottom: 1px solid #aaa;

}


.variant-header div {

  padding: 3px;

}


.variant-header div:last-child {

  text-align: right;

}


.variant-row {

  font-size: 9px;

  border-bottom: 1px solid #ddd;

}


.variant-row:last-child {

  border-bottom: none;

}


.size-cell {

  padding: 3px;

  word-break: break-word;

}


.price-cell {

  padding: 3px;

  text-align: right;

  font-weight: 700;

  white-space: nowrap;

}


/* =========================
   PRINT
   ========================= */

@media print {

  html,
  body {

    background: #fff;

  }

  .design-grid {

    grid-template-columns:
      repeat(2, minmax(0, 1fr));

  }

  .design-card {

    break-inside: avoid;

    page-break-inside: avoid;

  }

}

</style>

</head>


<body>


<div class="print-header">

  <h1>Swapnali's Rangoli</h1>

  <p>
    Design Catalogue
  </p>

</div>


<div class="design-grid">

  ${cards}

</div>


<script>

/*
 * All images are already embedded as data URLs,
 * so there is no external image loading problem.
 */

window.onload = function () {

  setTimeout(function () {

    window.focus();

    window.print();

  }, 500);

};

<\/script>


</body>

</html>
  `;


  /*
   * Replace loading page with final print page.
   */
  printWindow.document.open();

  printWindow.document.write(html);

  printWindow.document.close();

}


/* =========================================================
   ESCAPE PRINT TEXT
   ========================================================= */

function escapePrintText(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}