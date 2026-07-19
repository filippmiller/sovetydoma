/**
 * Progressive-enhancement islands for auth-gated article widgets on
 * renderer-served (dynamic) pages. Next hydration is stripped there, so
 * 'use client' components (reactions, star rating, favorites, push) are dead.
 *
 * Pattern mirrors workers/renderer/src/ugc.ts (questions/comments): inject a
 * self-contained HTML shell + <script type="text/javascript"> that the
 * renderer's typeless-inline strip keeps.
 *
 * Auth path: read the GoTrue session from localStorage (*-auth-token), then
 * call self-hosted Supabase REST with apikey=anon + Authorization: Bearer
 * <access_token>. RLS stays auth.uid() = user_id — no service-role anon path.
 */

// Public values (same as NEXT_PUBLIC_* on the static site). Not secrets.
const SUPABASE_REST = 'https://api.1001sovet.ru/rest/v1'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxMDAwMDAwLCJleHAiOjIwOTYzNjAwMDB9.reN2LvNIuuf9y0P7w_nWvI1hoKhvNMiwSqBMfelzKaI'
const PUSH_API = 'https://sovetydoma-subscriptions.filippmiller.workers.dev'
const VAPID_PUBLIC_KEY =
  'BB5kLCqBMGZ84815ejBI69dFuHyUjF0qJHWiW4YYH-xThrf_AXBamgbKxMfnwPEYS2UVGjyNpi2juiCzBh2jepk'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Shared GoTrue session + REST helpers, ES5-style for the inline island. */
function peAuthHelpersJs(): string {
  const restJson = JSON.stringify(SUPABASE_REST)
  const anonJson = JSON.stringify(SUPABASE_ANON_KEY)
  return (
    `var REST=${restJson},ANON=${anonJson};` +
    `function peGetSession(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);` +
    `if(!k||k.indexOf('-auth-token')<0)continue;var raw=localStorage.getItem(k);if(!raw)continue;` +
    `var data=JSON.parse(raw);var s=data&&(data.currentSession||data);` +
    `if(s&&s.access_token&&s.user&&s.user.id)return{token:s.access_token,userId:s.user.id};}}catch(e){}return null;}` +
    `function peHeaders(token,extra){var h={'apikey':ANON,'Authorization':'Bearer '+(token||ANON),'Accept':'application/json'};` +
    `if(extra){for(var k in extra)if(Object.prototype.hasOwnProperty.call(extra,k))h[k]=extra[k];}return h;}` +
    `function pePromptLogin(msgEl,text){if(msgEl){msgEl.style.color='#a93226';msgEl.innerHTML='<a href="/" style="color:#c0392b;font-weight:700;text-decoration:underline">Войдите</a> '+text;}` +
    `try{window.dispatchEvent(new CustomEvent('sovetydoma:open-auth'));}catch(e){}}`
  )
}

const REACTIONS: Array<{ emoji: string; label: string }> = [
  { emoji: '👍', label: 'Полезно' },
  { emoji: '❤️', label: 'Нравится' },
  { emoji: '🔥', label: 'Огонь' },
  { emoji: '🤔', label: 'Интересно' },
]

/**
 * Emoji reaction strip — public counts via anon REST; toggle requires session.
 */
export function buildReactionsHtml(articleSlug: string): string {
  const sid = 'rx_' + articleSlug.replace(/[^a-z0-9]+/gi, '').slice(0, 32)
  const sidJson = JSON.stringify(sid)
  const slugJson = JSON.stringify(articleSlug)
  const reactionsJson = JSON.stringify(REACTIONS)

  const buttons = REACTIONS.map((r, i) => {
    return (
      `<button type="button" data-rx-i="${i}" aria-pressed="false" aria-label="${escapeHtml(r.label)}: 0"` +
      ` title="Войдите, чтобы ваш голос учли"` +
      ` style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.45rem 1rem;border-radius:999px;` +
      `border:2px solid #e0dbd5;background-color:#faf9f7;cursor:pointer;font-size:0.9rem;font-weight:600;` +
      `color:#555;transition:border-color 0.15s,color 0.15s,background-color 0.15s;min-height:40px">` +
      `<span style="font-size:1.1rem">${r.emoji}</span><span>${escapeHtml(r.label)}</span>` +
      `<span data-rx-count style="font-size:0.8rem;font-weight:700;color:#999;display:none">0</span></button>`
    )
  }).join('')

  const script =
    `<script type="text/javascript">(function(){` +
    `var root=document.getElementById(${sidJson});if(!root||root.dataset.peBound)return;root.dataset.peBound='1';` +
    peAuthHelpersJs() +
    `var REACTIONS=${reactionsJson},slug=${slugJson};` +
    `var counts=[0,0,0,0],active=[false,false,false,false],session=peGetSession(),msg=root.querySelector('[data-rx-msg]');` +
    `function paint(){var btns=root.querySelectorAll('[data-rx-i]');for(var i=0;i<btns.length;i++){var b=btns[i],on=active[i],c=counts[i];` +
    `b.setAttribute('aria-pressed',on?'true':'false');b.style.border=on?'2px solid #c0392b':'2px solid #e0dbd5';` +
    `b.style.backgroundColor=on?'#c0392b0f':'#faf9f7';b.style.color=on?'#c0392b':'#555';` +
    `b.setAttribute('aria-label',REACTIONS[i].label+': '+c);` +
    `var cn=b.querySelector('[data-rx-count]');if(cn){if(c>0){cn.style.display='';cn.textContent=String(c);cn.style.color=on?'#c0392b':'#999';}else{cn.style.display='none';}}}}` +
    `function loadCounts(){return fetch(REST+'/reactions?article_slug=eq.'+encodeURIComponent(slug)+'&select=emoji',{headers:peHeaders(null)})` +
    `.then(function(r){return r.ok?r.json():[];}).then(function(rows){counts=REACTIONS.map(function(rx){return rows.filter(function(row){return row.emoji===rx.emoji;}).length;});paint();}).catch(function(){});}` +
    `function loadMine(){if(!session)return Promise.resolve();` +
    `return fetch(REST+'/reactions?article_slug=eq.'+encodeURIComponent(slug)+'&user_id=eq.'+encodeURIComponent(session.userId)+'&select=emoji',{headers:peHeaders(session.token)})` +
    `.then(function(r){return r.ok?r.json():[];}).then(function(rows){var mine={};for(var i=0;i<rows.length;i++)mine[rows[i].emoji]=1;` +
    `active=REACTIONS.map(function(rx){return !!mine[rx.emoji];});paint();}).catch(function(){});}` +
    `loadCounts().then(loadMine);` +
    `root.addEventListener('click',function(ev){var t=ev.target;while(t&&t!==root&&!(t.getAttribute&&t.getAttribute('data-rx-i')!=null))t=t.parentNode;` +
    `if(!t||t===root)return;var idx=parseInt(t.getAttribute('data-rx-i'),10);if(isNaN(idx))return;` +
    `session=peGetSession();if(!session){pePromptLogin(msg,'чтобы ваша реакция учлась.');return;}` +
    `var rx=REACTIONS[idx],next=!active[idx];active[idx]=next;counts[idx]=Math.max(0,counts[idx]+(next?1:-1));paint();` +
    `var q='user_id=eq.'+encodeURIComponent(session.userId)+'&article_slug=eq.'+encodeURIComponent(slug)+'&emoji=eq.'+encodeURIComponent(rx.emoji);` +
    `var p=next` +
    `?fetch(REST+'/reactions?'+q,{method:'DELETE',headers:peHeaders(session.token)}).then(function(){` +
    `return fetch(REST+'/reactions',{method:'POST',headers:peHeaders(session.token,{'Content-Type':'application/json','Prefer':'return=minimal'}),` +
    `body:JSON.stringify({user_id:session.userId,article_slug:slug,emoji:rx.emoji})});})` +
    `:fetch(REST+'/reactions?'+q,{method:'DELETE',headers:peHeaders(session.token)});` +
    `p.then(function(){return loadCounts();}).catch(function(){loadCounts();});});` +
    `})();</script>`

  return (
    `<div id="${escapeHtml(sid)}" data-dynamic-widget="reactions" style="margin-top:1.5rem">` +
    `<div style="display:flex;justify-content:center;gap:0.65rem;flex-wrap:wrap">${buttons}</div>` +
    `<p data-rx-msg role="status" style="text-align:center;margin:0.6rem 0 0;font-size:0.82rem;min-height:1.1em"></p>` +
    `</div>` +
    script
  )
}

/**
 * Star rating — public aggregate + per-user upsert (onConflict article_slug,user_id).
 */
export function buildRatingHtml(articleSlug: string): string {
  const sid = 'rt_' + articleSlug.replace(/[^a-z0-9]+/gi, '').slice(0, 32)
  const sidJson = JSON.stringify(sid)
  const slugJson = JSON.stringify(articleSlug)

  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="button" data-rt-star="${n}" aria-label="Оценить на ${n} из 5" ` +
        `style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:none;border:none;` +
        `cursor:pointer;padding:0;font-size:28px;color:#ccc;line-height:1">★</button>`,
    )
    .join('')

  const script =
    `<script type="text/javascript">(function(){` +
    `var root=document.getElementById(${sidJson});if(!root||root.dataset.peBound)return;root.dataset.peBound='1';` +
    peAuthHelpersJs() +
    `var slug=${slugJson},userRating=0,rated=false,hovered=0,avg=null,voteCount=0;` +
    `var msg=root.querySelector('[data-rt-msg]'),label=root.querySelector('[data-rt-label]'),badge=root.querySelector('[data-rt-badge]');` +
    `function plural(n){var m10=n%10,m100=n%100;if(m10===1&&m100!==11)return 'оценка';if(m10>=2&&m10<=4&&(m100<10||m100>=20))return 'оценки';return 'оценок';}` +
    `function paintStars(){var btns=root.querySelectorAll('[data-rt-star]');var show=rated?userRating:(hovered||0);` +
    `for(var i=0;i<btns.length;i++){var n=i+1;btns[i].style.color=n<=show?'#f39c12':'#ccc';btns[i].disabled=rated;btns[i].style.cursor=rated?'default':'pointer';}` +
    `if(label){if(rated){label.textContent='Ваша оценка: '+userRating+'/5 · Спасибо!';label.style.fontStyle='italic';label.style.color='#888';}` +
    `else{label.textContent='Оцените статью:';label.style.fontStyle='normal';label.style.color='#666';label.style.fontWeight='600';}}` +
    `if(badge){if(avg!=null){badge.style.display='';badge.innerHTML='<span style="color:#f39c12">★</span> '+avg.toFixed(1)+' · '+voteCount+' '+plural(voteCount);}` +
    `else{badge.style.display='none';}}}` +
    `function loadAgg(){return fetch(REST+'/ratings?article_slug=eq.'+encodeURIComponent(slug)+'&select=stars',{headers:peHeaders(null)})` +
    `.then(function(r){return r.ok?r.json():[];}).then(function(rows){if(rows&&rows.length){var sum=0;for(var i=0;i<rows.length;i++)sum+=rows[i].stars;` +
    `avg=Math.round((sum/rows.length)*10)/10;voteCount=rows.length;}else{avg=null;voteCount=0;}paintStars();}).catch(function(){});}` +
    `function loadMine(){var session=peGetSession();var stored=null;try{stored=localStorage.getItem('rating_'+slug);}catch(e){}` +
    `if(stored){var n=parseInt(stored,10);if(n>=1&&n<=5){userRating=n;rated=true;paintStars();return Promise.resolve();}}` +
    `if(!session){paintStars();return Promise.resolve();}` +
    `return fetch(REST+'/ratings?article_slug=eq.'+encodeURIComponent(slug)+'&user_id=eq.'+encodeURIComponent(session.userId)+'&select=stars&limit=1',{headers:peHeaders(session.token)})` +
    `.then(function(r){return r.ok?r.json():[];}).then(function(rows){if(rows&&rows[0]&&rows[0].stars){userRating=rows[0].stars;rated=true;` +
    `try{localStorage.setItem('rating_'+slug,String(userRating));}catch(e){}}paintStars();}).catch(function(){paintStars();});}` +
    `loadAgg().then(loadMine);` +
    `root.addEventListener('mouseover',function(ev){if(rated)return;var t=ev.target;while(t&&t!==root&&!(t.getAttribute&&t.getAttribute('data-rt-star')))t=t.parentNode;` +
    `if(!t||t===root)return;hovered=parseInt(t.getAttribute('data-rt-star'),10)||0;paintStars();});` +
    `root.addEventListener('mouseleave',function(){hovered=0;paintStars();});` +
    `root.addEventListener('click',function(ev){var t=ev.target;while(t&&t!==root&&!(t.getAttribute&&t.getAttribute('data-rt-star')))t=t.parentNode;` +
    `if(!t||t===root||rated)return;var n=parseInt(t.getAttribute('data-rt-star'),10);if(!(n>=1&&n<=5))return;` +
    `var session=peGetSession();if(!session){pePromptLogin(msg,'чтобы оценить статью.');return;}` +
    `userRating=n;rated=true;try{localStorage.setItem('rating_'+slug,String(n));}catch(e){}paintStars();` +
    `fetch(REST+'/ratings?on_conflict=article_slug,user_id',{method:'POST',` +
    `headers:peHeaders(session.token,{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}),` +
    `body:JSON.stringify({user_id:session.userId,article_slug:slug,stars:n})})` +
    `.then(function(){return loadAgg();}).catch(function(){});});` +
    `})();</script>`

  return (
    `<div id="${escapeHtml(sid)}" data-dynamic-widget="rating" style="margin-top:2rem">` +
    `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">` +
    `<span data-rt-label style="font-size:0.88rem;color:#666;font-weight:600">Оцените статью:</span>` +
    `<div style="display:flex;gap:4px">${stars}</div>` +
    `<span data-rt-badge style="font-size:0.82rem;color:#888;white-space:nowrap;display:none"></span>` +
    `</div>` +
    `<p data-rt-msg role="status" style="margin:0.5rem 0 0;font-size:0.82rem;min-height:1.1em"></p>` +
    `</div>` +
    script
  )
}

/**
 * Favorite heart — localStorage always; saved_articles upsert/delete when authed.
 * Logged-out save shows a login prompt (sync across devices requires auth).
 */
export function buildFavoriteHtml(articleSlug: string): string {
  const sid = 'fv_' + articleSlug.replace(/[^a-z0-9]+/gi, '').slice(0, 32)
  const sidJson = JSON.stringify(sid)
  const slugJson = JSON.stringify(articleSlug)

  const script =
    `<script type="text/javascript">(function(){` +
    `var root=document.getElementById(${sidJson});if(!root||root.dataset.peBound)return;root.dataset.peBound='1';` +
    peAuthHelpersJs() +
    `var slug=${slugJson},saved=false,msg=root.querySelector('[data-fv-msg]'),btn=root.querySelector('[data-fv-btn]'),lab=root.querySelector('[data-fv-lab]');` +
    `function getLocal(){try{var raw=localStorage.getItem('favorites');return raw?JSON.parse(raw):[];}catch(e){return [];}}` +
    `function setLocal(arr){try{localStorage.setItem('favorites',JSON.stringify(arr));}catch(e){}}` +
    `function paint(){if(btn){btn.textContent=saved?'❤️':'🤍';btn.setAttribute('aria-label',saved?'Убрать из избранного':'Добавить в избранное');` +
    `btn.style.border=saved?'1.5px solid #f8c8c8':'1.5px solid #e0dbd5';btn.style.background=saved?'#fff0f0':'transparent';}` +
    `if(lab){lab.textContent=saved?'В избранном':'Сохранить';lab.style.color=saved?'#e74c3c':'#999';}}` +
    `function load(){var favs=getLocal();saved=favs.indexOf(slug)>=0;paint();` +
    `var session=peGetSession();if(!session)return;` +
    `fetch(REST+'/saved_articles?user_id=eq.'+encodeURIComponent(session.userId)+'&article_slug=eq.'+encodeURIComponent(slug)+'&select=article_slug&limit=1',{headers:peHeaders(session.token)})` +
    `.then(function(r){return r.ok?r.json():[];}).then(function(rows){if(rows&&rows.length){saved=true;var f=getLocal();if(f.indexOf(slug)<0){f.push(slug);setLocal(f);}paint();}}).catch(function(){});}` +
    `load();` +
    `if(btn)btn.addEventListener('click',function(){` +
    `var session=peGetSession();var next=!saved;saved=next;var favs=getLocal();` +
    `if(next){if(favs.indexOf(slug)<0)favs.push(slug);setLocal(favs);` +
    `if(!session){pePromptLogin(msg,'чтобы избранное синхронизировалось на всех устройствах.');paint();return;}}` +
    `else{favs=favs.filter(function(s){return s!==slug;});setLocal(favs);}` +
    `paint();if(!session)return;` +
    `if(next){fetch(REST+'/saved_articles?on_conflict=user_id,article_slug',{method:'POST',` +
    `headers:peHeaders(session.token,{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}),` +
    `body:JSON.stringify({user_id:session.userId,article_slug:slug})}).catch(function(){});}` +
    `else{fetch(REST+'/saved_articles?user_id=eq.'+encodeURIComponent(session.userId)+'&article_slug=eq.'+encodeURIComponent(slug),` +
    `{method:'DELETE',headers:peHeaders(session.token)}).catch(function(){});}` +
    `});` +
    `})();</script>`

  return (
    `<div id="${escapeHtml(sid)}" data-dynamic-widget="favorite" ` +
    `style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;position:relative">` +
    `<button type="button" data-fv-btn aria-label="Добавить в избранное" title="Добавить в избранное" ` +
    `style="width:44px;height:44px;min-width:44px;min-height:44px;border-radius:50%;border:1.5px solid #e0dbd5;` +
    `background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;` +
    `font-size:1.35rem;transition:all 0.2s ease;padding:0;line-height:1">🤍</button>` +
    `<span data-fv-lab style="font-size:0.72rem;font-weight:600;color:#999;transition:color 0.2s;white-space:nowrap">Сохранить</span>` +
    `<p data-fv-msg role="status" style="margin:0.25rem 0 0;font-size:0.72rem;min-height:1em;text-align:center;max-width:12rem"></p>` +
    `</div>` +
    script
  )
}

/**
 * Category push subscribe — registers /sw.js if needed, talks to subscriptions worker.
 */
export function buildPushHtml(category: string): string {
  const sid = 'ps_' + category.replace(/[^a-z0-9]+/gi, '').slice(0, 32)
  const sidJson = JSON.stringify(sid)
  const catJson = JSON.stringify(category)
  const pushJson = JSON.stringify(PUSH_API)
  const vapidJson = JSON.stringify(VAPID_PUBLIC_KEY)

  const script =
    `<script type="text/javascript">(function(){` +
    `var root=document.getElementById(${sidJson});if(!root||root.dataset.peBound)return;root.dataset.peBound='1';` +
    `var cat=${catJson},API=${pushJson},VAPID=${vapidJson};` +
    `var btn=root.querySelector('[data-ps-btn]'),err=root.querySelector('[data-ps-err]'),loading=false,subscribed=false;` +
    `try{subscribed=localStorage.getItem('push_subscribed_'+cat)==='1';}catch(e){}` +
    `function u8(b64){var pad='='.repeat((4-(b64.length%4))%4);var base=(b64+pad).replace(/-/g,'+').replace(/_/g,'/');` +
    `var raw=atob(base),out=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}` +
    `function paint(){if(!btn)return;if(subscribed){btn.innerHTML='<span>🔕</span><span>Отключить уведомления</span>';` +
    `btn.style.border='1px solid #ddd';btn.style.color='#555';btn.style.fontWeight='400';}` +
    `else{btn.innerHTML='<span>🔔</span><span>Уведомлять о новых статьях</span>';` +
    `btn.style.border='1px solid #c0392b';btn.style.color='#c0392b';btn.style.fontWeight='600';}` +
    `btn.disabled=loading;btn.style.opacity=loading?'0.6':'1';btn.style.cursor=loading?'not-allowed':'pointer';` +
    `if(err)err.textContent='';}` +
    `function showErr(code){if(err)err.textContent=code==='notification_permission_denied'?'Разрешение на уведомления отклонено':'Ошибка';}` +
    `if(!('serviceWorker' in navigator)||!('PushManager' in window)){root.style.display='none';return;}` +
    `paint();` +
    `navigator.serviceWorker.register('/sw.js').catch(function(){});` +
    `navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription();}).then(function(sub){` +
    `if(!sub&&subscribed){subscribed=false;try{localStorage.removeItem('push_subscribed_'+cat);}catch(e){}paint();}}).catch(function(){});` +
    `if(btn)btn.addEventListener('click',function(){if(loading)return;loading=true;paint();` +
    `if(subscribed){` +
    `navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription();}).then(function(sub){` +
    `if(!sub)return null;var endpoint=sub.endpoint;return sub.unsubscribe().then(function(){` +
    `return fetch(API+'/push/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:endpoint})}).catch(function(){});});` +
    `}).then(function(){subscribed=false;try{localStorage.removeItem('push_subscribed_'+cat);}catch(e){}loading=false;paint();})` +
    `.catch(function(){showErr('unsubscribe_failed');loading=false;paint();});` +
    `return;}` +
    `var chain=Promise.resolve();` +
    `if(Notification.permission==='denied'){showErr('notification_permission_denied');loading=false;paint();return;}` +
    `if(Notification.permission!=='granted'){chain=Notification.requestPermission().then(function(p){if(p!=='granted')throw new Error('notification_permission_denied');});}` +
    `chain.then(function(){return navigator.serviceWorker.ready;}).then(function(reg){` +
    `return reg.pushManager.getSubscription().then(function(sub){` +
    `if(sub)return sub;` +
    `return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(VAPID)});});` +
    `}).then(function(sub){` +
    `var endpoint=sub.endpoint,key=sub.getKey('p256dh'),auth=sub.getKey('auth');` +
    `if(!endpoint||!key||!auth)throw new Error('invalid_push_subscription');` +
    `var p256dh=btoa(String.fromCharCode.apply(null,Array.from(new Uint8Array(key))));` +
    `var authB64=btoa(String.fromCharCode.apply(null,Array.from(new Uint8Array(auth))));` +
    `return fetch(API+'/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},` +
    `body:JSON.stringify({endpoint:endpoint,p256dh:p256dh,auth:authB64,category:cat})}).then(function(r){` +
    `if(!r.ok)return r.json().catch(function(){return {};}).then(function(d){throw new Error((d&&d.error)||'subscribe_failed');});});` +
    `}).then(function(){subscribed=true;try{localStorage.setItem('push_subscribed_'+cat,'1');}catch(e){}loading=false;paint();})` +
    `.catch(function(e){showErr(e&&e.message?e.message:'subscribe_failed');loading=false;paint();});` +
    `});` +
    `})();</script>`

  return (
    `<div id="${escapeHtml(sid)}" data-dynamic-widget="push" data-category="${escapeHtml(category)}" ` +
    `style="display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.35rem">` +
    `<button type="button" data-ps-btn ` +
    `style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.35rem 0.75rem;border-radius:6px;` +
    `border:1px solid #c0392b;background:#fff;color:#c0392b;font-size:0.85rem;font-family:inherit;font-weight:600;cursor:pointer">` +
    `<span>🔔</span><span>Уведомлять о новых статьях</span></button>` +
    `<span data-ps-err style="font-size:0.75rem;color:#c0392b"></span>` +
    `</div>` +
    script
  )
}
