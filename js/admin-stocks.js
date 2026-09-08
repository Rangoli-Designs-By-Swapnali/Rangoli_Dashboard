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
   3 COLUMNS × 3 ROWS
   9 DESIGN CARDS PER A4 PAGE

   PRINT CONTENT:
   - Actual Rangoli image
   - Design name
   - Size
   - Price

   DOES NOT PRINT:
   - Checkbox
   - Quantity counter
   - Add to cart
   - Stock
   - Buttons
========================================================= */

async function printAllDesigns() {

  /* =======================================================
     CHECK DESIGNS
  ======================================================= */

  if (
    !Array.isArray(designs) ||
    !designs.length
  ) {

    alert(
      "Designs are not loaded yet. Please wait and try again."
    );

    return;
  }


  /* =======================================================
     OPEN PRINT WINDOW
  ======================================================= */

  const printWindow =
    window.open(
      "",
      "_blank",
      "width=1200,height=900"
    );


  if (!printWindow) {

    alert(
      "Please allow pop-ups for this website to print the designs."
    );

    return;
  }


  /* =======================================================
     SHOW LOADING SCREEN
  ======================================================= */

  printWindow.document.open();

  printWindow.document.write(`

    <!DOCTYPE html>

    <html>

    <head>

      <meta charset="UTF-8">

      <title>
        Preparing Designs...
      </title>

      <style>

        html,
        body {

          margin: 0;

          width: 100%;

          height: 100%;

          font-family:
            Arial,
            Helvetica,
            sans-serif;

        }

        body {

          display: flex;

          align-items: center;

          justify-content: center;

          background: #fff;

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

        Preparing design images...

        <br>

        Please wait.

      </div>

    </body>

    </html>

  `);

  printWindow.document.close();


  /* =======================================================
     IMAGE PATH
     
     designs.json can contain:
     
       Design1.png
       ./Design1.png
       images/Design1.png
       Images/Design1.png
       Rangoli_Dashboard/images/Design1.png
     
     We convert all of them to:
     
       images/Design1.png
  ======================================================= */

  function getActualDesignImagePath(
    imageValue
  ) {

    if (!imageValue) {

      return "";

    }


    let value =
      String(imageValue).trim();


    if (!value) {

      return "";

    }


    /* Full URL */

    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:")
    ) {

      return value;

    }


    /* Remove leading ./ */

    value =
      value.replace(
        /^\.\/+/,
        ""
      );


    /* Remove leading / */

    value =
      value.replace(
        /^\/+/,
        ""
      );


    /* Remove Rangoli_Dashboard */

    value =
      value.replace(
        /^Rangoli_Dashboard[\\/]+/i,
        ""
      );


    /* Remove images folder */

    value =
      value.replace(
        /^images[\\/]+/i,
        ""
      );


    value =
      value.replace(
        /^Images[\\/]+/i,
        ""
      );


    /* Windows path → web path */

    value =
      value.replace(
        /\\/g,
        "/"
      );


    /*
     * Use only filename.
     */

    const parts =
      value.split("/");


    const filename =
      parts[parts.length - 1];


    /*
     * Encode filename.
     */

    return (
      "images/" +
      encodeURIComponent(filename)
    );

  }


  /* =======================================================
     IMAGE → DATA URL
     
     Embedding the images prevents the print preview
     from showing "No Image".
  ======================================================= */

  async function imageToDataURL(
    url
  ) {

    if (!url) {

      return "";

    }


    try {

      const response =
        await fetch(
          url +
          (
            url.includes("?")
              ? "&"
              : "?"
          ) +
          "print=1",
          {
            cache: "no-store"
          }
        );


      if (!response.ok) {

        throw new Error(
          "Image request failed: " +
          response.status
        );

      }


      const blob =
        await response.blob();


      return await new Promise(
        function(
          resolve,
          reject
        ) {

          const reader =
            new FileReader();


          reader.onload =
            function() {

              resolve(
                reader.result
              );

            };


          reader.onerror =
            function(error) {

              reject(error);

            };


          reader.readAsDataURL(
            blob
          );

        }
      );

    }

    catch (error) {

      console.warn(
        "Could not load print image:",
        url,
        error
      );

      return "";

    }

  }


  /* =======================================================
     PREPARE ALL DESIGN IMAGES
  ======================================================= */

  const preparedDesigns = [];


  for (
    const design of designs
  ) {

    const designName =
      design.name ||
      design.design ||
      "";


    const variants =
      Array.isArray(
        design.variants
      )
        ? design.variants
        : [];


    /*
     * Get actual image path.
     */

    const imagePath =
      getActualDesignImagePath(
        design.image
      );


    let imageData = "";


    /*
     * First attempt:
     * images/filename
     */

    if (imagePath) {

      imageData =
        await imageToDataURL(
          imagePath
        );

    }


    /*
     * Second attempt:
     * Images/filename
     */

    if (
      !imageData &&
      imagePath
    ) {

      imageData =
        await imageToDataURL(

          imagePath.replace(
            /^images\//,
            "Images/"
          )

        );

    }


    /*
     * Save prepared design.
     */

    preparedDesigns.push({

      name:
        designName,

      image:
        imageData,

      imagePath:
        imagePath,

      variants:
        variants

    });

  }


  /* =======================================================
     ESCAPE TEXT FOR HTML
  ======================================================= */

  function escapePrintText(
    value
  ) {

    return String(
      value ?? ""
    )

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


  /* =======================================================
     CREATE SIZE / PRICE ROWS
  ======================================================= */

  function createVariantRows(
    variants
  ) {

    if (
      !Array.isArray(variants) ||
      !variants.length
    ) {

      return `

        <div class="variant-row">

          <div class="variant-size">
            Standard
          </div>

          <div class="variant-price">
            —
          </div>

        </div>

      `;

    }


    return variants
      .map(
        function(variant) {

          const size =
            escapePrintText(
              variant.size ||
              "Standard"
            );


          const price =
            Number(
              String(
                variant.price ?? 0
              )
                .replace(
                  /,/g,
                  ""
                )
                .replace(
                  /[₹$]/g,
                  ""
                )
                .trim()
            ) || 0;


          return `

            <div class="variant-row">

              <div class="variant-size">

                ${size}

              </div>


              <div class="variant-price">

                ₹${price.toLocaleString("en-IN")}

              </div>

            </div>

          `;

        }
      )
      .join("");

  }


  /* =======================================================
     CREATE ONE DESIGN CARD
  ======================================================= */

  function createDesignCard(
    design
  ) {

    let imageHTML = "";


    if (design.image) {

      imageHTML = `

        <img

          src="${design.image}"

          class="design-image"

          alt=""

        >

      `;

    }

    else {

      imageHTML = `

        <div class="image-missing">

          Image not loaded

        </div>

      `;

    }


    return `

      <div class="design-card">


        <!-- =============================================
             RANGOLI IMAGE
        ============================================== -->

        <div class="card-image">

          ${imageHTML}

        </div>


        <!-- =============================================
             DESIGN NAME
        ============================================== -->

        <div class="card-name">

          ${escapePrintText(
            design.name
          )}

        </div>


        <!-- =============================================
             SIZE / PRICE
        ============================================== -->

        <div class="variant-table">


          <div class="variant-header">

            <div>
              Size
            </div>

            <div>
              Price
            </div>

          </div>


          ${createVariantRows(
            design.variants
          )}


        </div>


      </div>

    `;

  }


  /* =======================================================
     CREATE ALL CARDS
  ======================================================= */

  const cardArray =
    preparedDesigns.map(
      function(design) {

        return createDesignCard(
          design
        );

      }
    );


  /* =======================================================
     CREATE 3 × 3 PAGES
     
     9 CARDS PER PAGE
  ======================================================= */

  const pages = [];


  for (
    let i = 0;
    i < cardArray.length;
    i += 9
  ) {

    const pageCards =
      cardArray.slice(
        i,
        i + 9
      );


    pages.push(`

      <div class="print-page">

        ${pageCards.join("")}

      </div>

    `);

  }


  /* =======================================================
     FINAL PRINT HTML
  ======================================================= */

  const finalHTML = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">


<title>

  Swapnali's Rangoli -
  Design Catalogue

</title>


<style>

/* =========================================================
   A4 PAGE
========================================================= */

@page {

  size: A4 portrait;

  margin: 6mm;

}


/* =========================================================
   GLOBAL
========================================================= */

* {

  box-sizing: border-box;

}


html,
body {

  margin: 0;

  padding: 0;

  width: 100%;

  background: #fff;

  color: #111;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

}


/* =========================================================
   PRINT PAGE

   A4:
   3 COLUMNS
   3 ROWS

   TOTAL:
   9 CARDS
========================================================= */

.print-page {

  width: 100%;

  height: 285mm;

  display: grid;

  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  grid-template-rows:
    repeat(3, minmax(0, 1fr));

  gap: 4mm;

  page-break-after: always;

  break-after: page;

}


/*
 * Last page should not create
 * an extra blank page.
 */

.print-page:last-child {

  page-break-after: auto;

  break-after: auto;

}


/* =========================================================
   DESIGN CARD

   MAIN PAGE CARD STYLE
========================================================= */

.design-card {

  width: 100%;

  height: 100%;

  min-width: 0;

  min-height: 0;

  padding: 3mm;

  border: 1px solid #d8d8d8;

  border-radius: 8px;

  background: #fff;

  display: flex;

  flex-direction: column;

  overflow: hidden;

  break-inside: avoid;

  page-break-inside: avoid;

}


/* =========================================================
   IMAGE AREA

   IMAGE WILL FIT INSIDE THE CARD.

   NOTHING IS CROPPED.
========================================================= */

.card-image {

  width: 100%;

  height: 58mm;

  flex-shrink: 0;

  display: flex;

  align-items: center;

  justify-content: center;

  overflow: hidden;

  background: #fff;

  border-radius: 5px;

}


/*
 * IMPORTANT:
 *
 * contain = complete Rangoli visible
 * no cropping
 * no stretching
 */

.design-image {

  display: block;

  width: 100%;

  height: 100%;

  object-fit: contain;

  object-position: center center;

}


/* =========================================================
   IMAGE MISSING
========================================================= */

.image-missing {

  width: 100%;

  height: 100%;

  display: flex;

  align-items: center;

  justify-content: center;

  text-align: center;

  font-size: 8px;

  color: #888;

}


/* =========================================================
   DESIGN NAME
========================================================= */

.card-name {

  width: 100%;

  margin-top: 2mm;

  margin-bottom: 2mm;

  font-size: 11px;

  font-weight: 700;

  line-height: 1.15;

  text-align: center;

  color: #222;

  white-space: normal;

  word-break: break-word;

  overflow: hidden;

}


/* =========================================================
   SIZE / PRICE TABLE
========================================================= */

.variant-table {

  width: 100%;

  border: 1px solid #ddd;

  border-radius: 4px;

  overflow: hidden;

}


/* Header + Rows */

.variant-header,
.variant-row {

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    17mm;

}


/* Header */

.variant-header {

  background: #f7f7f7;

  font-size: 7.5px;

  font-weight: 700;

  border-bottom: 1px solid #ddd;

}


.variant-header div {

  padding:
    1.5mm
    2mm;

}


.variant-header div:last-child {

  text-align: right;

}


/* Rows */

.variant-row {

  font-size: 7.5px;

  border-bottom: 1px solid #eee;

}


.variant-row:last-child {

  border-bottom: none;

}


.variant-size {

  padding:
    1.5mm
    2mm;

  word-break: break-word;

}


.variant-price {

  padding:
    1.5mm
    2mm;

  text-align: right;

  font-weight: 700;

  white-space: nowrap;

}


/* =========================================================
   PRINT SETTINGS
========================================================= */

@media print {

  html,
  body {

    width: 100%;

    margin: 0;

    padding: 0;

    background: #fff;

  }


  .print-page {

    width: 100%;

    height: 285mm;

    grid-template-columns:
      repeat(3, minmax(0, 1fr));

    grid-template-rows:
      repeat(3, minmax(0, 1fr));

    gap: 4mm;

  }


  .design-card {

    break-inside: avoid;

    page-break-inside: avoid;

  }


  .card-image {

    overflow: hidden;

  }


  .design-image {

    width: 100%;

    height: 100%;

    object-fit: contain;

    object-position: center center;

    print-color-adjust: exact;

    -webkit-print-color-adjust: exact;

  }

}

</style>

</head>


<body>


${pages.join("")}


<script>

/* =========================================================
   WAIT FOR ALL IMAGES
========================================================= */

window.addEventListener(
  "load",
  async function() {


    const images =
      Array.from(
        document.querySelectorAll(
          ".design-image"
        )
      );


    /*
     * Wait until every image is
     * completely loaded.
     */

    await Promise.all(

      images.map(
        function(img) {

          if (
            img.complete &&
            img.naturalWidth > 0
          ) {

            return Promise.resolve();

          }


          return new Promise(
            function(resolve) {

              img.onload =
                function() {

                  resolve();

                };


              img.onerror =
                function() {

                  resolve();

                };

            }
          );

        }
      )

    );


    /*
     * Extra delay allows browser
     * to finish the A4 grid layout.
     */

    setTimeout(
      function() {

        window.focus();

        window.print();

      },
      700
    );

  }
);

<\/script>


</body>

</html>

  `;


  /* =======================================================
     WRITE FINAL PRINT DOCUMENT
  ======================================================= */

  printWindow.document.open();

  printWindow.document.write(
    finalHTML
  );

  printWindow.document.close();

}