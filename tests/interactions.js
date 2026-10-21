const frame=document.querySelector('iframe');
frame.addEventListener('load',()=>new ResizeObserver(()=>{frame.style.height=`${frame.contentDocument.body.scrollHeight+8}px`;}).observe(frame.contentDocument.body));
document.querySelector('.catalog').addEventListener('click',event=>event.preventDefault());
if(location.search.includes('test=1'))(async()=>{
  const out=document.querySelector('#test-results'),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async fn=>{for(let i=0;i<120;i++){if(await fn())return;await wait(25);}throw Error('Timed out');};
  const assert=(ok,label)=>{if(!ok)throw Error(label);out.textContent+=`PASS ${label}\n`;};
  const card=document.querySelector('#mixed'),other=document.querySelector('#not-code');
  const masked=e=>e.classList.contains('saf-blocked');
  const set=async values=>{await testSettings(values);await wait(80);};
  const pointer=async action=>{window.testPointerDone=false;window.testPointerAction=action;await until(()=>window.testPointerDone);await wait(180);};
  const point=(element,inFrame=false)=>{
    const r=element.getBoundingClientRect(),f=inFrame?frame.getBoundingClientRect():{left:0,top:0};
    return {x:f.left+r.left+r.width/2,y:f.top+r.top+r.height/2};
  };
  let doc;
  try {
    await until(()=>frame.contentDocument?.querySelector('#strength')?.disabled===false);doc=frame.contentDocument;
    await set({mode:'mask',filterCategories:{art:true}});
    assert(masked(card)&&!card.querySelector('.saf-checked'),'mask has no redundant check');
    assert(card.querySelector('.saf-mask-label').textContent==='AI生成內容'&&card.querySelectorAll('.saf-mask button').length===3,'mask has exact wording and three actions');
    assert(getComputedStyle(card.querySelector('.saf-mask')).backdropFilter.includes('blur(18px)'),'frosted cover blurs the existing card');
    await pointer({type:'move',...point(card)});
    assert(getComputedStyle(card.querySelector('.saf-mask-actions')).opacity==='1','hover fades in the action row');
    card.querySelector('.saf-mask-label').click();
    assert(!masked(card)&&masked(other)&&card.querySelector('.saf-remask'),'blank mask click reveals only that card and creates the eye control');
    assert(!document.querySelector('#saf-root').shadowRoot.querySelector('dialog').open&&!card.querySelector('img').inert,'reveal restores interaction without opening a dialog');
    const eye=card.querySelector('.saf-remask');await until(()=>eye.querySelector('img').complete);
    assert(eye.querySelector('img').naturalWidth>0&&eye.getAttribute('aria-label')==='恢復遮蔽','eye uses a loaded asset with an accessible name');
    eye.click();assert(masked(card)&&!card.querySelector('.saf-remask'),'eye restores masking');
    await set({hoverReveal:true});
    await pointer({type:'move',x:20,y:20});await pointer({type:'move',...point(card)});
    assert(!masked(card)&&card.querySelector('.saf-remask'),'hover reveal displays the card temporarily');
    await pointer({type:'move',x:20,y:20});
    assert(masked(card)&&!Object.hasOwn(testBridge.data.allow,'902'),'pointer leave remasks without creating an exception');
    await pointer({type:'move',...point(card)});
    const event=new MouseEvent('click',{bubbles:true,cancelable:true});card.dispatchEvent(event);
    await pointer({type:'move',x:20,y:20});
    assert(event.defaultPrevented&&!masked(card),'manual reveal remains after pointer leave');
    card.querySelector('.saf-remask').click();
    await set({hoverReveal:false});
    card.focus();await wait(180);
    assert(getComputedStyle(card.querySelector('.saf-mask-actions')).opacity==='1','keyboard focus also reveals actions');
    card.querySelector('[data-action=reveal]').click();
    assert(!masked(card),'reveal action works independently');
    await set({mode:'mark'});await set({mode:'mask'});
    assert(masked(card)&&!card.querySelector('.saf-remask'),'mode changes reset temporary card state');
    // Steam may recycle the same card DOM into a different app.
    card.querySelector('[data-action=reveal]').click();card.href='https://store.steampowered.com/app/920/';
    await until(()=>masked(card));assert(masked(card),'recycled app identity cannot inherit temporary reveal');
    card.href='https://store.steampowered.com/app/902/';await wait(180);
    card.querySelector('[data-action=allow]').click();await until(()=>testBridge.data.allow['902']);
    await until(()=>!masked(card));assert(!card.querySelector('.saf-remask'),'allow creates a persistent exception rather than a temporary eye control');
    await set({allow:{}});await until(()=>masked(card));
    let ignoreCalls=0,finish;
    window.testIgnoreOne=()=>{ignoreCalls++;return new Promise(resolve=>{finish=resolve;});};
    card.querySelector('[data-action=ignore]').click();await wait(30);
    assert(ignoreCalls===0,'synthetic page clicks cannot write to the Steam account');
    await pointer({type:'click',...point(card.querySelector('[data-action=ignore]'))});
    assert(ignoreCalls===1&&card.querySelector('[data-action=ignore]').disabled,'trusted account action is pending once and disables repeat clicks');
    finish({ok:true});await until(()=>card.querySelector('[data-action=ignore]').textContent==='已忽略');
    assert(!testBridge.data.autoIgnore&&card.querySelector('[data-action=ignore]').disabled,'confirmed manual ignore does not enable automation');
    // Language changes update an already-visible mask, popup, and disclosure dialog.
    doc.querySelector('#settings').click();doc.querySelector('[data-open=language]').click();
    for(const [language,title,label] of [['en','Language','AI-generated content'],['zh-Hans','语言','AI生成内容'],['zh-Hant','語言','AI生成內容']]) {
      const field=doc.querySelector('#language');field.value=language;field.dispatchEvent(new Event('change'));
      await until(()=>doc.documentElement.lang===language&&card.querySelector('.saf-mask-label').textContent===label);
      assert(doc.querySelector('#page-title').textContent===title,`${language} updates the current page title`);
      doc.querySelector('#back').click();
      for(const category of ['checking','network','display','automation']){
        doc.querySelector(`[data-open=${category}]`).click();
        assert(doc.documentElement.scrollWidth===320,`${language} ${category} fits the popup width`);
        doc.querySelector('#back').click();
      }
      doc.querySelector('[data-open=language]').click();
    }
    doc.querySelector('#back').click();doc.querySelector('#back').click();
    await set({mode:'mark',language:'en'});
    assert(card.querySelector('.saf-badge').textContent==='AIArtCode'&&card.querySelector('.saf-checked-matched'),'matched cards use translated chips and amber check');
    assert(document.querySelector('#code .saf-checked')&&!document.querySelector('#code .saf-checked-matched'),'completed unselected use stays green');
    card.querySelector('.saf-badge').click();
    const shadow=document.querySelector('#saf-root').shadowRoot;
    assert(shadow.querySelector('#evidence').textContent.includes('AI was used only for code and art.'),'developer disclosure text remains unmodified');
    await set({language:'zh-Hans'});
    assert(shadow.querySelector('#allow').textContent==='始终显示这款游戏','open disclosure dialog updates on language change');
    shadow.querySelector('#close').click();
    await set({language:'en'});
    const slider=doc.querySelector('#strength'),shell=doc.querySelector('.slider-shell'),fractional=[];
    slider.addEventListener('input',()=>{
      const fill=doc.querySelector('.fill').getBoundingClientRect(),thumb=doc.querySelector('.slider-thumb').getBoundingClientRect();
      fractional.push({value:Number(slider.value),delta:Math.abs(fill.right-(thumb.left+14))});
    });
    const r=shell.getBoundingClientRect(),f=frame.getBoundingClientRect();
    await pointer({type:'drag',x:f.left+r.left+14+(r.width-28)/3,y:f.top+r.top+24,toX:f.left+r.right-14,toY:f.top+r.top+24});
    await until(()=>testBridge.data.mode==='hide');
    assert(fractional.some(sample=>sample.value%1>0)&&fractional.every(sample=>sample.delta<1),'slider thumb and fill follow the pointer together between stops');
    slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
    await until(()=>testBridge.data.mode==='mask');assert(slider.value==='2','keyboard advances by exactly one mode');
    doc.querySelector('#settings').click();doc.querySelector('[data-open=network]').click();
    assert(frame.contentWindow.CSS.supports('appearance','base-select'),'browser supports themed select popovers');
    const select=doc.querySelector('#request-gap');await pointer({type:'click',...point(select,true)});
    assert(select.matches(':open'),'native themed dropdown opens with trusted input');
    await pointer({type:'click',x:20,y:20});
    const old=doc;frame.contentWindow.location.reload();
    await until(()=>frame.contentDocument!==old&&frame.contentDocument?.querySelector('#strength')?.disabled===false);doc=frame.contentDocument;
    assert(doc.documentElement.lang==='en'&&doc.querySelector('#language').value==='en','chosen language survives popup reopening');
    out.textContent+='ALL INTERACTION TESTS PASSED';document.documentElement.dataset.tests='passed';
  } catch(e){out.textContent+=`FAIL ${e.stack}`;document.documentElement.dataset.tests='failed';}
})();
