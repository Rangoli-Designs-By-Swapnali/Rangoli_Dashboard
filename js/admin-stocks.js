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
   2 COLUMN A4 PRINT
   Actual images from: Rangoli_Dashboard/images/
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

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Preparing Designs...</title>

      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }

        .loading {
          text-align: center;
          font-size: 18px;
          font-weight: 600;
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


  /* =========================================================
     GET ACTUAL IMAGE PATH
     
     IMPORTANT:
     All catalogue images are inside:

     Rangoli_Dashboard/images/

     If designs.json contains:
       Design1.png
       /Design1.png
       Images/Design1.png
       images/Design1.png

     this function converts it to:

       images/Design1.png
  ========================================================= */

  function getActualDesignImagePath(imageValue) {

    if (!imageValue) return "";

    let value = String(imageValue).trim();

    if (!value) return "";

    /*
     * If it is already a full URL, keep it.
     */
    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:")
    ) {
      return value;
    }

    /*
     * Remove leading ./ or /
     */
    value = value
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "");

    /*
     * Remove existing folder names.
     */
    value = value.replace(
      /^Rangoli_Dashboard[\\/]+/i,
      ""
    );

    value = value.replace(
      /^images[\\/]+/i,
      ""
    );

    value = value.replace(
      /^Images[\\/]+/i,
      ""
    );

    /*
     * Convert Windows backslashes to /
     */
    value = value.replace(/\\/g, "/");

    /*
     * If a path still exists, keep only the filename.
     */
    const parts = value.split("/");

    const filename = parts[parts.length - 1];

    /*
     * Encode filename safely.
     */
    return "images/" + encodeURIComponent(filename);
  }


  /* =========================================================
     CONVERT IMAGE TO DATA URL
  ========================================================= */

  async function imageToDataURL(url) {

    if (!url) return "";

    try {

      const response = await fetch(
        url + (url.includes("?") ? "&" : "?") + "print=1",
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Image request failed: " + response.status
        );
      }

      const blob = await response.blob();

      return await new Promise(
        function(resolve, reject) {

          const reader = new FileReader();

          reader.onload = function() {
            resolve(reader.result);
          };

          reader.onerror = function(error) {
            reject(error);
          };

          reader.readAsDataURL(blob);

        }
      );

    } catch (error) {

      console.warn(
        "Could not load print image:",
        url,
        error
      );

      return "";
    }
  }


  /* =========================================================
     PREPARE ALL DESIGNS
  ========================================================= */

  const preparedDesigns = [];

  for (const design of designs) {

    const designName =
      design.name ||
      design.design ||
      "";

    const variants =
      Array.isArray(design.variants)
        ? design.variants
        : [];

    /*
     * IMPORTANT:
     * Force image to Rangoli_Dashboard/images/
     */
    const imagePath =
      getActualDesignImagePath(
        design.image
      );

    console.log(
      "Print image:",
      designName,
      imagePath
    );

    /*
     * Embed actual image.
     */
    let imageData = "";

    if (imagePath) {
      imageData =
        await imageToDataURL(imagePath);
    }

    /*
     * If the first attempt failed,
     * try alternate case for folder.
     */
    if (!imageData && imagePath) {

      const alternatePath =
        imagePath.replace(
          /^images\//,
          "Images/"
        );

      imageData =
        await imageToDataURL(
          alternatePath
        );
    }

    preparedDesigns.push({

      name: designName,

      image: imageData,

      imagePath: imagePath,

      variants: variants

    });
  }


  /* =========================================================
     BUILD DESIGN CARDS
  ========================================================= */

  const cards =
    preparedDesigns
      .map(function(design) {

        const variants =
          Array.isArray(design.variants)
            ? design.variants
            : [];


        let variantRows = "";


        if (variants.length) {

          variantRows =
            variants
              .map(function(v) {

                const size =
                  escapePrintText(
                    v.size || ""
                  );

                const priceNumber =
                  Number(
                    String(
                      v.price ?? 0
                    )
                      .replace(/,/g, "")
                      .replace(/[₹$]/g, "")
                      .trim()
                  ) || 0;

                const price =
                  priceNumber.toLocaleString(
                    "en-IN"
                  );

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

              })
              .join("");

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


        /*
         * IMAGE
         */
        let imageHTML = "";

        if (design.image) {

          imageHTML = `

            <img
              src="${design.image}"
              class="design-image"
              alt=""
            >

          `;

        } else {

          /*
           * Do NOT silently hide failed images.
           * Show the expected path so it is easy
           * to identify a wrong filename.
           */
          imageHTML = `

            <div class="image-error">

              Image not loaded

              <small>
                ${escapePrintText(
                  design.imagePath || ""
                )}
              </small>

            </div>

          `;
        }


        return `

          <div class="design-card">

            <!-- IMAGE -->
            <div class="image-cell">

              ${imageHTML}

            </div>


            <!-- DESIGN INFORMATION -->
            <div class="design-info">

              <div class="design-name">

                ${escapePrintText(
                  design.name
                )}

              </div>


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

      })
      .join("");


  /* =========================================================
     FINAL PRINT HTML
  ========================================================= */

  const html = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>Swapnali's Rangoli - Designs</title>


<style>

/* =========================================================
   A4 PAGE
========================================================= */

@page {

  size: A4 portrait;

  margin: 8mm;

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

  font-family:
    Arial,
    Helvetica,
    sans-serif;

}


/* =========================================================
   HEADER
========================================================= */

.print-header {

  width: 100%;

  text-align: center;

  margin-bottom: 5mm;

  padding-bottom: 3mm;

  border-bottom: 1.5px solid #111;

}


.print-header h1 {

  margin: 0;

  font-size: 18px;

  font-weight: 700;

}


.print-header p {

  margin: 2px 0 0;

  font-size: 9px;

}


/* =========================================================
   2 COLUMN GRID
========================================================= */

.design-grid {

  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  column-gap: 5mm;

  row-gap: 5mm;

  width: 100%;

}


/* =========================================================
   DESIGN CARD
========================================================= */

.design-card {

  width: 100%;

  min-width: 0;

  min-height: 43mm;

  display: grid;

  grid-template-columns:
    38mm minmax(0, 1fr);

  border: 1px solid #222;

  border-radius: 3px;

  overflow: hidden;

  background: #fff;

  break-inside: avoid;

  page-break-inside: avoid;

}


/* =========================================================
   IMAGE AREA
========================================================= */

.image-cell {

  width: 38mm;

  height: 43mm;

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


.image-error {

  width: 100%;

  height: 100%;

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  text-align: center;

  font-size: 8px;

  color: #777;

  padding: 4px;

}


.image-error small {

  display: block;

  margin-top: 4px;

  font-size: 6px;

  word-break: break-all;

}


/* =========================================================
   DESIGN INFORMATION
========================================================= */

.design-info {

  min-width: 0;

  padding: 4px;

}


/* =========================================================
   DESIGN NAME
========================================================= */

.design-name {

  font-size: 11px;

  line-height: 1.15;

  font-weight: 700;

  margin-bottom: 4px;

  padding-bottom: 3px;

  border-bottom: 1px solid #222;

  word-break: break-word;

}


/* =========================================================
   SIZE / PRICE TABLE
========================================================= */

.variant-table {

  width: 100%;

}


.variant-header,
.variant-row {

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    18mm;

}


.variant-header {

  font-size: 8px;

  font-weight: 700;

  border-bottom: 1px solid #aaa;

}


.variant-header div {

  padding: 2px 3px;

}


.variant-header div:last-child {

  text-align: right;

}


.variant-row {

  font-size: 8px;

  border-bottom: 1px solid #ddd;

}


.variant-row:last-child {

  border-bottom: none;

}


.size-cell {

  padding: 2px 3px;

  word-break: break-word;

}


.price-cell {

  padding: 2px 3px;

  text-align: right;

  font-weight: 700;

  white-space: nowrap;

}


/* =========================================================
   PRINT
========================================================= */

@media print {

  html,
  body {

    width: 100%;

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


  .design-image {

    print-color-adjust: exact;

    -webkit-print-color-adjust: exact;

  }

}

</style>

</head>


<body>


<div class="print-header">

  <h1>
    Swapnali's Rangoli
  </h1>

  <p>
    Design Catalogue
  </p>

</div>


<div class="design-grid">

  ${cards}

</div>


<script>

/*
 * Images are already embedded as DATA URLs.
 *
 * Wait until browser has decoded every image.
 * Only then start printing.
 */

window.addEventListener(
  "load",
  async function() {

    const images =
      Array.from(
        document.querySelectorAll(
          "img.design-image"
        )
      );


    try {

      await Promise.all(

        images.map(function(img) {

          if (
            img.complete &&
            img.naturalWidth > 0
          ) {

            return Promise.resolve();

          }


          return new Promise(
            function(resolve) {

              img.onload = resolve;

              img.onerror = resolve;

            }
          );

        })

      );

    } catch (e) {

      console.warn(
        "Image wait error",
        e
      );

    }


    /*
     * Small delay allows the print
     * layout to finish rendering.
     */

    setTimeout(
      function() {

        window.focus();

        window.print();

      },
      800
    );

  }
);

<\/script>


</body>

</html>

  `;


  /* =========================================================
     WRITE FINAL PRINT PAGE
  ========================================================= */

  printWindow.document.open();

  printWindow.document.write(html);

  printWindow.document.close();

}


/* =========================================================
   ESCAPE PRINT TEXT
========================================================= */

function escapePrintText(value) {

  return String(value ?? "")

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