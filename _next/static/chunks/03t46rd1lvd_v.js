(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,75157,e=>{"use strict";e.s(["CATEGORY_COLOR",0,{kulinaria:"#e67e22","dom-i-uborka":"#27ae60","dacha-i-ogorod":"#16a085",layfkhaki:"#8e44ad",ekonomiya:"#2980b9",rybalka:"#2c7da0","zdorovie-i-bezopasnost":"#c0392b","semya-i-deti":"#8e44ad","krasota-i-uhod":"#e91e63","otdyh-i-puteshestviya":"#2980b9","pokupki-i-tehnika":"#f39c12",avto:"#34495e"},"CATEGORY_EMOJI",0,{kulinaria:"🍲","dom-i-uborka":"🧹","dacha-i-ogorod":"🌱",layfkhaki:"💡",ekonomiya:"💰",rybalka:"🎣","zdorovie-i-bezopasnost":"🛡️","semya-i-deti":"👨‍👩‍👧‍👦","krasota-i-uhod":"🌸","otdyh-i-puteshestviya":"🧳","pokupki-i-tehnika":"📦",avto:"🚗"},"formatDate",0,function(e){return new Date(e).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})},"readingTime",0,function(e){let t=Math.max(1,Math.round(e.trim().split(/\s+/).length/180));return 1===t?"1 минута":t<5?`${t} минуты`:`${t} минут`},"relativeDate",0,function(e){let t=new Date,r=new Date(e),o=t.getTime()-r.getTime();if(o<0)return"сегодня";let a=Math.floor(o/864e5);if(0===a)return"сегодня";if(1===a)return"вчера";if(a<7)return`${a} дн. назад`;if(a<28){let e=Math.floor(a/7);return`${e} нед. назад`}if(a<365){let e=Math.floor(a/30);return`${e} мес. назад`}let n=Math.floor(a/365);return`${n} г. назад`}])},119,e=>{"use strict";let t=new Set(["а","без","бы","в","во","для","до","за","и","из","или","как","ко","на","над","не","о","об","от","по","под","при","про","с","со","у","что","это"]),r=["ться","тся","ся","иями","ями","ами","ого","его","ому","ему","ыми","ими","иях","ах","ях","ов","ев","ей","ой","ый","ий","ая","яя","ое","ее","ые","ие","ую","юю","ом","ем","ам","ям","ах","ях","а","я","ы","и","у","ю","е","о"];function o(e){return e.toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9\s-]+/g," ").replace(/\s+/g," ").trim()}function a(e){let t=o(e).replace(/[-ьъ]/g,"");if(t.length<=4)return t;for(let e of r)if(t.endsWith(e)&&t.length-e.length>=4)return t.slice(0,-e.length);return t}e.s(["searchArticles",0,function(e,r,n){let i=e.map(e=>({...e,score:function(e,r){let n,i,l,s,c,d=Array.from(new Set(o(r).split(/\s+/).map(a).filter(e=>e.length>=3&&!t.has(e))));if(0===d.length)return 0;let u=(n=o(e.title),i=o(e.description),l=o(e.tags.join(" ")),s=o(`${e.categoryName} ${e.category}`),c=`${n} ${i} ${l} ${s}`,{title:n,description:i,tags:l,category:s,all:c}),m=Array.from(new Set(u.all.split(/\s+/).map(a).filter(e=>e.length>=3))),g=0;for(let e of d)u.title.includes(e)&&(g+=24),u.tags.includes(e)&&(g+=20),u.description.includes(e)&&(g+=12),u.category.includes(e)&&(g+=5),m.includes(e)?g+=12:m.some(t=>t.includes(e)||e.includes(t))&&(g+=7);return d.filter(e=>u.all.includes(e)||m.some(t=>t.includes(e)||e.includes(t))).length===d.length&&(g+=15),u.title.includes(o(r))&&(g+=30),g}(e,r)})).filter(e=>e.score>0).sort((e,t)=>t.score-e.score||Date.parse(t.date)-Date.parse(e.date));return"number"==typeof n?i.slice(0,n):i}])},43683,e=>{"use strict";var t=e.i(76350),r=e.i(73576),o=e.i(55367),a=e.i(3030),n=e.i(75157),i=e.i(119);function l(){return new URLSearchParams(window.location.search).get("q")||""}function s(){return new URLSearchParams(window.location.search).get("category")||""}let c=String.raw`
(() => {
  const root = document.querySelector('[data-search-page]');
  if (!root || root.dataset.staticReady === '1') return;
  root.dataset.staticReady = '1';

  const input = root.querySelector('input[name="q"]');
  const box = root.querySelector('[data-search-fallback-results]');
  const browse = root.querySelector('[data-search-browse]');
  const dataNode = root.querySelector('#search-page-data');
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q') || '';
  const categoryFilter = params.get('category') || '';
  if (!input || !box || !dataNode || (query.trim().length < 1 && !categoryFilter)) return;

  input.value = query;
  const allArticles = JSON.parse(dataNode.textContent || '[]');
  const articles = categoryFilter ? allArticles.filter((article) => article.category === categoryFilter) : allArticles;
  const stops = new Set(['а','без','бы','в','во','для','до','за','и','из','или','как','ко','на','над','не','о','об','от','по','под','при','про','с','со','у','что','это']);
  const suffixes = ['ться','тся','ся','иями','ями','ами','ого','его','ому','ему','ыми','ими','иях','ах','ях','ов','ев','ей','ой','ый','ий','ая','яя','ое','ее','ые','ие','ую','юю','ом','ем','ам','ям','а','я','ы','и','у','ю','е','о'];
  const colors = { kulinaria: '#e67e22', 'dom-i-uborka': '#27ae60', 'dacha-i-ogorod': '#16a085', layfkhaki: '#8e44ad', ekonomiya: '#2980b9', rybalka: '#555', 'zdorovie-i-bezopasnost': '#c0392b', 'semya-i-deti': '#8e44ad', 'krasota-i-uhod': '#e91e63', 'otdyh-i-puteshestviya': '#2980b9', 'pokupki-i-tehnika': '#f39c12' };

  function norm(value) {
    return String(value || '').toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function stem(token) {
    const clean = norm(token).replace(/[-ьъ]/g, '');
    if (clean.length <= 4) return clean;
    for (const suffix of suffixes) {
      if (clean.endsWith(suffix) && clean.length - suffix.length >= 4) return clean.slice(0, -suffix.length);
    }
    return clean;
  }

  function tokens(value) {
    return [...new Set(norm(value).split(/\s+/).map(stem).filter((token) => token.length >= 3 && !stops.has(token)))];
  }

  function score(article, value) {
    const queryTokens = tokens(value);
    if (!queryTokens.length) return 0;
    const title = norm(article.title);
    const description = norm(article.description);
    const tags = norm((article.tags || []).join(' '));
    const category = norm(article.categoryName + ' ' + article.category);
    const all = title + ' ' + description + ' ' + tags + ' ' + category;
    const stems = [...new Set(all.split(/\s+/).map(stem).filter((token) => token.length >= 3))];
    let total = 0;
    for (const token of queryTokens) {
      if (title.includes(token)) total += 24;
      if (tags.includes(token)) total += 20;
      if (description.includes(token)) total += 12;
      if (category.includes(token)) total += 5;
      if (stems.includes(token)) total += 12;
      else if (stems.some((s) => s.includes(token) || token.includes(s))) total += 7;
    }
    const matched = queryTokens.filter((token) => all.includes(token) || stems.some((s) => s.includes(token) || token.includes(s)));
    if (matched.length === queryTokens.length) total += 15;
    if (title.includes(norm(value))) total += 30;
    return total;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  const results = query.trim().length < 1
    ? articles.map((article) => ({ ...article, score: 1 })).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    : articles
      .map((article) => ({ ...article, score: score(article, query) }))
      .filter((article) => article.score > 0)
      .sort((a, b) => b.score - a.score || Date.parse(b.date) - Date.parse(a.date));

  if (browse) browse.style.display = 'none';
  root.dataset.hasStaticResults = '1';
  box.style.display = 'block';
  if (!results.length) {
    box.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2.5rem;margin-bottom:.75rem">🔍</div><p style="font-size:1.1rem;font-weight:600;color:#444;margin:0 0 .5rem">Ничего не найдено</p><p style="color:#888;font-size:.9rem;margin:0">Попробуйте другой запрос.</p></div>';
    return;
  }

  box.innerHTML = [
    '<p style="font-size:.85rem;color:#888;margin:0 0 1rem">Найдено: ' + results.length + ' статей</p>',
    '<div style="display:flex;flex-direction:column;gap:.75rem">',
    results.map((article) => {
      const color = colors[article.category] || '#888';
      const href = '/' + article.category + '/' + article.slug + '/';
      return [
        '<a href="' + href + '" style="text-decoration:none;color:inherit">',
        '<div style="background:#fff;border-radius:10px;border:1.5px solid #e8e4df;padding:1rem 1.25rem;display:flex;gap:1rem;align-items:flex-start;box-shadow:0 1px 4px rgba(0,0,0,.05)">',
        '<div style="width:48px;height:48px;flex-shrink:0;border-radius:8px;background:' + color + '18;display:flex;align-items:center;justify-content:center;color:' + color + ';font-weight:800">#</div>',
        '<div style="flex:1;min-width:0">',
        '<div style="margin-bottom:.3rem"><span style="font-size:.7rem;font-weight:700;text-transform:uppercase;background:' + color + '18;color:' + color + ';border-radius:4px;padding:2px 7px">' + escapeHtml(article.categoryName) + '</span></div>',
        '<h3 style="font-size:.97rem;font-weight:700;color:#1a1a1a;margin:0 0 .3rem;line-height:1.4">' + escapeHtml(article.title) + '</h3>',
        '<p style="font-size:.83rem;color:#666;margin:0;line-height:1.5">' + escapeHtml(article.description) + '</p>',
        '</div></div></a>',
      ].join('');
    }).join(''),
    '</div>',
  ].join('');
})();
`;e.s(["default",0,function({articles:e}){let[d,u]=(0,r.useState)(l),[m,g]=(0,r.useState)(l),[p]=(0,r.useState)(s),f=(0,r.useRef)(null),h=JSON.stringify(e).replace(/</g,"\\u003c");(0,r.useEffect)(()=>(f.current&&clearTimeout(f.current),f.current=setTimeout(()=>{g(d)},200),()=>{f.current&&clearTimeout(f.current)}),[d]);let y=(0,r.useMemo)(()=>p?e.filter(e=>e.category===p):e,[e,p]),x=(0,r.useMemo)(()=>m.trim()?(0,i.searchArticles)(y,m):p?y.map(e=>({...e,score:1})):[],[m,y,p]),b=m.trim().length>0||p.length>0;return(0,t.jsxs)("div",{"data-search-page":!0,style:{maxWidth:"800px",margin:"0 auto",padding:"2rem 1rem"},children:[(0,t.jsx)("h1",{style:{fontSize:"1.8rem",fontWeight:800,marginBottom:"0.4rem",color:"#1a1a1a"},children:"Поиск"}),(0,t.jsxs)("p",{style:{color:"#888",marginBottom:"1.5rem",fontSize:"0.9rem"},children:[e.length," статей на сайте"]}),(0,t.jsxs)("form",{action:"/search/",method:"get",role:"search",style:{position:"relative",marginBottom:"2rem"},children:[(0,t.jsx)("span",{style:{position:"absolute",left:"1rem",top:"50%",transform:"translateY(-50%)",fontSize:"1.1rem",pointerEvents:"none",color:"#aaa"},children:"🔍"}),(0,t.jsx)("input",{type:"search",name:"q",autoFocus:!0,suppressHydrationWarning:!0,placeholder:"Введите запрос — например: борщ, уборка, огород...",value:d,onChange:e=>u(e.target.value),style:{width:"100%",padding:"0.85rem 1rem 0.85rem 2.8rem",fontSize:"1rem",borderRadius:"10px",border:"2px solid #e8e4df",outline:"none",backgroundColor:"#fff",boxSizing:"border-box",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",transition:"border-color 0.15s"},onFocus:e=>{e.target.style.borderColor="#c0392b"},onBlur:e=>{e.target.style.borderColor="#e8e4df"}}),p&&(0,t.jsx)("input",{type:"hidden",name:"category",value:p}),d&&(0,t.jsx)("button",{type:"button",onClick:()=>u(""),style:{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:"1.1rem",lineHeight:1,padding:"4px"},"aria-label":"Очистить",children:"×"})]}),(0,t.jsx)("style",{dangerouslySetInnerHTML:{__html:'[data-search-page][data-has-static-results="1"] [data-search-browse]{display:none!important}'}}),(0,t.jsx)("div",{"data-search-fallback-results":!0,style:{display:"none"}}),(0,t.jsx)("script",{id:"search-page-data",type:"application/json",dangerouslySetInnerHTML:{__html:h}}),(0,t.jsx)("script",{dangerouslySetInnerHTML:{__html:c}}),b?x.length>0?(0,t.jsxs)("div",{children:[(0,t.jsxs)("p",{style:{fontSize:"0.85rem",color:"#888",marginBottom:"1rem"},children:["Найдено: ",x.length," ",1===x.length?"статья":x.length<5?"статьи":"статей"]}),(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"},children:x.map(e=>{let r=n.CATEGORY_COLOR[e.category]||"#888",i=n.CATEGORY_EMOJI[e.category]||"📄",l=a.CATEGORIES[e.category];return(0,t.jsx)(o.default,{href:`/${e.category}/${e.slug}`,style:{textDecoration:"none",color:"inherit"},children:(0,t.jsxs)("div",{style:{backgroundColor:"#fff",borderRadius:"10px",border:"1.5px solid #e8e4df",padding:"1rem 1.25rem",display:"flex",gap:"1rem",alignItems:"flex-start",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",transition:"border-color 0.15s, box-shadow 0.15s"},onMouseEnter:e=>{let t=e.currentTarget;t.style.borderColor=r,t.style.boxShadow="0 2px 8px rgba(0,0,0,0.1)"},onMouseLeave:e=>{let t=e.currentTarget;t.style.borderColor="#e8e4df",t.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)"},children:[(0,t.jsx)("div",{style:{width:"48px",height:"48px",flexShrink:0,borderRadius:"8px",background:`linear-gradient(135deg, ${r}cc, ${r}66)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"},children:i}),(0,t.jsxs)("div",{style:{flex:1,minWidth:0},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.3rem",flexWrap:"wrap"},children:[(0,t.jsx)("span",{style:{fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",backgroundColor:r+"18",color:r,borderRadius:"4px",padding:"2px 7px"},children:l?.name||e.categoryName}),(0,t.jsx)("span",{style:{fontSize:"0.75rem",color:"#bbb"},children:(0,n.relativeDate)(e.date)})]}),(0,t.jsx)("h3",{style:{fontSize:"0.97rem",fontWeight:700,color:"#1a1a1a",margin:"0 0 0.3rem",lineHeight:1.4},children:e.title}),(0,t.jsx)("p",{style:{fontSize:"0.83rem",color:"#666",margin:0,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"},children:e.description}),e.tags.length>0&&(0,t.jsx)("div",{style:{marginTop:"0.5rem",display:"flex",gap:"0.3rem",flexWrap:"wrap"},children:e.tags.slice(0,4).map(e=>(0,t.jsxs)("span",{style:{fontSize:"0.72rem",color:"#999",backgroundColor:"#f5f2ef",borderRadius:"3px",padding:"1px 6px"},children:["#",e]},e))})]})]})},e.slug)})})]}):(0,t.jsxs)("div",{style:{textAlign:"center",padding:"3rem 1rem"},children:[(0,t.jsx)("div",{style:{fontSize:"2.5rem",marginBottom:"0.75rem"},children:"🔍"}),(0,t.jsx)("p",{style:{fontSize:"1.1rem",fontWeight:600,color:"#444",marginBottom:"0.5rem"},children:"Ничего не найдено"}),(0,t.jsx)("p",{style:{color:"#888",fontSize:"0.9rem"},children:"Попробуйте другой запрос или посмотрите все разделы ниже"})]}):(0,t.jsxs)("div",{"data-search-browse":!0,children:[(0,t.jsxs)("div",{style:{marginBottom:"2.5rem"},children:[(0,t.jsx)("h2",{style:{fontSize:"1rem",fontWeight:700,color:"#555",marginBottom:"0.9rem"},children:"По разделу"}),(0,t.jsx)("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.6rem"},children:Object.values(a.CATEGORIES).map(r=>{let a=n.CATEGORY_COLOR[r.slug]||"#888",i=n.CATEGORY_EMOJI[r.slug]||"📄",l=e.filter(e=>e.category===r.slug).length;return(0,t.jsxs)(o.default,{href:`/${r.slug}`,style:{padding:"0.5rem 1rem",borderRadius:"8px",border:`1.5px solid ${a}44`,textDecoration:"none",color:a,fontSize:"0.9rem",fontWeight:600,backgroundColor:a+"0d",display:"flex",alignItems:"center",gap:"0.4rem"},children:[i," ",r.name," ",(0,t.jsxs)("span",{style:{color:"#aaa",fontSize:"0.8rem",fontWeight:400},children:["(",l,")"]})]},r.slug)})})]}),(0,t.jsxs)("div",{style:{fontSize:"0.85rem",color:"#aaa",textAlign:"center",padding:"1rem"},children:["Начните вводить запрос для поиска по ",e.length," статьям"]})]})]})}])}]);