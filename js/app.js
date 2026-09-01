/* =========================================================
   APP BOOTSTRAP MODULE
   Deep-link restore + application startup
========================================================= */
if(location.hash.indexOf("#admin")===0)setTimeout(requestAdminAccess,300);

window.addEventListener("hashchange",function(){
  if(location.hash.indexOf("#admin")===0 && document.getElementById("adminScreen")?.classList.contains("show")){
    const tab=getAdminTabFromHash()||"dashboard";
    adminTab(tab,false);
  }
});

/* =========================================================
   START
========================================================= */
loadDesigns();
