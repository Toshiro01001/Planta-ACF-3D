/* ponte.js · liga os dois sites da Planta da Caixa (2.5D e 3D)
   Os dois ficam no mesmo endereço-base (usuário.github.io/Planta-ACF/ e /Planta-ACF-3D/), usam o mesmo Firebase
   e a mesma sessão do navegador (perfil e login seguem na mesma aba). Este arquivo é IGUAL nos dois repositórios.
   - ACF_SITES: endereços dos dois sites, descobertos pelo endereço atual (nada para configurar).
   - No site 2.5D: o botão 3D leva para o site 3D, na mesma aba.
   - Nos dois: seletor "2,5D | 3D" no topo, cada botão leva ao seu site.
   - No site 3D: ?abrir3d=1 abre o 3D sozinho assim que a pessoa estiver dentro e, ao sair do 3D, volta ao 2.5D. */
(function () {
  const aqui = location.pathname.replace(/[^/]*$/, '');
  const modo = /Planta-ACF-3D\/$/.test(aqui) ? '3d' : '25d';
  const raiz = aqui.replace(/Planta-ACF(-3D)?\/$/, '');
  const S = window.ACF_SITES = { modo, s25d: raiz + 'Planta-ACF/', s3d: raiz + 'Planta-ACF-3D/' };
  S.ir3d = () => { location.href = S.s3d + '?abrir3d=1'; };
  S.ir25d = () => { location.href = S.s25d; };
  // Seletor "2,5D | 3D": dois botões no topo, cada um leva ao seu site (mesma mesa, mesmo Firebase)
  const css = '#ponteSites{display:inline-flex;align-items:stretch;flex:none;margin:0 8px 0 auto;border:1px solid rgba(224,160,48,.55);border-radius:6px;overflow:hidden;font:600 12px/1 system-ui,sans-serif;letter-spacing:.04em}'
    + '#ponteSites a{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:34px;padding:0 10px;color:#e8e2d4;background:rgba(14,12,10,.7);text-decoration:none}'
    + '#ponteSites a+a{border-left:1px solid rgba(224,160,48,.55)}'
    + '#ponteSites a[aria-current=page]{background:#e0a030;color:#0a0908;cursor:default;pointer-events:none}'
    + '#ponteSites a:not([aria-current]):hover,#ponteSites a:focus-visible{background:rgba(224,160,48,.22)}'
    + '@media (max-width:480px){#ponteSites{margin:0 4px 0 auto;font-size:11px}#ponteSites a{min-width:40px;padding:0 7px}}'
    + 'body.s3d-aberta #ponteSites,body.tv #ponteSites{display:none}';
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const nav = document.createElement('nav');
    nav.id = 'ponteSites'; nav.setAttribute('aria-label', 'Trocar de site');
    const mk = (txt, href, ativo, tit) => { const a = document.createElement('a'); a.textContent = txt; a.href = href; a.title = tit; if (ativo) a.setAttribute('aria-current', 'page'); return a; };
    nav.append(mk('2,5D', S.s25d, modo !== '3d', 'Mapa 2.5D, leve (outro site, mesma mesa)'), mk('3D', S.s3d, modo === '3d', 'Site 3D completo (outro site, mesma mesa)'));
    const topo = document.querySelector('.topo'), dir = document.querySelector('.topo-dir');
    if (topo && dir) topo.insertBefore(nav, dir); else document.body.appendChild(nav);
    if (modo !== '3d') return;
    if (!/[?&]abrir3d=1/.test(location.search)) return;
    // veio do 2.5D: ao sair do 3D, volta ao 2.5D (o X do 3D vira "voltar ao mapa")
    let abriu = false;
    new MutationObserver(() => { const a = document.body.classList.contains('s3d-aberta'); if (a) abriu = true; else if (abriu) S.ir25d(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    let n = 0;
    const t = setInterval(() => {
      const s = window.Sala3D;
      if (s && s.aberta) { clearInterval(t); return; }
      const dentro = document.body.classList.contains('logado') || document.querySelector('#btnTresD:not([hidden])');
      if (s && s.abrirDireto && dentro && !document.querySelector('dialog[open]')) { clearInterval(t); try { s.abrirDireto(); } catch (e) {} }
      if (++n > 120) clearInterval(t);
    }, 500);
  });
})();
