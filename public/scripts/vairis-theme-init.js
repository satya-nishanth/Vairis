(function () {
  var stored = null;
  try { stored = localStorage.getItem('vairis-site-theme'); } catch (_) {}
  var theme = stored === 'dark' || stored === 'light' ? stored : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
