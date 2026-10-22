// Substitui o server.py: intercepta /api/adm, /api/honor e /api/sindicos
// e guarda os dados no armazenamento local do app.
(function () {
  var realFetch = window.fetch.bind(window);
  function chave(n) { return 'painel_' + n; }
  function resp(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  async function ler(nome) {
    var v = null;
    try { v = localStorage.getItem(chave(nome)); } catch (e) {}
    if (v) { try { return JSON.parse(v); } catch (e) {} }
    // Primeira abertura: carrega os dados que vieram dentro do APK
    try {
      var r = await realFetch('/dados_banco/' + nome + '.json');
      if (r.ok) {
        var d = await r.json();
        try { localStorage.setItem(chave(nome), JSON.stringify(d)); } catch (e) {}
        return d;
      }
    } catch (e) {}
    return { columns: [], data: [] };
  }
  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : ((input && input.url) || '');
    var m = url.match(/\/api\/(adm|honor|sindicos)(?:[?#].*)?$/);
    if (!m) return realFetch(input, init);
    var nome = m[1];
    var metodo = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (metodo === 'POST') {
      try { localStorage.setItem(chave(nome), init.body); }
      catch (e) { return resp({ status: 'erro' }, 500); }
      return resp({ status: 'sucesso' });
    }
    return resp(await ler(nome));
  };
})();
