/* Epoch Education — platform features v60
 * Cloud sync, PWA install/offline, project checks, study history and recovery.
 */

const EE_CLOUD_CONFIG_KEY = 'enterprise-educacional-cloud-config-v1';
const EE_CLOUD_SESSION_KEY = 'enterprise-educacional-cloud-session-v1';
const EE_RECOVERY_KEY = 'enterprise-educacional-recovery-v1';
const EE_CLOUD_AUTO_KEY = 'enterprise-educacional-cloud-auto-v1';
let eeCloudAutoTimer = 0;
let eeCloudSyncing = false;
let eeDeferredInstallPrompt = null;
let eeCloudSession = null;
let eeCloudConfig = null;

function eeDateKey(time = Date.now()) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function eeSafeJsonParse(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}
function eeReadCloudConfig() {
  const parsed = eeSafeJsonParse(localStorage.getItem(EE_CLOUD_CONFIG_KEY), {});
  const url = String(parsed?.url || '').trim().replace(/\/+$/, '');
  const anonKey = String(parsed?.anonKey || '').trim();
  return { url, anonKey };
}
function eeWriteCloudConfig(config) {
  const clean = { url:String(config?.url || '').trim().replace(/\/+$/, ''), anonKey:String(config?.anonKey || '').trim() };
  localStorage.setItem(EE_CLOUD_CONFIG_KEY, JSON.stringify(clean));
  eeCloudConfig = clean;
  return clean;
}
function eeReadCloudSession() {
  return eeSafeJsonParse(localStorage.getItem(EE_CLOUD_SESSION_KEY), null);
}
function eeWriteCloudSession(session) {
  eeCloudSession = session || null;
  if (session) localStorage.setItem(EE_CLOUD_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(EE_CLOUD_SESSION_KEY);
}
function eeCloudReady() {
  return Boolean(eeCloudConfig?.url && eeCloudConfig?.anonKey);
}
function eeCloudHeaders(token = '') {
  return {
    'apikey': eeCloudConfig?.anonKey || '',
    'Content-Type':'application/json',
    ...(token ? { 'Authorization':`Bearer ${token}` } : {})
  };
}
function eeSetCloudMessage(message = '', kind = '') {
  const node = $('#cloudSyncMessage');
  if (!node) return;
  node.hidden = !message;
  node.textContent = message;
  node.dataset.kind = kind;
}
function eeCloudSessionValid() {
  return Boolean(eeCloudSession?.access_token && eeCloudSession?.user?.id);
}
async function eeCloudRequest(path, { method='GET', body, token = '', headers = {} } = {}) {
  if (!eeCloudReady()) throw new Error('Configure a URL e a chave pública do Supabase primeiro.');
  const response = await fetch(`${eeCloudConfig.url}${path}`, {
    method,
    headers:{ ...eeCloudHeaders(token), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  const text = await response.text();
  if (text) data = eeSafeJsonParse(text, text);
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Erro HTTP ${response.status}`;
    const error = new Error(String(message)); error.status = response.status; throw error;
  }
  return data;
}
async function eeRefreshCloudSessionIfNeeded() {
  if (!eeCloudSession?.refresh_token) return eeCloudSession;
  const expiresAt = Number(eeCloudSession.expires_at || 0) * 1000;
  if (!expiresAt || expiresAt - Date.now() > 60_000) return eeCloudSession;
  try {
    const refreshed = await eeCloudRequest('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token:eeCloudSession.refresh_token } });
    if (refreshed?.access_token) eeWriteCloudSession(refreshed);
  } catch {
    eeWriteCloudSession(null);
  }
  return eeCloudSession;
}
async function eeCloudSignUp() {
  const email = $('#cloudEmail')?.value.trim();
  const password = $('#cloudPassword')?.value || '';
  if (!email || password.length < 6) { eeSetCloudMessage('Informe um e-mail válido e uma senha com pelo menos 6 caracteres.', 'error'); return; }
  try {
    eeSetCloudMessage('Criando conta…');
    const result = await eeCloudRequest('/auth/v1/signup', { method:'POST', body:{ email, password } });
    if (result?.access_token) {
      eeWriteCloudSession(result);
      eeSetCloudMessage('Conta criada e conectada.', 'success');
    } else {
      eeSetCloudMessage('Conta criada. Confirme o e-mail se o seu projeto Supabase exigir confirmação antes de entrar.', 'success');
    }
    renderCloudSyncStatus();
  } catch (error) { eeSetCloudMessage(error.message || 'Não foi possível criar a conta.', 'error'); }
}
async function eeCloudSignIn() {
  const email = $('#cloudEmail')?.value.trim();
  const password = $('#cloudPassword')?.value || '';
  if (!email || !password) { eeSetCloudMessage('Informe e-mail e senha.', 'error'); return; }
  try {
    eeSetCloudMessage('Entrando…');
    const result = await eeCloudRequest('/auth/v1/token?grant_type=password', { method:'POST', body:{ email, password } });
    if (!result?.access_token) throw new Error('A sessão não foi criada.');
    eeWriteCloudSession(result);
    $('#cloudPassword').value = '';
    eeSetCloudMessage('Conta conectada.', 'success');
    renderCloudSyncStatus();
  } catch (error) { eeSetCloudMessage(error.message || 'Não foi possível entrar.', 'error'); }
}
async function eeCloudSignOut() {
  try {
    if (eeCloudSession?.access_token) await eeCloudRequest('/auth/v1/logout', { method:'POST', token:eeCloudSession.access_token });
  } catch {}
  eeWriteCloudSession(null);
  eeSetCloudMessage('Sessão encerrada.', 'success');
  renderCloudSyncStatus();
}
async function buildEnterpriseBackupPayload(savedProjectsOverride) {
  const savedProjects = savedProjectsOverride || await listSavedCodeProjects();
  return {
    format:'enterprise-educacional-backup',
    version:2,
    exportedAt:new Date().toISOString(),
    appVersion:60,
    state:JSON.parse(JSON.stringify(state)),
    savedProjects
  };
}
async function restoreEnterpriseBackupPayload(payload, { confirmReplace = true, reload = true } = {}) {
  if (payload?.format !== 'enterprise-educacional-backup' || !payload.state || typeof payload.state !== 'object') throw new Error('Backup inválido.');
  if (confirmReplace && !await eeConfirm('O progresso, notas, histórico e projetos salvos deste dispositivo serão substituídos.', { title:'Restaurar dados?', confirmLabel:'Restaurar', tone:'danger' })) return false;

  const previousState = localStorage.getItem(storageKey);
  const previousLegacyState = localStorage.getItem(legacyStorageKey);
  const previousProjects = await listSavedCodeProjects();
  const nextProjects = Array.isArray(payload.savedProjects) ? payload.savedProjects : [];

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload.state));
    localStorage.removeItem(legacyStorageKey);
    await replaceSavedCodeProjects(nextProjects);
  } catch (error) {
    if (previousState === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, previousState);
    if (previousLegacyState === null) localStorage.removeItem(legacyStorageKey);
    else localStorage.setItem(legacyStorageKey, previousLegacyState);
    try { await replaceSavedCodeProjects(previousProjects); } catch {}
    throw error;
  }

  if (reload) setTimeout(() => location.reload(), 450);
  return true;
}
async function eeCloudPush({ automatic = false } = {}) {
  await eeRefreshCloudSessionIfNeeded();
  if (!eeCloudSessionValid()) { eeSetCloudMessage('Entre na sua conta antes de sincronizar.', 'error'); return; }
  if (eeCloudSyncing) return;
  eeCloudSyncing = true;
  try {
    if (!automatic) eeSetCloudMessage('Preparando backup e enviando…');
    if ($('#codeEditor')) syncPlaygroundBuffer();
    const payload = await buildEnterpriseBackupPayload();
    const row = { user_id:eeCloudSession.user.id, payload, updated_at:new Date().toISOString() };
    await eeCloudRequest('/rest/v1/ee_user_data?on_conflict=user_id', {
      method:'POST', token:eeCloudSession.access_token, body:row,
      headers:{ 'Prefer':'resolution=merge-duplicates,return=representation' }
    });
    localStorage.setItem('enterprise-educacional-cloud-last-sync-v1', JSON.stringify({ direction:'push', time:Date.now() }));
    if (!automatic) eeSetCloudMessage('Dados deste dispositivo enviados para a nuvem.', 'success');
    renderCloudSyncStatus();
  } catch (error) { if (!automatic) eeSetCloudMessage(error.message || 'Não foi possível enviar os dados.', 'error'); }
  finally { eeCloudSyncing = false; }
}
async function eeCloudPull() {
  await eeRefreshCloudSessionIfNeeded();
  if (!eeCloudSessionValid()) { eeSetCloudMessage('Entre na sua conta antes de restaurar.', 'error'); return; }
  try {
    eeSetCloudMessage('Buscando backup da nuvem…');
    const rows = await eeCloudRequest(`/rest/v1/ee_user_data?user_id=eq.${encodeURIComponent(eeCloudSession.user.id)}&select=payload,updated_at&limit=1`, { token:eeCloudSession.access_token });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.payload) throw new Error('Ainda não há um backup salvo nessa conta.');
    if (!await eeConfirm(`Os dados locais serão substituídos${row.updated_at ? ` pelo backup de ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(row.updated_at))}` : ' pelo backup salvo na nuvem'}.`, { title:'Restaurar backup da nuvem?', confirmLabel:'Restaurar', tone:'danger' })) return;
    localStorage.setItem('enterprise-educacional-cloud-last-sync-v1', JSON.stringify({ direction:'pull', time:Date.now() }));
    await restoreEnterpriseBackupPayload(row.payload, { confirmReplace:false, reload:true });
  } catch (error) { eeSetCloudMessage(error.message || 'Não foi possível restaurar os dados.', 'error'); }
}
function eeCloudAutoEnabled() { return localStorage.getItem(EE_CLOUD_AUTO_KEY) === 'true'; }
function eeSetCloudAutoEnabled(enabled) { localStorage.setItem(EE_CLOUD_AUTO_KEY, enabled ? 'true' : 'false'); }
async function eeCloudRemoteUpdatedAt() {
  await eeRefreshCloudSessionIfNeeded();
  if (!eeCloudSessionValid() || !eeCloudReady()) return 0;
  const rows = await eeCloudRequest(`/rest/v1/ee_user_data?user_id=eq.${encodeURIComponent(eeCloudSession.user.id)}&select=updated_at&limit=1`, { token:eeCloudSession.access_token });
  const remote = Array.isArray(rows) ? rows[0] : null;
  return remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;
}
async function eeCheckCloudConflict() {
  try {
    const remoteTime = await eeCloudRemoteUpdatedAt();
    const lastSync = Number(eeSafeJsonParse(localStorage.getItem('enterprise-educacional-cloud-last-sync-v1'), null)?.time || 0);
    const localChanged = Number(state.lastModified || 0) > lastSync + 3000;
    const remoteChanged = remoteTime > lastSync + 3000;
    if (remoteChanged && localChanged) {
      eeSetCloudMessage('Há alterações neste dispositivo e também um backup mais novo na nuvem. A sincronização automática foi pausada para evitar sobrescrever dados. Escolha manualmente enviar ou restaurar.', 'warning');
      return 'conflict';
    }
    if (remoteChanged) {
      eeSetCloudMessage('Existe um backup mais recente na nuvem. Use “Restaurar da nuvem” antes de continuar a sincronização automática.', 'warning');
      return 'remote-newer';
    }
    return 'ok';
  } catch { return 'unknown'; }
}
function queueEnterpriseCloudSync() {
  if (!eeCloudAutoEnabled() || !eeCloudReady() || !eeCloudSessionValid() || eeCloudSyncing) return;
  clearTimeout(eeCloudAutoTimer);
  eeCloudAutoTimer = setTimeout(async () => {
    const status = await eeCheckCloudConflict();
    if (status === 'ok' || status === 'unknown') eeCloudPush({ automatic:true });
  }, 7000);
}
window.queueEnterpriseCloudSync = queueEnterpriseCloudSync;

function renderCloudSyncStatus() {
  eeCloudConfig = eeReadCloudConfig();
  eeCloudSession = eeReadCloudSession();
  const configured = eeCloudReady();
  const connected = configured && eeCloudSessionValid();
  const status = $('#cloudSyncStatus');
  if (status) {
    status.dataset.state = connected ? 'connected' : configured ? 'configured' : 'offline';
    const label = connected ? `Conectado como ${eeCloudSession.user?.email || 'usuário'}` : configured ? 'Backend configurado · conta desconectada' : 'Não configurado';
    status.querySelector('span:last-child').textContent = label;
  }
  const button = $('#openCloudSync');
  if (button) button.textContent = connected ? 'Gerenciar sincronização' : 'Configurar nuvem';
  const configState = $('#cloudConfigState'); if (configState) configState.textContent = configured ? 'Configurado' : 'Não configurado';
  const accountState = $('#cloudAccountState'); if (accountState) accountState.textContent = connected ? (eeCloudSession.user?.email || 'Conectado') : 'Desconectado';
  const signOut = $('#cloudSignOut'); if (signOut) signOut.hidden = !connected;
  const signIn = $('#cloudSignIn'); if (signIn) signIn.hidden = connected;
  const signUp = $('#cloudSignUp'); if (signUp) signUp.hidden = connected;
  const push = $('#cloudPush'); if (push) push.disabled = !connected;
  const pull = $('#cloudPull'); if (pull) pull.disabled = !connected;
  const autoSync = $('#cloudAutoSync'); if (autoSync) { autoSync.checked = eeCloudAutoEnabled(); autoSync.disabled = !connected; }
  const last = eeSafeJsonParse(localStorage.getItem('enterprise-educacional-cloud-last-sync-v1'), null);
  const lastNode = $('#cloudLastSync');
  if (lastNode) lastNode.textContent = last?.time ? `Última sincronização · ${formatTime(last.time)}` : 'Nunca sincronizado';
}
function openCloudSyncDialog() {
  eeCloudConfig = eeReadCloudConfig(); eeCloudSession = eeReadCloudSession();
  $('#cloudProjectUrl').value = eeCloudConfig.url || '';
  $('#cloudAnonKey').value = eeCloudConfig.anonKey || '';
  $('#cloudEmail').value = eeCloudSession?.user?.email || '';
  $('#cloudPassword').value = '';
  eeSetCloudMessage(''); renderCloudSyncStatus();
  if (eeCloudAutoEnabled()) eeCheckCloudConflict();
  const dialog = $('#cloudSyncDialog'); if (dialog && !dialog.open) dialog.showModal();
}
function initCloudSyncFeature() {
  eeCloudConfig = eeReadCloudConfig(); eeCloudSession = eeReadCloudSession();
  $('#openCloudSync')?.addEventListener('click', openCloudSyncDialog);
  $('#closeCloudSync')?.addEventListener('click', () => $('#cloudSyncDialog')?.close());
  $('#saveCloudConfig')?.addEventListener('click', () => {
    const url = $('#cloudProjectUrl')?.value.trim() || '';
    const anonKey = $('#cloudAnonKey')?.value.trim() || '';
    if (!/^https:\/\//i.test(url) || !anonKey) { eeSetCloudMessage('Informe a URL HTTPS do projeto e a chave anon/public.', 'error'); return; }
    eeWriteCloudConfig({ url, anonKey });
    eeSetCloudMessage('Configuração salva neste navegador.', 'success'); renderCloudSyncStatus();
  });
  $('#cloudSignUp')?.addEventListener('click', eeCloudSignUp);
  $('#cloudSignIn')?.addEventListener('click', eeCloudSignIn);
  $('#cloudSignOut')?.addEventListener('click', eeCloudSignOut);
  $('#cloudPush')?.addEventListener('click', eeCloudPush);
  $('#cloudPull')?.addEventListener('click', eeCloudPull);
  $('#cloudAutoSync')?.addEventListener('change', event => { eeSetCloudAutoEnabled(event.currentTarget.checked); if (event.currentTarget.checked) { eeSetCloudMessage('Sincronização automática ativada.', 'success'); eeCheckCloudConflict(); queueEnterpriseCloudSync(); } else eeSetCloudMessage('Sincronização automática desativada.', 'success'); });
  $('#cloudSyncDialog')?.addEventListener('click', event => { if (event.target === $('#cloudSyncDialog')) $('#cloudSyncDialog').close(); });
  renderCloudSyncStatus();
  if (eeCloudAutoEnabled()) eeCheckCloudConflict();
}

function renderStudyHistory() {
  const host = $('#studyHeatmap');
  const summary = $('#studyHistorySummary');
  if (!host || !summary) return;
  const days = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let offset = 83; offset >= 0; offset--) {
    const date = new Date(today); date.setDate(today.getDate() - offset);
    const key = eeDateKey(date.getTime()); const count = Number(state.studyLog?.[key]?.count || 0);
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
    days.push({ date, key, count, level });
  }
  host.innerHTML = days.map(day => {
    const label = `${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(day.date)} · ${day.count} ${day.count === 1 ? 'atividade' : 'atividades'}`;
    return `<span class="study-day" data-level="${day.level}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"></span>`;
  }).join('');
  const activeDays = days.filter(day => day.count > 0).length;
  const activities = days.reduce((sum,day) => sum + day.count,0);
  const streak = studyStreak();
  summary.innerHTML = `<span><strong>${streak}</strong> ${streak === 1 ? 'dia seguido' : 'dias seguidos'}</span><span><strong>${activeDays}</strong> dias ativos</span><span><strong>${activities}</strong> atividades</span>`;
}

function renderPwaStatus() {
  const status = $('#pwaStatus'); const button = $('#installPwaButton');
  if (!status || !button) return;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const singleFile = document.documentElement.dataset.standaloneFile === 'true';
  const secure = !singleFile && (location.protocol === 'https:' || location.hostname === 'localhost');
  const online = navigator.onLine !== false;
  let label = '';
  if (standalone) label = 'Aplicativo instalado';
  else if (!secure) label = 'Disponível após publicar por HTTPS';
  else if (eeDeferredInstallPrompt) label = 'Pronto para instalar';
  else label = 'PWA ativo · instalação depende do navegador';
  if (!online) label += ' · offline';
  status.dataset.state = standalone ? 'connected' : secure ? 'configured' : 'offline';
  status.querySelector('span:last-child').textContent = label;
  button.disabled = standalone || !eeDeferredInstallPrompt;
  button.textContent = standalone ? 'Aplicativo instalado' : 'Instalar aplicativo';
}
async function initPwaFeature() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); eeDeferredInstallPrompt = event; renderPwaStatus(); });
  window.addEventListener('appinstalled', () => { eeDeferredInstallPrompt = null; renderPwaStatus(); showToast('Epoch Education instalado.'); });
  window.addEventListener('online', renderPwaStatus); window.addEventListener('offline', renderPwaStatus);
  $('#installPwaButton')?.addEventListener('click', async () => {
    if (!eeDeferredInstallPrompt) return;
    eeDeferredInstallPrompt.prompt();
    await eeDeferredInstallPrompt.userChoice.catch(() => null);
    eeDeferredInstallPrompt = null; renderPwaStatus();
  });
  if ('serviceWorker' in navigator && document.documentElement.dataset.standaloneFile !== 'true' && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./service-worker.js?v=60').catch(() => {});
  }
  renderPwaStatus();
}

function eeTest(label, pass, detail, optional = false, meta = {}) { return { label, pass:Boolean(pass), detail, optional, ...meta }; }
function eeBalanced(text, open, close) {
  let depth = 0;
  for (const ch of String(text || '')) { if (ch === open) depth++; if (ch === close) depth--; if (depth < 0) return false; }
  return depth === 0;
}
function eeHtmlDocument(code) {
  try { return new DOMParser().parseFromString(String(code || ''), 'text/html'); } catch { return document.implementation.createHTMLDocument(''); }
}
function eeProjectSpecificTests(project, code, doc) {
  const id = project?.id || '';
  const html = code.html || '', css = code.css || '', js = code.js || '', py = code.python || '';
  const tests = [];
  const has = (text, regex) => regex.test(text || '');
  const q = selector => Boolean(doc?.querySelector(selector));
  const qAll = selector => [...(doc?.querySelectorAll(selector) || [])];
  const add = (label, pass, detail, optional = false) => tests.push(eeTest(label, pass, detail, optional));
  const specific = {
    'pagina-pessoal': () => { add('Título principal', q('h1'), 'Inclua um <h1> com o nome ou apresentação.'); add('Área de contato', q('a[href^="mailto:"], a[href^="tel:"], form'), 'Inclua uma forma real de contato.'); },
    'pagina-de-receita': () => { add('Lista de ingredientes', q('ul,ol'), 'Use uma lista para os ingredientes.'); add('Etapas estruturadas', qAll('li').length >= 3 || qAll('section p').length >= 3, 'Estruture várias etapas da receita.'); add('Imagem acessível', !q('img') || qAll('img').every(img => img.hasAttribute('alt')), 'Toda imagem precisa de alt.'); },
    'pagina-de-artigo': () => { add('Elemento article', q('article'), 'Use <article> para o conteúdo principal.'); add('Autoria ou data', q('time,address,[rel="author"]'), 'Inclua data ou autoria de forma semântica.'); },
    'formulario-completo': () => { add('Formulário real', q('form'), 'Inclua um <form>.'); add('Campos com label', qAll('label').length >= 2, 'Associe rótulos aos campos.'); add('Validação nativa', q('[required],[pattern],[type="email"]'), 'Use pelo menos uma validação nativa.'); },
    'landing-page': () => { add('Hero/título', q('h1'), 'Inclua um título principal claro.'); add('CTA acionável', q('a[href]:not([href="#"]), button'), 'Inclua uma chamada para ação real.'); add('Seções de conteúdo', qAll('section,article').length >= 2, 'Organize benefícios/prova social em seções.'); },
    'pagina-responsiva': () => add('Media query', /@media\s*\(/i.test(css), 'Inclua pelo menos uma media query para adaptar a interface.'),
    'portfolio': () => { add('Projetos apresentados', qAll('article,section').length >= 2, 'Mostre mais de uma seção/projeto.'); add('Links reais', q('a[href]:not([href="#"])'), 'Inclua ao menos um link real para contato ou projeto.'); },
    'calculadora': () => { add('Botões de operação', qAll('button').length >= 4, 'A calculadora precisa de controles de entrada/operação.'); add('Eventos JavaScript', /addEventListener|onclick\s*=/i.test(js), 'Conecte os controles à lógica.'); add('Operações matemáticas', /[+\-*/%]/.test(js), 'Implemente operações matemáticas na lógica.'); },
    'lista-de-tarefas': () => { add('Entrada de tarefa', q('input,textarea'), 'Inclua um campo para nova tarefa.'); add('Manipulação de lista', /appendChild|insertAdjacentHTML|createElement|\.push\(/.test(js), 'Adicione tarefas dinamicamente.'); add('Persistência opcional', /localStorage/.test(js), 'Salvar tarefas no navegador melhora a experiência.', true); },
    'quiz': () => { add('Perguntas/alternativas', qAll('button,input[type="radio"]').length >= 2 || /questions|perguntas|alternativas/i.test(js), 'Crie alternativas ou uma coleção de perguntas.'); add('Pontuação/estado', /score|pontos|acertos|current|indice/i.test(js), 'Mantenha algum estado de progresso/pontuação.'); },
    'cronometro': () => { add('Temporizador', /setInterval|requestAnimationFrame/.test(js), 'Use um mecanismo de atualização de tempo.'); add('Controle de início/parada', qAll('button').length >= 2, 'Inclua controles para iniciar e parar/resetar.'); },
    'galeria': () => { add('Múltiplas imagens', qAll('img').length >= 3, 'Inclua várias imagens.'); add('Interação', /addEventListener|onclick\s*=/.test(js), 'Permita selecionar/abrir/navegar pelas imagens.'); },
    'filtro-de-produtos': () => { add('Filtro em JavaScript', /\.filter\(|filter\s*\(/.test(js), 'Use uma filtragem real da coleção.'); add('Controle de filtro', q('input,select,button'), 'Inclua uma forma de escolher o filtro.'); },
    'app-consumindo-api': () => add('Consumo de API', /\bfetch\s*\(|axios\.|XMLHttpRequest/.test(js), 'Faça uma requisição real a uma API.'),
    'dashboard': () => { add('Layout de painéis', qAll('section,article').length >= 3, 'Organize diferentes indicadores/painéis.'); add('Layout CSS estruturado', /display\s*:\s*(grid|flex)/i.test(css), 'Use Grid/Flexbox para o layout.'); },
    'pequeno-jogo': () => { add('Estado do jogo', /score|pontos|vidas|level|nivel|estado|state/i.test(js), 'Mantenha estado do jogo.'); add('Eventos', /addEventListener|keydown|click/.test(js), 'O jogo precisa reagir à entrada do usuário.'); },
    'projeto-web-final': () => { add('HTML semântico', q('main,article,section'), 'Use estrutura semântica.'); add('Responsividade', /@media\s*\(/.test(css), 'Adapte o projeto para diferentes telas.'); add('Interatividade', /addEventListener|fetch\s*\(/.test(js), 'Inclua comportamento real com JavaScript.'); },
    'calculadora-python': () => { add('Entrada de dados', /\binput\s*\(/.test(py), 'Leia valores do usuário.'); add('Operações', /[+\-*/%]/.test(py), 'Implemente operações matemáticas.'); },
    'conversor': () => { add('Entrada de dados', /\binput\s*\(/.test(py), 'Leia o valor que será convertido.'); add('Conversão numérica', /\b(float|int)\s*\(/.test(py), 'Converta a entrada para um tipo numérico.'); },
    'jogo-de-adivinhacao': () => { add('Número aleatório', /random|randint|choice/.test(py), 'Gere um valor imprevisível.'); add('Laço de tentativas', /\bwhile\b|\bfor\b/.test(py), 'Permita várias tentativas.'); },
    'gerador-de-senhas': () => { add('Fonte aleatória segura', /secrets|random|choice/.test(py), 'Escolha caracteres de forma aleatória.'); add('Coleção de caracteres', /string\.|ascii_|digits|punctuation/.test(py), 'Defina uma coleção de caracteres para compor a senha.'); },
    'quiz-em-python': () => { add('Entrada do usuário', /\binput\s*\(/.test(py), 'Leia respostas do usuário.'); add('Pontuação', /pontos|score|acertos/i.test(py), 'Mantenha uma pontuação.'); },
    'agenda': () => { add('Estrutura de dados', /\{|\[|dict\(|list\(/.test(py), 'Armazene os contatos em lista/dicionário.'); add('Funções', /\bdef\s+/.test(py), 'Separe operações em funções.'); },
    'lista-de-tarefas-python': () => { add('Lista de tarefas', /\[|list\(/.test(py), 'Use uma coleção para as tarefas.'); add('Operações em funções', /\bdef\s+/.test(py), 'Crie funções para adicionar/listar/remover.'); },
    'cadastro': () => { add('Estrutura de registros', /\{|dict\(|class\s+/.test(py), 'Modele os dados cadastrados.'); add('Validação/condição', /\bif\b/.test(py), 'Valide entradas ou condições importantes.'); },
    'sistema-simples-de-estoque': () => { add('Estrutura de estoque', /\{|dict\(|class\s+/.test(py), 'Modele produtos e quantidades.'); add('Atualização de quantidade', /\+=|-=|quantidade|estoque/i.test(py), 'Permita atualizar quantidades.'); },
    'analisador-de-texto': () => { add('Processamento de texto', /split\s*\(|lower\s*\(|count\s*\(/.test(py), 'Use operações de string para analisar o texto.'); add('Métricas', /len\s*\(|count\s*\(/.test(py), 'Calcule alguma métrica do texto.'); },
    'organizador-de-arquivos': () => add('Manipulação de arquivos', /pathlib|\bos\b|shutil/.test(py), 'Use pathlib/os/shutil para trabalhar com arquivos.'),
    'consumo-de-api': () => { add('Cliente HTTP', /requests|urllib|httpx/.test(py), 'Faça uma requisição HTTP.'); add('Tratamento de resposta', /json\s*\(|\.json\s*\(|status_code/.test(py), 'Leia ou valide a resposta recebida.'); },
    'automacao': () => add('Automação real', /pathlib|\bos\b|shutil|subprocess|requests|schedule/.test(py), 'Use uma biblioteca adequada à tarefa automatizada.'),
    'projeto-python-final': () => { add('Funções ou classes', /\bdef\s+|\bclass\s+/.test(py), 'Organize a solução em funções ou classes.'); add('Tratamento de erro', /\btry\s*:|\bexcept\b/.test(py), 'Trate pelo menos um erro previsível.'); }
  };
  specific[id]?.();
  return tests;
}
function runProjectCodeTests(project, code = {}) {
  const languages = project?.tech || [];
  const hasTech = name => languages.some(item => normalizeText(item) === normalizeText(name));
  const tests = [];
  const html = String(code.html || ''), css = String(code.css || ''), js = String(code.js || ''), py = String(code.python || '');
  const doc = eeHtmlDocument(html);
  if (hasTech('HTML')) {
    tests.push(eeTest('HTML presente', html.trim().length > 20, 'O projeto precisa ter uma estrutura HTML real.', false, { lang:'html' }));
    tests.push(eeTest('Estrutura principal', Boolean(doc.querySelector('main,article,section,form,header')), 'Use elementos que organizem o conteúdo em regiões claras.', false, { lang:'html' }));
    const imgs = [...doc.querySelectorAll('img')];
    if (imgs.length) tests.push(eeTest('Imagens com texto alternativo', imgs.every(img => img.hasAttribute('alt')), 'Toda imagem deve ter alt (vazio se for apenas decorativa).', false, { lang:'html' }));
    const fakeLinks = [...doc.querySelectorAll('a[href]')].filter(a => ['#','javascript:void(0)','javascript:void(0);'].includes((a.getAttribute('href') || '').trim().toLowerCase()));
    if (doc.querySelector('a')) tests.push(eeTest('Links sem destino falso', fakeLinks.length === 0, 'Evite href="#" em controles que parecem navegação.', false, { lang:'html' }));
  }
  if (hasTech('CSS')) {
    tests.push(eeTest('CSS presente', css.trim().length > 20, 'Adicione estilos para o projeto.', false, { lang:'css' }));
    tests.push(eeTest('Blocos CSS equilibrados', eeBalanced(smartEditorStripStringsAndComments(css,'css'), '{', '}'), 'Confira chaves de abertura e fechamento.', false, { lang:'css' }));
    tests.push(eeTest('Layout estruturado', /display\s*:\s*(grid|flex)|@media\s*\(/i.test(css), 'Use Flexbox, Grid ou regras responsivas para organizar o layout.', false, { lang:'css' }));
  }
  if (hasTech('JavaScript')) {
    let syntaxPass = true; try { new Function(js); } catch { syntaxPass = false; }
    tests.push(eeTest('JavaScript presente', js.trim().length > 20, 'Implemente a lógica interativa.', false, { lang:'js' }));
    tests.push(eeTest('Sintaxe JavaScript', syntaxPass, 'O código deve ser analisado pelo JavaScript sem SyntaxError.', false, { lang:'js' }));
    tests.push(eeTest('Interação real', /addEventListener|fetch\s*\(|setInterval|setTimeout|querySelector|getElementById/i.test(js), 'Conecte a lógica a eventos, DOM, tempo ou dados.', false, { lang:'js' }));
  }
  if (hasTech('Python')) {
    tests.push(eeTest('Python presente', py.trim().length > 20, 'Implemente a solução em Python.', false, { lang:'python' }));
    const diagnostics = smartEditorPythonDiagnostics(py).filter(item => item.severity === 'error');
    tests.push(eeTest('Estrutura Python', diagnostics.length === 0, diagnostics[0]?.message || 'Não foram encontrados erros estruturais óbvios.', false, { lang:'python', line:diagnostics[0]?.line || 0 }));
    tests.push(eeTest('Saída ou retorno', /\bprint\s*\(|\breturn\b/.test(py), 'Mostre ou retorne o resultado do programa.', false, { lang:'python' }));
  }
  tests.push(...eeProjectSpecificTests(project, code, doc));
  return tests;
}
function eeGuessTestLanguage(test, project) {
  if (test.lang) return test.lang;
  const text = normalizeText(`${test.label} ${test.detail}`);
  if (/html|elemento|tag|imagem|link|formulario|semant/.test(text)) return 'html';
  if (/css|layout|media query|grid|flex|estilo|responsiv/.test(text)) return 'css';
  if (/javascript|evento|dom|fetch|pontuacao|estado do jogo|intera/.test(text)) return 'js';
  if (/python|entrada|funcao|classe|lista|dicionario|arquivo|requests/.test(text)) return 'python';
  const tech = (project?.tech || []).map(item => normalizeText(item));
  if (tech.length === 1) return tech[0] === 'javascript' ? 'js' : tech[0];
  return '';
}
function eeJumpToVerifierIssue(lang, line = 0) {
  if (!['html','css','js','python'].includes(lang)) return;
  $('#projectVerifierDialog')?.close();
  if (location.hash !== '#playground') location.hash = '#playground';
  setTimeout(() => {
    try { selectEditorTab(lang); } catch {}
    const editor = $('#codeEditor'); if (!editor) return;
    editor.focus();
    if (line > 0) {
      const lines = editor.value.split('\n');
      const index = lines.slice(0, Math.max(0,line-1)).reduce((sum,item)=>sum+item.length+1,0);
      editor.setSelectionRange(index, Math.min(editor.value.length,index+(lines[line-1]?.length || 0)));
      editor.scrollTop = Math.max(0, (line - 3) * 22);
    }
  }, 120);
}
function renderProjectVerifier(project, tests) {
  const summary = $('#projectVerifierSummary'); const list = $('#projectVerifierTests');
  if (!summary || !list) return;
  const required = tests.filter(test => !test.optional);
  const passed = required.filter(test => test.pass).length;
  const percent = required.length ? Math.round((passed / required.length) * 100) : 0;
  const failed = required.filter(test => !test.pass);
  const status = percent >= 90 ? 'Muito bom' : percent >= 70 ? 'Quase pronto' : percent >= 45 ? 'Em construção' : 'Precisa de trabalho';
  summary.innerHTML = `<div><span class="detail-kicker">Resultado</span><strong>${percent}% · ${escapeHtml(status)}</strong><p>${passed} de ${required.length} verificações obrigatórias passaram.${failed.length ? ` Priorize ${failed.length === 1 ? 'o requisito abaixo' : `os ${failed.length} requisitos abaixo`}.` : ' O código atende aos requisitos verificados.'}</p></div><div class="project-verifier-meter"><span style="width:${percent}%"></span></div>`;
  list.innerHTML = tests.map(test => {
    const lang = eeGuessTestLanguage(test, project);
    const langLabel = ({html:'HTML',css:'CSS',js:'JavaScript',python:'Python'})[lang] || '';
    return `<article class="project-test ${test.pass ? 'pass' : 'fail'} ${test.optional ? 'optional' : ''}"><span class="project-test-state" aria-hidden="true">${test.pass ? '✓' : '!'}</span><div class="project-test-copy"><div class="project-test-title"><strong>${escapeHtml(test.label)}${test.optional ? ' · opcional' : ''}</strong>${langLabel ? `<span>${escapeHtml(langLabel)}</span>` : ''}</div><p>${escapeHtml(test.detail)}</p>${!test.pass && lang ? `<button class="text-button project-test-jump" type="button" data-verifier-lang="${escapeAttr(lang)}" data-verifier-line="${Number(test.line || 0)}">Corrigir no editor →</button>` : ''}</div></article>`;
  }).join('');
  $$('[data-verifier-lang]', list).forEach(button => button.addEventListener('click', () => eeJumpToVerifierIssue(button.dataset.verifierLang, Number(button.dataset.verifierLine || 0))));
}

function openProjectVerifier(projectId = '') {
  syncPlaygroundBuffer();
  const project = projects.find(item => item.id === projectId) || { id:'playground-current', title:'Código atual do Playground', tech:['HTML','CSS','JavaScript','Python'].filter(tech => {
    const key = tech === 'JavaScript' ? 'js' : tech.toLowerCase(); return String(pg[key] || '').trim();
  }) };
  const tests = runProjectCodeTests(project, pg);
  $('#projectVerifierTitle').textContent = projectId ? `Verificar · ${project.title}` : 'Verificar código atual';
  $('#projectVerifierDescription').textContent = projectId ? `Os testes usam o código atualmente aberto no Playground e os objetivos de “${project.title}”.` : 'Testes gerais sobre as linguagens que possuem código no Playground.';
  renderProjectVerifier(project, tests);
  const dialog = $('#projectVerifierDialog'); if (dialog && !dialog.open) dialog.showModal();
}
function initProjectVerifierFeature() {
  $('#closeProjectVerifier')?.addEventListener('click', () => $('#projectVerifierDialog')?.close());
  $('#projectVerifierDialog')?.addEventListener('click', event => { if (event.target === $('#projectVerifierDialog')) $('#projectVerifierDialog').close(); });
  $('#projectVerifierOpenPlayground')?.addEventListener('click', () => $('#projectVerifierDialog')?.close());
  $('#verifyCurrentCode')?.addEventListener('click', () => openProjectVerifier(''));
}

function savePlaygroundRecoveryDraft() {
  try {
    if (!$('#codeEditor')) return;
    const code = { ...pg, [activeLang]:$('#codeEditor').value };
    localStorage.setItem(EE_RECOVERY_KEY, JSON.stringify({ time:Date.now(), lang:activeLang, code }));
  } catch {}
}
function initPlaygroundRecoveryFeature() {
  let recovered = null;
  try { recovered = eeSafeJsonParse(localStorage.getItem(EE_RECOVERY_KEY), null); } catch {}
  if (recovered?.code && Number(recovered.time) > Number(state.lastModified || 0) + 1000) {
    const different = ['html','css','js','python'].some(lang => String(recovered.code[lang] || '') !== String(state.playground?.[lang] || ''));
    if (different) {
      const banner = document.createElement('div');
      banner.className = 'playground-recovery-banner';
      banner.innerHTML = `<div><strong>Encontramos um rascunho mais recente.</strong><span>Ele pode ter sido salvo antes de um fechamento inesperado.</span></div><div><button class="text-button" type="button" data-recovery-dismiss>Descartar</button><button class="button secondary compact" type="button" data-recovery-restore>Recuperar</button></div>`;
      $('#workbench')?.before(banner);
      banner.querySelector('[data-recovery-dismiss]')?.addEventListener('click', () => { localStorage.removeItem(EE_RECOVERY_KEY); banner.remove(); });
      banner.querySelector('[data-recovery-restore]')?.addEventListener('click', () => {
        savePlaygroundSnapshot('Antes de recuperar rascunho');
        pg = { ...defaultPlayground, ...recovered.code }; activeLang = ['html','css','js','python'].includes(recovered.lang) ? recovered.lang : 'html';
        state.playground = { ...pg }; state.playgroundLang = activeLang; saveState(); syncEditorMode(); updateEditor();
        activeLang === 'python' ? preparePythonPane() : runWebPlayground();
        localStorage.removeItem(EE_RECOVERY_KEY); banner.remove(); showToast('Rascunho recuperado.');
      });
    }
  }
  window.addEventListener('pagehide', savePlaygroundRecoveryDraft);
}

const EE_FEEDBACK_PROJECT_URL = 'https://xqlbuatjounkpovwggdj.supabase.co';
const EE_FEEDBACK_ENDPOINT = `${EE_FEEDBACK_PROJECT_URL}/functions/v1/submit-feedback`;
const EE_FEEDBACK_PUBLIC_KEY = 'sb_publishable_03cXMvbU2fQEqkZ-Z7xI_g_Ji97Txy_';
const EE_FEEDBACK_COOLDOWN_KEY = 'enterprise-educacional-feedback-last-v1';

function eeSetFeedbackStatus(message = '', kind = '') {
  const node = $('#feedbackStatus');
  if (!node) return;
  node.hidden = !message;
  node.textContent = message;
  node.dataset.kind = kind;
}
function eeUpdateFeedbackCounter() {
  const text = $('#feedbackText')?.value || '';
  const counter = $('#feedbackCounter');
  if (counter) counter.textContent = String(text.length);
}
function openFeedbackDialog() {
  const dialog = $('#feedbackDialog');
  const form = $('#feedbackForm');
  if (!dialog || !form) return;
  form.reset();
  eeSetFeedbackStatus('');
  eeUpdateFeedbackCounter();
  if (!dialog.open) dialog.showModal();
  setTimeout(() => $('#feedbackText')?.focus(), 60);
}
async function eeSubmitFeedback(event) {
  event.preventDefault();
  const form = $('#feedbackForm');
  const button = $('#submitFeedback');
  const message = String($('#feedbackText')?.value || '').trim();
  const category = String($('#feedbackCategory')?.value || 'geral');
  const ratingRaw = String($('#feedbackRating')?.value || '');
  const honeypot = String($('#feedbackWebsite')?.value || '').trim();
  const categories = new Set(['geral','conteudo','playground','bug','visual','sugestao']);
  if (honeypot) { form?.reset(); $('#feedbackDialog')?.close(); return; }
  if (!categories.has(category)) { eeSetFeedbackStatus('Escolha um tipo de feedback válido.', 'error'); return; }
  if (message.length < 5 || message.length > 2000) { eeSetFeedbackStatus('Escreva entre 5 e 2000 caracteres.', 'error'); return; }
  const rating = ratingRaw ? Number(ratingRaw) : null;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) { eeSetFeedbackStatus('Escolha uma avaliação válida.', 'error'); return; }
  const lastSent = Number(localStorage.getItem(EE_FEEDBACK_COOLDOWN_KEY) || 0);
  if (lastSent && Date.now() - lastSent < 15000) { eeSetFeedbackStatus('Aguarde alguns segundos antes de enviar outro feedback.', 'warning'); return; }
  if (button) { button.disabled = true; button.textContent = 'Enviando…'; }
  eeSetFeedbackStatus('Enviando feedback…');
  try {
    const response = await fetch(EE_FEEDBACK_ENDPOINT, {
      method:'POST',
      headers:{ 'apikey':EE_FEEDBACK_PUBLIC_KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({ category, rating, message, page:String(location.hash || '#home').slice(0,200), website:honeypot })
    });
    if (response.status === 429) {
      eeSetFeedbackStatus('Limite de envios atingido. Aguarde alguns minutos e tente novamente.', 'warning');
      return;
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Erro HTTP ${response.status}`);
    }
    localStorage.setItem(EE_FEEDBACK_COOLDOWN_KEY, String(Date.now()));
    form?.reset();
    eeUpdateFeedbackCounter();
    eeSetFeedbackStatus('Obrigado! Seu feedback foi enviado.', 'success');
    if (typeof showToast === 'function') showToast('Feedback enviado. Obrigado!');
    setTimeout(() => $('#feedbackDialog')?.close(), 900);
  } catch (error) {
    console.error('Falha ao enviar feedback:', error);
    eeSetFeedbackStatus(navigator.onLine === false ? 'Você está offline. Conecte-se à internet e tente novamente.' : 'Não foi possível enviar agora. Tente novamente em instantes.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Enviar feedback'; }
  }
}
function initFeedbackFeature() {
  $('#openFeedback')?.addEventListener('click', openFeedbackDialog);
  $('#closeFeedback')?.addEventListener('click', () => $('#feedbackDialog')?.close());
  $('#cancelFeedback')?.addEventListener('click', () => $('#feedbackDialog')?.close());
  $('#feedbackText')?.addEventListener('input', eeUpdateFeedbackCounter);
  $('#feedbackForm')?.addEventListener('submit', eeSubmitFeedback);
  $('#feedbackDialog')?.addEventListener('click', event => { if (event.target === $('#feedbackDialog')) $('#feedbackDialog').close(); });
}

function initPlatformFeatures() {
  initCloudSyncFeature();
  initFeedbackFeature();
  initPwaFeature();
  initProjectVerifierFeature();
  initPlaygroundRecoveryFeature();
}
