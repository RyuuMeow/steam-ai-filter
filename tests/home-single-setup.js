const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#365c74"/><path d="M0 240L140 70L240 180L340 90L400 240Z" fill="#b1cdd0"/></svg>');
const recommendation=(name,id,title,tag=false)=>`<div class="home_content_single_ctn" id="${name}-outer">
<div class="home_content single" id="${name}" role="button" tabindex="0">
<div class="single_header_ctn"><div class="single_title_ctn"><h2 class="single_title">${title}</h2>
<div class="home_content_reason">因為您最近遊玩過 <a href="https://store.steampowered.com/app/620/">另一款遊戲</a></div></div>
<div class="home_content single_buttonbar"><a href="https://store.steampowered.com/app/${id}/">造訪產品頁面</a><button>願望清單</button><button>忽略</button></div></div>
<div class="gamelink home_content_items" data-ds-appid="${id}" ${tag?'data-ds-tagids="[7926]"':''}>
<a class="capsule_image_ctn" href="https://store.steampowered.com/app/${id}/"><img alt="${title}" src="${art}"></a>
<img alt="同款截圖" src="${art}" data-image-url="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/fixture.jpg">
</div><div class="discount_block_ctn">NT$ 300</div><div style="clear:both"></div></div></div>`;
document.querySelector('#recommendations').innerHTML=
  recommendation('matched',3850550,'待過濾推薦')+
  recommendation('ordinary',621,'正常相鄰推薦')+
  recommendation('mixed',3850550,'含第二款遊戲的區塊')+
  recommendation('extra-wrapper',3850550,'外包裝另有內容');
const reference=document.querySelector('#ordinary .home_content_reason');
reference.innerHTML='<a href="https://store.steampowered.com/app/3850550/" data-ds-tagids="[7926]">另一款有 AI 揭露的遊戲</a>';
document.querySelector('#mixed .home_content_items').insertAdjacentHTML('beforeend',
  `<a href="https://store.steampowered.com/app/621/"><img alt="第二款遊戲" src="${art}"></a>`);
document.querySelector('#extra-wrapper-outer').insertAdjacentHTML('beforeend','<p id="separate-content">外層獨立資訊</p>');
const now=Date.now();
void chrome.storage.local.set({level:2,presentation:'mask',autoIgnore:false,disclosureCache:{version:1,sessionAware:true,cooldownUntil:0,items:{
  '3850550':{state:'disclosed',disclosure:'AI-generated artwork is used.',checkedAt:now,expiresAt:now+86400000},
  '621':{state:'not-found',disclosure:null,checkedAt:now,expiresAt:now+86400000},
  '620':{state:'not-found',disclosure:null,checkedAt:now,expiresAt:now+86400000}
}}});
document.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});
