import type { SearchableArticle } from '@/lib/search'

interface Props {
  articles: SearchableArticle[]
}

export default function HomeSmartSearch({ articles }: Props) {
  const json = JSON.stringify(articles).replace(/</g, '\\u003c')

  return (
    <section data-home-search style={{ marginBottom: '1.35rem' }}>
      <form action="/search/" method="get" role="search" style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{
          position: 'absolute',
          left: '0.85rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#999',
          fontSize: '1rem',
          pointerEvents: 'none',
        }}>
          🔍
        </span>
        <input
          type="search"
          name="q"
          placeholder="Найти совет: как избавиться от одуванчиков"
          aria-label="Поиск по статьям"
          style={{
            width: '100%',
            minHeight: '46px',
            border: '1.5px solid #ddd4cc',
            borderRadius: '8px',
            background: '#fff',
            color: '#222',
            font: 'inherit',
            fontSize: '0.95rem',
            padding: '0.65rem 6.5rem 0.65rem 2.45rem',
            outline: 'none',
            boxShadow: '0 1px 5px rgba(0,0,0,0.04)',
          }}
        />
        <button
          type="submit"
          style={{
            position: 'absolute',
            right: '0.35rem',
            top: '50%',
            transform: 'translateY(-50%)',
            minHeight: '34px',
            border: 'none',
            borderRadius: '6px',
            background: '#c0392b',
            color: '#fff',
            padding: '0 0.95rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Искать
        </button>
      </form>
      <div data-home-search-results style={{ display: 'none', marginTop: '0.55rem', border: '1px solid #e7ded6', borderRadius: '8px', background: '#fff', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
      <script id="home-search-data" type="application/json" dangerouslySetInnerHTML={{ __html: json }} />
      <script dangerouslySetInnerHTML={{ __html: homeSearchScript }} />
    </section>
  )
}

const homeSearchScript = String.raw`
(() => {
  const root = document.querySelector('[data-home-search]');
  if (!root || root.dataset.ready === '1') return;
  root.dataset.ready = '1';

  const input = root.querySelector('input[name="q"]');
  const box = root.querySelector('[data-home-search-results]');
  const dataNode = root.querySelector('#home-search-data');
  const articles = JSON.parse(dataNode.textContent || '[]');
  const stops = new Set(['а','без','бы','в','во','для','до','за','и','из','или','как','ко','на','над','не','о','об','от','по','под','при','про','с','со','у','что','это']);
  const suffixes = ['ться','тся','ся','иями','ями','ами','ого','его','ому','ему','ыми','ими','иях','ах','ях','ов','ев','ей','ой','ый','ий','ая','яя','ое','ее','ые','ие','ую','юю','ом','ем','ам','ям','а','я','ы','и','у','ю','е','о'];
  const colors = { kulinaria: '#e67e22', 'dom-i-uborka': '#27ae60', 'dacha-i-ogorod': '#16a085', layfkhaki: '#8e44ad', ekonomiya: '#2980b9', rybalka: '#555' };

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

  function tokens(query) {
    return [...new Set(norm(query).split(/\s+/).map(stem).filter((token) => token.length >= 3 && !stops.has(token)))];
  }

  function score(article, query) {
    const queryTokens = tokens(query);
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
    return total;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function render() {
    const query = input.value.trim();
    if (query.length < 3) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    const results = articles
      .map((article) => ({ ...article, score: score(article, query) }))
      .filter((article) => article.score > 0)
      .sort((a, b) => b.score - a.score || Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 6);

    box.style.display = 'block';
    if (!results.length) {
      box.innerHTML = '<div style="padding:0.8rem 0.9rem;color:#777;font-size:0.9rem">Ничего не найдено. Попробуйте другое слово.</div>';
      return;
    }
    box.innerHTML = results.map((article) => {
      const color = colors[article.category] || '#777';
      const href = '/' + article.category + '/' + article.slug + '/';
      return [
        '<a href="' + href + '" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.75rem;padding:.7rem .85rem;color:inherit;text-decoration:none;border-bottom:1px solid #f0ebe6;align-items:center">',
        '<span style="min-width:0">',
        '<span style="display:block;color:#222;font-weight:800;line-height:1.35">' + escapeHtml(article.title) + '</span>',
        '<span style="display:block;color:#777;font-size:.83rem;line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(article.description) + '</span>',
        '</span>',
        '<span style="color:' + color + ';background:' + color + '12;border:1px solid ' + color + '40;border-radius:999px;padding:.18rem .55rem;font-size:.72rem;font-weight:800;white-space:nowrap">' + escapeHtml(article.categoryName) + '</span>',
        '</a>',
      ].join('');
    }).join('');
  }

  input.addEventListener('input', render);
  input.addEventListener('search', render);
})();
`
