(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[2959],{392:(e,t,r)=>{"use strict";r.d(t,{R:()=>o});let o={kulinaria:{name:"Кулинария",slug:"kulinaria",description:"Рецепты, советы и секреты вкусной домашней кухни"},"dom-i-uborka":{name:"Дом и уборка",slug:"dom-i-uborka",description:"Лайфхаки для чистоты и порядка в доме"},"dacha-i-ogorod":{name:"Дача и огород",slug:"dacha-i-ogorod",description:"Советы для сада, огорода и загородной жизни"},layfkhaki:{name:"Лайфхаки",slug:"layfkhaki",description:"Полезные идеи и хитрости на каждый день"},ekonomiya:{name:"Экономия",slug:"ekonomiya",description:"Как жить хорошо и тратить меньше"},rybalka:{name:"Рыбалка",slug:"rybalka",description:"Снасти, наживки, места и секреты успешной рыбалки"},"zdorovie-i-bezopasnost":{name:"Здоровье и безопасность",slug:"zdorovie-i-bezopasnost",description:"Практичные советы по безопасности дома, аптечке и защите от сезонных рисков"},"semya-i-deti":{name:"Семья и дети",slug:"semya-i-deti",description:"Организация быта с детьми, школа, семейные покупки и повседневная безопасность"},"krasota-i-uhod":{name:"Красота и уход",slug:"krasota-i-uhod",description:"Уход за одеждой, обувью, гигиена и простые домашние средства"},"otdyh-i-puteshestviya":{name:"Отдых и путешествия",slug:"otdyh-i-puteshestviya",description:"Сборы в дорогу, экономный отпуск и подготовка к поездкам"},"pokupki-i-tehnika":{name:"Покупки и техника",slug:"pokupki-i-tehnika",description:"Выбор техники и товаров, умные покупки, уход и защита от переплат"},avto:{name:"Авто",slug:"avto",description:"Уход за автомобилем, экономия на топливе и ремонте, сезонная эксплуатация"}}},1136:(e,t,r)=>{"use strict";r.d(t,{aL:()=>s});let o=new Set(["а","без","бы","в","во","для","до","за","и","из","или","как","ко","на","над","не","о","об","от","по","под","при","про","с","со","у","что","это"]),a=["ться","тся","ся","иями","ями","ами","ого","его","ому","ему","ыми","ими","иях","ах","ях","ов","ев","ей","ой","ый","ий","ая","яя","ое","ее","ые","ие","ую","юю","ом","ем","ам","ям","ах","ях","а","я","ы","и","у","ю","е","о"];function i(e){return e.toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9\s-]+/g," ").replace(/\s+/g," ").trim()}function n(e){let t=i(e).replace(/[-ьъ]/g,"");if(t.length<=4)return t;for(let e of a)if(t.endsWith(e)&&t.length-e.length>=4)return t.slice(0,-e.length);return t}function s(e,t,r){let a=e.map(e=>({...e,score:function(e,t){let r,a,s,l,c,d=Array.from(new Set(i(t).split(/\s+/).map(n).filter(e=>e.length>=3&&!o.has(e))));if(0===d.length)return 0;let u=(r=i(e.title),a=i(e.description),s=i(e.tags.join(" ")),l=i(`${e.categoryName} ${e.category}`),c=`${r} ${a} ${s} ${l}`,{title:r,description:a,tags:s,category:l,all:c}),m=Array.from(new Set(u.all.split(/\s+/).map(n).filter(e=>e.length>=3))),p=0;for(let e of d)u.title.includes(e)&&(p+=24),u.tags.includes(e)&&(p+=20),u.description.includes(e)&&(p+=12),u.category.includes(e)&&(p+=5),m.includes(e)?p+=12:m.some(t=>t.includes(e)||e.includes(t))&&(p+=7);return d.filter(e=>u.all.includes(e)||m.some(t=>t.includes(e)||e.includes(t))).length===d.length&&(p+=15),u.title.includes(i(t))&&(p+=30),p}(e,t)})).filter(e=>e.score>0).sort((e,t)=>t.score-e.score||Date.parse(t.date)-Date.parse(e.date));return"number"==typeof r?a.slice(0,r):a}},1763:(e,t,r)=>{"use strict";r.d(t,{default:()=>m});var o=r(6558),a=r(5557),i=r(2002),n=r.n(i),s=r(392),l=r(9412),c=r(1136);function d(){return new URLSearchParams(window.location.search).get("q")||""}function u(){return new URLSearchParams(window.location.search).get("category")||""}function m({articles:e}){let[t,r]=(0,a.useState)(d),[i,g]=(0,a.useState)(d),[h]=(0,a.useState)(u),f=(0,a.useRef)(null),y=JSON.stringify(e).replace(/</g,"\\u003c");(0,a.useEffect)(()=>(f.current&&clearTimeout(f.current),f.current=setTimeout(()=>{g(t)},200),()=>{f.current&&clearTimeout(f.current)}),[t]);let x=(0,a.useMemo)(()=>h?e.filter(e=>e.category===h):e,[e,h]),b=(0,a.useMemo)(()=>i.trim()?(0,c.aL)(x,i):h?x.map(e=>({...e,score:1})):[],[i,x,h]),k=i.trim().length>0||h.length>0;return(0,o.jsxs)("div",{"data-search-page":!0,style:{maxWidth:"800px",margin:"0 auto",padding:"2rem 1rem"},children:[(0,o.jsx)("h1",{style:{fontSize:"1.8rem",fontWeight:800,marginBottom:"0.4rem",color:"#1a1a1a"},children:"Поиск"}),(0,o.jsxs)("p",{style:{color:"#888",marginBottom:"1.5rem",fontSize:"0.9rem"},children:[e.length," статей на сайте"]}),(0,o.jsxs)("form",{action:"/search/",method:"get",role:"search",style:{position:"relative",marginBottom:"2rem"},children:[(0,o.jsx)("span",{style:{position:"absolute",left:"1rem",top:"50%",transform:"translateY(-50%)",fontSize:"1.1rem",pointerEvents:"none",color:"#aaa"},children:"\uD83D\uDD0D"}),(0,o.jsx)("input",{type:"search",name:"q",autoFocus:!0,suppressHydrationWarning:!0,placeholder:"Введите запрос — например: борщ, уборка, огород...",value:t,onChange:e=>r(e.target.value),style:{width:"100%",padding:"0.85rem 1rem 0.85rem 2.8rem",fontSize:"1rem",borderRadius:"10px",border:"2px solid #e8e4df",outline:"none",backgroundColor:"#fff",boxSizing:"border-box",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",transition:"border-color 0.15s"},onFocus:e=>{e.target.style.borderColor="#c0392b"},onBlur:e=>{e.target.style.borderColor="#e8e4df"}}),h&&(0,o.jsx)("input",{type:"hidden",name:"category",value:h}),t&&(0,o.jsx)("button",{type:"button",onClick:()=>r(""),style:{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:"1.1rem",lineHeight:1,padding:"4px"},"aria-label":"Очистить",children:"\xd7"})]}),(0,o.jsx)("style",{dangerouslySetInnerHTML:{__html:'[data-search-page][data-has-static-results="1"] [data-search-browse]{display:none!important}'}}),(0,o.jsx)("div",{"data-search-fallback-results":!0,style:{display:"none"}}),(0,o.jsx)("script",{id:"search-page-data",type:"application/json",dangerouslySetInnerHTML:{__html:y}}),(0,o.jsx)("script",{dangerouslySetInnerHTML:{__html:p}}),k?b.length>0?(0,o.jsxs)("div",{children:[(0,o.jsxs)("p",{style:{fontSize:"0.85rem",color:"#888",marginBottom:"1rem"},children:["Найдено: ",b.length," ",1===b.length?"статья":b.length<5?"статьи":"статей"]}),(0,o.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"},children:b.map(e=>{let t=l.dE[e.category]||"#888",r=l.qc[e.category]||"\uD83D\uDCC4",a=s.R[e.category];return(0,o.jsx)(n(),{href:`/${e.category}/${e.slug}`,style:{textDecoration:"none",color:"inherit"},children:(0,o.jsxs)("div",{style:{backgroundColor:"#fff",borderRadius:"10px",border:"1.5px solid #e8e4df",padding:"1rem 1.25rem",display:"flex",gap:"1rem",alignItems:"flex-start",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",transition:"border-color 0.15s, box-shadow 0.15s"},onMouseEnter:e=>{let r=e.currentTarget;r.style.borderColor=t,r.style.boxShadow="0 2px 8px rgba(0,0,0,0.1)"},onMouseLeave:e=>{let t=e.currentTarget;t.style.borderColor="#e8e4df",t.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)"},children:[(0,o.jsx)("div",{style:{width:"48px",height:"48px",flexShrink:0,borderRadius:"8px",background:`linear-gradient(135deg, ${t}cc, ${t}66)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"},children:r}),(0,o.jsxs)("div",{style:{flex:1,minWidth:0},children:[(0,o.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.3rem",flexWrap:"wrap"},children:[(0,o.jsx)("span",{style:{fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",backgroundColor:t+"18",color:t,borderRadius:"4px",padding:"2px 7px"},children:a?.name||e.categoryName}),(0,o.jsx)("span",{suppressHydrationWarning:!0,style:{fontSize:"0.75rem",color:"#bbb"},children:(0,l.Pp)(e.date)})]}),(0,o.jsx)("h3",{style:{fontSize:"0.97rem",fontWeight:700,color:"#1a1a1a",margin:"0 0 0.3rem",lineHeight:1.4},children:e.title}),(0,o.jsx)("p",{style:{fontSize:"0.83rem",color:"#666",margin:0,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"},children:e.description}),e.tags.length>0&&(0,o.jsx)("div",{style:{marginTop:"0.5rem",display:"flex",gap:"0.3rem",flexWrap:"wrap"},children:e.tags.slice(0,4).map(e=>(0,o.jsxs)("span",{style:{fontSize:"0.72rem",color:"#999",backgroundColor:"#f5f2ef",borderRadius:"3px",padding:"1px 6px"},children:["#",e]},e))})]})]})},e.slug)})})]}):(0,o.jsxs)("div",{style:{textAlign:"center",padding:"3rem 1rem"},children:[(0,o.jsx)("div",{style:{fontSize:"2.5rem",marginBottom:"0.75rem"},children:"\uD83D\uDD0D"}),(0,o.jsx)("p",{style:{fontSize:"1.1rem",fontWeight:600,color:"#444",marginBottom:"0.5rem"},children:"Ничего не найдено"}),(0,o.jsx)("p",{style:{color:"#888",fontSize:"0.9rem"},children:"Попробуйте другой запрос или посмотрите все разделы ниже"})]}):(0,o.jsxs)("div",{"data-search-browse":!0,children:[(0,o.jsxs)("div",{style:{marginBottom:"2.5rem"},children:[(0,o.jsx)("h2",{style:{fontSize:"1rem",fontWeight:700,color:"#555",marginBottom:"0.9rem"},children:"По разделу"}),(0,o.jsx)("div",{style:{display:"flex",flexWrap:"wrap",gap:"0.6rem"},children:Object.values(s.R).map(t=>{let r=l.dE[t.slug]||"#888",a=l.qc[t.slug]||"\uD83D\uDCC4",i=e.filter(e=>e.category===t.slug).length;return(0,o.jsxs)(n(),{href:`/${t.slug}`,style:{padding:"0.5rem 1rem",borderRadius:"8px",border:`1.5px solid ${r}44`,textDecoration:"none",color:r,fontSize:"0.9rem",fontWeight:600,backgroundColor:r+"0d",display:"flex",alignItems:"center",gap:"0.4rem"},children:[a," ",t.name," ",(0,o.jsxs)("span",{style:{color:"#aaa",fontSize:"0.8rem",fontWeight:400},children:["(",i,")"]})]},t.slug)})})]}),(0,o.jsxs)("div",{style:{fontSize:"0.85rem",color:"#aaa",textAlign:"center",padding:"1rem"},children:["Начните вводить запрос для поиска по ",e.length," статьям"]})]})]})}let p=String.raw`
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
`},1855:(e,t,r)=>{Promise.resolve().then(r.bind(r,1763))},9412:(e,t,r)=>{"use strict";function o(e){let t=Math.max(1,Math.round(e.trim().split(/\s+/).length/180));return 1===t?"1 минута":t<5?`${t} минуты`:`${t} минут`}function a(e){let t=new Date,r=new Date(e),o=t.getTime()-r.getTime();if(o<0)return"сегодня";let a=Math.floor(o/864e5);if(0===a)return"сегодня";if(1===a)return"вчера";if(a<7)return`${a} дн. назад`;if(a<28){let e=Math.floor(a/7);return`${e} нед. назад`}if(a<365){let e=Math.floor(a/30);return`${e} мес. назад`}let i=Math.floor(a/365);return`${i} г. назад`}function i(e){return new Date(e).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}r.d(t,{Pp:()=>a,Yq:()=>i,dE:()=>s,k6:()=>o,qc:()=>n});let n={kulinaria:"\uD83C\uDF72","dom-i-uborka":"\uD83E\uDDF9","dacha-i-ogorod":"\uD83C\uDF31",layfkhaki:"\uD83D\uDCA1",ekonomiya:"\uD83D\uDCB0",rybalka:"\uD83C\uDFA3","zdorovie-i-bezopasnost":"\uD83D\uDEE1️","semya-i-deti":"\uD83D\uDC68‍\uD83D\uDC69‍\uD83D\uDC67‍\uD83D\uDC66","krasota-i-uhod":"\uD83C\uDF38","otdyh-i-puteshestviya":"\uD83E\uDDF3","pokupki-i-tehnika":"\uD83D\uDCE6",avto:"\uD83D\uDE97"},s={kulinaria:"#e67e22","dom-i-uborka":"#27ae60","dacha-i-ogorod":"#16a085",layfkhaki:"#8e44ad",ekonomiya:"#2980b9",rybalka:"#2c7da0","zdorovie-i-bezopasnost":"#c0392b","semya-i-deti":"#8e44ad","krasota-i-uhod":"#e91e63","otdyh-i-puteshestviya":"#2980b9","pokupki-i-tehnika":"#f39c12",avto:"#34495e"}}},e=>{e.O(0,[2002,8827,1526,7358],()=>e(e.s=1855)),_N_E=e.O()}]);