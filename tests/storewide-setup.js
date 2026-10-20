const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><defs><linearGradient id="a"><stop stop-color="#507a8c"/><stop offset="1" stop-color="#393c64"/></linearGradient></defs><rect width="400" height="240" fill="url(#a)"/><path d="M0 240L120 100L200 180L300 60L400 240Z" fill="#adcfcf" opacity=".35"/></svg>');
for(const img of document.querySelectorAll('img')){
  img.src=art;
  if(img.dataset.fixtureApp)img.dataset.imageUrl=`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${img.dataset.fixtureApp}/fixture.jpg`;
}
document.querySelector('#background-card').style.backgroundImage=`url("${art}")`;
if(location.pathname.startsWith('/app/'))document.querySelector('.product-main').style.display='block';
const now=Date.now();
void chrome.storage.local.set({level:3,disclosureCache:{version:1,sessionAware:true,cooldownUntil:0,items:{
  '5151540':{state:'disclosed',disclosure:'Synthetic fixture disclosure.',checkedAt:now,expiresAt:now+86400000},
  '621':{state:'not-found',disclosure:null,checkedAt:now,expiresAt:now+86400000}
}}});
document.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});
