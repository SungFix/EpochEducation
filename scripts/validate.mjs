import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = message => { console.error(`ERRO: ${message}`); process.exitCode = 1; };
const ok = message => console.log(`OK: ${message}`);
const read = file => fs.readFileSync(path.join(root,file),'utf8');

for (const file of ['index.html','styles.css','content-data.js','app.js','platform-features.js','bootstrap.js','manifest.webmanifest','service-worker.js']) {
  if (!fs.existsSync(path.join(root,file))) fail(`Arquivo ausente: ${file}`);
}

const html = read('index.html');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id,index) => ids.indexOf(id) !== index);
if (duplicates.length) fail(`IDs duplicados: ${[...new Set(duplicates)].join(', ')}`); else ok(`${ids.length} IDs únicos no HTML`);
const fragmentRefs = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
const controlledRefs = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(m => m[1]);
for (const target of [...fragmentRefs, ...controlledRefs]) if (!ids.includes(target) && !['home','trilhas','aula','exercicios','desafios','projetos','playground','glossario','progresso'].includes(target)) fail(`Alvo de fragmento ausente: ${target}`);
ok('Alvos de navegação/acessibilidade verificados');

const localRefs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(ref => !/^(?:https?:|data:|mailto:|tel:|javascript:)/.test(ref));
for (const ref of localRefs) {
  const clean = ref.split('?')[0].replace(/^\.\//,'');
  if (!clean || clean.endsWith('/')) continue;
  if (!fs.existsSync(path.join(root,clean))) fail(`Referência local ausente: ${ref}`);
}
ok('Referências locais verificadas');

const contentSource = read('content-data.js').trim();
const prefix = 'window.EE_CONTENT = ';
if (!contentSource.startsWith(prefix)) fail('content-data.js não possui o formato esperado');
let data;
try { data = JSON.parse(contentSource.slice(prefix.length).replace(/;\s*$/,'')); }
catch (error) { fail(`JSON de conteúdo inválido: ${error.message}`); }

if (data) {
  const lessons = data.lessons || [];
  const required = ['id','courseId','moduleId','moduleTitle','title','intro','objectives','explanation','deepDive','practicalContext','code','understand','errors','practice','summary','nextStep'];
  const seen = new Set();
  for (const lesson of lessons) {
    if (seen.has(lesson.id)) fail(`ID de aula duplicado: ${lesson.id}`); seen.add(lesson.id);
    for (const field of required) {
      const value = lesson[field];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) fail(`Aula ${lesson.id} sem ${field}`);
    }
  }
  const lessonIds = new Set(lessons.map(l => l.id));
  for (const course of data.courses || []) for (const module of course.modules || []) for (const id of module.lessonIds || []) if (!lessonIds.has(id)) fail(`Módulo referencia aula ausente: ${id}`);
  ok(`${lessons.length} aulas auditadas`);
  ok(`${(data.exercises || []).length} exercícios · ${(data.projects || []).length} projetos · ${(data.challenges || []).length} desafios · ${(data.glossary || []).length} termos`);
}

const css = read('styles.css');
let depth = 0; for (const ch of css.replace(/\/\*[\s\S]*?\*\//g,'')) { if (ch === '{') depth++; if (ch === '}') depth--; if (depth < 0) break; }
if (depth !== 0) fail(`CSS com chaves desequilibradas (${depth})`); else ok('CSS estruturalmente balanceado');

if (/\b(?:TODO|FIXME)\b/.test(read('app.js') + read('platform-features.js'))) fail('TODO/FIXME encontrado no JavaScript');
else ok('Sem TODO/FIXME no JavaScript publicado');


// Extended integrity checks (v44)
if (data) {
  const uniqueIds = (items, label) => {
    const ids = new Set();
    for (const item of items || []) {
      if (!item?.id) { fail(`${label} sem id`); continue; }
      if (ids.has(String(item.id))) fail(`ID duplicado em ${label}: ${item.id}`);
      ids.add(String(item.id));
    }
  };
  uniqueIds(data.exercises, 'exercícios'); uniqueIds(data.projects, 'projetos'); uniqueIds(data.challenges, 'desafios');
  const lessonIds = new Set((data.lessons || []).map(item => String(item.id)));
  for (const exercise of data.exercises || []) if (exercise.relatedLessonId && !lessonIds.has(String(exercise.relatedLessonId))) fail(`Exercício ${exercise.id} referencia aula ausente: ${exercise.relatedLessonId}`);
  for (const course of data.courses || []) {
    const listed = [];
    for (const module of course.modules || []) listed.push(...(module.lessonIds || []).map(String));
    const duplicatesInsideCourse = listed.filter((id,index) => listed.indexOf(id) !== index);
    if (duplicatesInsideCourse.length) fail(`Aulas repetidas na trilha ${course.id}: ${[...new Set(duplicatesInsideCourse)].join(', ')}`);
  }
  ok('IDs e vínculos de exercícios/projetos/desafios verificados');
}

const manifest = JSON.parse(read('manifest.webmanifest'));
if (!manifest.name || !manifest.start_url || !Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('Manifest PWA incompleto');
else ok('Manifest PWA verificado');

const versionSources = [html, read('app.js'), read('platform-features.js'), read('bootstrap.js'), read('service-worker.js')].join('\n');
const staleVersionRefs = [...versionSources.matchAll(/\?v=(\d+)/g)].map(match => Number(match[1])).filter(version => version < 50);
if (staleVersionRefs.length) fail(`Referências de cache antigas nos arquivos públicos: ${[...new Set(staleVersionRefs)].join(', ')}`); else ok('Referências de cache dos arquivos públicos atualizadas');

for (const breakpoint of ['375px','390px','430px','760px','900px']) if (!css.includes(`max-width:${breakpoint}`) && !css.includes(`max-width: ${breakpoint}`)) fail(`Breakpoint responsivo ausente: ${breakpoint}`);
else {}
ok('Breakpoints principais presentes');

if (/html\s*,?\s*body[^\{]*\{[^}]*overflow-x\s*:\s*hidden/i.test(css)) fail('overflow-x:hidden global encontrado; corrija a causa do overflow');
else ok('Sem overflow-x:hidden global mascarando layout');



const appSource = read('app.js');
const platformSource = read('platform-features.js');
const workerSource = read('service-worker.js');
const nativeDialogPattern = /(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/g;
if (nativeDialogPattern.test(appSource) || nativeDialogPattern.test(platformSource)) fail('Diálogo nativo do navegador encontrado no código da interface');
else ok('Ações da interface usam diálogos visuais do Epoch Education');
const schemaSource = fs.existsSync(path.join(root,'supabase/schema.sql')) ? read('supabase/schema.sql') : '';

if (css.lastIndexOf('Quality consolidation v47') < css.lastIndexOf('Product polish v46')) fail('Camada final de CSS v47 não preservada');
else if (css.lastIndexOf('Feedback integration v48') < css.lastIndexOf('Quality consolidation v47')) fail('Camada de feedback v48 fora de ordem');
else if (css.lastIndexOf('Quality audit v54') < css.lastIndexOf('Feedback integration v48')) fail('Camada v54 fora de ordem');
else if (css.lastIndexOf('Convenience + behavior polish v55') < css.lastIndexOf('Quality audit v54')) fail('Camada v55 fora de ordem');
else if (css.lastIndexOf('Legibility + focus polish v57') < css.lastIndexOf('Convenience + behavior polish v55')) fail('Camada final de CSS v57 não é a autoridade mais recente');
else ok('Autoridade CSS v57 consolidada');
if (data) {
  const tipCounts = new Map();
  for (const lesson of data.lessons || []) { const tip=String(lesson.tip || '').trim(); if (tip) tipCounts.set(tip,(tipCounts.get(tip)||0)+1); }
  const effectiveTips = (data.lessons || []).map(lesson => {
    const tip=String(lesson.tip || '').trim();
    return tip && (tipCounts.get(tip)||0) >= 20 ? `${tip} Nesta aula, aplique essa orientação ao praticar “${lesson.moduleTitle}: ${lesson.title}”.` : tip;
  });
  if (new Set(effectiveTips).size !== effectiveTips.length) fail('Dicas pedagógicas continuam com repetição exata após contextualização v47');
  else ok('Dicas pedagógicas repetidas contextualizadas por aula');
}

if (!appSource.includes('Tkinter Web Lite') || !appSource.includes('pythonUsesTkinter') || !html.includes('id="tkinterRuntime"')) fail('Tkinter Web Lite ausente ou incompleto');
else ok('Tkinter Web Lite integrado ao Playground Python');
if (!appSource.includes("'#f5efe6'")) fail('theme-color claro não acompanha a paleta Light Mode');
else ok('Theme color Light Mode alinhado');
if (!appSource.includes("event?.type === 'hashchange'") || !appSource.includes("heading.focus({ preventScroll:true })")) fail('Foco de navegação SPA não tratado');
else ok('Foco de navegação SPA verificado');
if (!/appVersion\s*:\s*62/.test(platformSource)) fail('Versão de backup não atualizada para v62');
else ok('Versão de backup atualizada');
const expectedPublicVersion = 62;
const publicVersionRefs = [...versionSources.matchAll(/\?v=(\d+)/g)].map(match => Number(match[1]));
if (publicVersionRefs.some(version => version !== expectedPublicVersion)) fail(`Referências públicas fora da v${expectedPublicVersion}: ${[...new Set(publicVersionRefs)].join(', ')}`);
else ok(`Referências públicas alinhadas na v${expectedPublicVersion}`);
if (!workerSource.includes(`epoch-education-shell-v${expectedPublicVersion}`) || !workerSource.includes(`epoch-education-runtime-v${expectedPublicVersion}`)) fail('Caches do Service Worker fora da versão pública atual');
else ok('Caches do Service Worker alinhados com a versão pública');
const versionedShellRefs = [...new Set([...html.matchAll(/(?:src|href|data-dark-src|data-light-src|data-dark-href|data-light-href)="([^"#?]+\?v=\d+)"/g)].map(match => match[1]))];
for (const ref of versionedShellRefs) {
  const shellRef = ref.startsWith('./') ? ref : `./${ref}`;
  if (!workerSource.includes(shellRef)) fail(`Asset versionado do HTML ausente do shell offline: ${ref}`);
}
if (versionedShellRefs.length) ok(`${versionedShellRefs.length} assets versionados do HTML alinhados com o shell offline`);

for (const id of ['lessonNavSearch','glossarySearch']) {
  const pattern = new RegExp(`<input[^>]+id=["']${id}["'][^>]+aria-label=["'][^"']+["']`, 'i');
  if (!pattern.test(html)) fail(`Campo de busca sem nome acessível: ${id}`);
}
if (!/<button[^>]+id=["']resetPlayground["'][^>]+type=["']button["']/i.test(html)) fail('Botão Restaurar do Playground sem type=button explícito');
else ok('Controles de busca e Playground com semântica acessível');
if (!appSource.includes("systemTheme?.addEventListener?.('change'") || !appSource.includes("if (state.theme === 'dark' || state.theme === 'light') return;")) fail('Tema automático não acompanha mudanças do sistema');
else ok('Tema automático acompanha preferência do sistema sem sobrescrever escolha manual');
if (!platformSource.includes('const previousProjects = await listSavedCodeProjects();') || !platformSource.includes('await replaceSavedCodeProjects(previousProjects)')) fail('Restauração de backup sem rollback de projetos');
else ok('Restauração de backup possui rollback de estado e projetos');
if (!css.includes('summary:focus-visible') || !css.includes('Legibility + focus polish v57')) fail('Foco visível/legibilidade v57 ausentes');
else ok('Foco visível e legibilidade v57 presentes');
if (!appSource.includes('const selectExerciseOption =') || !appSource.includes('nextRadio = (radioIndex + 1) % optionButtons.length') || !appSource.includes("item.tabIndex = active ? 0 : -1")) fail('Grupo de respostas de múltipla escolha sem navegação de rádio acessível');
else ok('Grupo de respostas de múltipla escolha com foco e setas acessíveis');
if (!appSource.includes('const encodedRoute = location.hash.slice(1)') || !appSource.includes('try { raw = decodeURIComponent(encodedRoute); } catch {}')) fail('Roteamento não está protegido contra hash malformado');
else ok('Roteamento protegido contra hash malformado');
if (appSource.includes("behavior: 'instant'")) fail('Scroll de rota usa valor não padronizado');
else ok('Scroll de rota usa comportamento compatível');
if (!appSource.includes("const optionButtons = $$('.option', $('#exerciseCard'));")) fail('Opções de múltipla escolha não usam coleção de elementos');
else ok('Coleção de opções de múltipla escolha verificada');
if (appSource.includes('renderHome(); renderTracks(); renderExercises(); renderChallenges(); renderProjects(); renderGlossary(); renderProgress();')) fail('Inicialização ainda renderiza páginas ocultas antes da rota');
else ok('Inicialização renderiza somente a rota ativa');
const singleQueryCollectionPattern = /(?<!\$)\$\([^\)\n]+\)\.(?:forEach|map|filter|find|some|every|reduce|indexOf|findIndex)\s*\(/g;
const singleQueryCollectionMatches = appSource.match(singleQueryCollectionPattern) || [];
if (singleQueryCollectionMatches.length) fail(`$() usado como coleção: ${singleQueryCollectionMatches.join(', ')}`);
else ok('Seletores de coleção usam $$()');
if (!appSource.includes("const tabs = $$('#editorTabs button');")) fail('Navegação das abas do Playground não usa coleção');
else ok('Navegação das abas usa coleção corretamente');
if (!appSource.includes('function warmPythonRuntime()') || !appSource.includes("type === 'prepare'")) fail('Pré-aquecimento do runtime Python ausente');
else ok('Runtime Python é preparado ao abrir a aba');
if (!appSource.includes('booting = null') || !appSource.includes("message.type === 'boot-error'")) fail('Retry do Pyodide após falha não está protegido');
else ok('Pyodide pode tentar novamente após falha de inicialização');
if (appSource.includes('Verifique sua conexão com a internet.')) fail('Erro genérico do Python ainda acusa internet indevidamente');
else ok('Erros do Python não culpam a conexão genericamente');
if (!appSource.includes('pythonRuntimeReady') || !appSource.includes('pythonRuntimeBooting')) fail('Estado de inicialização do Python não é rastreado');
else ok('Estado do runtime Python rastreado explicitamente');
if (appSource.includes("dialog.style.width = 'min(560px")) fail('Largura do diálogo de ação voltou a ser controlada inline no JavaScript');
else if (!css.includes('.action-dialog')) fail('Estilo consolidado do diálogo de ação ausente');
else ok('Diálogo de ação controlado pelo CSS');
if (!css.includes('Quality audit v54') || !css.includes('100dvh')) fail('Camada final de estabilidade visual v54 ausente');
else ok('Camada final de estabilidade visual v54 presente');
if (!appSource.includes('function syncEditorTabs()') || !appSource.includes("tab.tabIndex = selected ? 0 : -1")) fail('Abas acessíveis do Playground incompletas');
else ok('Abas do Playground sincronizam seleção e foco');
if (!appSource.includes("event.key === '/'" ) || !appSource.includes('clearSearchHistory')) fail('Melhorias de busca v55 ausentes');
else ok('Busca rápida e limpeza de histórico verificadas');
if (!appSource.includes('function initConnectivityStatus()') || !appSource.includes("window.addEventListener('offline'")) fail('Feedback de conectividade ausente');
else ok('Feedback de conectividade verificado');
if (appSource.includes("location.hash = `#aula/${encodeURIComponent(id)}`;\n  if (location.hash")) fail('Navegação de aula ainda pode renderizar duas vezes');
else ok('Navegação de aula sem renderização duplicada');

for (const standaloneFile of ['Epoch-Education.html','index-standalone-preview.html']) {
  if (!fs.existsSync(path.join(root,standaloneFile))) fail(`Standalone ausente: ${standaloneFile}`);
}
if (fs.existsSync(path.join(root,'Epoch-Education.html')) && fs.existsSync(path.join(root,'index-standalone-preview.html'))) {
  const standalone = read('Epoch-Education.html');
  const previewStandalone = read('index-standalone-preview.html');
  if (!standalone.includes('data-build="62"')) fail('Standalone oficial não foi regenerado para v62');
  if (standalone !== previewStandalone) fail('Standalone oficial e preview standalone divergiram');
  else ok('Standalone oficial e preview estão sincronizados');
}
if (!workerSource.includes("request.mode === 'navigate'") || /catch\(\(\) => caches\.match\('\.\/index\.html'\)\)/.test(workerSource)) fail('Fallback offline do Service Worker ainda pode devolver HTML para assets');
else ok('Fallback PWA separado entre navegação e assets');
for (const asset of ['favicon-light-16.png','favicon-light-32.png','apple-touch-icon-light.png']) if (!workerSource.includes(asset)) fail(`Asset Light Mode ausente do cache PWA: ${asset}`);
if (schemaSource && !schemaSource.includes('drop policy if exists "ee_user_data_select_own"')) fail('schema.sql não é idempotente para policies');
else if (schemaSource) ok('Policies Supabase idempotentes');

const feedbackSchemaPath = path.join(root,'supabase/feedback-schema.sql');
const feedbackSchemaSource = fs.existsSync(feedbackSchemaPath) ? read('supabase/feedback-schema.sql') : '';
if (!html.includes('id="feedbackDialog"') || !html.includes('id="openFeedback"') || !html.includes('id="feedbackForm"')) fail('Interface de feedback ausente');
else ok('Interface de feedback presente');
if (!platformSource.includes('EE_FEEDBACK_ENDPOINT') || !platformSource.includes('sb_publishable_') || !platformSource.includes('/functions/v1/submit-feedback')) fail('Integração segura de feedback incompleta');
else if (platformSource.includes('/rest/v1/ee_feedback')) fail('Frontend ainda possui inserção direta na tabela de feedback');
else if (/sb_secret_|service_role\s*=|service_role['"]\s*:/i.test(platformSource)) fail('Credencial privilegiada encontrada na integração de feedback');
else ok('Integração de feedback usa apenas chave publicável');
if (!feedbackSchemaSource.includes('enable row level security') || !feedbackSchemaSource.includes('revoke insert') || !feedbackSchemaSource.includes('ee_feedback_rate_limits') || !feedbackSchemaSource.includes('grant execute') || !feedbackSchemaSource.includes('service_role')) fail('Schema de feedback v50 sem RLS/rate limit/privilégio mínimo');
else ok('Schema de feedback v50 protegido por RLS, Edge Function e rate limit');



if (!css.includes('--font-mono:') || !css.includes('--mono: var(--font-mono)')) fail('Variáveis de fonte monoespaçada ausentes');
else ok('Variáveis de fonte monoespaçada definidas');
if (!appSource.includes("pythonTkinter ? $('#previewStage') : $('#consolePanel')")) fail('Tela cheia do Tkinter ainda aponta para o Console');
else ok('Tela cheia do Tkinter usa o resultado visual');
const feedbackFunctionPath = path.join(root,'supabase/functions/submit-feedback/index.ts');
const feedbackFunctionSource = fs.existsSync(feedbackFunctionPath) ? read('supabase/functions/submit-feedback/index.ts') : '';
if (!feedbackFunctionSource.includes('p_limit:3') || !feedbackFunctionSource.includes('p_window_seconds:600') || !feedbackFunctionSource.includes('SUPABASE_SECRET_KEYS')) fail('Edge Function de feedback sem rate limit/segredo de backend');
else ok('Edge Function de feedback com validação e rate limit');

const legacyBrand = 'Enterprise' + ' Educacional';
for (const file of ['index.html','app.js','platform-features.js','content-data.js','manifest.webmanifest','assets/branding/enterprise-logo-horizontal.svg','assets/branding/enterprise-symbol.svg']) {
  if (read(file).includes(legacyBrand)) fail(`Marca antiga ainda presente em ${file}`);
}
if (manifest.name !== 'Epoch Education' || manifest.short_name !== 'Epoch') fail('Manifest PWA não usa Epoch Education/Epoch');
else ok('Marca Epoch Education verificada nos arquivos públicos');

if (process.exitCode) process.exit(process.exitCode);
