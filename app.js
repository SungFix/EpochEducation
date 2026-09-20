const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];


let eeActionDialogResolve = null;
let eeActionDialogMode = 'confirm';
let eeActionDialogPreviousFocus = null;

function ensureEeActionDialog() {
  let dialog = $('#eeActionDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'eeActionDialog';
  dialog.className = 'saved-code-dialog action-dialog';
  dialog.setAttribute('aria-labelledby', 'eeActionDialogTitle');
  dialog.setAttribute('aria-describedby', 'eeActionDialogMessage');
  dialog.innerHTML = `<div class="saved-code-modal">
    <div class="saved-code-dialog-head"><div><span class="detail-kicker" id="eeActionDialogKicker">Confirmação</span><strong id="eeActionDialogTitle">Confirmar ação</strong><p id="eeActionDialogMessage"></p></div><button class="icon-button" id="eeActionDialogClose" type="button" aria-label="Fechar"><svg class="ui-icon"><use href="#icon-close"></use></svg></button></div>
    <div class="saved-code-dialog-body" id="eeActionDialogBody" hidden><label class="saved-code-name"><span id="eeActionDialogInputLabel">Valor</span><input id="eeActionDialogInput" type="text" autocomplete="off" /></label></div>
    <div class="saved-code-dialog-actions"><span></span><span></span><button class="button secondary" id="eeActionDialogCancel" type="button">Cancelar</button><button class="button primary" id="eeActionDialogConfirm" type="button">Confirmar</button></div>
  </div>`;
  document.body.append(dialog);

  const finish = result => {
    if (!dialog.open) return;
    const resolve = eeActionDialogResolve;
    eeActionDialogResolve = null;
    dialog.close();
    const previous = eeActionDialogPreviousFocus;
    eeActionDialogPreviousFocus = null;
    if (previous?.isConnected) requestAnimationFrame(() => previous.focus({ preventScroll:true }));
    resolve?.(result);
  };
  dialog._eeFinish = finish;
  $('#eeActionDialogClose', dialog)?.addEventListener('click', () => finish(eeActionDialogMode === 'prompt' ? null : false));
  $('#eeActionDialogCancel', dialog)?.addEventListener('click', () => finish(eeActionDialogMode === 'prompt' ? null : false));
  $('#eeActionDialogConfirm', dialog)?.addEventListener('click', () => {
    const input = $('#eeActionDialogInput', dialog);
    finish(eeActionDialogMode === 'prompt' ? (input?.value ?? '') : true);
  });
  $('#eeActionDialogInput', dialog)?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); $('#eeActionDialogConfirm', dialog)?.click(); }
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    finish(eeActionDialogMode === 'prompt' ? null : false);
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) finish(eeActionDialogMode === 'prompt' ? null : false);
  });
  return dialog;
}

function eeOpenActionDialog(options = {}) {
  const dialog = ensureEeActionDialog();
  if (dialog.open) dialog._eeFinish?.(eeActionDialogMode === 'prompt' ? null : false);
  eeActionDialogMode = options.mode === 'prompt' ? 'prompt' : 'confirm';
  eeActionDialogPreviousFocus = document.activeElement;
  const tone = options.tone === 'danger' ? 'danger' : 'default';
  const body = $('#eeActionDialogBody', dialog);
  const input = $('#eeActionDialogInput', dialog);
  const confirmButton = $('#eeActionDialogConfirm', dialog);
  $('#eeActionDialogKicker', dialog).textContent = options.kicker || (tone === 'danger' ? 'Atenção' : (eeActionDialogMode === 'prompt' ? 'Editar' : 'Confirmação'));
  $('#eeActionDialogTitle', dialog).textContent = options.title || (eeActionDialogMode === 'prompt' ? 'Digite um valor' : 'Confirmar ação');
  $('#eeActionDialogMessage', dialog).textContent = options.message || '';
  $('#eeActionDialogCancel', dialog).textContent = options.cancelLabel || 'Cancelar';
  confirmButton.textContent = options.confirmLabel || (eeActionDialogMode === 'prompt' ? 'Salvar' : 'Confirmar');
  confirmButton.className = tone === 'danger' ? 'button danger-ghost' : 'button primary';
  body.hidden = eeActionDialogMode !== 'prompt';
  if (eeActionDialogMode === 'prompt') {
    $('#eeActionDialogInputLabel', dialog).textContent = options.inputLabel || 'Valor';
    input.value = String(options.value ?? '');
    input.placeholder = options.placeholder || '';
    input.maxLength = Number(options.maxLength || 120);
  }
  return new Promise(resolve => {
    eeActionDialogResolve = resolve;
    dialog.showModal();
    requestAnimationFrame(() => {
      if (eeActionDialogMode === 'prompt') { input.focus(); input.select(); }
      else confirmButton.focus();
    });
  });
}

function eeConfirm(message, options = {}) {
  return eeOpenActionDialog({ ...options, mode:'confirm', message });
}
function eePrompt(message, defaultValue = '', options = {}) {
  return eeOpenActionDialog({ ...options, mode:'prompt', message, value:defaultValue });
}
window.eeConfirm = eeConfirm;
window.eePrompt = eePrompt;

const DATA = window.EE_CONTENT || { courses: [], lessons: [], exercises: [], challenges: [], projects: [], glossary: [] };
const courses = DATA.courses || [];
const lessons = DATA.lessons || [];
const exercises = DATA.exercises || [];
const challenges = DATA.challenges || [];
const projects = DATA.projects || [];
const glossary = [...(DATA.glossary || [])].sort((a, b) => a.term.localeCompare(b.term, 'pt-BR'));

const courseById = new Map(courses.map(course => [course.id, course]));
const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]));
const glossaryByTerm = new Map(glossary.map(term => [term.term.toLocaleLowerCase('pt-BR'), term]));
const lessonsByCourse = new Map(courses.map(course => [course.id, lessons.filter(lesson => lesson.courseId === course.id).sort((a,b) => (a.order ?? 0) - (b.order ?? 0))]));

function contextualizeRepeatedLessonTips(items) {
  const counts = new Map();
  items.forEach(lesson => {
    const tip = String(lesson.tip || '').trim();
    if (tip) counts.set(tip, (counts.get(tip) || 0) + 1);
  });
  items.forEach(lesson => {
    const tip = String(lesson.tip || '').trim();
    if (!tip || (counts.get(tip) || 0) < 20) return;
    lesson.tip = `${tip} Nesta aula, aplique essa orientação ao praticar “${lesson.moduleTitle}: ${lesson.title}”.`;
  });
}
contextualizeRepeatedLessonTips(lessons);

const defaultPlayground = {
  html: `<main class="card">\n  <span class="tag">Epoch Education</span>\n  <h1>Seu código, seu resultado.</h1>\n  <p>Edite este exemplo e clique em Executar.</p>\n  <button id="action">Testar JavaScript</button>\n</main>`,
  css: `:root { color-scheme: dark; }\n* { box-sizing: border-box; }\nbody {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 32px;\n  font-family: system-ui, sans-serif;\n  background: #0b0d0f;\n  color: #f3f5f7;\n}\n.card {\n  width: min(520px, 86vw);\n  padding: 32px;\n  border: 1px solid #2b3138;\n  border-radius: 18px;\n  background: #12161a;\n  box-shadow: 0 18px 46px rgba(0,0,0,.32);\n}\n.tag { font-size: 12px; color: #9aa3ad; }\nh1 { color: #f7f8f9; }\np { color: #c2c8cf; }\nbutton {\n  padding: 10px 14px;\n  border: 1px solid #dfe3e7;\n  border-radius: 9px;\n  background: #eef1f4;\n  color: #111417;\n  font: inherit;\n  font-weight: 650;\n  cursor: pointer;\n}\nbutton:hover { background: #ffffff; }`,
  js: `document.querySelector('#action').addEventListener('click', () => {\n  document.querySelector('h1').textContent = 'Funcionou!';\n  console.log('Evento executado com sucesso.');\n});`,
  python: `# Python 3 — executado no navegador com Pyodide\nnome = "Marina"\nprogresso = ["entender", "praticar", "construir"]\n\nprint(f"Olá, {nome}!")\nfor etapa, valor in enumerate(progresso, start=1):\n    print(f"{etapa}. {valor.capitalize()}")\n\nmedia = sum([8.5, 9.0, 10.0]) / 3\nprint(f"Média: {media:.1f}")`
};

const playgroundPresets = {
  default: { label: 'Web · Exemplo inicial', title: 'Exemplo inicial', description: 'HTML, CSS e JavaScript trabalhando juntos.', category: 'Web', icon: 'playground', ...defaultPlayground },
  blank: { label: 'Web · Página vazia', title: 'Página vazia', description: 'Estrutura mínima para começar do zero.', category: 'Web', icon: 'html', ...defaultPlayground, html: '<main>\n  <h1>Comece por aqui</h1>\n</main>', css: ':root { color-scheme: dark; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; padding: 40px; font-family: system-ui, sans-serif; background: #0b0d0f; color: #f3f5f7; }\nmain { max-width: 760px; margin: 0 auto; }\nh1 { margin: 0; color: #f7f8f9; }', js: '' },
  card: { label: 'Web · Card responsivo', title: 'Card responsivo', description: 'Um componente simples para praticar HTML e CSS.', category: 'Web', icon: 'css', ...defaultPlayground, html: '<article class="profile">\n  <span>Perfil</span>\n  <h1>Marina Costa</h1>\n  <p>Estudante de desenvolvimento web.</p>\n</article>', css: ':root { color-scheme: dark; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px; font-family: system-ui; background: #0b0d0f; color: #f3f5f7; }\n.profile { width: min(420px, 84vw); padding: 28px; background: #12161a; border: 1px solid #2b3138; border-radius: 16px; box-shadow: 0 18px 46px rgba(0,0,0,.28); }\n.profile span { color: #9aa3ad; font-size: 12px; }\n.profile p { color: #c2c8cf; }', js: '' },
  form: { label: 'Web · Formulário', title: 'Formulário', description: 'Validação e envio de dados com JavaScript.', category: 'Web', icon: 'exercise', ...defaultPlayground, html: '<form id="contact">\n  <label>Nome <input name="nome" required></label>\n  <button>Enviar</button>\n  <p id="message"></p>\n</form>', css: ':root { color-scheme: dark; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px; font-family: system-ui; background: #0b0d0f; color: #f3f5f7; }\nform { width: min(440px, 88vw); display: grid; gap: 16px; padding: 28px; border: 1px solid #2b3138; border-radius: 16px; background: #12161a; box-shadow: 0 18px 46px rgba(0,0,0,.28); }\nlabel { display: grid; gap: 7px; color: #dce1e6; }\ninput, button { padding: 10px 12px; border-radius: 9px; font: inherit; }\ninput { border: 1px solid #353d46; background: #0d1115; color: #f4f6f8; outline: none; }\ninput:focus { border-color: #737f8b; }\nbutton { border: 1px solid #dfe3e7; background: #eef1f4; color: #111417; font-weight: 650; cursor: pointer; }\n#message { margin: 0; color: #aeb7c1; }', js: `document.querySelector('#contact').addEventListener('submit', event => {\n  event.preventDefault();\n  const data = new FormData(event.currentTarget);\n  document.querySelector('#message').textContent = 'Olá, ' + data.get('nome') + '!';\n  console.log('Formulário validado.');\n});` },
  counter: { label: 'Web · Contador DOM', title: 'Contador DOM', description: 'Eventos, estado e atualização da interface.', category: 'Web', icon: 'js', ...defaultPlayground, html: '<main>\n  <h1 id="value">0</h1>\n  <div>\n    <button data-action="minus">−</button>\n    <button data-action="reset">Resetar</button>\n    <button data-action="plus">+</button>\n  </div>\n</main>', css: ':root { color-scheme: dark; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px; font-family: system-ui; text-align: center; background: #0b0d0f; color: #f3f5f7; }\nmain { padding: 30px; border: 1px solid #2b3138; border-radius: 16px; background: #12161a; box-shadow: 0 18px 46px rgba(0,0,0,.28); }\nh1 { font-size: 72px; margin: 0 0 20px; color: #f7f8f9; }\nbutton { padding: 10px 14px; border: 1px solid #343b43; border-radius: 9px; background: #191f25; color: #f3f5f7; font: inherit; cursor: pointer; }\nbutton:hover { background: #222a31; }', js: `let value = 0;\nconst output = document.querySelector('#value');\nfunction render() { output.textContent = value; console.log('Valor:', value); }\ndocument.addEventListener('click', event => {\n  const action = event.target.dataset.action;\n  if (action === 'plus') value++;\n  if (action === 'minus') value--;\n  if (action === 'reset') value = 0;\n  if (action) render();\n});` },
  pythonBasics: { label: 'Python · Fundamentos', title: 'Fundamentos', description: 'Variáveis, operações e saída com print().', category: 'Python', icon: 'python', ...defaultPlayground, python: `nome = "Marina"\nidade = 18\n\nprint(f"Olá, {nome}!")\nprint(f"No próximo ano você terá {idade + 1} anos.")` },
  pythonLists: { label: 'Python · Listas e funções', title: 'Listas e funções', description: 'Coleções, funções e compreensão de listas.', category: 'Python', icon: 'python', ...defaultPlayground, python: `notas = [7.5, 9.0, 8.5, 10.0]\n\ndef calcular_media(valores):\n    return sum(valores) / len(valores)\n\nacima_de_oito = [nota for nota in notas if nota >= 8]\n\nprint("Notas:", notas)\nprint("Média:", round(calcular_media(notas), 2))\nprint("Notas >= 8:", acima_de_oito)` },
  pythonClass: { label: 'Python · Classe simples', title: 'Classe simples', description: 'Objetos, atributos, métodos e __init__.', category: 'Python', icon: 'python', ...defaultPlayground, python: `class Curso:\n    def __init__(self, nome, aulas):\n        self.nome = nome\n        self.aulas = aulas\n\n    def resumo(self):\n        return f"{self.nome}: {self.aulas} aulas"\n\ncurso = Curso("Python", 202)\nprint(curso.resumo())` },
  pythonTkinter: { label: 'Python · Tkinter Web Lite', title: 'Tkinter Web Lite', description: 'Crie interfaces Tkinter e visualize o resultado diretamente no navegador.', category: 'Python', icon: 'python', ...defaultPlayground, python: `import tkinter as tk\n\njanela = tk.Tk()\njanela.title("Olá, Tkinter!")\njanela.geometry("420x260")\n\ntitulo = tk.Label(janela, text="Tkinter Web Lite", font=("Arial", 20, "bold"))\ntitulo.pack(pady=24)\n\nnome = tk.StringVar(value="Marina")\nentrada = tk.Entry(janela, textvariable=nome)\nentrada.pack(padx=28, fill="x")\n\ndef saudar():\n    titulo.config(text=f"Olá, {nome.get()}!")\n\ntk.Button(janela, text="Saudar", command=saudar).pack(pady=18)\njanela.mainloop()` }
};

const storageKey = 'enterprise-educacional-state-v2';
const legacyStorageKey = 'enterprise-educacional-state-v1';
function loadState() {
  try {
    const current = JSON.parse(localStorage.getItem(storageKey));
    if (current) return current;
    const legacy = JSON.parse(localStorage.getItem(legacyStorageKey));
    return legacy || {};
  } catch {
    return {};
  }
}

let state = Object.assign({
  completedLessons: [],
  completedExercises: [],
  completedChallenges: [],
  completedProjects: [],
  projectSteps: {},
  exerciseAttempts: {},
  exerciseMistakes: [],
  exerciseHistory: {},
  moduleCheckpoints: {},
  lastLesson: lessons[0]?.id || '',
  theme: '',
  playground: null,
  playgroundPreset: 'default',
  playgroundLang: 'html',
  playgroundSplit: 55,
  playgroundHistory: [],
  playgroundSavedProjectId: '',
  consoleCollapsed: true,
  pythonStdin: '',
  lessonNotes: {},
  activity: [],
  studyLog: {},
  reviewSchedule: {},
  searchHistory: [],
  certificateName: '',
  lastModified: 0
}, loadState());

function migrateState() {
  state.completedLessons = [...new Set((state.completedLessons || []).filter(id => lessonById.has(id)))];
  state.completedExercises = [...new Set((state.completedExercises || []).filter(id => exercises.some(ex => String(ex.id) === String(id))))];
  const challengeIds = new Set(challenges.map(c => c.id));
  state.completedChallenges = [...new Set((state.completedChallenges || []).map(value => challengeIds.has(value) ? value : challenges.find(c => c.title === value)?.id).filter(Boolean))];
  const projectIds = new Set(projects.map(p => p.id));
  state.completedProjects = [...new Set((state.completedProjects || []).map(value => projectIds.has(value) ? value : projects.find(p => p.title === value)?.id).filter(Boolean))];
  if (!lessonById.has(state.lastLesson)) state.lastLesson = lessons[0]?.id || '';
  state.projectSteps ||= {};
  state.exerciseAttempts ||= {};
  state.exerciseMistakes = [...new Set((state.exerciseMistakes || []).filter(id => exercises.some(ex => String(ex.id) === String(id))))];
  state.exerciseHistory ||= {};
  state.moduleCheckpoints ||= {};
  state.playgroundHistory = Array.isArray(state.playgroundHistory) ? state.playgroundHistory.slice(0, 12) : [];
  state.playgroundSavedProjectId = typeof state.playgroundSavedProjectId === 'string' ? state.playgroundSavedProjectId : '';
  state.activity ||= [];
  state.studyLog ||= {};
  state.reviewSchedule ||= {};
  state.searchHistory = Array.isArray(state.searchHistory) ? state.searchHistory.filter(Boolean).slice(0,8) : [];
  state.certificateName = typeof state.certificateName === 'string' ? state.certificateName.slice(0,90) : '';
  state.lastModified = Number(state.lastModified) || 0;
  (state.activity || []).forEach(item => {
    const date = new Date(item.time);
    if (!Number.isFinite(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const entry = state.studyLog[key] ||= { count:0, types:{} };
    entry.count = Math.max(entry.count || 0, 1);
    entry.types[item.type] = Math.max(entry.types[item.type] || 0, 1);
  });
  state.lessonNotes ||= {};
  state.pythonStdin = typeof state.pythonStdin === 'string' ? state.pythonStdin : '';
  state.consoleCollapsed = state.consoleCollapsed !== false;
  state.playgroundSplit = clamp(Number(state.playgroundSplit) || 55, 36, 70);
  if (!['html','css','js','python'].includes(state.playgroundLang)) state.playgroundLang = 'html';
}
migrateState();

function saveState() {
  state.lastModified = Date.now();
  try { localStorage.setItem(storageKey, JSON.stringify(state)); window.queueEnterpriseCloudSync?.(); }
  catch (error) { try { localStorage.setItem('enterprise-educacional-recovery-v1', JSON.stringify({ time:Date.now(), playground:state.playground, playgroundLang:state.playgroundLang, lessonNotes:state.lessonNotes })); } catch {} }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}
function escapeAttr(value = '') { return escapeHtml(value).replace(/`/g, '&#96;'); }
function normalizeText(value = '') { return String(value).trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' '); }
function clamp(number, min, max) { return Math.min(Math.max(number, min), max); }
function formatTime(timestamp) {
  if (!timestamp) return 'agora';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  if (diff < 172_800_000) return 'ontem';
  return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'short' }).format(timestamp);
}
function techLabel(courseId) { return courseById.get(courseId)?.title || courseId || 'Conteúdo'; }
function techCode(courseId) { return courseById.get(courseId)?.code || String(courseId || '').toUpperCase(); }
function techIconId(courseId) { return ({ html:'html', css:'css', javascript:'js', python:'python' })[courseId] || 'book'; }
function getCourseLessons(courseId) { return lessonsByCourse.get(courseId) || []; }
function getFirstLesson(courseId) { return getCourseLessons(courseId)[0]; }
function getLessonIndexInCourse(lesson) { return Math.max(0, getCourseLessons(lesson.courseId).findIndex(item => item.id === lesson.id)); }
function getModule(course, moduleId) { return course?.modules?.find(module => module.id === moduleId); }
function getModuleIndex(course, moduleId) { return Math.max(0, course?.modules?.findIndex(module => module.id === moduleId) ?? 0); }
function courseProgress(courseId) {
  const courseLessons = getCourseLessons(courseId);
  if (!courseLessons.length) return 0;
  const completed = courseLessons.filter(lesson => state.completedLessons.includes(lesson.id)).length;
  return Math.round((completed / courseLessons.length) * 100);
}
function overallProgress() {
  const lessonPart = lessons.length ? state.completedLessons.length / lessons.length : 0;
  const exercisePart = exercises.length ? state.completedExercises.length / exercises.length : 0;
  const challengePart = challenges.length ? state.completedChallenges.length / challenges.length : 0;
  const projectPart = projects.length ? state.completedProjects.length / projects.length : 0;
  return Math.round((lessonPart * .5 + exercisePart * .25 + projectPart * .15 + challengePart * .10) * 100);
}
function estimateLessonTime(lesson) {
  const source = [lesson.intro, lesson.explanation, lesson.deepDive, lesson.practicalContext, lesson.analogy, lesson.summary, ...(lesson.understand || []), ...(lesson.errors || [])].filter(Boolean).join(' ');
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  const reading = Math.max(4, Math.ceil(words / 180));
  const practice = lesson.editor ? 7 : 4;
  return { reading, practice, total: reading + practice };
}
function getRecommendedLesson() {
  const last = lessonById.get(state.lastLesson);
  if (last && !state.completedLessons.includes(last.id)) return last;
  if (last) {
    const courseLessons = getCourseLessons(last.courseId);
    const index = courseLessons.findIndex(item => item.id === last.id);
    const nextSameCourse = courseLessons.slice(index + 1).find(item => !state.completedLessons.includes(item.id));
    if (nextSameCourse) return nextSameCourse;
  }
  return lessons.find(lesson => !state.completedLessons.includes(lesson.id)) || lessons[0];
}
function recordActivity(type, label, meta = '') {
  const now = Date.now();
  state.activity.unshift({ id: `${now}-${Math.random().toString(36).slice(2,8)}`, type, label, meta, time: now });
  state.activity = state.activity.slice(0, 80);
  const date = new Date(now);
  const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const entry = state.studyLog[key] ||= { count:0, types:{} };
  entry.count = Number(entry.count || 0) + 1;
  entry.types[type] = Number(entry.types[type] || 0) + 1;
  saveState();
}
function studyStreak() {
  const dayMs = 86400000;
  const keys = Object.keys(state.studyLog || {}).filter(key => Number(state.studyLog[key]?.count || 0) > 0);
  const days = new Set(keys.map(key => {
    const [year,month,day] = key.split('-').map(Number);
    return Number.isFinite(year) ? new Date(year, month - 1, day).getTime() : null;
  }).filter(Boolean));
  if (!days.size) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let cursor = days.has(today) ? today : today - dayMs;
  let count = 0;
  while (days.has(cursor)) { count += 1; cursor -= dayMs; }
  return count;
}

function exerciseHistoryRecord(exerciseId) {
  const key = String(exerciseId);
  state.exerciseHistory[key] ||= { correct:0, wrong:0, streak:0, lastCorrect:0, lastWrong:0, lastAttempt:0 };
  return state.exerciseHistory[key];
}
function registerExerciseOutcome(exercise, correct) {
  const record = exerciseHistoryRecord(exercise.id);
  const now = Date.now();
  record.lastAttempt = now;
  if (correct) {
    record.correct += 1;
    record.streak += 1;
    record.lastCorrect = now;
  } else {
    record.wrong += 1;
    record.streak = 0;
    record.lastWrong = now;
  }

  // Revisão espaçada: um erro volta rápido; acertos consecutivos aumentam o intervalo.
  const schedule = state.reviewSchedule[String(exercise.id)] ||= { intervalDays:0, nextReview:0, lastReviewed:0 };
  schedule.lastReviewed = now;
  if (!correct) {
    schedule.intervalDays = 0.25;
  } else {
    const intervals = [1, 3, 7, 14, 30, 60];
    schedule.intervalDays = intervals[Math.min(Math.max(0, record.streak - 1), intervals.length - 1)];
  }
  schedule.nextReview = now + schedule.intervalDays * 86400000;
}

function getReviewReason(exercise) {
  const record = state.exerciseHistory[String(exercise.id)] || {};
  const schedule = state.reviewSchedule[String(exercise.id)] || {};
  const now = Date.now();
  if (schedule.nextReview && schedule.nextReview <= now) return 'Revisão programada';
  if (record.lastWrong && (!record.lastCorrect || record.lastWrong > record.lastCorrect)) return 'Erro recente';
  if (state.exerciseMistakes.includes(exercise.id) && (record.streak || 0) < 2) return 'Errou antes';
  if (record.lastAttempt && now - record.lastAttempt > 30 * 86400000) return 'Há mais de 30 dias';
  if (record.lastAttempt && now - record.lastAttempt > 14 * 86400000) return 'Hora de reforçar';
  if ((state.exerciseAttempts[exercise.id] || 0) <= 1) return 'Pouca prática';
  return 'Reforço recomendado';
}

function getReviewExercises(limit = 10) {
  const now = Date.now();
  const scored = exercises.map(exercise => {
    const record = state.exerciseHistory[String(exercise.id)] || {};
    const schedule = state.reviewSchedule[String(exercise.id)] || {};
    const completed = state.completedExercises.includes(exercise.id);
    const historicMistake = state.exerciseMistakes.includes(exercise.id);
    const relatedDone = exercise.relatedLessonId && state.completedLessons.includes(exercise.relatedLessonId);
    const age = record.lastAttempt ? now - record.lastAttempt : 0;
    let score = 0;
    if (schedule.nextReview && schedule.nextReview <= now) score += 74 + Math.min(24, Math.floor((now - schedule.nextReview) / 86400000) * 3);
    if (historicMistake) score += 48;
    score += Math.min(30, Number(record.wrong || 0) * 9);
    if (record.lastWrong && (!record.lastCorrect || record.lastWrong > record.lastCorrect)) score += 30;
    if (age > 30 * 86400000) score += 48;
    else if (age > 14 * 86400000) score += 34;
    else if (age > 7 * 86400000) score += 20;
    if ((record.streak || 0) >= 2 && record.lastCorrect > (record.lastWrong || 0) && (!schedule.nextReview || schedule.nextReview > now)) score -= 42;
    if (!completed && relatedDone) score += 24;
    if (!completed && (state.exerciseAttempts[exercise.id] || 0) > 0) score += 18;
    return { exercise, score };
  }).filter(item => item.score >= 24).sort((a,b) => b.score - a.score || String(a.exercise.id).localeCompare(String(b.exercise.id)));
  return scored.slice(0, limit).map(item => item.exercise);
}

function getModuleExercises(courseId, moduleId) {
  const moduleLessonIds = new Set((getModule(courseById.get(courseId), moduleId)?.lessonIds || []));
  return exercises.filter(exercise => exercise.relatedLessonId && moduleLessonIds.has(exercise.relatedLessonId));
}
function getModuleMastery(course, module) {
  const moduleLessons = (module.lessonIds || []).map(id => lessonById.get(id)).filter(Boolean);
  const completedLessons = moduleLessons.filter(lesson => state.completedLessons.includes(lesson.id)).length;
  const lessonRatio = moduleLessons.length ? completedLessons / moduleLessons.length : 0;
  const moduleExercises = getModuleExercises(course.id, module.id);
  const completedExercises = moduleExercises.filter(exercise => state.completedExercises.includes(exercise.id)).length;
  const exerciseRatio = moduleExercises.length ? completedExercises / moduleExercises.length : lessonRatio;
  const mistakeCount = moduleExercises.filter(exercise => state.exerciseMistakes.includes(exercise.id) && (state.exerciseHistory[String(exercise.id)]?.streak || 0) < 2).length;
  const mistakePenalty = moduleExercises.length ? Math.min(.18, (mistakeCount / moduleExercises.length) * .22) : 0;
  const checkpoint = state.moduleCheckpoints[`${course.id}:${module.id}`];
  const checkpointRatio = checkpoint ? checkpoint.score / 100 : null;
  const raw = checkpointRatio == null
    ? lessonRatio * .58 + exerciseRatio * .42 - mistakePenalty
    : lessonRatio * .48 + exerciseRatio * .32 + checkpointRatio * .20 - mistakePenalty;
  const score = clamp(Math.round(raw * 100), 0, 100);
  const status = score >= 85 ? 'Dominado' : score >= 60 ? 'Praticando' : score >= 30 ? 'Em desenvolvimento' : 'Começando';
  return { score, status, completedLessons, totalLessons:moduleLessons.length, moduleExercises, checkpoint };
}
function projectReadiness(project) {
  const relatedCourses = courses.filter(course => (project.tech || []).some(tech => normalizeText(tech) === normalizeText(course.title) || normalizeText(tech) === normalizeText(course.code)));
  const courseScores = relatedCourses.map(course => courseProgress(course.id));
  const score = courseScores.length ? Math.round(courseScores.reduce((sum,value) => sum + value, 0) / courseScores.length) : overallProgress();
  const label = score >= 65 ? 'Pronto para construir' : score >= 35 ? 'Quase pronto' : 'Construa os fundamentos';
  return { score, label, relatedCourses };
}
function sessionResultSummary(session = activeExerciseSession) {
  if (!session) return { answered:0, correct:0, total:0, score:0 };
  const values = Object.values(session.results || {});
  const correct = values.filter(Boolean).length;
  return { answered:values.length, correct, total:session.ids.length, score:session.ids.length ? Math.round((correct / session.ids.length) * 100) : 0 };
}
function startExerciseSession(type, sessionExercises, label, meta = {}) {
  const unique = [...new Map((sessionExercises || []).filter(Boolean).map(exercise => [String(exercise.id), exercise])).values()];
  if (!unique.length) return;
  activeExerciseSession = { type, label, ids:unique.map(exercise => exercise.id), results:{}, resolved:{}, startedAt:Date.now(), meta };
  exerciseTechFilter = 'Todos'; exerciseDifficultyFilter = 'Todas'; exerciseStatusFilter = 'Todos';
  currentExercise = unique[0].id;
  if (location.hash !== '#exercicios') location.hash = '#exercicios'; else renderExercises();
}
function startQuickPractice(count = 10) {
  const review = getReviewExercises(count);
  const used = new Set(review.map(exercise => String(exercise.id)));
  const pendingStudied = exercises.filter(exercise => !used.has(String(exercise.id)) && !state.completedExercises.includes(exercise.id) && (!exercise.relatedLessonId || state.completedLessons.includes(exercise.relatedLessonId)));
  const pendingAny = exercises.filter(exercise => !used.has(String(exercise.id)) && !state.completedExercises.includes(exercise.id));
  const fallback = exercises.filter(exercise => !used.has(String(exercise.id)));
  const selected = [...review, ...pendingStudied, ...pendingAny, ...fallback].filter((exercise,index,array) => array.findIndex(item => String(item.id) === String(exercise.id)) === index).slice(0, count);
  startExerciseSession('quick', selected, `Prática rápida · ${selected.length} exercícios`);
}
function startReviewSession() {
  const review = getReviewExercises(10);
  if (!review.length) return startQuickPractice(10);
  startExerciseSession('review', review, `Revisão inteligente · ${review.length} exercícios`);
}
function startModuleCheckpoint(courseId, moduleId) {
  const course = courseById.get(courseId); const module = getModule(course, moduleId);
  if (!course || !module) return;
  const primary = getModuleExercises(courseId, moduleId);
  const sameTech = exercises.filter(exercise => normalizeText(exercise.tech) === normalizeText(course.title) && !primary.some(item => String(item.id) === String(exercise.id)));
  const selected = [...primary, ...sameTech].slice(0, 5);
  startExerciseSession('checkpoint', selected, `Checkpoint · ${module.title}`, { courseId, moduleId });
}
function finishExerciseSession() {
  const session = activeExerciseSession;
  if (!session) return;
  const summary = sessionResultSummary(session);
  if (session.type === 'checkpoint' && session.meta?.courseId && session.meta?.moduleId) {
    state.moduleCheckpoints[`${session.meta.courseId}:${session.meta.moduleId}`] = { score:summary.score, correct:summary.correct, total:summary.total, completedAt:Date.now() };
    recordActivity('checkpoint', `Checkpoint concluído: ${session.label.replace(/^Checkpoint · /,'')}`, `${summary.score}% de acertos`);
  }
  activeExerciseSession = null;
  saveState();
  showToast(`Sessão concluída: ${summary.correct}/${summary.total} corretos (${summary.score}%).`);
  renderExercises(); renderProgress(); renderHome();
}
function showToast(message) {
  const region = $('#toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'app-toast'; toast.textContent = message;
  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 220); }, 3400);
}
function renderSmartLearningHome() {
  const host = $('#smartLearningGrid'); if (!host) return;
  const review = getReviewExercises(10);
  const readyProjects = projects.map(project => ({ project, readiness:projectReadiness(project) })).filter(item => !state.completedProjects.includes(item.project.id)).sort((a,b) => b.readiness.score - a.readiness.score);
  const project = readyProjects[0];
  const reviewTitle = review.length ? `${review.length} ${review.length === 1 ? 'exercício priorizado' : 'exercícios priorizados'}` : 'Revisão em dia';
  const reviewCopy = review.length ? 'Retome primeiro os pontos em que houve erro ou pouca prática.' : 'Sem pendências fortes; use a prática rápida para manter o ritmo.';
  host.innerHTML = `<button class="smart-learning-row" type="button" data-start-review><span class="smart-learning-row-icon"><svg class="ui-icon"><use href="#icon-refresh"></use></svg></span><span class="smart-learning-row-copy"><small>Revisar</small><strong>${escapeHtml(reviewTitle)}</strong><span>${escapeHtml(reviewCopy)}</span></span><span class="smart-learning-row-arrow" aria-hidden="true">→</span></button><button class="smart-learning-row" type="button" data-start-quick><span class="smart-learning-row-icon"><svg class="ui-icon"><use href="#icon-exercise"></use></svg></span><span class="smart-learning-row-copy"><small>Prática rápida</small><strong>10 exercícios em sequência</strong><span>Mistura revisão e conteúdos que você já estudou.</span></span><span class="smart-learning-row-arrow" aria-hidden="true">→</span></button>${project ? `<a class="smart-learning-row" href="#projetos"><span class="smart-learning-row-icon"><svg class="ui-icon"><use href="#icon-project"></use></svg></span><span class="smart-learning-row-copy"><small>Projeto recomendado</small><strong>${escapeHtml(project.project.title)}</strong><span>${project.readiness.score}% de preparo · ${escapeHtml(project.readiness.label)}.</span></span><span class="smart-learning-row-arrow" aria-hidden="true">→</span></a>` : ''}`;
}
function bindLearningMechanicActions() {
  document.addEventListener('click', event => {
    const quick = event.target.closest('[data-start-quick]');
    if (quick) { event.preventDefault(); startQuickPractice(10); return; }
    const review = event.target.closest('[data-start-review]');
    if (review) { event.preventDefault(); getReviewExercises(1).length ? startReviewSession() : startQuickPractice(10); return; }
    const checkpoint = event.target.closest('[data-checkpoint-course][data-checkpoint-module]');
    if (checkpoint) { event.preventDefault(); startModuleCheckpoint(checkpoint.dataset.checkpointCourse, checkpoint.dataset.checkpointModule); return; }
    const practiceLesson = event.target.closest('[data-practice-lesson]');
    if (practiceLesson) {
      event.preventDefault();
      const related = exercises.filter(exercise => String(exercise.relatedLessonId) === String(practiceLesson.dataset.practiceLesson));
      if (related.length) startExerciseSession('concept', related.slice(0, 8), `Prática do conceito · ${lessonById.get(practiceLesson.dataset.practiceLesson)?.title || 'Aula'}`);
    }
  });
}

function updateDocumentMeta(pageName, detail = '') {
  const titles = {
    home: 'Epoch Education', trilhas: 'Trilhas | Epoch Education', aula: detail ? `${detail} | Epoch Education` : 'Aula | Epoch Education',
    exercicios: 'Exercícios | Epoch Education', desafios: 'Desafios | Epoch Education', projetos: 'Projetos | Epoch Education', playground: 'Playground | Epoch Education', glossario: 'Glossário | Epoch Education', progresso: 'Progresso | Epoch Education', 'not-found':'Página não encontrada | Epoch Education'
  };
  document.title = titles[pageName] || titles.home;
}

let currentLessonId = state.lastLesson;
let currentExercise = exercises[0]?.id;
let exerciseTechFilter = 'Todos';
let exerciseDifficultyFilter = 'Todas';
let exerciseStatusFilter = 'Todos';
let selectedTerm = glossary[0]?.term || '';
let letterFilter = 'Todos';
let glossaryCategory = 'Todos';
let activeExerciseSession = null;
let activeRoadmapCourse = courses.find(course => courseProgress(course.id) > 0)?.id || courses[0]?.id || 'html';
let searchExpandedGroups = new Set();

function closeMobileNav({ restoreFocus = false } = {}) {
  const button = $('#mobileMenuButton');
  const nav = $('#mobileNav');
  if (!button || !nav) return;
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', 'false');
  nav.hidden = true;
  button.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#icon-menu"></use></svg>';
  button.setAttribute('aria-label', 'Abrir menu');
  if (restoreFocus && wasOpen) button.focus();
}

function route(event) {
  closeMobileNav();
  $('.lesson-sidebar')?.classList.remove('mobile-open');
  $('#lessonMobileToggle')?.setAttribute('aria-expanded', 'false');
  const raw = decodeURIComponent(location.hash.slice(1) || 'home');
  const [root, ...rest] = raw.split('/');
  let pageName = root;
  if (!['home','trilhas','aula','exercicios','desafios','projetos','playground','glossario','progresso'].includes(pageName)) pageName = 'not-found';

  if (pageName === 'aula') {
    const id = rest.join('/') || state.lastLesson || lessons[0]?.id;
    if (lessonById.has(id)) currentLessonId = id;
    else pageName = 'not-found';
  }
  if (pageName === 'exercicios' && rest[0]) {
    const found = exercises.find(ex => String(ex.id) === String(rest[0]));
    if (found) { activeExerciseSession = null; currentExercise = found.id; exerciseTechFilter = 'Todos'; exerciseDifficultyFilter = 'Todas'; exerciseStatusFilter = 'Todos'; }
  }
  if (pageName === 'glossario' && rest.length) {
    const term = rest.join('/');
    const foundTerm = glossary.find(item => normalizeText(item.term) === normalizeText(term));
    if (foundTerm) { selectedTerm = foundTerm.term; letterFilter = 'Todos'; glossaryCategory = 'Todos'; if ($('#glossarySearch')) $('#glossarySearch').value = ''; }
  }

  document.body.dataset.page = pageName;
  $$('.page').forEach(page => page.classList.toggle('active', page.dataset.page === pageName));
  $$('.desktop-nav a').forEach(link => {
    const hrefPage = link.getAttribute('href').replace('#','');
    const active = pageName === hrefPage || (pageName === 'aula' && hrefPage === 'trilhas');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });

  if (pageName === 'home') renderHome();
  if (pageName === 'trilhas') renderTracks();
  if (pageName === 'aula') renderLesson(currentLessonId);
  if (pageName === 'exercicios') renderExercises();
  if (pageName === 'desafios') renderChallenges();
  if (pageName === 'projetos') renderProjects();
  if (pageName === 'glossario') {
    renderGlossary();
    if (window.matchMedia('(max-width: 980px)').matches && rest.length) $('.glossary-layout')?.classList.add('term-open');
    else if (!rest.length) resetGlossaryMobileView();
  }
  if (pageName === 'progresso') renderProgress();
  if (pageName === 'playground') refreshPlaygroundFromState();

  updateDocumentMeta(pageName, pageName === 'aula' ? lessonById.get(currentLessonId)?.title : '');
  if (pageName !== 'not-found') window.scrollTo({ top: 0, behavior: 'instant' });
  if (event?.type === 'hashchange') {
    requestAnimationFrame(() => {
      const heading = $('.page.active h1') || $('#main');
      if (!heading) return;
      const hadTabindex = heading.hasAttribute('tabindex');
      if (!hadTabindex) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll:true });
      if (!hadTabindex) heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once:true });
    });
  }
}
window.addEventListener('hashchange', route);

function renderPlatformStrip() {
  const stats = [
    { icon:'book', text:`${courses.length} trilhas · ${lessons.length.toLocaleString('pt-BR')} aulas` },
    { icon:'exercise', text:`${exercises.length.toLocaleString('pt-BR')} exercícios com feedback` },
    { icon:'project', text:`${projects.length} projetos · ${challenges.length} desafios` },
    { icon:'progress', text:'progresso salvo no navegador' }
  ];
  $('#platformStrip').innerHTML = stats.map(item => `<div class="platform-stat"><span class="platform-stat-icon"><svg class="ui-icon"><use href="#icon-${item.icon}"></use></svg></span><span>${item.text}</span></div>`).join('');
}

function renderHome() {
  renderPlatformStrip();
  $('#homeTechGrid').innerHTML = courses.map(course => {
    const progress = courseProgress(course.id);
    const courseLessons = getCourseLessons(course.id);
    const next = courseLessons.find(lesson => !state.completedLessons.includes(lesson.id)) || courseLessons[0];
    return `<a class="tech-card" href="#aula/${encodeURIComponent(next?.id || '')}">
      <span class="tech-code">${escapeHtml(course.code)}</span>
      <h3>${escapeHtml(course.title)}</h3>
      <p>${escapeHtml(course.description)}</p>
      <div class="card-foot"><span>${course.modules.length} módulos · ${courseLessons.length} aulas</span><span><strong>${progress ? `${progress}% concluído` : 'Começar trilha'}</strong>${next ? escapeHtml(next.title) : ''}</span></div>
    </a>`;
  }).join('');

  const progress = overallProgress();
  const recommended = getRecommendedLesson();
  $('#continuePercent').textContent = `${progress}%`;
  $('#continueBar').style.width = `${progress}%`;
  if (!state.completedLessons.length && !state.completedExercises.length) {
    const htmlStart = getFirstLesson('html') || lessons[0];
    $('#continueEyebrow').textContent = 'Comece sua jornada';
    $('#continueTitle').textContent = 'Nunca programou? Comece pelos fundamentos.';
    $('#continueText').textContent = 'HTML é um ótimo ponto de entrada para entender como a Web é estruturada. Depois, avance para CSS e JavaScript — ou escolha Python para começar pela lógica.';
    $('#continueLabel').textContent = 'Progresso geral';
    $('#continueMeta').innerHTML = '<span>Iniciante</span><span>Sem pré-requisitos</span><span>Aprenda no seu ritmo</span>';
    $('#continueButton').textContent = 'Começar com HTML';
    $('#continueButton').href = htmlStart ? `#aula/${encodeURIComponent(htmlStart.id)}` : '#trilhas';
  } else if (recommended) {
    const course = courseById.get(recommended.courseId);
    const time = estimateLessonTime(recommended);
    $('#continueEyebrow').textContent = 'Seu próximo passo';
    $('#continueTitle').textContent = recommended.title;
    $('#continueText').textContent = `Continue em ${course?.title || 'sua trilha'} · ${recommended.moduleTitle}. Seu progresso foi salvo neste navegador.`;
    $('#continueLabel').textContent = `${course?.title || ''} — ${recommended.moduleTitle}`;
    $('#continueMeta').innerHTML = `<span>${time.reading} min de leitura</span><span>${time.practice} min de prática</span><span>${courseProgress(recommended.courseId)}% da trilha</span>`;
    $('#continueButton').textContent = 'Continuar estudando';
    $('#continueButton').href = `#aula/${encodeURIComponent(recommended.id)}`;
  }
  renderSmartLearningHome();
}

function renderTracks() {
  renderLearningRoadmap();
  $('#trackGrid').innerHTML = courses.map(course => {
    const courseLessons = getCourseLessons(course.id);
    const progress = courseProgress(course.id);
    const next = courseLessons.find(lesson => !state.completedLessons.includes(lesson.id)) || courseLessons[0];
    const completedModules = course.modules.filter(module => module.lessonIds.every(id => state.completedLessons.includes(id))).length;
    const currentModule = next ? getModule(course, next.moduleId) : course.modules.at(-1);
    return `<article class="track-card track-card-compact">
      <div class="track-top"><div><span class="eyebrow simple">${escapeHtml(course.code)}</span><h2>${escapeHtml(course.title)}</h2><p>${escapeHtml(course.description)}</p></div><div class="track-icon">${escapeHtml(course.code)}</div></div>
      <div class="track-course-stats"><span><small>Módulos</small><strong>${completedModules}/${course.modules.length}</strong></span><span><small>Aulas</small><strong>${state.completedLessons.filter(id => lessonById.get(id)?.courseId === course.id).length}/${courseLessons.length}</strong></span><span><small>Nível</small><strong>${escapeHtml(course.level || 'Iniciante')}</strong></span></div>
      ${next ? `<div class="track-next"><small>${progress ? 'Continue em' : 'Comece por'}</small><strong>${escapeHtml(currentModule?.title || next.moduleTitle)} → ${escapeHtml(next.title)}</strong></div>` : ''}
      <div class="progress-label"><span>Progresso da trilha</span><strong>${progress}%</strong></div><div class="progress" style="margin:8px 0 18px"><span style="width:${progress}%"></span></div>
      <div class="track-card-actions"><a class="button ${progress ? 'secondary' : 'primary'}" href="${next ? `#aula/${encodeURIComponent(next.id)}` : '#trilhas'}">${progress ? 'Continuar trilha' : 'Começar trilha'}</a><button class="text-button" type="button" data-open-roadmap="${escapeAttr(course.id)}">Ver mapa</button></div>
    </article>`;
  }).join('');
  $$('[data-open-roadmap]').forEach(button => button.addEventListener('click', () => {
    activeRoadmapCourse = button.dataset.openRoadmap;
    renderLearningRoadmap();
    document.querySelector('.learning-roadmap')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));
}

function renderLearningRoadmap() {
  const tabs = $('#roadmapCourseTabs');
  const host = $('#roadmapMap');
  if (!tabs || !host || !courses.length) return;
  if (!courseById.has(activeRoadmapCourse)) activeRoadmapCourse = courses[0].id;
  tabs.innerHTML = courses.map(course => `<button class="roadmap-course-tab" type="button" role="tab" aria-selected="${course.id === activeRoadmapCourse}" data-roadmap-course="${escapeAttr(course.id)}"><svg class="ui-icon" aria-hidden="true"><use href="#icon-${techIconId(course.id)}"></use></svg><span>${escapeHtml(course.code)}</span><small>${courseProgress(course.id)}%</small></button>`).join('');

  const course = courseById.get(activeRoadmapCourse);
  const currentModule = course.modules.find(module => module.lessonIds.some(id => !state.completedLessons.includes(id))) || course.modules[course.modules.length - 1];
  host.innerHTML = `<div class="roadmap-summary"><div><span class="detail-kicker">${escapeHtml(course.code)}</span><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p></div><div class="roadmap-summary-progress"><strong>${courseProgress(course.id)}%</strong><span>${state.completedLessons.filter(id => lessonById.get(id)?.courseId === course.id).length}/${getCourseLessons(course.id).length} aulas</span></div></div><div class="roadmap-path" role="list">${course.modules.map((module,index) => {
    const done = module.lessonIds.filter(id => state.completedLessons.includes(id)).length;
    const total = module.lessonIds.length;
    const complete = total > 0 && done === total;
    const current = module.id === currentModule?.id && !complete;
    const firstPending = module.lessonIds.find(id => !state.completedLessons.includes(id)) || module.lessonIds[0];
    const status = complete ? 'Concluído' : current ? 'Atual' : done ? 'Em andamento' : 'Próximo';
    return `<a class="roadmap-node ${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}" role="listitem" href="#aula/${encodeURIComponent(firstPending || '')}" aria-label="${escapeAttr(`${module.title}: ${status}, ${done} de ${total} aulas`)}"><span class="roadmap-node-index">${complete ? '✓' : String(index + 1).padStart(2,'0')}</span><span class="roadmap-node-copy"><small>${escapeHtml(status)} · ${done}/${total} aulas</small><strong>${escapeHtml(module.title)}</strong></span><span class="roadmap-node-arrow" aria-hidden="true">→</span></a>`;
  }).join('')}</div>`;
  $$('[data-roadmap-course]', tabs).forEach(button => button.addEventListener('click', () => {
    activeRoadmapCourse = button.dataset.roadmapCourse;
    renderLearningRoadmap();
  }));
}

function escapeRegex(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function glossaryTermPattern(term = '') {
  const value = String(term).trim();
  if (!value) return '';
  const escaped = escapeRegex(value);
  const startsWithWord = /^[\p{L}\p{N}_]/u.test(value);
  const endsWithWord = /[\p{L}\p{N}_]$/u.test(value);
  const leftBoundary = startsWithWord ? '(?<![\\p{L}\\p{N}_])' : '';
  const rightBoundary = endsWithWord ? '(?![\\p{L}\\p{N}_])' : '';
  return `${leftBoundary}${escaped}${rightBoundary}`;
}

function glossaryAwareText(text = '', maxTerms = 3) {
  if (!text || !glossary.length) return escapeHtml(text);
  const source = String(text);
  const candidates = glossary.filter(item => {
    const termPattern = glossaryTermPattern(item.term);
    return termPattern && new RegExp(termPattern, 'iu').test(source);
  }).sort((a,b) => b.term.length - a.term.length).slice(0, maxTerms);
  if (!candidates.length) return escapeHtml(source);
  const pattern = new RegExp(`(${candidates.map(item => glossaryTermPattern(item.term)).join('|')})`, 'giu');
  const termLookup = new Map(candidates.map(item => [normalizeText(item.term), item.term]));
  return source.split(pattern).map(part => {
    const match = termLookup.get(normalizeText(part));
    return match ? `<button type="button" class="term-inline" data-term="${escapeAttr(match)}">${escapeHtml(part)}</button>` : escapeHtml(part);
  }).join('');
}


let lessonScrollFrame = 0;

function filterLessonNavigation(query = '') {
  const nav = $('#lessonNav');
  if (!nav) return;
  const normalized = normalizeText(query.trim());
  $$('.lesson-module-group', nav).forEach(group => {
    const buttons = $$('button[data-lesson]', group);
    let matches = 0;
    buttons.forEach(button => {
      const visible = !normalized || normalizeText(button.textContent).includes(normalized);
      button.hidden = !visible;
      if (visible) matches += 1;
    });
    group.hidden = matches === 0;
    if (normalized && matches) group.open = true;
  });
  nav.classList.toggle('is-filtering', Boolean(normalized));
}

function updateLessonScrollState() {
  lessonScrollFrame = 0;
  if (!document.querySelector('#aula.page.active')) return;
  const content = $('#lessonContent');
  const bar = $('#lessonReadingBar');
  if (!content || !bar) return;
  const rect = content.getBoundingClientRect();
  const viewport = window.innerHeight;
  const total = Math.max(1, content.scrollHeight - Math.min(viewport * .6, 420));
  const passed = Math.max(0, -rect.top + 120);
  const progress = clamp((passed / total) * 100, 0, 100);
  bar.style.width = `${progress}%`;

  const tocLinks = $$('.lesson-toc a', content);
  if (!tocLinks.length) return;
  const offset = Math.max(120, (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 74) + 84);
  let activeId = tocLinks[0].getAttribute('href')?.slice(1) || '';
  tocLinks.forEach(link => {
    const id = link.getAttribute('href')?.slice(1);
    const section = id ? document.getElementById(id) : null;
    if (section && section.getBoundingClientRect().top <= offset) activeId = id;
  });
  tocLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`));
}

function scheduleLessonScrollState() {
  if (lessonScrollFrame) return;
  lessonScrollFrame = requestAnimationFrame(updateLessonScrollState);
}

function syncPythonStdinVisibility() {
  const panel = $('#pythonStdinPanel');
  if (!panel) return;
  const python = activeLang === 'python';
  const source = python ? ($('#codeEditor')?.value || pg.python || '') : '';
  const needsInput = python && /\binput\s*\(/.test(source);
  panel.hidden = !needsInput;
  panel.classList.toggle('is-needed', needsInput);
}

function showResultFullscreenHint(target) {
  const hint = $('#resultFullscreenHint');
  if (!hint || !target) return;
  hint.hidden = false;
  if (hint.parentElement !== target) target.appendChild(hint);
  clearTimeout(window.__eeFullscreenHintTimer);
  window.__eeFullscreenHintTimer = setTimeout(() => { if (hint) hint.hidden = true; }, 2400);
}

function resetGlossaryMobileView() {
  $('.glossary-layout')?.classList.remove('term-open');
}


function lessonHasExplainableCode(lesson, code) {
  if (!code || !String(code).trim()) return false;
  if (lesson?.editor) return true;
  const source = String(code);
  if (lesson?.courseId === 'html') return /<\/?[a-z][^>]*>/i.test(source) || /<!doctype/i.test(source);
  if (lesson?.courseId === 'css') return /[.#]?[a-z][^{\n]*\{[\s\S]*:[^;\n}]+/i.test(source);
  if (lesson?.courseId === 'javascript') return /\b(const|let|var|function|return|if|for|while|class|document|console|addEventListener)\b|=>/.test(source);
  if (lesson?.courseId === 'python') return /\b(def|class|if|elif|else|for|while|return|import|from|print|input|with|try|except)\b|(^|\n)\s*[a-zA-Z_]\w*\s*=/.test(source);
  return false;
}

function explainLessonCodeLine(line, courseId) {
  const raw = String(line || '');
  const value = raw.trim();
  if (!value) return 'Linha em branco usada para separar blocos e melhorar a leitura.';

  if (courseId === 'html') {
    if (/^<!doctype/i.test(value)) return 'Informa ao navegador que o documento usa HTML moderno.';
    if (/^<!--/.test(value)) return 'Comentário: serve como anotação e não aparece no conteúdo renderizado.';
    const closing = value.match(/^<\/([\w-]+)>/);
    if (closing) return `Fecha o elemento <${closing[1]}> aberto anteriormente.`;
    const tag = value.match(/^<([\w-]+)/);
    if (tag) {
      const name = tag[1].toLowerCase();
      const meanings = {
        html:'Abre o documento HTML.', head:'Agrupa metadados e configurações da página.', body:'Agrupa o conteúdo visível da página.',
        main:'Define o conteúdo principal da página.', header:'Cria uma região de cabeçalho.', nav:'Representa uma área de navegação.',
        section:'Agrupa uma seção temática do conteúdo.', article:'Representa um conteúdo independente e reutilizável.', div:'Cria um agrupamento genérico.',
        span:'Marca um trecho inline sem criar um novo bloco.', h1:'Define o título principal do conteúdo.', h2:'Define um subtítulo de segundo nível.',
        p:'Cria um parágrafo.', a:'Cria um link para outro recurso ou destino.', img:'Insere uma imagem; o atributo alt descreve seu conteúdo.',
        button:'Cria um controle acionável pelo usuário.', form:'Agrupa campos que formam um formulário.', input:'Cria um campo de entrada.',
        label:'Associa um texto explicativo a um campo de formulário.', ul:'Inicia uma lista não ordenada.', ol:'Inicia uma lista ordenada.', li:'Define um item de lista.'
      };
      return meanings[name] || `Abre o elemento <${name}> e define sua função na estrutura do documento.`;
    }
    return 'Conteúdo textual ou continuação da estrutura HTML exibida no navegador.';
  }

  if (courseId === 'css') {
    if (/^\/\*/.test(value)) return 'Comentário CSS usado para documentar o estilo sem alterar o resultado.';
    if (value === '}') return 'Encerra o bloco de declarações do seletor atual.';
    if (/\{$/.test(value)) return `Seleciona ${value.replace(/\{$/, '').trim()} e inicia as regras aplicadas a esse alvo.`;
    const prop = value.match(/^([\w-]+)\s*:\s*([^;]+);?$/);
    if (prop) return `Define a propriedade “${prop[1]}” com o valor “${prop[2].trim()}”.`;
    if (/^@media/i.test(value)) return 'Inicia uma media query para adaptar estilos conforme as condições de tela.';
    return 'Participa da regra CSS atual e altera a apresentação dos elementos selecionados.';
  }

  if (courseId === 'javascript') {
    if (/^\/\//.test(value)) return 'Comentário usado para explicar o código sem executá-lo.';
    if (/\b(const|let|var)\b/.test(value)) return 'Declara uma variável e associa a ela um valor que poderá ser reutilizado no programa.';
    if (/\b(document\.(querySelector|getElementById|querySelectorAll))\b/.test(value)) return 'Busca um elemento do documento para que o JavaScript possa ler ou alterar sua interface.';
    if (/addEventListener\s*\(/.test(value)) return 'Registra uma função que será executada quando o evento indicado acontecer.';
    if (/console\.log\s*\(/.test(value)) return 'Envia um valor ao console para inspeção e depuração.';
    if (/^function\b|=>\s*\{?$/.test(value)) return 'Define uma função: um bloco reutilizável de instruções.';
    if (/^if\s*\(/.test(value)) return 'Testa uma condição e executa o bloco somente quando ela é verdadeira.';
    if (/^else\b/.test(value)) return 'Define o caminho alternativo executado quando a condição anterior não é atendida.';
    if (/^for\b|^while\b/.test(value)) return 'Inicia uma repetição controlada por uma condição ou sequência de valores.';
    if (/^return\b/.test(value)) return 'Encerra a função e devolve um valor para o ponto onde ela foi chamada.';
    if (/\.textContent\s*=|\.innerHTML\s*=/.test(value)) return 'Atualiza o conteúdo exibido por um elemento da página.';
    return 'Executa uma instrução JavaScript dentro do fluxo atual do programa.';
  }

  if (courseId === 'python') {
    if (/^#/.test(value)) return 'Comentário usado para documentar o código sem ser executado.';
    if (/^(from\s+\S+\s+import|import\s+)/.test(value)) return 'Importa recursos de outro módulo para poder utilizá-los neste programa.';
    if (/^def\s+/.test(value)) return 'Define uma função e inicia seu bloco indentado.';
    if (/^class\s+/.test(value)) return 'Define uma classe, que serve como modelo para criar objetos.';
    if (/^if\s+/.test(value)) return 'Avalia uma condição; o bloco indentado é executado quando ela é verdadeira.';
    if (/^(elif|else)\b/.test(value)) return 'Cria um caminho alternativo para a estrutura condicional.';
    if (/^(for|while)\s+/.test(value)) return 'Inicia um laço de repetição.';
    if (/^return\b/.test(value)) return 'Encerra a função e devolve um valor para quem a chamou.';
    if (/\bprint\s*\(/.test(value)) return 'Mostra uma informação na saída do programa.';
    if (/\binput\s*\(/.test(value)) return 'Pausa a execução para receber uma entrada digitada pelo usuário.';
    if (/^[a-zA-Z_]\w*\s*=/.test(value)) return 'Cria ou atualiza uma variável com o valor calculado à direita do sinal de igual.';
    return 'Executa uma instrução Python dentro do bloco indicado pela indentação.';
  }
  return 'Esta linha participa do exemplo e contribui para o resultado apresentado.';
}

function buildLessonLineGuide(lesson, code) {
  if (!lessonHasExplainableCode(lesson, code)) return [];
  return String(code).split('\n').map((line, index) => ({ line, number:index + 1, explanation: explainLessonCodeLine(line, lesson.courseId) }))
    .filter(item => item.line.trim()).slice(0, 14);
}

function getLessonComparison(lesson) {
  const key = normalizeText(`${lesson?.title || ''} ${lesson?.moduleTitle || ''}`);
  const match = (...terms) => terms.some(term => key.includes(normalizeText(term)));
  const make = (title, leftTitle, leftItems, rightTitle, rightItems, takeaway) => ({ title, leftTitle, leftItems, rightTitle, rightItems, takeaway });

  if (match('internet','o que e web')) return make('Internet × Web','Internet',['Infraestrutura global de redes','Transporta dados entre dispositivos','Suporta vários serviços e protocolos'],'Web',['Serviço que funciona sobre a Internet','Usa URLs e HTTP/HTTPS','Entrega páginas e aplicações no navegador'],'A Web depende da Internet, mas Internet e Web não são sinônimos.');
  if (match('frontend e backend')) return make('Front-end × Back-end','Front-end',['Executa próximo do usuário','Constrói interface e interação','HTML, CSS e JavaScript são centrais'],'Back-end',['Executa no servidor','Processa regras, dados e autenticação','Expõe respostas e APIs'],'Os dois lados cooperam: a interface solicita dados e o servidor processa e responde.');
  if (match('caminhos relativos','caminhos absolutos')) return make('Caminho relativo × absoluto','Relativo',['Parte da localização do arquivo atual','Facilita mover o projeto como conjunto','Ex.: ../img/logo.png'],'Absoluto',['Indica uma localização completa','Independe do arquivo atual','Ex.: https://exemplo.com/img/logo.png'],'Use relativo para recursos do próprio projeto e absoluto quando o destino precisa ser identificado completamente.');
  if (match('strong','em')) return make('<strong> × <em>','<strong>',['Indica forte importância','Normalmente recebe ênfase visual forte','Tem significado semântico'],'<em>',['Indica ênfase na leitura','Pode alterar o sentido da frase','Também é semântico'],'Escolha pela intenção do texto, não apenas pela aparência padrão do navegador.');
  if (match('ul','ol','listas')) return make('<ul> × <ol>','<ul>',['Lista sem ordem significativa','Boa para grupos e menus','Marcadores não expressam sequência'],'<ol>',['A ordem dos itens importa','Boa para etapas e rankings','Numeração comunica sequência'],'A pergunta decisiva é: trocar a ordem dos itens muda o significado?');
  if (match('get e post','get post')) return make('GET × POST','GET',['Normalmente consulta dados','Parâmetros podem aparecer na URL','Ideal para operações sem alteração de estado'],'POST',['Envia dados no corpo da requisição','Comum ao criar ou processar recursos','Pode alterar estado no servidor'],'O método deve representar a intenção da operação, não apenas “funcionar”.');
  if (match('flexbox','flex box','grid')) return make('Flexbox × Grid','Flexbox',['Layout principalmente unidimensional','Excelente para linhas ou colunas','Ótimo para alinhamento de componentes'],'Grid',['Layout bidimensional','Controla linhas e colunas ao mesmo tempo','Ótimo para estruturas de página'],'Use Flexbox para fluxo em um eixo e Grid quando linhas e colunas precisam trabalhar juntas.');
  if (match('margin','padding')) return make('Margin × Padding','Margin',['Espaço do lado de fora da borda','Afasta um elemento de outros','Não faz parte do conteúdo interno'],'Padding',['Espaço entre conteúdo e borda','Aumenta a área interna do elemento','O fundo do elemento ocupa essa região'],'Margin separa elementos; padding dá respiro ao conteúdo dentro do próprio elemento.');
  if (match('block','inline')) return make('Block × Inline','Block',['Tende a ocupar a largura disponível','Começa em uma nova linha','Aceita dimensões de forma previsível'],'Inline',['Flui junto com o texto','Não quebra linha por padrão','Dimensões têm comportamento diferente'],'Escolha o tipo de fluxo conforme a função do elemento no layout.');
  if (match('px','rem','em unidades')) return make('px × rem','px',['Unidade absoluta em CSS','Útil para detalhes muito específicos','Não acompanha diretamente o tamanho raiz'],'rem',['Relativa ao font-size do elemento raiz','Escala melhor sistemas tipográficos','Ajuda consistência e acessibilidade'],'Para tipografia e espaçamento de interface, rem costuma escalar melhor; px ainda é útil em detalhes pontuais.');
  if (match('relative','absolute','position')) return make('relative × absolute','position: relative',['Mantém o elemento no fluxo','Cria referência para descendentes posicionados','Offsets deslocam a partir da posição original'],'position: absolute',['Sai do fluxo normal','Posiciona-se em relação ao ancestral posicionado','Útil para elementos sobrepostos'],'Absolute funciona melhor quando existe um contexto de posicionamento claro, frequentemente criado por relative.');
  if (match('let','const','variaveis')) return make('let × const','let',['Permite reatribuir a variável','Use quando o valor precisa mudar','Tem escopo de bloco'],'const',['Impede reatribuição da referência','Deve ser a escolha padrão quando possível','Também tem escopo de bloco'],'Comece com const; troque para let somente quando a reatribuição fizer parte da lógica.');
  if (match('igualdade','===','==')) return make('== × ===','==',['Faz coerção de tipos','Pode produzir resultados inesperados','Menos previsível em código moderno'],'===',['Compara valor e tipo','Não faz coerção implícita','Mais previsível e normalmente preferido'],'Prefira === quando você não precisa explicitamente da coerção feita por ==.');
  if (match('null','undefined')) return make('null × undefined','null',['Ausência definida intencionalmente','Normalmente atribuída pelo programador','É um valor explícito'],'undefined',['Valor ainda não definido','Pode surgir em propriedades ou retornos ausentes','É comum em APIs da linguagem'],'null costuma comunicar “vazio de propósito”; undefined geralmente significa “não definido”.');
  if (match('map','foreach')) return make('map() × forEach()','map()',['Transforma cada item','Retorna um novo array','Ideal quando você precisa do resultado transformado'],'forEach()',['Executa uma ação por item','Não cria um novo array útil','Bom para efeitos colaterais controlados'],'Se você quer construir outro array, map expressa melhor a intenção.');
  if (match('async','await','promise')) return make('Promise × async/await','Promise',['Representa um resultado futuro','Pode ser encadeada com then/catch','É a base do modelo assíncrono'],'async/await',['Sintaxe construída sobre Promises','Deixa o fluxo parecer sequencial','Facilita try/catch em muitas rotinas'],'async/await não substitui Promises: ele oferece uma forma mais legível de trabalhar com elas.');
  if (match('lista','tupla','tuple')) return make('List × Tuple','list',['Mutável','Usa colchetes []','Boa para coleções que mudam'],'tuple',['Imutável','Usa parênteses () em muitos casos','Boa para registros que não devem mudar'],'Escolha list quando a coleção muda e tuple quando a imutabilidade comunica melhor a intenção.');
  if (match('dicionario','dict','set')) return make('dict × set','dict',['Armazena pares chave → valor','Busca valores por chave','Preserva associação entre identificador e dado'],'set',['Armazena valores únicos','Evita duplicatas automaticamente','Ótimo para testes de pertinência'],'Use dict quando cada chave aponta para um valor; use set quando o que importa é a presença única de itens.');
  if (match('is','igualdade','comparacao')) return make('== × is em Python','==',['Compara valores','Pergunta se os conteúdos são equivalentes','É o operador comum para igualdade'],'is',['Compara identidade','Pergunta se é exatamente o mesmo objeto','É apropriado para casos como None'],'Para valores, normalmente use ==; para identidade, use is.');
  if (match('append','extend')) return make('append() × extend()','append()',['Adiciona um único item ao final','Uma lista passada vira um item aninhado','Aumenta o tamanho em 1'],'extend()',['Adiciona vários itens de um iterável','Insere cada elemento separadamente','Aumenta pelo número de itens recebidos'],'append adiciona um objeto; extend incorpora os elementos de outro iterável.');
  return null;
}


function lessonOfficialReferences(lesson) {
  const refs = {
    html: [
      { label:'MDN · HTML', description:'Referência de elementos, atributos e semântica.', url:'https://developer.mozilla.org/pt-BR/docs/Web/HTML' },
      { label:'WHATWG · HTML', description:'Padrão vivo oficial da linguagem HTML.', url:'https://html.spec.whatwg.org/' }
    ],
    css: [
      { label:'MDN · CSS', description:'Referência de propriedades, seletores e layout.', url:'https://developer.mozilla.org/pt-BR/docs/Web/CSS' },
      { label:'W3C · CSS', description:'Especificações e módulos oficiais de CSS.', url:'https://www.w3.org/Style/CSS/' }
    ],
    javascript: [
      { label:'MDN · JavaScript', description:'Guia e referência da linguagem no navegador.', url:'https://developer.mozilla.org/pt-BR/docs/Web/JavaScript' },
      { label:'ECMAScript', description:'Especificação oficial da linguagem JavaScript.', url:'https://tc39.es/ecma262/' }
    ],
    python: [
      { label:'Python Docs', description:'Documentação oficial do Python 3.', url:'https://docs.python.org/3/' },
      { label:'Tutorial Python', description:'Tutorial oficial com conceitos e exemplos.', url:'https://docs.python.org/3/tutorial/' }
    ]
  };
  return refs[lesson?.courseId] || [];
}

function renderLesson(id) {
  const lesson = lessonById.get(id) || lessons[0];
  if (!lesson) return;
  currentLessonId = lesson.id;
  state.lastLesson = lesson.id;
  saveState();

  const course = courseById.get(lesson.courseId);
  const courseLessons = getCourseLessons(lesson.courseId);
  const lessonIndex = getLessonIndexInCourse(lesson);
  const module = getModule(course, lesson.moduleId);
  const moduleIndex = getModuleIndex(course, lesson.moduleId);
  const moduleLessonIndex = Math.max(0, module?.lessonIds?.indexOf(lesson.id) ?? 0);
  const done = state.completedLessons.includes(lesson.id);

  $('#lessonCourseCode').textContent = course?.code || techCode(lesson.courseId);
  $('#lessonCourseTitle').textContent = course?.title || techLabel(lesson.courseId);
  $('#lessonModuleLabel').textContent = `${course?.modules?.length || 0} módulos · ${courseLessons.length} aulas`;
  $('#lessonCoursePercent').textContent = `${courseProgress(lesson.courseId)}%`;
  $('#lessonCourseBar').style.width = `${courseProgress(lesson.courseId)}%`;

  $('#lessonNav').innerHTML = (course?.modules || []).map((mod, modIndex) => {
    const modLessons = (mod.lessonIds || []).map(lessonId => lessonById.get(lessonId)).filter(Boolean);
    const modDone = modLessons.filter(item => state.completedLessons.includes(item.id)).length;
    const isCurrent = mod.id === lesson.moduleId;
    return `<details class="lesson-module-group" ${isCurrent ? 'open' : ''}>
      <summary class="lesson-module-title">${String(modIndex + 1).padStart(2,'0')} · ${escapeHtml(mod.title)} <span>${modDone}/${modLessons.length}</span></summary>
      <div>${modLessons.map((item, index) => `<button class="${item.id === lesson.id ? 'active ' : ''}${state.completedLessons.includes(item.id) ? 'done' : ''}" data-lesson="${escapeAttr(item.id)}" ${item.id === lesson.id ? 'aria-current="page"' : ''}><span class="lesson-state">${state.completedLessons.includes(item.id) ? '✓' : index + 1}</span><span>${escapeHtml(item.title)}</span></button>`).join('')}</div>
    </details>`;
  }).join('');

  const lineGuide = buildLessonLineGuide(lesson, lesson.code || lesson.syntax || '');
  const comparison = getLessonComparison(lesson);
  const sections = [
    ['objetivos','Objetivos', lesson.objectives?.length],
    ['explicacao','Explicação', lesson.explanation],
    ['comparacao','Compare', comparison],
    ['aprofundamento','Aprofundamento', lesson.deepDive || lesson.practicalContext],
    ['sintaxe','Sintaxe e exemplo', lesson.syntax || lesson.code],
    ['linha-a-linha','Linha por linha', lineGuide.length],
    ['entenda','Entenda o código', lesson.understand?.length],
    ['erros','Erros comuns', lesson.errors?.length],
    ['pratica','Prática', lesson.practice || lesson.editor],
    ['revisao','Resumo final', lesson.summary],
    ['referencias','Referências', true]
  ].filter(([, , show]) => show);

  const relatedTerms = glossary.filter(term => {
    const combined = normalizeText([lesson.title, lesson.explanation, lesson.deepDive, lesson.practicalContext].filter(Boolean).join(' '));
    return combined.includes(normalizeText(term.term));
  }).slice(0, 6);

  const langLabel = lesson.courseId === 'javascript' ? 'JavaScript' : lesson.courseId === 'python' ? 'Python' : lesson.courseId.toUpperCase();
  const code = lesson.code || lesson.syntax || '';
  const codeBlock = code ? `<div class="code-block"><div class="code-head"><span>${escapeHtml(langLabel)}</span><button class="text-button copy-example" type="button"><svg class="ui-icon"><use href="#icon-copy"></use></svg>Copiar</button></div><pre><code>${escapeHtml(code)}</code></pre></div>` : '';
  const objectiveBlock = lesson.objectives?.length ? `<section class="lesson-section lesson-objectives" id="objetivos"><div class="lesson-section-heading"><span class="lesson-section-index">01</span><div><span class="detail-kicker">Antes de começar</span><h2>Ao terminar esta aula, você vai conseguir</h2></div></div><div class="lesson-objective-list">${lesson.objectives.map((item,index) => `<div class="lesson-objective-item"><span>${String(index + 1).padStart(2,'0')}</span><p>${escapeHtml(item)}</p></div>`).join('')}</div></section>` : '';
  const comparisonBlock = comparison ? `<section class="lesson-section lesson-comparison-section" id="comparacao"><div class="lesson-section-heading"><span class="lesson-section-index">↔</span><div><span class="detail-kicker">Compare para entender</span><h2>${escapeHtml(comparison.title)}</h2></div></div><div class="lesson-comparison-grid"><article><strong>${escapeHtml(comparison.leftTitle)}</strong><ul>${comparison.leftItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><strong>${escapeHtml(comparison.rightTitle)}</strong><ul>${comparison.rightItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article></div><div class="lesson-comparison-takeaway"><span>Regra prática</span><p>${escapeHtml(comparison.takeaway)}</p></div></section>` : '';
  const lineGuideBlock = lineGuide.length ? `<section class="lesson-section lesson-line-guide-section" id="linha-a-linha"><div class="lesson-section-heading"><span class="lesson-section-index">{ }</span><div><span class="detail-kicker">Sem pular etapas</span><h2>Entenda o exemplo linha por linha</h2></div></div><div class="lesson-line-guide">${lineGuide.map(item => `<div class="lesson-line-row"><span class="lesson-line-number">${item.number}</span><code>${escapeHtml(item.line.trim())}</code><p>${escapeHtml(item.explanation)}</p></div>`).join('')}</div></section>` : '';
  const errorsBlock = lesson.errors?.length ? `<section class="lesson-section lesson-errors-section" id="erros"><div class="lesson-section-heading"><span class="lesson-section-index">!</span><div><span class="detail-kicker">Evite tropeços comuns</span><h2>Erros comuns</h2></div></div><div class="lesson-error-list">${lesson.errors.map((error,index) => `<article class="lesson-error-item"><span>${index + 1}</span><div><strong>O que costuma dar errado</strong><p>${escapeHtml(error)}</p></div></article>`).join('')}</div><div class="lesson-error-tip"><strong>Como estudar esse erro</strong><p>Volte ao exemplo acima, altere apenas uma parte por vez e compare o resultado. Entender por que algo falha costuma fixar o conceito melhor do que apenas decorar a forma correta.</p></div></section>` : '';
  const summaryBlock = lesson.summary ? `<section class="lesson-section lesson-summary-section" id="revisao"><div class="lesson-section-heading"><span class="lesson-section-index">✓</span><div><span class="detail-kicker">Antes de avançar</span><h2>Resumo final</h2></div></div><p class="lesson-summary-lead">${glossaryAwareText(lesson.summary, 2)}</p>${lesson.objectives?.length ? `<div class="lesson-summary-checklist"><strong>Você deve conseguir:</strong>${lesson.objectives.map(item => `<span><svg class="ui-icon"><use href="#icon-check"></use></svg>${escapeHtml(item)}</span>`).join('')}</div>` : ''}${lesson.nextStep ? `<div class="callout tip"><strong>Próximo passo</strong><p>${escapeHtml(lesson.nextStep)}</p></div>` : ''}</section>` : '';
  const canOpenInPlayground = Boolean(lesson.editor || (lesson.courseId === 'python' && code));
  const editorButton = canOpenInPlayground ? `<a class="button secondary" href="#playground" id="openLessonInPlayground"><svg class="ui-icon"><use href="#icon-terminal"></use></svg>${lesson.courseId === 'python' ? 'Executar este exemplo em Python' : 'Abrir este exemplo no Playground'}</a>` : '';
  const relatedExercises = exercises.filter(exercise => String(exercise.relatedLessonId) === String(lesson.id));
  const conceptPracticeButton = relatedExercises.length ? `<button class="button secondary" type="button" data-practice-lesson="${escapeAttr(lesson.id)}"><svg class="ui-icon"><use href="#icon-exercise"></use></svg>Praticar este conceito · ${relatedExercises.length}</button>` : '';
  const officialReferences = lessonOfficialReferences(lesson);
  const referencesBlock = officialReferences.length ? `<section class="lesson-section lesson-references-section" id="referencias"><div class="lesson-section-heading"><span class="lesson-section-index">↗</span><div><span class="detail-kicker">Continue pesquisando</span><h2>Referências oficiais</h2></div></div><div class="lesson-reference-grid">${officialReferences.map(ref => `<a href="${escapeAttr(ref.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(ref.label)}</strong><small>${escapeHtml(ref.description)}</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div></section>` : '';
  const noteValue = state.lessonNotes[lesson.id] || '';
  const prev = courseLessons[lessonIndex - 1];
  const next = courseLessons[lessonIndex + 1];

  $('#lessonContent').innerHTML = `
    <div class="lesson-breadcrumb"><a href="#trilhas">Trilhas</a><span> / </span><span>${escapeHtml(course?.title || '')}</span><span> / </span><span>${escapeHtml(lesson.moduleTitle)}</span></div>
    <h1>${escapeHtml(lesson.title)}</h1>
    <p class="lesson-intro">${glossaryAwareText(lesson.intro, 2)}</p>
    <div class="lesson-top-grid">
      <div>
        ${objectiveBlock}
        ${lesson.explanation ? `<section class="lesson-section" id="explicacao"><h2>Explicação</h2><p>${glossaryAwareText(lesson.explanation, 3)}</p>${lesson.analogy ? `<div class="callout"><strong>Uma forma de pensar</strong><p>${glossaryAwareText(lesson.analogy, 2)}</p></div>` : ''}</section>` : ''}
        ${comparisonBlock}
        ${(lesson.deepDive || lesson.practicalContext) ? `<section class="lesson-section" id="aprofundamento"><h2>Aprofundamento</h2>${lesson.deepDive ? `<p>${glossaryAwareText(lesson.deepDive, 3)}</p>` : ''}${lesson.practicalContext ? `<div class="callout"><strong>Na prática</strong><p>${glossaryAwareText(lesson.practicalContext, 2)}</p></div>` : ''}</section>` : ''}
        ${(lesson.syntax || code) ? `<section class="lesson-section" id="sintaxe"><h2>Sintaxe e exemplo</h2>${lesson.syntax && lesson.syntax !== code ? `<p>${glossaryAwareText(lesson.syntax, 1)}</p>` : ''}${codeBlock}${lesson.result ? `<div class="callout"><strong>Resultado</strong><p style="white-space:pre-line">${escapeHtml(lesson.result)}</p></div>` : ''}</section>` : ''}
        ${lineGuideBlock}
        ${lesson.understand?.length ? `<section class="lesson-section" id="entenda"><h2>Entenda o código</h2><ul>${lesson.understand.map(item => `<li>${glossaryAwareText(item, 1)}</li>`).join('')}</ul></section>` : ''}
        ${lesson.tip ? `<div class="lesson-rich-grid lesson-rich-grid-single"><div class="mini-callout"><strong>Boa prática</strong><p>${glossaryAwareText(lesson.tip, 1)}</p></div></div>` : ''}
        ${errorsBlock}
        ${(lesson.practice || lesson.editor || lesson.checkpoint) ? `<section class="lesson-section" id="pratica"><h2>Pratique agora</h2>${lesson.practice ? `<p>${glossaryAwareText(lesson.practice, 2)}</p>` : '<p>Experimente o exemplo e altere pequenas partes para observar o comportamento.</p>'}${lesson.checkpoint?.length ? `<div class="callout"><strong>Checkpoint</strong><ul>${lesson.checkpoint.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}<div class="lesson-practice-actions">${editorButton}${conceptPracticeButton}</div></section>` : ''}
        ${relatedTerms.length ? `<div class="lesson-concepts"><span class="eyebrow simple" style="width:100%;margin-bottom:4px">Conceitos desta aula</span>${relatedTerms.map(term => `<button class="term-inline" type="button" data-term="${escapeAttr(term.term)}">${escapeHtml(term.term)}</button>`).join('')}</div>` : ''}
        ${summaryBlock}
        ${referencesBlock}
      </div>
      <nav class="lesson-toc" aria-label="Nesta aula"><strong>Nesta aula</strong>${sections.map(([idSection, label]) => `<a href="#${idSection}" data-scroll-section="${idSection}">${label}</a>`).join('')}</nav>
    </div>
    <details class="lesson-notes" ${noteValue ? 'open' : ''}>
      <summary class="lesson-notes-summary">
        <span class="lesson-notes-summary-main">
          <span class="lesson-notes-icon" aria-hidden="true"><svg class="ui-icon"><use href="#icon-note"></use></svg></span>
          <span class="lesson-notes-copy"><strong>Minhas notas</strong><small>${noteValue ? 'Continue suas anotações desta aula' : 'Anote exemplos, dúvidas e lembretes'}</small></span>
        </span>
        <svg class="ui-icon lesson-notes-chevron" aria-hidden="true"><use href="#icon-chevron-down"></use></svg>
      </summary>
      <div class="lesson-notes-body">
        <label class="sr-only" for="lessonNotes">Minhas notas desta aula</label>
        <textarea id="lessonNotes" rows="5" maxlength="4000" placeholder="Escreva algo que queira lembrar ou revisar depois...">${escapeHtml(noteValue)}</textarea>
        <div class="note-footer"><span class="lesson-note-save"><span class="lesson-note-save-dot" aria-hidden="true"></span><span id="lessonNoteStatus">Salvo automaticamente</span></span><span id="lessonNoteCount">${noteValue.length} / 4000</span></div>
      </div>
    </details>
    <div class="lesson-actions"><div>${prev ? `<button class="text-button lesson-prev" data-lesson="${escapeAttr(prev.id)}" type="button">← ${escapeHtml(prev.title)}</button>` : '<a class="text-link" href="#trilhas">← Voltar para Trilhas</a>'}</div><button class="button ${done ? 'secondary' : 'primary'}" id="completeLesson" type="button">${done ? 'Aula concluída ✓' : 'Marcar como concluída'}</button><div class="next">${next ? `<button class="text-button lesson-next" data-lesson="${escapeAttr(next.id)}" type="button">${escapeHtml(next.title)} →</button>` : '<a class="text-link" href="#exercicios">Praticar exercícios →</a>'}</div></div>`;

  $$('#lessonNav button[data-lesson]').forEach(button => button.addEventListener('click', () => navigateToLesson(button.dataset.lesson)));
  const lessonSearch = $('#lessonNavSearch');
  if (lessonSearch) { lessonSearch.value = ''; filterLessonNavigation(''); }
  requestAnimationFrame(updateLessonScrollState);
  $$('.lesson-prev,.lesson-next').forEach(button => button.addEventListener('click', () => navigateToLesson(button.dataset.lesson)));
  $$('.copy-example').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); button.textContent = 'Copiado'; setTimeout(() => { button.innerHTML = '<svg class="ui-icon"><use href="#icon-copy"></use></svg>Copiar'; }, 1200); } catch { button.textContent = 'Não foi possível copiar'; }
  }));
  $('#completeLesson')?.addEventListener('click', () => toggleLessonCompletion(lesson));
  $('#lessonNotes')?.addEventListener('input', event => {
    state.lessonNotes[lesson.id] = event.currentTarget.value;
    saveState();
    const count = $('#lessonNoteCount');
    if (count) count.textContent = `${event.currentTarget.value.length}/4000`;
    const status = $('#lessonNoteStatus');
    if (status) {
      status.textContent = 'Salvando…';
      clearTimeout(window.__eeNoteTimer);
      window.__eeNoteTimer = setTimeout(() => { if ($('#lessonNoteStatus')) $('#lessonNoteStatus').textContent = 'Tudo salvo neste navegador'; }, 450);
    }
  });
  $('#openLessonInPlayground')?.addEventListener('click', () => {
    savePlaygroundSnapshot('Antes de abrir exemplo da aula');
    if (lesson.courseId === 'python' && code) {
      state.playground = Object.assign({}, defaultPlayground, { python: code });
      state.playgroundLang = 'python';
    } else {
      state.playground = Object.assign({}, defaultPlayground, lesson.editor || {});
      state.playgroundLang = lesson.editor?.js ? 'js' : lesson.editor?.css ? 'css' : 'html';
    }
    state.playgroundPreset = 'lesson';
    saveState();
  });
  $$('[data-scroll-section]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.getElementById(link.dataset.scrollSection)?.scrollIntoView({ behavior: 'smooth', block:'start' });
  }));
  initTermButtons();

  setTimeout(() => {
    const active = $('#lessonNav button.active');
    active?.scrollIntoView({ block:'center' });
  }, 0);
}

function navigateToLesson(id) {
  const targetHash = `#aula/${encodeURIComponent(id)}`;
  if (location.hash === targetHash) renderLesson(id);
  else location.hash = targetHash;
}
function toggleLessonCompletion(lesson) {
  const completed = state.completedLessons.includes(lesson.id);
  if (completed) {
    state.completedLessons = state.completedLessons.filter(id => id !== lesson.id);
    recordActivity('lesson', `Reabriu “${lesson.title}”`, techLabel(lesson.courseId));
  } else {
    state.completedLessons.push(lesson.id);
    recordActivity('lesson', `Aula concluída: ${lesson.title}`, `${techLabel(lesson.courseId)} · ${lesson.moduleTitle}`);
  }
  saveState();
  renderLesson(lesson.id);
  renderHome();
}

function exerciseFilteredList() {
  if (activeExerciseSession) {
    const byId = new Map(exercises.map(exercise => [String(exercise.id), exercise]));
    return activeExerciseSession.ids.map(id => byId.get(String(id))).filter(Boolean);
  }
  return exercises.filter(exercise => {
    const techMatch = exerciseTechFilter === 'Todos' || normalizeText(exercise.tech) === normalizeText(exerciseTechFilter);
    const difficultyMatch = exerciseDifficultyFilter === 'Todas' || normalizeText(exercise.difficulty || 'Prática') === normalizeText(exerciseDifficultyFilter);
    const completed = state.completedExercises.includes(exercise.id);
    const statusMatch = exerciseStatusFilter === 'Todos'
      || (exerciseStatusFilter === 'Pendentes' && !completed)
      || (exerciseStatusFilter === 'Concluídos' && completed)
      || (exerciseStatusFilter === 'Errei antes' && state.exerciseMistakes.includes(exercise.id));
    return techMatch && difficultyMatch && statusMatch;
  });
}

function renderExerciseFilters() {
  if (activeExerciseSession) {
    const summary = sessionResultSummary();
    $('#exerciseFilters').innerHTML = `<div class="exercise-session-toolbar"><div><span class="exercise-filter-label">Sessão ativa</span><strong>${escapeHtml(activeExerciseSession.label)}</strong><small>${summary.answered}/${summary.total} respondidos · ${summary.correct} corretos</small></div><div class="exercise-session-actions"><div class="exercise-session-progress"><span style="width:${summary.total ? (summary.answered / summary.total) * 100 : 0}%"></span></div><button class="text-button" id="finishExerciseSessionEarly" type="button">Encerrar sessão</button></div></div>`;
    $('#finishExerciseSessionEarly')?.addEventListener('click', finishExerciseSession);
    return;
  }
  const technologies = ['Todos', ...courses.map(course => course.title)];
  const difficulties = ['Todas', ...[...new Set(exercises.map(exercise => exercise.difficulty || 'Prática'))]];
  const hasActiveFilters = exerciseTechFilter !== 'Todos' || exerciseDifficultyFilter !== 'Todas' || exerciseStatusFilter !== 'Todos';
  $('#exerciseFilters').innerHTML = `<div class="exercise-filter-group exercise-filter-tech"><span class="exercise-filter-label">Tecnologia</span><div class="exercise-filter-chips">${technologies.map(filter => `<button class="filter-chip ${filter === exerciseTechFilter ? 'active' : ''}" data-tech-filter="${escapeAttr(filter)}" aria-pressed="${filter === exerciseTechFilter}" type="button">${escapeHtml(filter)}</button>`).join('')}</div></div><div class="exercise-filter-group compact"><label><span class="exercise-filter-label">Dificuldade</span><select class="exercise-filter-select" id="exerciseDifficultyFilter">${difficulties.map(filter => `<option value="${escapeAttr(filter)}" ${filter === exerciseDifficultyFilter ? 'selected' : ''}>${escapeHtml(filter)}</option>`).join('')}</select></label><label><span class="exercise-filter-label">Estado</span><select class="exercise-filter-select" id="exerciseStatusFilter"><option value="Todos" ${exerciseStatusFilter === 'Todos' ? 'selected' : ''}>Todos</option><option value="Pendentes" ${exerciseStatusFilter === 'Pendentes' ? 'selected' : ''}>Não concluídos</option><option value="Concluídos" ${exerciseStatusFilter === 'Concluídos' ? 'selected' : ''}>Concluídos</option><option value="Errei antes" ${exerciseStatusFilter === 'Errei antes' ? 'selected' : ''}>Errei antes</option></select></label>${hasActiveFilters ? '<button class="text-button exercise-clear-filters" id="clearExerciseFilters" type="button">Limpar filtros</button>' : ''}</div>`;
  $$('[data-tech-filter]', $('#exerciseFilters')).forEach(button => button.addEventListener('click', () => {
    exerciseTechFilter = button.dataset.techFilter;
    renderExercises();
  }));
  $('#exerciseDifficultyFilter')?.addEventListener('change', event => { exerciseDifficultyFilter = event.target.value; renderExercises(); });
  $('#exerciseStatusFilter')?.addEventListener('change', event => { exerciseStatusFilter = event.target.value; renderExercises(); });
  $('#clearExerciseFilters')?.addEventListener('click', () => {
    exerciseTechFilter = 'Todos'; exerciseDifficultyFilter = 'Todas'; exerciseStatusFilter = 'Todos'; renderExercises();
  });
}

function acceptedExerciseAnswers(exercise) {
  return [exercise.answer, ...(exercise.answers || [])].filter(answer => answer !== undefined && answer !== null);
}
function isExerciseCorrect(exercise, raw) {
  const normalized = normalizeText(raw);
  if (!normalized) return false;
  return acceptedExerciseAnswers(exercise).some(answer => normalizeText(answer) === normalized);
}
function exerciseHint(exercise) {
  if (exercise.type === 'Múltipla escolha' || exercise.options) return 'Elimine primeiro as opções que descrevem uma função diferente da pedida e compare as restantes com o enunciado.';
  if (exercise.type === 'Prever resultado') return 'Acompanhe a expressão passo a passo e escreva apenas o valor final produzido pelo código.';
  return `Volte ao conceito central de ${exercise.tech} citado no enunciado e compare a função de cada termo antes de responder.`;
}
function setExerciseListOpen(open) {
  const panel = $('#exerciseListPanel');
  const body = $('#exerciseListBody');
  const toggle = $('#exerciseListToggle');
  if (!panel || !body || !toggle) return;
  panel.classList.toggle('mobile-open', open);
  toggle.setAttribute('aria-expanded', String(open));
}
function goToExercise(list, index) {
  const target = list[index];
  if (!target) return;
  currentExercise = target.id;
  renderExercises();
  if (matchMedia('(max-width: 900px)').matches) setExerciseListOpen(false);
  $('#exerciseCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderExercises() {
  if (!exercises.length) return;
  renderExerciseFilters();
  const list = exerciseFilteredList();
  const completedCount = list.filter(exercise => state.completedExercises.includes(exercise.id)).length;
  const percent = list.length ? Math.round((completedCount / list.length) * 100) : 0;
  if (!list.some(exercise => String(exercise.id) === String(currentExercise))) currentExercise = list[0]?.id;
  const currentIndex = Math.max(0, list.findIndex(exercise => String(exercise.id) === String(currentExercise)));

  $('#exerciseListMeta').innerHTML = `<div class="exercise-progress-copy"><span><strong>${completedCount}</strong> de ${list.length} concluídos</span><span>${percent}%</span></div><div class="exercise-progress-track" aria-label="Progresso dos exercícios filtrados"><span style="width:${percent}%"></span></div>`;
  $('#exerciseListToggleMeta').textContent = list.length ? `${currentIndex + 1} de ${list.length} · ${percent}% concluído` : 'Nenhum exercício';
  $('#exerciseList').innerHTML = list.length ? list.map((exercise, index) => {
    const completed = state.completedExercises.includes(exercise.id);
    const missed = state.exerciseMistakes.includes(exercise.id);
    const active = String(exercise.id) === String(currentExercise);
    const sessionResult = activeExerciseSession?.resolved?.[String(exercise.id)];
    const sessionAnswered = activeExerciseSession && Object.prototype.hasOwnProperty.call(activeExerciseSession.resolved || {}, String(exercise.id));
    const stateClass = sessionAnswered ? (sessionResult ? 'done' : 'review') : completed ? 'done' : missed ? 'review' : '';
    const stateText = sessionAnswered ? (sessionResult ? '✓' : '×') : completed ? '✓' : missed ? '↺' : '';
    const stateLabel = sessionAnswered ? (sessionResult ? 'Correto nesta sessão' : 'Incorreto nesta sessão') : completed ? 'Concluído' : missed ? 'Errou antes' : 'Pendente';
    return `<button class="exercise-list-item ${active ? 'active' : ''}" data-id="${escapeAttr(exercise.id)}" type="button" aria-current="${active ? 'true' : 'false'}"><span class="exercise-list-number">${String(index + 1).padStart(2,'0')}</span><span class="exercise-list-copy"><small>${escapeHtml(exercise.tech)} · ${escapeHtml(exercise.difficulty || exercise.type)}</small><strong>${escapeHtml(exercise.title)}</strong></span><span class="exercise-list-state ${stateClass}" aria-label="${stateLabel}">${stateText}</span></button>`;
  }).join('') : '<div class="exercise-list-empty">Nenhum exercício corresponde a estes filtros.</div>';
  $$('#exerciseList button').forEach(button => button.addEventListener('click', () => {
    currentExercise = button.dataset.id;
    renderExercises();
    if (matchMedia('(max-width: 900px)').matches) setExerciseListOpen(false);
  }));

  const toggle = $('#exerciseListToggle');
  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => setExerciseListOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  }

  const exercise = list[currentIndex];
  if (!exercise) {
    $('#exerciseCard').innerHTML = `<div class="empty-state exercise-empty"><strong>Nenhum exercício encontrado</strong><p>Altere os filtros para continuar praticando.</p><button class="button secondary" id="exerciseEmptyReset" type="button">Limpar filtros</button></div>`;
    $('#exerciseEmptyReset')?.addEventListener('click', () => { exerciseTechFilter = 'Todos'; exerciseDifficultyFilter = 'Todas'; exerciseStatusFilter = 'Todos'; renderExercises(); });
    return;
  }
  currentExercise = exercise.id;
  const complete = state.completedExercises.includes(exercise.id);
  const attempts = state.exerciseAttempts[exercise.id] || 0;
  const isCodeAnswer = !exercise.options && (exercise.type === 'Prever resultado' || /[`{}\[\]();=>]/.test(exercise.prompt));
  const options = exercise.options ? `<div class="options" role="radiogroup" aria-label="Opções de resposta">${exercise.options.map((option, index) => `<button class="option" data-value="${escapeAttr(option)}" type="button" role="radio" aria-checked="false"><span class="option-letter">${String.fromCharCode(65 + index)}</span><span class="option-text">${escapeHtml(option)}</span></button>`).join('')}</div>` : `<label class="answer-field"><span class="answer-label">Sua resposta</span><textarea class="answer-input ${isCodeAnswer ? 'code-answer' : ''}" id="exerciseAnswer" placeholder="Digite sua resposta..." aria-label="Sua resposta"></textarea><small>${isCodeAnswer ? 'Ctrl/⌘ + Enter para verificar' : 'Escreva a resposta e verifique quando estiver pronto.'}</small></label>`;
  $('#exerciseCard').innerHTML = `<div class="exercise-card-progress"><span style="width:${((currentIndex + 1) / Math.max(1,list.length)) * 100}%"></span></div><div class="exercise-card-head"><div class="exercise-heading"><div class="badge-row exercise-badges"><span class="badge">${escapeHtml(exercise.tech)}</span><span class="badge">${escapeHtml(exercise.difficulty || 'Prática')}</span><span class="badge subtle">${escapeHtml(exercise.type)}</span></div><h2>${escapeHtml(exercise.title)}</h2></div><span class="exercise-counter">${currentIndex + 1} de ${list.length}</span></div><p class="exercise-prompt">${escapeHtml(exercise.prompt)}</p>${options}<div class="exercise-actions"><button class="button primary" id="checkAnswer" type="button">Verificar resposta</button><span class="attempt-count">${attempts ? `${attempts} tentativa${attempts === 1 ? '' : 's'}` : 'Primeira tentativa'}</span></div>${complete ? '<div class="exercise-complete-note"><span>✓</span><p><strong>Já concluído.</strong> Você pode refazer para revisar.</p></div>' : ''}<div id="exerciseFeedback" aria-live="polite"></div><nav class="exercise-nav" aria-label="Navegação entre exercícios"><button class="text-button" id="previousExercise" type="button" ${currentIndex === 0 ? 'disabled' : ''}>← Anterior</button><span>${currentIndex + 1} / ${list.length}</span><button class="text-button" id="nextExerciseNav" type="button" ${currentIndex >= list.length - 1 ? 'disabled' : ''}>Próximo →</button></nav>`;

  let selected = '';
  $$('.option', $('#exerciseCard')).forEach(option => option.addEventListener('click', () => {
    $$('.option', $('#exerciseCard')).forEach(item => { item.classList.remove('selected'); item.setAttribute('aria-checked','false'); });
    option.classList.add('selected');
    option.setAttribute('aria-checked','true');
    selected = option.dataset.value;
  }));

  const verify = () => {
    const raw = exercise.options ? selected : ($('#exerciseAnswer')?.value || '');
    if (!String(raw).trim()) {
      $('#exerciseFeedback').innerHTML = '<div class="feedback neutral"><strong>Escolha ou escreva uma resposta</strong><p>Depois clique em Verificar resposta.</p></div>';
      return;
    }
    state.exerciseAttempts[exercise.id] = (state.exerciseAttempts[exercise.id] || 0) + 1;
    const currentAttempts = state.exerciseAttempts[exercise.id];
    const correct = isExerciseCorrect(exercise, raw);
    registerExerciseOutcome(exercise, correct);
    if (activeExerciseSession) {
      if (!Object.prototype.hasOwnProperty.call(activeExerciseSession.results, String(exercise.id))) activeExerciseSession.results[String(exercise.id)] = correct;
      if (correct || !Object.prototype.hasOwnProperty.call(activeExerciseSession.resolved || {}, String(exercise.id))) activeExerciseSession.resolved[String(exercise.id)] = correct;
    }
    const conceptLink = exercise.relatedLessonId && lessonById.has(exercise.relatedLessonId) ? `<a class="text-link" href="#aula/${encodeURIComponent(exercise.relatedLessonId)}">Revisar conceito na aula →</a>` : '';
    if (correct) {
      $('#exerciseFeedback').innerHTML = `<div class="feedback success"><span class="feedback-kicker">Resposta correta</span><strong>Conceito entendido ✓</strong><p>${escapeHtml(exercise.explanation)}</p><div class="feedback-actions">${conceptLink}${list[currentIndex + 1] ? '<button class="button secondary compact-button" id="nextExercise" type="button">Próximo exercício →</button>' : activeExerciseSession ? '<button class="button secondary compact-button" id="finishExerciseSession" type="button">Finalizar sessão</button>' : '<a class="text-link" href="#progresso">Ver meu progresso →</a>'}</div></div>`;
      if (!state.completedExercises.includes(exercise.id)) {
        state.completedExercises.push(exercise.id);
        recordActivity('exercise', `Exercício concluído: ${exercise.title}`, `${exercise.tech} · ${exercise.difficulty || exercise.type}`);
      }
    } else {
      if (!state.exerciseMistakes.includes(exercise.id)) state.exerciseMistakes.push(exercise.id);
      const revealExplanation = currentAttempts >= 2;
      $('#exerciseFeedback').innerHTML = `<div class="feedback error"><span class="feedback-kicker">${revealExplanation ? 'Vamos revisar' : 'Tente mais uma vez'}</span><strong>${revealExplanation ? 'Veja onde ajustar o raciocínio' : 'Ainda não é essa resposta'}</strong><p>${revealExplanation ? escapeHtml(exercise.explanation) : escapeHtml(exerciseHint(exercise))}</p><div class="feedback-actions">${conceptLink}<button class="button secondary compact-button" id="retryExercise" type="button">Tentar novamente</button></div></div>`;
    }
    saveState();
    $('#nextExercise')?.addEventListener('click', () => goToExercise(list, currentIndex + 1));
    $('#finishExerciseSession')?.addEventListener('click', finishExerciseSession);
    $('#retryExercise')?.addEventListener('click', () => { if (exercise.options) $('.option', $('#exerciseCard'))?.focus(); else $('#exerciseAnswer')?.focus(); });
    renderExerciseFilters();
    renderHome();
  };

  $('#checkAnswer')?.addEventListener('click', verify);
  $('#previousExercise')?.addEventListener('click', () => goToExercise(list, currentIndex - 1));
  $('#nextExerciseNav')?.addEventListener('click', () => goToExercise(list, currentIndex + 1));
  $('#exerciseAnswer')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); verify(); }
  });
  $('#exerciseCard')?.addEventListener('keydown', event => {
    const interactive = event.target.closest('button,a,input,textarea,select');
    if (!interactive && event.key === 'Enter' && exercise.options) { event.preventDefault(); verify(); }
    if (!interactive && event.key === 'ArrowLeft' && currentIndex > 0) { event.preventDefault(); goToExercise(list, currentIndex - 1); }
    if (!interactive && event.key === 'ArrowRight' && currentIndex < list.length - 1) { event.preventDefault(); goToExercise(list, currentIndex + 1); }
  });
}

function renderChallenges() {
  $('#challengeGrid').innerHTML = challenges.map((challenge, index) => {
    const completed = state.completedChallenges.includes(challenge.id);
    return `<article class="challenge-card"><div class="badge-row"><span class="badge">${escapeHtml(challenge.tech)}</span><span class="badge">${escapeHtml(challenge.level)}</span>${completed ? '<span class="badge">Concluído ✓</span>' : ''}</div><h2>${escapeHtml(challenge.title)}</h2><p>${escapeHtml(challenge.description)}</p>${challenge.requirements?.length ? `<div class="requirement-list">${challenge.requirements.slice(0,4).map(item => `<div class="requirement-item">${escapeHtml(item)}</div>`).join('')}</div>` : ''}<div class="card-bottom"><button class="button secondary hint-button" data-id="${index}" type="button">Mostrar dica 1</button><div class="hint-box" id="hint-${index}" hidden></div><button class="text-button challenge-complete" data-id="${escapeAttr(challenge.id)}" type="button">${completed ? 'Desafio concluído ✓' : 'Marcar como concluído'}</button></div></article>`;
  }).join('');
  $$('.hint-button').forEach(button => {
    let step = 0;
    button.addEventListener('click', () => {
      const challenge = challenges[Number(button.dataset.id)];
      const box = $(`#hint-${button.dataset.id}`);
      box.hidden = false;
      if (step < (challenge.hints?.length || 0)) {
        box.innerHTML = `<strong>Dica ${step + 1}</strong><p>${escapeHtml(challenge.hints[step])}</p>`;
        step += 1;
        button.textContent = step < challenge.hints.length ? `Mostrar dica ${step + 1}` : 'Mostrar solução oficial';
      } else {
        box.innerHTML = `<strong>Solução oficial</strong><p>${escapeHtml(challenge.solution)}</p>`;
        button.disabled = true;
        button.textContent = 'Solução exibida';
      }
    });
  });
  $$('.challenge-complete').forEach(button => button.addEventListener('click', () => {
    const challenge = challenges.find(item => item.id === button.dataset.id);
    if (!challenge) return;
    const completed = state.completedChallenges.includes(challenge.id);
    state.completedChallenges = completed ? state.completedChallenges.filter(id => id !== challenge.id) : [...state.completedChallenges, challenge.id];
    if (!completed) recordActivity('challenge', `Desafio concluído: ${challenge.title}`, challenge.tech);
    saveState(); renderChallenges(); renderHome();
  }));
}

function getProjectStepState(project) {
  const stored = state.projectSteps[project.id] || [];
  return project.steps.map((_, index) => Boolean(stored[index]));
}
function renderProjects() {
  $('#projectGrid').innerHTML = projects.map(project => {
    const stepState = getProjectStepState(project);
    const doneCount = stepState.filter(Boolean).length;
    const percent = project.steps.length ? Math.round((doneCount / project.steps.length) * 100) : 0;
    const completed = state.completedProjects.includes(project.id) || (project.steps.length > 0 && doneCount === project.steps.length);
    const readiness = projectReadiness(project);
    const readinessCourses = readiness.relatedCourses.map(course => `<span>${escapeHtml(course.code)} ${courseProgress(course.id)}%</span>`).join('');
    return `<article class="project-card"><div class="badge-row">${(project.tech || []).map(tech => `<span class="badge">${escapeHtml(tech)}</span>`).join('')}<span class="badge">${escapeHtml(project.level)}</span>${completed ? '<span class="badge">Concluído ✓</span>' : ''}</div><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description)}</p><div class="project-readiness"><div><small>Preparo pelas trilhas</small><strong>${readiness.score}% · ${escapeHtml(readiness.label)}</strong></div><div class="project-readiness-courses">${readinessCourses || '<span>Progresso geral</span>'}</div><div class="progress"><span style="width:${readiness.score}%"></span></div></div>${project.objective ? `<div class="project-details"><div class="requirement-item"><strong>Objetivo:</strong>&nbsp; ${escapeHtml(project.objective)}</div></div>` : ''}<div class="project-progress-line"><span>${doneCount} de ${project.steps.length} etapas</span><strong>${percent}%</strong></div><div class="progress"><span style="width:${percent}%"></span></div><div class="track-modules">${project.steps.map((step, index) => `<label class="project-step-row"><input type="checkbox" class="project-step" data-project="${escapeAttr(project.id)}" data-step="${index}" ${stepState[index] ? 'checked' : ''}><span>${escapeHtml(step)}</span></label>`).join('')}</div><details class="project-more"><summary>Pré-requisitos, requisitos e extensões</summary><div class="requirement-list">${(project.prerequisites || []).slice(0,3).map(item => `<div class="requirement-item prerequisite-item"><strong>Antes de começar:</strong>&nbsp;${escapeHtml(item)}</div>`).join('')}${(project.requirements || []).slice(0,4).map(item => `<div class="requirement-item">${escapeHtml(item)}</div>`).join('')}${(project.completion || []).slice(0,3).map(item => `<div class="requirement-item">Critério: ${escapeHtml(item)}</div>`).join('')}${(project.tips || []).slice(0,2).map(item => `<div class="requirement-item">Dica: ${escapeHtml(item)}</div>`).join('')}${(project.extensions || []).slice(0,2).map(item => `<div class="requirement-item">Extensão: ${escapeHtml(item)}</div>`).join('')}</div></details><div class="card-bottom project-card-actions"><button class="button secondary project-verify" data-project="${escapeAttr(project.id)}" type="button"><svg class="ui-icon"><use href="#icon-check"></use></svg>Verificar código</button><button class="text-button project-complete" data-project="${escapeAttr(project.id)}" type="button">${completed ? 'Projeto concluído ✓' : 'Marcar projeto concluído'}</button></div></article>`;
  }).join('');

  $$('.project-verify').forEach(button => button.addEventListener('click', () => openProjectVerifier(button.dataset.project)));
  $$('.project-step').forEach(input => input.addEventListener('change', () => {
    const project = projects.find(item => item.id === input.dataset.project);
    if (!project) return;
    const steps = getProjectStepState(project);
    steps[Number(input.dataset.step)] = input.checked;
    state.projectSteps[project.id] = steps;
    const allDone = steps.length && steps.every(Boolean);
    if (allDone && !state.completedProjects.includes(project.id)) {
      state.completedProjects.push(project.id);
      recordActivity('project', `Projeto concluído: ${project.title}`, (project.tech || []).join(' · '));
    }
    if (!allDone) state.completedProjects = state.completedProjects.filter(id => id !== project.id);
    saveState(); renderProjects(); renderHome();
  }));
  $$('.project-complete').forEach(button => button.addEventListener('click', () => {
    const project = projects.find(item => item.id === button.dataset.project);
    if (!project) return;
    const completed = state.completedProjects.includes(project.id);
    if (completed) {
      state.completedProjects = state.completedProjects.filter(id => id !== project.id);
      state.projectSteps[project.id] = project.steps.map(() => false);
    } else {
      state.completedProjects.push(project.id);
      state.projectSteps[project.id] = project.steps.map(() => true);
      recordActivity('project', `Projeto concluído: ${project.title}`, (project.tech || []).join(' · '));
    }
    saveState(); renderProjects(); renderHome();
  }));
}

let activeLang = 'html';
let pg = { ...defaultPlayground };
let pythonWorker = null;
let pythonWorkerUrl = '';
let pythonRunning = false;
let pythonRunStartedAt = 0;
let pythonRunId = 0;
const PYODIDE_VERSION = '0.27.7';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function refreshPlaygroundFromState() {
  pg = { ...defaultPlayground, ...(state.playground || {}) };
  activeLang = ['html','css','js','python'].includes(state.playgroundLang) ? state.playgroundLang : 'html';
  if ($('#codeEditor')) {
    syncEditorMode();
    updateEditor();
    activeLang === 'python' ? preparePythonPane() : runWebPlayground();
  }
}

function savePlaygroundSnapshot(reason = 'Versão salva') {
  pg[activeLang] = $('#codeEditor')?.value ?? pg[activeLang];
  const snapshot = { id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`, time:Date.now(), reason, lang:activeLang, code:{ html:pg.html || '', css:pg.css || '', js:pg.js || '', python:pg.python || '' } };
  const latest = state.playgroundHistory?.[0];
  if (latest && JSON.stringify(latest.code) === JSON.stringify(snapshot.code)) return;
  state.playgroundHistory = [snapshot, ...(state.playgroundHistory || [])].slice(0, 12);
  saveState();
  renderPlaygroundHistory();
}
function renderPlaygroundHistory() {
  const host = $('#playgroundHistoryList'); if (!host) return;
  const items = state.playgroundHistory || [];
  host.innerHTML = items.length ? items.map((item,index) => `<button class="playground-history-item" type="button" data-history-index="${index}"><span><small>${escapeHtml(item.reason || 'Versão salva')} · ${escapeHtml(languageLabel(item.lang || 'html'))}</small><strong>${formatTime(item.time)} atrás</strong></span><span>Restaurar</span></button>`).join('') : '<div class="playground-history-empty">O histórico aparecerá aqui conforme você editar e executar seu código.</div>';
  $$('[data-history-index]', host).forEach(button => button.addEventListener('click', () => restorePlaygroundSnapshot(Number(button.dataset.historyIndex))));
}
function setPlaygroundHistoryOpen(open) {
  const panel = $('#playgroundHistoryPanel'); const toggle = $('#playgroundHistoryToggle');
  if (!panel || !toggle) return;
  panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
  if (open) renderPlaygroundHistory();
}
function restorePlaygroundSnapshot(index) {
  const snapshot = state.playgroundHistory?.[index]; if (!snapshot) return;
  savePlaygroundSnapshot('Antes de restaurar histórico');
  pg = { ...defaultPlayground, ...(snapshot.code || {}) };
  activeLang = ['html','css','js','python'].includes(snapshot.lang) ? snapshot.lang : 'html';
  state.playground = { ...pg }; state.playgroundLang = activeLang;
  saveState(); syncEditorMode(); updateEditor();
  activeLang === 'python' ? preparePythonPane() : runWebPlayground();
  setPlaygroundHistoryOpen(false);
  showToast('Versão do Playground restaurada.');
}



const SAVED_CODE_DB_NAME = 'enterprise-educacional-playground-db';
const SAVED_CODE_DB_STORE = 'projects';
const SAVED_CODE_DB_VERSION = 1;
const SAVED_CODE_FALLBACK_KEY = 'enterprise-educacional-saved-codes-v1';
let savedCodeDbDisabled = false;
let savedProjectsCache = [];

function savedCodeProjectId() {
  return globalThis.crypto?.randomUUID?.() || `ee-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}
function normalizeSavedCodeProject(project) {
  const languages = [...new Set((project?.languages || []).filter(lang => ['html','css','js','python'].includes(lang)))];
  const code = {};
  languages.forEach(lang => { code[lang] = String(project?.code?.[lang] ?? ''); });
  return {
    id: String(project?.id || savedCodeProjectId()),
    name: String(project?.name || 'Projeto sem nome').trim().slice(0,80) || 'Projeto sem nome',
    languages,
    code,
    createdAt: Number(project?.createdAt) || Date.now(),
    updatedAt: Number(project?.updatedAt) || Date.now()
  };
}
function openSavedCodeDatabase() {
  if (savedCodeDbDisabled || !('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponível'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVED_CODE_DB_NAME, SAVED_CODE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVED_CODE_DB_STORE)) {
        const store = db.createObjectStore(SAVED_CODE_DB_STORE, { keyPath:'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('name', 'name');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir banco local'));
    request.onblocked = () => reject(new Error('Banco local bloqueado'));
  });
}
function readSavedCodeFallback() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVED_CODE_FALLBACK_KEY) || '[]');
    return Array.isArray(data) ? data.map(normalizeSavedCodeProject) : [];
  } catch { return []; }
}
function writeSavedCodeFallback(items) {
  localStorage.setItem(SAVED_CODE_FALLBACK_KEY, JSON.stringify(items.map(normalizeSavedCodeProject)));
}
async function listSavedCodeProjects() {
  try {
    const db = await openSavedCodeDatabase();
    const items = await new Promise((resolve, reject) => {
      const request = db.transaction(SAVED_CODE_DB_STORE, 'readonly').objectStore(SAVED_CODE_DB_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    savedProjectsCache = items.map(normalizeSavedCodeProject).sort((a,b) => b.updatedAt - a.updatedAt);
    return savedProjectsCache;
  } catch {
    savedCodeDbDisabled = true;
    savedProjectsCache = readSavedCodeFallback().sort((a,b) => b.updatedAt - a.updatedAt);
    return savedProjectsCache;
  }
}
async function getSavedCodeProject(id) {
  if (!id) return null;
  try {
    const db = await openSavedCodeDatabase();
    const item = await new Promise((resolve, reject) => {
      const request = db.transaction(SAVED_CODE_DB_STORE, 'readonly').objectStore(SAVED_CODE_DB_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return item ? normalizeSavedCodeProject(item) : null;
  } catch {
    savedCodeDbDisabled = true;
    return readSavedCodeFallback().find(item => item.id === id) || null;
  }
}
async function putSavedCodeProject(project) {
  const normalized = normalizeSavedCodeProject(project);
  try {
    const db = await openSavedCodeDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(SAVED_CODE_DB_STORE, 'readwrite').objectStore(SAVED_CODE_DB_STORE).put(normalized);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    savedCodeDbDisabled = true;
    const items = readSavedCodeFallback();
    const index = items.findIndex(item => item.id === normalized.id);
    if (index >= 0) items[index] = normalized; else items.push(normalized);
    writeSavedCodeFallback(items);
  }
  return normalized;
}
async function removeSavedCodeProject(id) {
  try {
    const db = await openSavedCodeDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(SAVED_CODE_DB_STORE, 'readwrite').objectStore(SAVED_CODE_DB_STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    savedCodeDbDisabled = true;
    writeSavedCodeFallback(readSavedCodeFallback().filter(item => item.id !== id));
  }
}
function syncPlaygroundBuffer() {
  if ($('#codeEditor')) pg[activeLang] = $('#codeEditor').value;
  state.playground = { ...pg };
  state.playgroundLang = activeLang;
  saveState();
  return { ...pg };
}
function savedCodeLanguageBadges(languages = []) {
  return languages.map(lang => `<span class="saved-code-lang saved-code-lang-${escapeAttr(lang)}">${escapeHtml(languageLabel(lang).replace(' 3',''))}</span>`).join('');
}
function selectedSavedCodeLanguages() {
  return $$('[data-save-language]', $('#saveCodeDialog')).filter(input => input.checked).map(input => input.value);
}
function setSaveCodeValidation(message = '') {
  const node = $('#saveCodeValidation');
  if (!node) return;
  node.hidden = !message;
  node.textContent = message;
}
async function syncSavedProjectStatus() {
  const button = $('#savedProjectStatus');
  const label = $('#savedProjectStatusText');
  if (!button || !label) return;
  const project = await getSavedCodeProject(state.playgroundSavedProjectId);
  if (!project) {
    state.playgroundSavedProjectId = '';
    saveState();
    button.hidden = true;
    return;
  }
  label.textContent = project.name;
  button.hidden = false;
  button.title = `Projeto salvo: ${project.name} · abrir Meus códigos`;
}
async function openSaveCodeDialog(forceNew = false) {
  syncPlaygroundBuffer();
  const dialog = $('#saveCodeDialog');
  if (!dialog) return;
  const current = !forceNew ? await getSavedCodeProject(state.playgroundSavedProjectId) : null;
  dialog.dataset.projectId = current?.id || '';
  dialog.dataset.mode = current ? 'update' : 'new';
  $('#saveCodeDialogTitle').textContent = current ? 'Salvar alterações' : 'Salvar código';
  $('#savedCodeName').value = current?.name || '';
  $$('[data-save-language]', dialog).forEach(input => {
    input.checked = current ? current.languages.includes(input.value) : input.value === activeLang;
  });
  $('#saveCodeAsNew').hidden = !current;
  $('#confirmSaveCode').textContent = current ? 'Salvar alterações' : 'Salvar projeto';
  setSaveCodeValidation('');
  if (!dialog.open) dialog.showModal();
  setTimeout(() => {
    const name = $('#savedCodeName');
    name?.focus();
    if (current) name?.select();
  }, 0);
}
function closeSaveCodeDialog() {
  const dialog = $('#saveCodeDialog');
  if (dialog?.open) dialog.close();
}
async function saveCodeFromDialog({ asNew = false } = {}) {
  const dialog = $('#saveCodeDialog');
  const name = $('#savedCodeName')?.value.trim() || '';
  const languages = selectedSavedCodeLanguages();
  if (!name) { setSaveCodeValidation('Digite um nome para o projeto.'); $('#savedCodeName')?.focus(); return; }
  if (!languages.length) { setSaveCodeValidation('Selecione pelo menos uma linguagem para salvar.'); return; }
  const buffer = syncPlaygroundBuffer();
  const all = await listSavedCodeProjects();
  let target = !asNew && dialog?.dataset.projectId ? all.find(item => item.id === dialog.dataset.projectId) : null;
  const sameName = all.find(item => normalizeText(item.name) === normalizeText(name) && item.id !== target?.id);
  if (sameName) {
    const overwrite = await eeConfirm(`Já existe um projeto chamado “${sameName.name}”. Se continuar, o projeto salvo será substituído.`, { title:'Substituir projeto?', confirmLabel:'Substituir', tone:'danger' });
    if (!overwrite) { setSaveCodeValidation('Escolha outro nome para salvar como um projeto separado.'); return; }
    target = sameName;
  }
  const now = Date.now();
  const project = await putSavedCodeProject({
    id: target?.id || savedCodeProjectId(),
    name,
    languages,
    code: Object.fromEntries(languages.map(lang => [lang, buffer[lang] || ''])),
    createdAt: target?.createdAt || now,
    updatedAt: now
  });
  state.playgroundSavedProjectId = project.id;
  saveState();
  closeSaveCodeDialog();
  await syncSavedProjectStatus();
  await renderSavedCodeProjects($('#savedCodesSearch')?.value || '');
  showToast(`“${project.name}” salvo com ${languages.map(languageLabel).join(', ')}.`);
}
async function quickSaveCurrentProject() {
  const current = await getSavedCodeProject(state.playgroundSavedProjectId);
  if (!current || !current.languages.includes(activeLang)) {
    openSaveCodeDialog(false);
    return;
  }
  const buffer = syncPlaygroundBuffer();
  const project = await putSavedCodeProject({
    ...current,
    code: Object.fromEntries(current.languages.map(lang => [lang, buffer[lang] || ''])),
    updatedAt: Date.now()
  });
  await syncSavedProjectStatus();
  showToast(`“${project.name}” salvo.`);
}
function uniqueSavedCodeName(name, items) {
  const used = new Set(items.map(item => normalizeText(item.name)));
  let candidate = `${name} — cópia`;
  let count = 2;
  while (used.has(normalizeText(candidate))) candidate = `${name} — cópia ${count++}`;
  return candidate;
}
async function renderSavedCodeProjects(query = '') {
  const host = $('#savedCodesList');
  if (!host) return;
  const all = await listSavedCodeProjects();
  const normalizedQuery = normalizeText(query);
  const items = normalizedQuery ? all.filter(item => normalizeText(`${item.name} ${item.languages.map(languageLabel).join(' ')}`).includes(normalizedQuery)) : all;
  const count = $('#savedCodesCount');
  if (count) count.textContent = `${items.length} projeto${items.length === 1 ? '' : 's'}`;
  if (!items.length) {
    host.innerHTML = `<div class="saved-codes-empty"><span class="saved-codes-empty-icon"><svg class="ui-icon"><use href="#icon-folder"></use></svg></span><strong>${normalizedQuery ? 'Nenhum projeto encontrado' : 'Nenhum código salvo ainda'}</strong><p>${normalizedQuery ? 'Tente outro nome ou linguagem.' : 'No Playground, clique em Salvar e escolha HTML, CSS, JavaScript ou Python.'}</p></div>`;
    return;
  }
  host.innerHTML = items.map(project => {
    const current = project.id === state.playgroundSavedProjectId;
    return `<article class="saved-code-card${current ? ' current' : ''}" data-saved-project="${escapeAttr(project.id)}"><div class="saved-code-card-main"><span class="saved-code-card-icon"><svg class="ui-icon"><use href="#icon-folder"></use></svg></span><div class="saved-code-card-copy"><div class="saved-code-card-title"><strong>${escapeHtml(project.name)}</strong>${current ? '<span class="saved-code-current-badge">Aberto</span>' : ''}</div><div class="saved-code-language-row">${savedCodeLanguageBadges(project.languages)}</div><small>Editado ${escapeHtml(formatTime(project.updatedAt))} atrás</small></div></div><div class="saved-code-card-actions"><button class="button secondary saved-code-open" type="button" data-saved-open="${escapeAttr(project.id)}">Abrir</button><button class="text-button" type="button" data-saved-rename="${escapeAttr(project.id)}">Renomear</button><button class="text-button" type="button" data-saved-export="${escapeAttr(project.id)}">Exportar</button><button class="text-button" type="button" data-saved-duplicate="${escapeAttr(project.id)}">Duplicar</button><button class="text-button danger-text" type="button" data-saved-delete="${escapeAttr(project.id)}">Excluir</button></div></article>`;
  }).join('');
}
async function openSavedCodesDialog() {
  const dialog = $('#savedCodesDialog');
  if (!dialog) return;
  $('#savedCodesSearch').value = '';
  await renderSavedCodeProjects('');
  if (!dialog.open) dialog.showModal();
  setTimeout(() => $('#savedCodesSearch')?.focus(), 0);
}
async function openSavedCodeProject(id) {
  const project = await getSavedCodeProject(id);
  if (!project) { showToast('Esse projeto não foi encontrado.'); return; }
  syncPlaygroundBuffer();

  const allLanguages = ['html', 'css', 'js', 'python'];
  const hasCurrentCode = allLanguages.some(lang => String(pg[lang] || '').trim());
  if (hasCurrentCode) {
    const savedLabels = project.languages.map(languageLabel).join(', ');
    const ok = await eeConfirm(`O código atualmente aberto será limpo. Depois, somente ${savedLabels || 'as linguagens salvas'} de “${project.name}” serão carregadas.`, { title:'Abrir projeto salvo?', confirmLabel:'Abrir projeto' });
    if (!ok) return;
  }

  savePlaygroundSnapshot('Antes de abrir projeto salvo');

  // Abrir um projeto salvo representa trocar completamente o conteúdo do Playground.
  // Primeiro limpamos todas as linguagens; depois restauramos somente as que pertencem ao projeto.
  allLanguages.forEach(lang => { pg[lang] = ''; });
  project.languages.forEach(lang => { pg[lang] = project.code[lang] || ''; });

  activeLang = project.languages.includes(activeLang) ? activeLang : (project.languages[0] || 'html');
  state.playground = { ...pg };
  state.playgroundLang = activeLang;
  state.playgroundSavedProjectId = project.id;
  saveState();
  syncEditorMode();
  updateEditor();
  activeLang === 'python' ? preparePythonPane() : runWebPlayground();
  await syncSavedProjectStatus();
  if ($('#savedCodesDialog')?.open) $('#savedCodesDialog').close();
  showToast(`“${project.name}” aberto. Apenas as linguagens salvas foram carregadas.`);
}
async function renameSavedCodeProject(id) {
  const project = await getSavedCodeProject(id);
  if (!project) return;
  const name = (await eePrompt('Digite o novo nome do projeto.', project.name, { title:'Renomear projeto', inputLabel:'Nome do projeto', confirmLabel:'Renomear', maxLength:80 }))?.trim();
  if (!name || name === project.name) return;
  const all = await listSavedCodeProjects();
  if (all.some(item => item.id !== id && normalizeText(item.name) === normalizeText(name))) {
    showToast('Já existe outro projeto com esse nome.');
    return;
  }
  await putSavedCodeProject({ ...project, name:name.slice(0,80), updatedAt:Date.now() });
  await renderSavedCodeProjects($('#savedCodesSearch')?.value || '');
  await syncSavedProjectStatus();
  showToast('Projeto renomeado.');
}
async function duplicateSavedCodeProject(id) {
  const project = await getSavedCodeProject(id);
  if (!project) return;
  const all = await listSavedCodeProjects();
  const copy = await putSavedCodeProject({ ...project, id:savedCodeProjectId(), name:uniqueSavedCodeName(project.name, all), createdAt:Date.now(), updatedAt:Date.now() });
  await renderSavedCodeProjects($('#savedCodesSearch')?.value || '');
  showToast(`“${copy.name}” criado.`);
}
async function deleteSavedCodeProject(id) {
  const project = await getSavedCodeProject(id);
  if (!project) return;
  if (!await eeConfirm(`“${project.name}” será removido dos seus códigos salvos. O código aberto no editor não será apagado.`, { title:'Excluir projeto?', confirmLabel:'Excluir', tone:'danger' })) return;
  await removeSavedCodeProject(id);
  if (state.playgroundSavedProjectId === id) {
    state.playgroundSavedProjectId = '';
    saveState();
  }
  await syncSavedProjectStatus();
  await renderSavedCodeProjects($('#savedCodesSearch')?.value || '');
  showToast('Projeto removido dos códigos salvos.');
}
function handleSavedCodeLibraryAction(event) {
  const open = event.target.closest('[data-saved-open]');
  const rename = event.target.closest('[data-saved-rename]');
  const exportButton = event.target.closest('[data-saved-export]');
  const duplicate = event.target.closest('[data-saved-duplicate]');
  const remove = event.target.closest('[data-saved-delete]');
  if (open) openSavedCodeProject(open.dataset.savedOpen);
  else if (rename) renameSavedCodeProject(rename.dataset.savedRename);
  else if (exportButton) exportSavedCodeProject(exportButton.dataset.savedExport);
  else if (duplicate) duplicateSavedCodeProject(duplicate.dataset.savedDuplicate);
  else if (remove) deleteSavedCodeProject(remove.dataset.savedDelete);
}


/* Data portability: project ZIPs + full local backup ---------------------- */
function portableFileName(value = 'projeto') {
  return normalizeText(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64) || 'projeto';
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.hidden = true;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function zipCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = ZIP_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zipDosDateTime(time = Date.now()) {
  const date = new Date(time);
  const year = Math.max(1980, date.getFullYear());
  return {
    time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds()/2)) & 31),
    date: (((year - 1980) & 127) << 9) | (((date.getMonth()+1) & 15) << 5) | (date.getDate() & 31)
  };
}
function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total); let offset = 0;
  parts.forEach(part => { out.set(part, offset); offset += part.length; });
  return out;
}
function buildStoreZip(files) {
  const encoder = new TextEncoder();
  const locals = [], central = []; let offset = 0;
  const stamp = zipDosDateTime();
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = zipCrc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0x0800,true); lv.setUint16(8,0,true);
    lv.setUint16(10,stamp.time,true); lv.setUint16(12,stamp.date,true); lv.setUint32(14,crc,true); lv.setUint32(18,data.length,true); lv.setUint32(22,data.length,true);
    lv.setUint16(26,nameBytes.length,true); lv.setUint16(28,0,true); local.set(nameBytes,30);
    locals.push(local,data);
    const cen = new Uint8Array(46 + nameBytes.length); const cv = new DataView(cen.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true);
    cv.setUint16(12,stamp.time,true); cv.setUint16(14,stamp.date,true); cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true);
    cv.setUint16(28,nameBytes.length,true); cv.setUint16(30,0,true); cv.setUint16(32,0,true); cv.setUint16(34,0,true); cv.setUint16(36,0,true); cv.setUint32(38,0,true); cv.setUint32(42,offset,true); cen.set(nameBytes,46);
    central.push(cen); offset += local.length + data.length;
  }
  const centralBytes = concatBytes(central);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(4,0,true); ev.setUint16(6,0,true); ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
  ev.setUint32(12,centralBytes.length,true); ev.setUint32(16,offset,true); ev.setUint16(20,0,true);
  return concatBytes([...locals, centralBytes, end]);
}
async function inflateZipData(bytes) {
  if (!('DecompressionStream' in window)) throw new Error('Este ZIP usa compressão que o navegador atual não consegue importar.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function parseZipFiles(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i,true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Arquivo ZIP inválido.');
  const entries = view.getUint16(eocd + 10,true); let offset = view.getUint32(eocd + 16,true); const decoder = new TextDecoder(); const files = [];
  for (let i = 0; i < entries; i++) {
    if (view.getUint32(offset,true) !== 0x02014b50) throw new Error('Estrutura ZIP não reconhecida.');
    const method = view.getUint16(offset + 10,true); const compressedSize = view.getUint32(offset + 20,true); const nameLen = view.getUint16(offset + 28,true); const extraLen = view.getUint16(offset + 30,true); const commentLen = view.getUint16(offset + 32,true); const localOffset = view.getUint32(offset + 42,true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLen));
    const localNameLen = view.getUint16(localOffset + 26,true); const localExtraLen = view.getUint16(localOffset + 28,true); const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    if (!name.endsWith('/')) {
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateZipData(compressed);
      else throw new Error(`Método de compressão ZIP ${method} não suportado.`);
      files.push({ name, data, text:() => decoder.decode(data) });
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
function projectExportFiles(project) {
  const files = [];
  if (project.languages.includes('html')) files.push({name:'index.html',content:project.code.html || ''});
  if (project.languages.includes('css')) files.push({name:'style.css',content:project.code.css || ''});
  if (project.languages.includes('js')) files.push({name:'script.js',content:project.code.js || ''});
  if (project.languages.includes('python')) files.push({name:'main.py',content:project.code.python || ''});
  files.push({ name:'.enterprise-project.json', content:JSON.stringify({ format:'enterprise-educacional-project', version:1, name:project.name, languages:project.languages, createdAt:project.createdAt, updatedAt:project.updatedAt }, null, 2) });
  return files;
}
async function exportSavedCodeProject(id) {
  const project = await getSavedCodeProject(id);
  if (!project) { showToast('Projeto não encontrado para exportação.'); return; }
  const zip = buildStoreZip(projectExportFiles(project));
  downloadBlob(new Blob([zip], {type:'application/zip'}), `${portableFileName(project.name)}.zip`);
  showToast(`“${project.name}” exportado com arquivos reais.`);
}
function languageFromImportedFile(name = '') {
  const clean = name.toLowerCase().split('/').pop() || '';
  if (/\.html?$/.test(clean)) return 'html';
  if (/\.css$/.test(clean)) return 'css';
  if (/\.(js|mjs)$/.test(clean)) return 'js';
  if (/\.py$/.test(clean)) return 'python';
  return '';
}
async function importSavedCodeFiles(fileList) {
  const inputFiles = [...(fileList || [])]; if (!inputFiles.length) return;
  try {
    let records = []; let metadata = null; let suggestedName = inputFiles[0].name.replace(/\.[^.]+$/,'');
    if (inputFiles.length === 1 && inputFiles[0].name.toLowerCase().endsWith('.zip')) {
      records = await parseZipFiles(await inputFiles[0].arrayBuffer());
      const metaRecord = records.find(item => item.name.split('/').pop() === '.enterprise-project.json');
      if (metaRecord) { try { metadata = JSON.parse(metaRecord.text()); } catch {} }
    } else if (inputFiles.length === 1 && /\.(json|eeproject)$/i.test(inputFiles[0].name)) {
      const parsed = JSON.parse(await inputFiles[0].text());
      const candidate = parsed.project || parsed;
      if (candidate?.code && Array.isArray(candidate.languages)) {
        metadata = { name:candidate.name, languages:candidate.languages };
        records = candidate.languages.map(lang => ({ name:({html:'index.html',css:'style.css',js:'script.js',python:'main.py'})[lang], text:() => String(candidate.code[lang] || '') }));
      }
    } else {
      records = await Promise.all(inputFiles.map(async file => ({ name:file.name, text:() => file.text() })));
    }
    const code = {}; const languages = [];
    for (const record of records) {
      const lang = languageFromImportedFile(record.name); if (!lang || languages.includes(lang)) continue;
      code[lang] = await record.text(); languages.push(lang);
    }
    if (!languages.length) throw new Error('Nenhum arquivo HTML, CSS, JavaScript ou Python foi encontrado.');
    const defaultName = String(metadata?.name || suggestedName || 'Projeto importado').trim().slice(0,80) || 'Projeto importado';
    const nameInput = await eePrompt('Escolha o nome usado para salvar o projeto importado.', defaultName, { title:'Nome do projeto importado', inputLabel:'Nome do projeto', confirmLabel:'Importar', maxLength:80 });
    if (nameInput === null) return;
    const all = await listSavedCodeProjects(); const requested = nameInput.trim().slice(0,80) || defaultName; const name = all.some(item => normalizeText(item.name) === normalizeText(requested)) ? uniqueSavedCodeName(requested, all) : requested;
    const now = Date.now();
    const project = await putSavedCodeProject({ id:savedCodeProjectId(), name, languages, code, createdAt:now, updatedAt:now });
    await renderSavedCodeProjects($('#savedCodesSearch')?.value || '');
    showToast(`“${project.name}” importado com ${languages.map(languageLabel).join(', ')}.`);
  } catch (error) {
    showToast(error?.message || 'Não foi possível importar o projeto.');
  }
}
async function replaceSavedCodeProjects(items = []) {
  const normalized = items.map(normalizeSavedCodeProject);
  try {
    if (savedCodeDbDisabled) throw new Error('fallback');
    const db = await openSavedCodeDatabase();
    await new Promise((resolve,reject) => {
      const tx = db.transaction(SAVED_CODE_DB_STORE,'readwrite'); const store = tx.objectStore(SAVED_CODE_DB_STORE); store.clear(); normalized.forEach(item => store.put(item));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    db.close(); localStorage.removeItem(SAVED_CODE_FALLBACK_KEY);
  } catch {
    savedCodeDbDisabled = true; writeSavedCodeFallback(normalized);
  }
  savedProjectsCache = normalized.sort((a,b) => b.updatedAt - a.updatedAt);
}
async function exportEnterpriseBackup() {
  try {
    if ($('#codeEditor')) syncPlaygroundBuffer();
    const savedProjects = await listSavedCodeProjects();
    const payload = typeof buildEnterpriseBackupPayload === 'function' ? await buildEnterpriseBackupPayload(savedProjects) : { format:'enterprise-educacional-backup', version:2, exportedAt:new Date().toISOString(), state, savedProjects };
    const date = new Date().toISOString().slice(0,10);
    downloadBlob(new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}), `epoch-education-backup-${date}.json`);
    showToast('Backup completo baixado.');
  } catch { showToast('Não foi possível gerar o backup.'); }
}
async function restoreEnterpriseBackup(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== 'enterprise-educacional-backup' || !payload.state || typeof payload.state !== 'object') throw new Error('Este arquivo não é um backup válido do Epoch Education.');
    if (!await eeConfirm('O progresso, notas, histórico e projetos salvos atuais deste navegador serão substituídos.', { title:'Restaurar backup?', confirmLabel:'Restaurar', tone:'danger' })) return;
    localStorage.setItem(storageKey, JSON.stringify(payload.state));
    localStorage.removeItem(legacyStorageKey);
    await replaceSavedCodeProjects(Array.isArray(payload.savedProjects) ? payload.savedProjects : []);
    showToast('Backup restaurado. Recarregando o site...');
    setTimeout(() => location.reload(), 550);
  } catch (error) { showToast(error?.message || 'Não foi possível restaurar o backup.'); }
}
function initDataPortability() {
  $('#importSavedCodeFiles')?.addEventListener('click', () => $('#savedCodeImportInput')?.click());
  $('#savedCodeImportInput')?.addEventListener('change', async event => { await importSavedCodeFiles(event.currentTarget.files); event.currentTarget.value = ''; });
  $('#exportDataBackup')?.addEventListener('click', exportEnterpriseBackup);
  $('#importDataBackup')?.addEventListener('click', () => $('#dataBackupInput')?.click());
  $('#dataBackupInput')?.addEventListener('change', async event => { await restoreEnterpriseBackup(event.currentTarget.files?.[0]); event.currentTarget.value = ''; });
}


function presetDisplayTitle(preset) {
  return preset?.title || String(preset?.label || 'Modelo').replace(/^[^·]+·\s*/, '');
}
function renderPresetPicker() {
  const container = $('#presetOptions');
  if (!container) return;
  const groups = ['Web', 'Python'];
  container.innerHTML = groups.map(group => {
    const items = Object.entries(playgroundPresets).filter(([, preset]) => preset.category === group);
    if (!items.length) return '';
    return `<section class="preset-group" aria-labelledby="presetGroup${group}"><div class="preset-group-title"><span id="presetGroup${group}">${group}</span><small>${items.length} modelo${items.length === 1 ? '' : 's'}</small></div><div class="preset-grid">${items.map(([id,preset]) => `<button class="preset-option" type="button" data-preset-id="${escapeAttr(id)}"><span class="preset-option-icon"><svg class="ui-icon" aria-hidden="true"><use href="#icon-${escapeAttr(preset.icon || (group === 'Python' ? 'python' : 'playground'))}"></use></svg></span><span class="preset-option-copy"><strong>${escapeHtml(presetDisplayTitle(preset))}</strong><small>${escapeHtml(preset.description || '')}</small></span><span class="preset-option-check" aria-hidden="true"><svg class="ui-icon"><use href="#icon-check"></use></svg></span></button>`).join('')}</div></section>`;
  }).join('');
  $$('.preset-option', container).forEach(button => button.addEventListener('click', () => choosePlaygroundPreset(button.dataset.presetId)));
  syncPresetPicker();
}
function syncPresetPicker() {
  const currentId = $('#playgroundPreset')?.value || state.playgroundPreset || 'default';
  const preset = playgroundPresets[currentId] || playgroundPresets.default;
  const label = $('#presetCurrentLabel');
  if (label) label.textContent = presetDisplayTitle(preset);
  $$('.preset-option').forEach(option => {
    const active = option.dataset.presetId === currentId;
    option.classList.toggle('active', active);
    option.setAttribute('aria-current', active ? 'true' : 'false');
  });
}
function setPresetMenu(open) {
  const trigger = $('#presetTrigger');
  const menu = $('#presetMenu');
  if (!trigger || !menu) return;
  trigger.setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
  $('#presetPicker')?.classList.toggle('open', open);
}
function choosePlaygroundPreset(id) {
  const select = $('#playgroundPreset');
  if (!select || !playgroundPresets[id]) return;
  if (select.value === id) { setPresetMenu(false); return; }
  select.value = id;
  select.dispatchEvent(new Event('change'));
}


/* Smart Playground editor -------------------------------------------------- */
let smartEditorDiagnostics = [];
let smartEditorDiagnosticTimer = 0;
let smartEditorAutocompleteItems = [];
let smartEditorAutocompleteIndex = 0;
let smartEditorFindMatches = [];
let smartEditorFindIndex = -1;
let smartEditorHoverTimer = 0;
let smartEditorHoverToken = '';

const SMART_EDITOR_VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const SMART_EDITOR_OPTIONAL_CLOSE_TAGS = new Set(['li','p','dt','dd','tr','td','th','option','thead','tbody','tfoot']);
const SMART_EDITOR_COMPLETIONS = {
  html: [
    ['html5','<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>$0</title>\n  </head>\n  <body>\n    \n  </body>\n</html>','Documento HTML completo','snippet'],
    ['div','div>$0</div>','Elemento genérico de bloco','tag'],['main','main>\n  $0\n</main>','Conteúdo principal','tag'],['section','section>\n  $0\n</section>','Seção temática','tag'],['article','article>\n  $0\n</article>','Conteúdo independente','tag'],['header','header>\n  $0\n</header>','Cabeçalho','tag'],['footer','footer>\n  $0\n</footer>','Rodapé','tag'],['nav','nav aria-label="$0">\n  \n</nav>','Navegação','tag'],['button','button type="button">$0</button>','Botão acessível','tag'],['a','a href="$0"></a>','Link','tag'],['img','img src="$0" alt="">','Imagem com texto alternativo','tag'],['form','form>\n  $0\n</form>','Formulário','tag'],['label','label for="$0"></label>','Rótulo de campo','tag'],['input','input id="$0" name="">','Campo de entrada','tag'],['ul','ul>\n  <li>$0</li>\n</ul>','Lista não ordenada','tag'],['h1','h1>$0</h1>','Título principal','tag'],['p','p>$0</p>','Parágrafo','tag']
  ],
  css: [
    ['display','display: $0;','Controla o tipo de caixa/layout','property'],['grid','display: grid;\n$0','Ativa CSS Grid','snippet'],['flex','display: flex;\n$0','Ativa Flexbox','snippet'],['gap','gap: $0;','Espaçamento entre itens','property'],['padding','padding: $0;','Espaçamento interno','property'],['margin','margin: $0;','Espaçamento externo','property'],['color','color: $0;','Cor do texto','property'],['background','background: $0;','Fundo do elemento','property'],['border','border: $0;','Borda','property'],['border-radius','border-radius: $0;','Arredondamento','property'],['width','width: $0;','Largura','property'],['height','height: $0;','Altura','property'],['min-height','min-height: $0;','Altura mínima','property'],['max-width','max-width: $0;','Largura máxima','property'],['font-size','font-size: $0;','Tamanho da fonte','property'],['font-family','font-family: $0;','Família tipográfica','property'],['position','position: $0;','Modo de posicionamento','property'],['align-items','align-items: $0;','Alinhamento no eixo transversal','property'],['justify-content','justify-content: $0;','Distribuição no eixo principal','property'],['grid-template-columns','grid-template-columns: $0;','Colunas do grid','property'],['@media','@media (max-width: $0) {\n  \n}','Media query responsiva','snippet']
  ],
  js: [
    ['const','const $0 = ;','Declara uma constante','keyword'],['let','let $0 = ;','Declara uma variável','keyword'],['if','if ($0) {\n  \n}','Bloco condicional','snippet'],['for','for (let i = 0; i < $0; i++) {\n  \n}','Loop for','snippet'],['forof','for (const item of $0) {\n  \n}','Loop sobre iteráveis','snippet'],['function','function $0() {\n  \n}','Declara uma função','snippet'],['arrow','const $0 = () => {\n  \n};','Função arrow','snippet'],['class','class $0 {\n  constructor() {\n    \n  }\n}','Classe JavaScript','snippet'],['console.log','console.log($0);','Escreve no console','method'],['querySelector','document.querySelector($0)','Seleciona o primeiro elemento compatível','method'],['querySelectorAll','document.querySelectorAll($0)','Seleciona todos os elementos compatíveis','method'],['addEventListener','addEventListener($0)','Registra um evento','method'],['map','map(($0) => )','Transforma itens de um array','method'],['filter','filter(($0) => )','Filtra itens de um array','method'],['reduce','reduce(($0) => , )','Reduz um array a um valor','method'],['fetch','fetch($0)','Faz uma requisição HTTP','function'],['async','async ','Declara função assíncrona','keyword'],['await','await ','Aguarda uma Promise','keyword'],['return','return $0;','Retorna um valor','keyword']
  ],
  python: [
    ['print','print($0)','Escreve uma saída','function'],['input','input($0)','Lê uma entrada do usuário','function'],['if','if $0:\n  ','Bloco condicional','snippet'],['elif','elif $0:\n  ','Condição adicional','snippet'],['else','else:\n  $0','Bloco alternativo','snippet'],['for','for item in $0:\n  ','Loop sobre um iterável','snippet'],['while','while $0:\n  ','Loop condicional','snippet'],['def','def $0():\n  ','Declara uma função','snippet'],['class','class $0:\n  def __init__(self):\n    ','Declara uma classe','snippet'],['listcomp','[$0 for item in itens]','List comprehension','snippet'],['range','range($0)','Gera uma sequência numérica','function'],['len','len($0)','Retorna o tamanho','function'],['enumerate','enumerate($0)','Itera com índice e valor','function'],['sum','sum($0)','Soma valores','function'],['sorted','sorted($0)','Retorna valores ordenados','function'],['return','return $0','Retorna um valor','keyword'],['try','try:\n  $0\nexcept Exception as erro:\n  print(erro)','Tratamento de erro','snippet'],['with','with open($0) as arquivo:\n  ','Gerenciador de contexto','snippet']
  ]
};

const SMART_EDITOR_DOCS = {
  html: {
    div:'Elemento genérico de bloco. Use elementos semânticos quando houver uma opção mais descritiva.',
    main:'Representa o conteúdo principal único da página.', section:'Agrupa uma seção temática do documento.', article:'Conteúdo independente que poderia existir fora do contexto atual.',
    nav:'Região destinada a links de navegação.', button:'Ação interativa. Em formulários, defina type para evitar submits acidentais.',
    a:'Cria um hyperlink. Use href para indicar o destino.', img:'Exibe uma imagem. O atributo alt descreve a imagem para acessibilidade.',
    input:'Campo de entrada. Associe-o a um label sempre que possível.', label:'Rótulo associado a um campo de formulário.'
  },
  css: {
    display:'Define como a caixa participa do layout. Valores comuns: block, flex, grid e none.',
    flex:'Atalho para flex-grow, flex-shrink e flex-basis.', grid:'Valor de display que ativa CSS Grid.', gap:'Define o espaço entre linhas/colunas de flex e grid.',
    padding:'Espaço interno entre o conteúdo e a borda.', margin:'Espaço externo ao redor do elemento.',
    'justify-content':'Distribui itens ao longo do eixo principal.', 'align-items':'Alinha itens no eixo transversal.',
    'grid-template-columns':'Define o tamanho e a quantidade de colunas do Grid.', position:'Define o método de posicionamento do elemento.'
  },
  js: {
    const:'Declara uma ligação que não pode ser reatribuída.', let:'Declara uma variável com escopo de bloco.',
    'console.log':'Mostra valores no console — útil para inspecionar o fluxo do programa.', 'document.querySelector':'Retorna o primeiro elemento que combina com um seletor CSS.',
    querySelector:'Retorna o primeiro elemento que combina com um seletor CSS.', addEventListener:'Registra uma função para responder a um evento.',
    map:'Cria um novo array transformando cada item.', filter:'Cria um novo array apenas com os itens que passam no teste.', reduce:'Combina os itens de um array em um único resultado.',
    fetch:'Inicia uma requisição de rede e retorna uma Promise.', async:'Permite usar await dentro de uma função e faz a função retornar uma Promise.', await:'Espera uma Promise resolver dentro de uma função async.'
  },
  python: {
    print:'Escreve valores na saída padrão.', input:'Lê uma linha da entrada padrão e retorna uma string.', len:'Retorna a quantidade de itens de um objeto.',
    range:'Cria uma sequência numérica usada com frequência em loops.', enumerate:'Produz pares de índice e valor ao iterar.', sum:'Soma os itens de um iterável.',
    def:'Inicia a definição de uma função. A linha deve terminar com dois-pontos (:).', class:'Inicia a definição de uma classe. A linha deve terminar com dois-pontos (:).',
    return:'Encerra a função e devolve um valor.', for:'Repete um bloco para cada item de um iterável.', if:'Executa um bloco apenas quando a condição é verdadeira.'
  }
};

function smartEditorLineCol(value, index) {
  const safe = clamp(Number(index) || 0, 0, value.length);
  const before = value.slice(0, safe);
  const linesBefore = before.split('\n');
  return { line: linesBefore.length, column: linesBefore.at(-1).length + 1 };
}
function smartEditorIndexAtLine(value, line) {
  if (line <= 1) return 0;
  let index = 0;
  for (let current = 1; current < line; current++) {
    const next = value.indexOf('\n', index);
    if (next < 0) return value.length;
    index = next + 1;
  }
  return index;
}
function smartEditorEscapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function smartEditorTokenClass(token, lang, nextText = '') {
  if (/^\/\*/.test(token) || /^\/\//.test(token) || (lang === 'python' && /^#/.test(token))) return 'tok-comment';
  if (/^["'`]/.test(token)) return 'tok-string';
  if (/^\d/.test(token)) return 'tok-number';
  const jsKeywords = new Set(['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','class','extends','new','this','try','catch','finally','throw','async','await','import','from','export','default','typeof','instanceof','in','of','true','false','null','undefined']);
  const pyKeywords = new Set(['and','as','assert','async','await','break','class','continue','def','del','elif','else','except','False','finally','for','from','global','if','import','in','is','lambda','None','nonlocal','not','or','pass','raise','return','True','try','while','with','yield']);
  const jsBuiltins = new Set(['console','document','window','Array','Object','String','Number','Boolean','Math','JSON','Date','Promise','Map','Set','fetch','localStorage','FormData']);
  const pyBuiltins = new Set(['print','input','len','range','enumerate','sum','min','max','sorted','round','str','int','float','bool','list','dict','set','tuple','zip','map','filter','open','super']);
  if (lang === 'js' && jsKeywords.has(token)) return 'tok-keyword';
  if (lang === 'python' && pyKeywords.has(token)) return 'tok-keyword';
  if (lang === 'js' && jsBuiltins.has(token)) return 'tok-built-in';
  if (lang === 'python' && pyBuiltins.has(token)) return 'tok-built-in';
  if (/^\s*\(/.test(nextText)) return 'tok-fn';
  return '';
}
function highlightGenericSource(code, lang) {
  const source = String(code || '');
  const pattern = lang === 'python'
    ? /#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b/g
    : /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\[\s\S]|[^\\`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;
  let output = '';
  let cursor = 0;
  let match;
  while ((match = pattern.exec(source))) {
    output += escapeHtml(source.slice(cursor, match.index));
    const token = match[0];
    const className = smartEditorTokenClass(token, lang, source.slice(pattern.lastIndex, pattern.lastIndex + 4));
    output += className ? `<span class="${className}">${escapeHtml(token)}</span>` : escapeHtml(token);
    cursor = pattern.lastIndex;
  }
  output += escapeHtml(source.slice(cursor));
  return output || ' ';
}
function highlightHtmlTag(tag) {
  if (/^<!--/.test(tag)) return `<span class="tok-comment">${escapeHtml(tag)}</span>`;
  const match = tag.match(/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/);
  if (!match) return escapeHtml(tag);
  const [, open, name, attrs, close] = match;
  let attrsOut = '';
  let cursor = 0;
  const attrPattern = /([:@A-Za-z_][\w:.-]*)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]+)?/g;
  let attr;
  while ((attr = attrPattern.exec(attrs))) {
    attrsOut += escapeHtml(attrs.slice(cursor, attr.index));
    attrsOut += `<span class="tok-attr">${escapeHtml(attr[1])}</span>`;
    if (attr[2]) attrsOut += escapeHtml(attr[2]);
    if (attr[3]) attrsOut += `<span class="tok-string">${escapeHtml(attr[3])}</span>`;
    cursor = attrPattern.lastIndex;
  }
  attrsOut += escapeHtml(attrs.slice(cursor));
  return `${escapeHtml(open)}<span class="tok-tag">${escapeHtml(name)}</span>${attrsOut}${escapeHtml(close)}`;
}
function highlightHtmlSource(code) {
  const source = String(code || '');
  const pattern = /<!--[\s\S]*?-->|<[^>]*>/g;
  let output = '';
  let cursor = 0;
  let match;
  while ((match = pattern.exec(source))) {
    output += escapeHtml(source.slice(cursor, match.index));
    output += highlightHtmlTag(match[0]);
    cursor = pattern.lastIndex;
  }
  output += escapeHtml(source.slice(cursor));
  return output || ' ';
}
function highlightCssAtoms(text) {
  const source = String(text || '');
  const pattern = /\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[0-9A-Fa-f]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|fr|deg)?\b|\b(?:var|calc|min|max|clamp|rgb|rgba|hsl|hsla|url)\b/g;
  let output = '', cursor = 0, match;
  while ((match = pattern.exec(source))) {
    output += escapeHtml(source.slice(cursor, match.index));
    const token = match[0];
    let cls = 'tok-number';
    if (/^\/\*/.test(token)) cls = 'tok-comment';
    else if (/^["']/.test(token) || /^#/.test(token)) cls = 'tok-string';
    else if (/^[A-Za-z]/.test(token)) cls = 'tok-built-in';
    output += `<span class="${cls}">${escapeHtml(token)}</span>`;
    cursor = pattern.lastIndex;
  }
  output += escapeHtml(source.slice(cursor));
  return output;
}
function highlightCssSource(code) {
  return String(code || '').split('\n').map(line => {
    const selectorAt = line.indexOf('{');
    if (selectorAt >= 0) {
      const before = line.slice(0, selectorAt);
      const after = line.slice(selectorAt + 1);
      return `<span class="tok-selector">${escapeHtml(before)}</span>{${highlightCssAtoms(after)}`;
    }
    const property = line.match(/^(\s*)(--?[\w-]+|[A-Za-z][\w-]*)(\s*:)([\s\S]*)$/);
    if (property) return `${escapeHtml(property[1])}<span class="tok-property">${escapeHtml(property[2])}</span>${escapeHtml(property[3])}${highlightCssAtoms(property[4])}`;
    return highlightCssAtoms(line);
  }).join('\n') || ' ';
}
function renderSmartEditorHighlight() {
  const editor = $('#codeEditor');
  const code = $('#codeHighlight code');
  if (!editor || !code) return;
  const value = editor.value;
  code.innerHTML = activeLang === 'html' ? highlightHtmlSource(value) : activeLang === 'css' ? highlightCssSource(value) : highlightGenericSource(value, activeLang);
  syncEditorGutterScroll();
}

function smartEditorStripStringsAndComments(code, lang) {
  const chars = [...String(code || '')];
  let quote = '', lineComment = false, blockComment = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], next = chars[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; else chars[i] = ' '; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { chars[i] = chars[i + 1] = ' '; i++; blockComment = false; } else if (ch !== '\n') chars[i] = ' '; continue; }
    if (quote) {
      if (ch === '\\') { chars[i] = ' '; if (i + 1 < chars.length && chars[i + 1] !== '\n') chars[++i] = ' '; continue; }
      if (ch === quote) { chars[i] = ' '; quote = ''; } else if (ch !== '\n') chars[i] = ' ';
      continue;
    }
    if (lang !== 'python' && ch === '/' && next === '/') { chars[i] = chars[i + 1] = ' '; i++; lineComment = true; continue; }
    if (lang !== 'python' && ch === '/' && next === '*') { chars[i] = chars[i + 1] = ' '; i++; blockComment = true; continue; }
    if (lang === 'python' && ch === '#') { chars[i] = ' '; lineComment = true; continue; }
    if (ch === '"' || ch === "'" || (lang === 'js' && ch === '`')) { quote = ch; chars[i] = ' '; }
  }
  return chars.join('');
}
function smartEditorBracketDiagnostics(code, lang) {
  const stripped = smartEditorStripStringsAndComments(code, lang);
  const opens = { '(':')', '[':']', '{':'}' };
  const closes = { ')':'(', ']':'[', '}':'{' };
  const stack = [];
  const diagnostics = [];
  for (let index = 0; index < stripped.length; index++) {
    const ch = stripped[index];
    if (opens[ch]) stack.push({ ch, index });
    else if (closes[ch]) {
      const last = stack.at(-1);
      if (!last || last.ch !== closes[ch]) {
        const pos = smartEditorLineCol(code, index);
        diagnostics.push({ severity:'error', line:pos.line, column:pos.column, message:`${ch} não possui uma abertura correspondente.`, explanation:`Há um ${ch} fechando um bloco que não foi aberto neste ponto. Remova o caractere extra ou confira o par de símbolos.`, fix:{ start:index, end:index + 1, text:'', label:`Remover ${ch}` } });
        break;
      }
      stack.pop();
    }
  }
  if (!diagnostics.length && stack.length) {
    const last = stack.at(-1);
    const close = opens[last.ch];
    const pos = smartEditorLineCol(code, last.index);
    diagnostics.push({ severity:'error', line:pos.line, column:pos.column, message:`Falta ${close} para fechar ${last.ch}.`, explanation:`O editor encontrou ${last.ch} nesta linha, mas não encontrou o ${close} correspondente até o fim do código.`, fix:{ start:code.length, end:code.length, text:close, label:`Adicionar ${close}` } });
  }
  return diagnostics;
}
function smartEditorHtmlDiagnostics(code) {
  const diagnostics = [];
  const stack = [];
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?\s*\/?>/g;
  let match;
  while ((match = tagPattern.exec(code))) {
    const raw = match[0];
    if (raw.startsWith('<!--') || raw.startsWith('<!')) continue;
    const tag = (match[1] || '').toLowerCase();
    const closing = /^<\//.test(raw);
    const selfClosing = /\/>$/.test(raw) || SMART_EDITOR_VOID_TAGS.has(tag);
    if (!closing && !selfClosing && !SMART_EDITOR_OPTIONAL_CLOSE_TAGS.has(tag)) stack.push({ tag, index:match.index });
    if (closing && !SMART_EDITOR_OPTIONAL_CLOSE_TAGS.has(tag)) {
      const last = stack.at(-1);
      if (!last || last.tag !== tag) {
        const pos = smartEditorLineCol(code, match.index);
        diagnostics.push({ severity:'error', line:pos.line, column:pos.column, message:`A tag </${tag}> não corresponde à tag aberta mais recente${last ? ` (<${last.tag}>)` : ''}.`, explanation:'Tags HTML aninhadas devem ser fechadas na ordem inversa em que foram abertas. Revise a estrutura ao redor desta linha.' });
        break;
      }
      stack.pop();
    }
  }
  if (!diagnostics.some(item => item.severity === 'error') && stack.length) {
    const last = stack.at(-1);
    const pos = smartEditorLineCol(code, last.index);
    diagnostics.push({ severity:'error', line:pos.line, column:pos.column, message:`A tag <${last.tag}> não foi fechada.`, explanation:`Esta tag foi aberta, mas o editor não encontrou </${last.tag}> depois dela.`, fix:{ start:code.length, end:code.length, text:`\n</${last.tag}>`, label:`Adicionar </${last.tag}>` } });
  }
  const imgPattern = /<img\b(?![^>]*\balt\s*=)[^>]*>/gi;
  while ((match = imgPattern.exec(code))) {
    const pos = smartEditorLineCol(code, match.index);
    const insertAt = match.index + match[0].lastIndexOf('>');
    diagnostics.push({ severity:'warning', line:pos.line, column:pos.column, message:'Imagem sem atributo alt.', explanation:'O atributo alt fornece uma alternativa textual para leitores de tela e para situações em que a imagem não carrega. Se a imagem for decorativa, use alt="".', fix:{ start:insertAt, end:insertAt, text:' alt=""', label:'Adicionar alt=""' } });
  }
  return diagnostics;
}
function smartEditorPythonDiagnostics(code) {
  const diagnostics = smartEditorBracketDiagnostics(code, 'python');
  const lines = code.split('\n');
  lines.forEach((line, index) => {
    const stripped = line.replace(/#.*$/, '').trimEnd();
    if (/^\s*(?:if|elif|for|while|def|class|with|except)\b/.test(stripped) && !/:\s*$/.test(stripped)) {
      const commentAt = line.indexOf('#');
      const insertAt = smartEditorIndexAtLine(code, index + 1) + (commentAt >= 0 ? line.slice(0, commentAt).trimEnd().length : line.trimEnd().length);
      diagnostics.push({ severity:'error', line:index + 1, column:Math.max(1, stripped.length), message:'Falta : no final desta estrutura Python.', explanation:'Em Python, linhas que iniciam blocos como if, for, while, def, class e with terminam com dois-pontos (:).', fix:{ start:insertAt, end:insertAt, text:':', label:'Adicionar :' } });
    }
    if (/^\s*(?:else|try|finally)\s*$/.test(stripped)) {
      const insertAt = smartEditorIndexAtLine(code, index + 1) + line.trimEnd().length;
      diagnostics.push({ severity:'error', line:index + 1, column:Math.max(1, stripped.length), message:'Falta : no final desta estrutura Python.', explanation:'else, try e finally também iniciam blocos indentados e precisam terminar com dois-pontos (:).', fix:{ start:insertAt, end:insertAt, text:':', label:'Adicionar :' } });
    }
    if (/^[ \t]*\t+[ ]+/.test(line) || /^[ ]+\t+/.test(line)) diagnostics.push({ severity:'warning', line:index + 1, column:1, message:'Indentação mistura tabs e espaços.', explanation:'Misturar tabs e espaços pode gerar erros de indentação difíceis de perceber. Use um único padrão; neste editor, Tab equivale a dois espaços.' });
  });
  const names = [...code.matchAll(/^\s*([A-Za-z_]\w*)\s*=(?!=)/gm)].map(match => ({ name:match[1], index:match.index }));
  names.slice(0, 40).forEach(item => {
    if (item.name.startsWith('_')) return;
    const count = (code.match(new RegExp(`\\b${smartEditorEscapeRegExp(item.name)}\\b`, 'g')) || []).length;
    if (count === 1) {
      const pos = smartEditorLineCol(code, item.index);
      diagnostics.push({ severity:'warning', line:pos.line, column:pos.column, message:`“${item.name}” foi definida, mas ainda não é usada.`, explanation:'Variáveis não usadas podem indicar código incompleto ou uma declaração que não é mais necessária.' });
    }
  });
  return diagnostics;
}
function smartEditorJsDiagnostics(code) {
  const diagnostics = smartEditorBracketDiagnostics(code, 'js');
  if (!diagnostics.some(item => item.severity === 'error')) {
    try { new Function(code); }
    catch (error) {
      if (error instanceof SyntaxError) {
        const stack = String(error.stack || '');
        const lineMatch = stack.match(/<anonymous>:(\d+):(\d+)/) || stack.match(/Function:(\d+):(\d+)/);
        const line = lineMatch ? Math.max(1, Number(lineMatch[1]) - 2) : 1;
        const column = lineMatch ? Number(lineMatch[2]) : 1;
        diagnostics.push({ severity:'error', line, column, message:`Erro de sintaxe: ${String(error.message || 'código inválido')}.`, explanation:'O JavaScript não conseguiu analisar o código. Confira símbolos, vírgulas, parênteses, chaves e a estrutura da instrução indicada.' });
      }
    }
  }
  const declarations = [...code.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)].map(match => ({ name:match[1], index:match.index }));
  declarations.slice(0, 50).forEach(item => {
    const count = (code.match(new RegExp(`\\b${smartEditorEscapeRegExp(item.name)}\\b`, 'g')) || []).length;
    if (count === 1) {
      const pos = smartEditorLineCol(code, item.index);
      diagnostics.push({ severity:'warning', line:pos.line, column:pos.column, message:`“${item.name}” foi declarada, mas não é usada.`, explanation:'Declarações não usadas podem ser removidas ou podem indicar que uma etapa da lógica ainda está faltando.' });
    }
  });
  return diagnostics;
}
function smartEditorCssDiagnostics(code) {
  const diagnostics = smartEditorBracketDiagnostics(code, 'css');
  let depth = 0;
  code.split('\n').forEach((line, index) => {
    const cleaned = line.replace(/\/\*.*?\*\//g, '');
    const beforeDepth = depth;
    depth += (cleaned.match(/{/g) || []).length - (cleaned.match(/}/g) || []).length;
    const trimmed = cleaned.trim();
    if (beforeDepth > 0 && trimmed && !/[{}]/.test(trimmed) && /;$/.test(trimmed) && !/:/.test(trimmed) && !trimmed.startsWith('@')) {
      diagnostics.push({ severity:'warning', line:index + 1, column:1, message:'Esta declaração CSS parece não ter “:”.', explanation:'Declarações CSS usam a forma propriedade: valor;. Exemplo: color: red;' });
    }
  });
  return diagnostics;
}
function runSmartEditorDiagnostics() {
  const editor = $('#codeEditor');
  if (!editor) return;
  const code = editor.value;
  let diagnostics = activeLang === 'html' ? smartEditorHtmlDiagnostics(code) : activeLang === 'css' ? smartEditorCssDiagnostics(code) : activeLang === 'python' ? smartEditorPythonDiagnostics(code) : smartEditorJsDiagnostics(code);
  const seen = new Set();
  smartEditorDiagnostics = diagnostics.filter(item => {
    const key = `${item.severity}|${item.line}|${item.column}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b) => (a.line - b.line) || (a.severity === 'error' ? -1 : 1)).slice(0, 30);
  renderSmartEditorProblems();
  updateEditorGutter();
}
function scheduleSmartEditorDiagnostics() {
  clearTimeout(smartEditorDiagnosticTimer);
  smartEditorDiagnosticTimer = setTimeout(runSmartEditorDiagnostics, 420);
}
function renderSmartEditorProblems() {
  const panel = $('#editorProblems');
  const list = $('#editorProblemsList');
  const summary = $('#editorProblemsSummary');
  const status = $('#editorProblemsStatus');
  if (!panel || !list || !summary || !status) return;
  const errors = smartEditorDiagnostics.filter(item => item.severity === 'error').length;
  const warnings = smartEditorDiagnostics.filter(item => item.severity === 'warning').length;
  summary.textContent = !smartEditorDiagnostics.length ? 'Nenhum problema detectado.' : `${errors} ${errors === 1 ? 'erro' : 'erros'} · ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}`;
  status.className = `editor-problems-status ${errors ? 'has-error' : warnings ? 'has-warning' : 'clean'}`;
  status.textContent = errors ? `● ${errors} ${errors === 1 ? 'erro' : 'erros'}${warnings ? ` · ${warnings} aviso${warnings > 1 ? 's' : ''}` : ''}` : warnings ? `▲ ${warnings} aviso${warnings > 1 ? 's' : ''}` : '✓ Sem problemas';
  if (!smartEditorDiagnostics.length) {
    list.innerHTML = '';
    panel.hidden = true;
    status.setAttribute('aria-expanded','false');
    return;
  }
  list.innerHTML = smartEditorDiagnostics.map((item, index) => `<div class="editor-problem-item ${item.severity}" data-problem-index="${index}"><span class="editor-problem-icon">${item.severity === 'error' ? '●' : '▲'}</span><div class="editor-problem-copy"><strong>Linha ${item.line}: ${escapeHtml(item.message)}</strong><p class="editor-problem-explanation" data-problem-explanation="${index}" hidden>${escapeHtml(item.explanation || 'Revise esta parte do código e compare a estrutura com o exemplo esperado para a linguagem.')}</p></div><div class="editor-problem-actions"><button type="button" data-problem-go="${index}">Ir para linha</button><button type="button" data-problem-explain="${index}">Explique este erro</button>${item.fix ? `<button type="button" data-problem-fix="${index}">${escapeHtml(item.fix.label || 'Corrigir')}</button>` : ''}</div></div>`).join('');
  const signature = smartEditorDiagnostics.filter(item => item.severity === 'error').map(item => `${item.line}:${item.message}`).join('|');
  if (errors && signature && panel.dataset.autoFor !== signature) {
    panel.dataset.autoFor = signature;
    panel.hidden = false;
    status.setAttribute('aria-expanded','true');
  }
}
function toggleSmartEditorProblems(force) {
  const panel = $('#editorProblems');
  const status = $('#editorProblemsStatus');
  if (!panel || !smartEditorDiagnostics.length) return;
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  status?.setAttribute('aria-expanded', String(open));
}
function goToSmartEditorDiagnostic(index) {
  const item = smartEditorDiagnostics[index];
  const editor = $('#codeEditor');
  if (!item || !editor) return;
  const start = smartEditorIndexAtLine(editor.value, item.line) + Math.max(0, (item.column || 1) - 1);
  editor.focus();
  editor.setSelectionRange(start, start);
  scrollSmartEditorToIndex(start);
  updateSmartEditorCursorUI();
}
function applySmartEditorFix(index) {
  const item = smartEditorDiagnostics[index];
  const editor = $('#codeEditor');
  if (!item?.fix || !editor) return;
  const { start, end, text } = item.fix;
  editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
  const caret = start + text.length;
  editor.setSelectionRange(caret, caret);
  editor.dispatchEvent(new Event('input', { bubbles:true }));
  editor.focus();
  flashAutosave('Correção aplicada');
  setTimeout(runSmartEditorDiagnostics, 30);
}

function smartEditorDetectedSymbols(code, lang) {
  const items = [];
  const add = (name, detail, kind='símbolo') => { if (name && !items.some(item => item.label === name)) items.push({ label:name, insert:name, detail, kind }); };
  if (lang === 'js') {
    for (const match of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(match[1], 'Variável deste código','variável');
    for (const match of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) add(match[1], 'Função deste código','função');
    for (const match of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) add(match[1], 'Classe deste código','classe');
  } else if (lang === 'python') {
    for (const match of code.matchAll(/^\s*([A-Za-z_]\w*)\s*=(?!=)/gm)) add(match[1], 'Variável deste código','variável');
    for (const match of code.matchAll(/^\s*def\s+([A-Za-z_]\w*)/gm)) add(match[1], 'Função deste código','função');
    for (const match of code.matchAll(/^\s*class\s+([A-Za-z_]\w*)/gm)) add(match[1], 'Classe deste código','classe');
  } else if (lang === 'css') {
    for (const match of code.matchAll(/(--[\w-]+)\s*:/g)) add(match[1], 'Variável CSS deste código','variável');
  }
  return items.slice(0, 30);
}
function smartEditorCompletionContext(editor) {
  const caret = editor.selectionStart;
  const before = editor.value.slice(0, caret);
  const match = before.match(/[A-Za-z_$][\w$.-]*$/);
  const prefix = match ? match[0] : '';
  return { caret, prefix, start: caret - prefix.length, before };
}
function smartEditorCompletionEntries() {
  const editor = $('#codeEditor');
  if (!editor) return [];
  const base = (SMART_EDITOR_COMPLETIONS[activeLang] || []).map(([label,insert,detail,kind]) => ({ label, insert, detail, kind }));
  return [...smartEditorDetectedSymbols(editor.value, activeLang), ...base];
}
function showSmartEditorAutocomplete(force = false) {
  const editor = $('#codeEditor');
  const box = $('#editorAutocomplete');
  if (!editor || !box || document.activeElement !== editor || editor.selectionStart !== editor.selectionEnd) return hideSmartEditorAutocomplete();
  const context = smartEditorCompletionContext(editor);
  const prefix = context.prefix.toLowerCase();
  if (!force && prefix.length < 2) return hideSmartEditorAutocomplete();
  const entries = smartEditorCompletionEntries();
  let filtered = entries.filter(item => !prefix || item.label.toLowerCase().startsWith(prefix) || item.label.toLowerCase().includes(prefix));
  if (activeLang === 'html' && prefix && /<\/?[^<>]*$/.test(context.before)) filtered = filtered.filter(item => item.kind === 'tag' || item.kind === 'snippet');
  const unique = [];
  const seen = new Set();
  filtered.forEach(item => { if (!seen.has(item.label)) { seen.add(item.label); unique.push(item); } });
  smartEditorAutocompleteItems = unique.slice(0, 12);
  smartEditorAutocompleteIndex = 0;
  if (!smartEditorAutocompleteItems.length) return hideSmartEditorAutocomplete();
  box.innerHTML = smartEditorAutocompleteItems.map((item,index) => `<button class="editor-suggestion${index === 0 ? ' active' : ''}" type="button" role="option" aria-selected="${index === 0}" data-suggestion-index="${index}"><span class="editor-suggestion-main"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail || '')}</small></span><span class="editor-suggestion-kind">${escapeHtml(item.kind || 'sugestão')}</span></button>`).join('');
  const position = smartEditorVisualPosition(editor.selectionStart);
  box.style.left = `${clamp(position.left, 8, Math.max(8, $('#editorCodeWrap').clientWidth - 372))}px`;
  box.style.top = `${clamp(position.top + position.lineHeight + 4, 8, Math.max(8, $('#editorCodeWrap').clientHeight - 210))}px`;
  box.hidden = false;
}
function hideSmartEditorAutocomplete() {
  const box = $('#editorAutocomplete');
  if (box) box.hidden = true;
  smartEditorAutocompleteItems = [];
  smartEditorAutocompleteIndex = 0;
}
function moveSmartEditorAutocomplete(delta) {
  const box = $('#editorAutocomplete');
  if (!box || box.hidden || !smartEditorAutocompleteItems.length) return false;
  smartEditorAutocompleteIndex = (smartEditorAutocompleteIndex + delta + smartEditorAutocompleteItems.length) % smartEditorAutocompleteItems.length;
  $$('.editor-suggestion', box).forEach((button,index) => {
    const active = index === smartEditorAutocompleteIndex;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    if (active) button.scrollIntoView({ block:'nearest' });
  });
  return true;
}
function acceptSmartEditorAutocomplete(index = smartEditorAutocompleteIndex) {
  const editor = $('#codeEditor');
  const item = smartEditorAutocompleteItems[index];
  if (!editor || !item) return false;
  const context = smartEditorCompletionContext(editor);
  const lineStart = editor.value.lastIndexOf('\n', context.start - 1) + 1;
  const baseIndent = (editor.value.slice(lineStart, context.start).match(/^\s*/) || [''])[0];
  let insert = item.insert || item.label;
  if (activeLang === 'html' && item.kind === 'tag' && !/<\/?[^<>]*$/.test(context.before)) insert = `<${insert}`;
  if (insert.includes('\n')) insert = insert.split('\n').map((line,i) => i ? baseIndent + line : line).join('\n');
  const marker = insert.indexOf('$0');
  insert = insert.replace('$0','');
  editor.value = editor.value.slice(0, context.start) + insert + editor.value.slice(context.caret);
  const caret = context.start + (marker >= 0 ? marker : insert.length);
  editor.setSelectionRange(caret, caret);
  hideSmartEditorAutocomplete();
  editor.dispatchEvent(new Event('input', { bubbles:true }));
  editor.focus();
  updateSmartEditorCursorUI();
  return true;
}

function smartEditorGeometry() {
  const editor = $('#codeEditor');
  const pane = $('.editor-pane');
  if (!editor || !pane) return { lineHeight:24.5, charWidth:8.45, padX:22, padY:24 };
  const css = getComputedStyle(pane);
  return {
    lineHeight: parseFloat(css.getPropertyValue('--editor-line-height')) || 24.5,
    charWidth: parseFloat(css.getPropertyValue('--editor-char-width')) || 8.45,
    padX: parseFloat(css.getPropertyValue('--editor-pad-x')) || 22,
    padY: parseFloat(css.getPropertyValue('--editor-pad-y')) || 24
  };
}
function updateSmartEditorCharWidth() {
  const editor = $('#codeEditor');
  const pane = $('.editor-pane');
  if (!editor || !pane) return;
  const style = getComputedStyle(editor);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = ctx.measureText('M').width || 8.45;
  pane.style.setProperty('--editor-char-width', `${width}px`);
}
function smartEditorVisualPosition(index) {
  const editor = $('#codeEditor');
  if (!editor) return { left:0, top:0, lineHeight:24.5, charWidth:8.45 };
  const { line, column } = smartEditorLineCol(editor.value, index);
  const geo = smartEditorGeometry();
  return { left:geo.padX + (column - 1) * geo.charWidth - editor.scrollLeft, top:geo.padY + (line - 1) * geo.lineHeight - editor.scrollTop, lineHeight:geo.lineHeight, charWidth:geo.charWidth };
}
function scrollSmartEditorToIndex(index) {
  const editor = $('#codeEditor');
  if (!editor) return;
  const { line, column } = smartEditorLineCol(editor.value, index);
  const geo = smartEditorGeometry();
  const targetY = geo.padY + (line - 1) * geo.lineHeight;
  const targetX = geo.padX + (column - 1) * geo.charWidth;
  editor.scrollTop = clamp(targetY - editor.clientHeight * .45, 0, Math.max(0, editor.scrollHeight - editor.clientHeight));
  editor.scrollLeft = clamp(targetX - editor.clientWidth * .55, 0, Math.max(0, editor.scrollWidth - editor.clientWidth));
  syncEditorGutterScroll();
}
function smartEditorFindMatchingBracket(value, index) {
  const pairs = { '(':')', '[':']', '{':'}', ')':'(', ']':'[', '}':'{' };
  const ch = value[index];
  if (!pairs[ch]) return -1;
  const forward = '([{'.includes(ch);
  const open = forward ? ch : pairs[ch];
  const close = forward ? pairs[ch] : ch;
  let depth = 0;
  for (let i = index; forward ? i < value.length : i >= 0; i += forward ? 1 : -1) {
    const current = value[i];
    if (current === open) depth += forward ? 1 : -1;
    if (current === close) depth += forward ? -1 : 1;
    if (depth === 0 && i !== index) return i;
  }
  return -1;
}
function addSmartEditorMarker(index, length, className) {
  const layer = $('#editorMarkerLayer');
  if (!layer) return;
  const pos = smartEditorVisualPosition(index);
  if (pos.top + pos.lineHeight < 0 || pos.top > layer.clientHeight) return;
  const marker = document.createElement('span');
  marker.className = className;
  marker.style.left = `${pos.left}px`;
  marker.style.top = `${pos.top}px`;
  marker.style.width = `${Math.max(pos.charWidth, pos.charWidth * length)}px`;
  layer.appendChild(marker);
}
function updateSmartEditorMarkers() {
  const editor = $('#codeEditor');
  const layer = $('#editorMarkerLayer');
  if (!editor || !layer) return;
  layer.innerHTML = '';
  const geo = smartEditorGeometry();
  const lines = editor.value.split('\n');
  const firstVisible = Math.max(0, Math.floor((editor.scrollTop - geo.padY) / geo.lineHeight));
  const lastVisible = Math.min(lines.length - 1, Math.ceil((editor.scrollTop + editor.clientHeight) / geo.lineHeight));
  for (let lineIndex = firstVisible; lineIndex <= lastVisible; lineIndex++) {
    const leading = (lines[lineIndex].match(/^[ \t]*/) || [''])[0].replace(/\t/g, '  ').length;
    const levels = Math.min(8, Math.floor(leading / 2));
    for (let level = 1; level <= levels; level++) {
      const guide = document.createElement('span');
      guide.className = 'editor-indent-guide';
      guide.style.left = `${geo.padX + level * 2 * geo.charWidth - editor.scrollLeft}px`;
      guide.style.top = `${geo.padY + lineIndex * geo.lineHeight - editor.scrollTop}px`;
      layer.appendChild(guide);
    }
  }
  const diagnosticLines = new Map();
  smartEditorDiagnostics.forEach(item => {
    const current = diagnosticLines.get(item.line);
    if (!current || item.severity === 'error') diagnosticLines.set(item.line, item.severity);
  });
  diagnosticLines.forEach((severity, line) => {
    const top = smartEditorVisualPosition(smartEditorIndexAtLine(editor.value, line)).top;
    if (top + smartEditorGeometry().lineHeight < 0 || top > layer.clientHeight) return;
    const marker = document.createElement('span');
    marker.className = `editor-diagnostic-line-marker ${severity}`;
    marker.style.top = `${top}px`;
    layer.appendChild(marker);
  });
  const start = editor.selectionStart, end = editor.selectionEnd;
  if (start === end) {
    let bracketIndex = -1;
    if ('()[]{}'.includes(editor.value[start] || '')) bracketIndex = start;
    else if (start > 0 && '()[]{}'.includes(editor.value[start - 1] || '')) bracketIndex = start - 1;
    if (bracketIndex >= 0) {
      const match = smartEditorFindMatchingBracket(editor.value, bracketIndex);
      addSmartEditorMarker(bracketIndex, 1, 'editor-bracket-marker');
      if (match >= 0) addSmartEditorMarker(match, 1, 'editor-bracket-marker');
    }
  } else {
    const selected = editor.value.slice(start, end);
    if (/^[A-Za-z_$][\w$-]*$/.test(selected) && selected.length > 1) {
      const regex = new RegExp(`\\b${smartEditorEscapeRegExp(selected)}\\b`, 'g');
      let match, count = 0;
      while ((match = regex.exec(editor.value)) && count < 80) { addSmartEditorMarker(match.index, selected.length, 'editor-occurrence-marker'); count++; }
    }
  }
}
function updateSmartEditorCursorUI() {
  const editor = $('#codeEditor');
  if (!editor) return;
  const pos = smartEditorLineCol(editor.value, editor.selectionStart);
  const status = $('#editorCursorStatus');
  if (status) status.textContent = `Ln ${pos.line}, Col ${pos.column}`;
  const activeLine = $('#editorActiveLine');
  if (activeLine) {
    const visual = smartEditorVisualPosition(smartEditorIndexAtLine(editor.value, pos.line));
    activeLine.style.transform = `translateY(${visual.top}px)`;
  }
  updateSmartEditorGutterState(pos.line);
  updateSmartEditorMarkers();
}
function updateSmartEditorGutterState(activeLine) {
  const gutter = $('#editorGutter');
  if (!gutter) return;
  const severityByLine = new Map();
  smartEditorDiagnostics.forEach(item => {
    const previous = severityByLine.get(item.line);
    if (!previous || item.severity === 'error') severityByLine.set(item.line, item.severity);
  });
  [...gutter.children].forEach((span,index) => {
    const line = index + 1;
    span.classList.toggle('active', line === activeLine);
    span.classList.toggle('error', severityByLine.get(line) === 'error');
    span.classList.toggle('warning', severityByLine.get(line) === 'warning');
  });
}

function smartEditorWordAtIndex(value, index) {
  const isWord = char => /[A-Za-z0-9_$.-]/.test(char || '');
  let start = clamp(index, 0, value.length), end = start;
  while (start > 0 && isWord(value[start - 1])) start--;
  while (end < value.length && isWord(value[end])) end++;
  return { word:value.slice(start, end).replace(/^\.+|\.+$/g,''), start, end };
}
function smartEditorIndexFromMouse(event) {
  const editor = $('#codeEditor');
  if (!editor) return 0;
  const rect = editor.getBoundingClientRect();
  const geo = smartEditorGeometry();
  const x = event.clientX - rect.left + editor.scrollLeft - geo.padX;
  const y = event.clientY - rect.top + editor.scrollTop - geo.padY;
  const line = Math.max(0, Math.floor(y / geo.lineHeight));
  const column = Math.max(0, Math.round(x / geo.charWidth));
  const lines = editor.value.split('\n');
  const safeLine = Math.min(line, lines.length - 1);
  let index = 0;
  for (let i = 0; i < safeLine; i++) index += lines[i].length + 1;
  return index + Math.min(column, lines[safeLine]?.length || 0);
}
function hideSmartEditorHoverDoc() {
  clearTimeout(smartEditorHoverTimer);
  smartEditorHoverToken = '';
  const tooltip = $('#editorHoverDoc');
  if (tooltip) tooltip.hidden = true;
}
function scheduleSmartEditorHover(event) {
  clearTimeout(smartEditorHoverTimer);
  const editor = $('#codeEditor');
  const tooltip = $('#editorHoverDoc');
  if (!editor || !tooltip || !$('#editorAutocomplete')?.hidden) return;
  const index = smartEditorIndexFromMouse(event);
  const token = smartEditorWordAtIndex(editor.value, index).word;
  const docs = SMART_EDITOR_DOCS[activeLang] || {};
  const direct = docs[token] || docs[token.split('.').at(-1)] || (activeLang === 'js' && token.includes('console.log') ? docs['console.log'] : '');
  if (!direct) return hideSmartEditorHoverDoc();
  smartEditorHoverToken = token;
  const wrapRect = $('#editorCodeWrap').getBoundingClientRect();
  const left = clamp(event.clientX - wrapRect.left + 10, 8, Math.max(8, wrapRect.width - 332));
  const top = clamp(event.clientY - wrapRect.top + 18, 8, Math.max(8, wrapRect.height - 100));
  smartEditorHoverTimer = setTimeout(() => {
    if (smartEditorHoverToken !== token) return;
    tooltip.innerHTML = `<strong>${escapeHtml(token)}</strong>${escapeHtml(direct)}`;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.hidden = false;
  }, 450);
}

function openSmartEditorFind() {
  const bar = $('#editorFindbar');
  const input = $('#editorFindInput');
  const editor = $('#codeEditor');
  if (!bar || !input || !editor) return;
  bar.hidden = false;
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (selected && !selected.includes('\n')) input.value = selected;
  input.focus();
  input.select();
  updateSmartEditorFind();
}
function closeSmartEditorFind() {
  const bar = $('#editorFindbar');
  if (bar) bar.hidden = true;
  $('#codeEditor')?.focus();
}
function updateSmartEditorFind() {
  const editor = $('#codeEditor');
  const input = $('#editorFindInput');
  const count = $('#editorFindCount');
  if (!editor || !input || !count) return;
  const query = input.value;
  smartEditorFindMatches = [];
  smartEditorFindIndex = -1;
  if (query) {
    const haystack = editor.value.toLocaleLowerCase('pt-BR');
    const needle = query.toLocaleLowerCase('pt-BR');
    let cursor = 0;
    while ((cursor = haystack.indexOf(needle, cursor)) >= 0 && smartEditorFindMatches.length < 500) { smartEditorFindMatches.push(cursor); cursor += Math.max(1, needle.length); }
  }
  count.textContent = smartEditorFindMatches.length ? `1/${smartEditorFindMatches.length}` : '0/0';
  if (smartEditorFindMatches.length) { smartEditorFindIndex = 0; selectSmartEditorFindMatch(); }
}
function selectSmartEditorFindMatch() {
  const editor = $('#codeEditor');
  const input = $('#editorFindInput');
  if (!editor || !input || smartEditorFindIndex < 0 || !smartEditorFindMatches.length) return;
  const start = smartEditorFindMatches[smartEditorFindIndex];
  editor.focus({ preventScroll:true });
  editor.setSelectionRange(start, start + input.value.length);
  scrollSmartEditorToIndex(start);
  $('#editorFindCount').textContent = `${smartEditorFindIndex + 1}/${smartEditorFindMatches.length}`;
  input.focus({ preventScroll:true });
}
function navigateSmartEditorFind(delta) {
  if (!smartEditorFindMatches.length) return;
  smartEditorFindIndex = (smartEditorFindIndex + delta + smartEditorFindMatches.length) % smartEditorFindMatches.length;
  selectSmartEditorFindMatch();
}

function setSmartEditorValue(value, message = 'Código atualizado') {
  const editor = $('#codeEditor');
  if (!editor) return;
  editor.value = value;
  editor.dispatchEvent(new Event('input', { bubbles:true }));
  editor.focus();
  flashAutosave(message);
}
function toggleSmartEditorComment() {
  const editor = $('#codeEditor');
  if (!editor) return;
  const start = editor.selectionStart, end = editor.selectionEnd;
  if (activeLang === 'html' || activeLang === 'css') {
    const open = activeLang === 'html' ? '<!--' : '/*';
    const close = activeLang === 'html' ? '-->' : '*/';
    const selected = editor.value.slice(start, end || start);
    const before = editor.value.slice(0,start), after = editor.value.slice(end || start);
    if (selected.startsWith(open) && selected.endsWith(close)) {
      editor.value = before + selected.slice(open.length, -close.length) + after;
      editor.setSelectionRange(start, start + selected.length - open.length - close.length);
    } else {
      editor.value = before + open + selected + close + after;
      editor.setSelectionRange(start + open.length, start + open.length + selected.length);
    }
  } else {
    const prefix = activeLang === 'python' ? '# ' : '// ';
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = editor.value.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = editor.value.length;
    const block = editor.value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nonEmpty = lines.filter(line => line.trim());
    const allCommented = nonEmpty.length && nonEmpty.every(line => line.trimStart().startsWith(prefix.trim()));
    const changed = lines.map(line => {
      if (!line.trim()) return line;
      const indent = (line.match(/^\s*/) || [''])[0];
      const rest = line.slice(indent.length);
      if (allCommented) return indent + rest.replace(new RegExp(`^${smartEditorEscapeRegExp(prefix.trim())}\\s?`), '');
      return indent + prefix + rest;
    }).join('\n');
    editor.value = editor.value.slice(0,lineStart) + changed + editor.value.slice(lineEnd);
    editor.setSelectionRange(lineStart, lineStart + changed.length);
  }
  editor.dispatchEvent(new Event('input', { bubbles:true }));
}
function indentSmartEditorSelection(unindent = false) {
  const editor = $('#codeEditor');
  if (!editor) return;
  const start = editor.selectionStart, end = editor.selectionEnd;
  if (start !== end) {
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = editor.value.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = editor.value.length;
    const block = editor.value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    let deltaStart = 0, deltaEnd = 0;
    const changed = lines.map((line,index) => {
      if (unindent) {
        const remove = line.startsWith('  ') ? 2 : line.startsWith('\t') ? 1 : line.startsWith(' ') ? 1 : 0;
        if (index === 0) deltaStart -= Math.min(remove, Math.max(0, start - lineStart));
        deltaEnd -= remove;
        return line.slice(remove);
      }
      if (index === 0) deltaStart += 2;
      deltaEnd += 2;
      return `  ${line}`;
    }).join('\n');
    editor.value = editor.value.slice(0,lineStart) + changed + editor.value.slice(lineEnd);
    editor.setSelectionRange(Math.max(lineStart, start + deltaStart), Math.max(lineStart, end + deltaEnd));
  } else if (unindent) {
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    const before = editor.value.slice(lineStart, Math.min(lineStart + 2, editor.value.length));
    const remove = before.startsWith('  ') ? 2 : before.startsWith('\t') ? 1 : before.startsWith(' ') ? 1 : 0;
    if (remove) {
      editor.value = editor.value.slice(0,lineStart) + editor.value.slice(lineStart + remove);
      editor.setSelectionRange(Math.max(lineStart,start - remove), Math.max(lineStart,start - remove));
    }
  } else {
    editor.value = editor.value.slice(0,start) + '  ' + editor.value.slice(end);
    editor.setSelectionRange(start + 2, start + 2);
  }
  editor.dispatchEvent(new Event('input', { bubbles:true }));
}
function handleSmartEditorPairKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const editor = event.currentTarget;
  const pairs = { '(':')', '[':']', '{':'}', '"':'"', "'":"'" };
  const closings = new Set(Object.values(pairs));
  const key = event.key;
  const start = editor.selectionStart, end = editor.selectionEnd;
  if (pairs[key]) {
    if ((key === '"' || key === "'") && editor.value[start] === key && start === end) {
      event.preventDefault(); editor.setSelectionRange(start + 1,start + 1); return true;
    }
    event.preventDefault();
    const selected = editor.value.slice(start,end);
    const insert = key + selected + pairs[key];
    editor.value = editor.value.slice(0,start) + insert + editor.value.slice(end);
    if (start !== end) editor.setSelectionRange(start + 1, start + 1 + selected.length);
    else editor.setSelectionRange(start + 1,start + 1);
    editor.dispatchEvent(new Event('input', { bubbles:true }));
    return true;
  }
  if (closings.has(key) && start === end && editor.value[start] === key) {
    event.preventDefault(); editor.setSelectionRange(start + 1,start + 1); updateSmartEditorCursorUI(); return true;
  }
  if (key === 'Backspace' && start === end && start > 0) {
    const prev = editor.value[start - 1], next = editor.value[start];
    if (pairs[prev] === next) {
      event.preventDefault();
      editor.value = editor.value.slice(0,start - 1) + editor.value.slice(start + 1);
      editor.setSelectionRange(start - 1,start - 1);
      editor.dispatchEvent(new Event('input', { bubbles:true }));
      return true;
    }
  }
  return false;
}
function handleSmartEditorHtmlClose(event) {
  if (activeLang !== 'html' || event.key !== '>' || event.ctrlKey || event.metaKey || event.altKey) return false;
  const editor = event.currentTarget;
  if (editor.selectionStart !== editor.selectionEnd) return false;
  const caret = editor.selectionStart;
  const before = editor.value.slice(0, caret);
  const match = before.match(/<([A-Za-z][\w:-]*)(?:\s[^<>]*)?$/);
  if (!match) return false;
  const tag = match[1].toLowerCase();
  if (SMART_EDITOR_VOID_TAGS.has(tag) || /\/\s*$/.test(match[0])) return false;
  event.preventDefault();
  const insert = `></${tag}>`;
  editor.value = editor.value.slice(0,caret) + insert + editor.value.slice(caret);
  editor.setSelectionRange(caret + 1, caret + 1);
  editor.dispatchEvent(new Event('input', { bubbles:true }));
  return true;
}
function smartEditorCountStructure(line, openChar, closeChar) {
  const cleaned = smartEditorStripStringsAndComments(line, activeLang);
  return (cleaned.match(new RegExp(`\\${openChar}`,'g')) || []).length - (cleaned.match(new RegExp(`\\${closeChar}`,'g')) || []).length;
}
function formatSmartEditorCode() {
  const editor = $('#codeEditor');
  if (!editor) return;
  savePlaygroundSnapshot('Antes de formatar');
  const original = editor.value;
  let formatted;
  if (activeLang === 'python') {
    formatted = original.split('\n').map(line => line.replace(/^\t+/, tabs => '  '.repeat(tabs.length)).replace(/[ \t]+$/,'')).join('\n');
  } else if (activeLang === 'html') {
    let depth = 0;
    formatted = original.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const closing = /^<\//.test(trimmed);
      if (closing) depth = Math.max(0, depth - 1);
      const result = `${'  '.repeat(depth)}${trimmed}`;
      const openMatch = trimmed.match(/^<([A-Za-z][\w:-]*)\b[^>]*>/);
      const sameLineClose = openMatch && new RegExp(`</${smartEditorEscapeRegExp(openMatch[1])}>`, 'i').test(trimmed);
      const selfClosing = /\/>/.test(trimmed) || (openMatch && SMART_EDITOR_VOID_TAGS.has(openMatch[1].toLowerCase()));
      if (openMatch && !sameLineClose && !selfClosing && !closing && !SMART_EDITOR_OPTIONAL_CLOSE_TAGS.has(openMatch[1].toLowerCase())) depth++;
      return result;
    }).join('\n');
  } else {
    let depth = 0;
    formatted = original.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const startsClose = /^[}\]]/.test(trimmed);
      if (startsClose) depth = Math.max(0, depth - 1);
      const result = `${'  '.repeat(depth)}${trimmed.replace(/[ \t]+$/,'')}`;
      const structural = smartEditorStripStringsAndComments(trimmed, activeLang);
      const opens = (structural.match(/{/g) || []).length;
      const closes = (structural.match(/}/g) || []).length;
      depth = Math.max(0, depth + opens - closes + (startsClose ? 1 : 0));
      return result;
    }).join('\n');
  }
  if (formatted === original) { flashAutosave('Código já está organizado'); return; }
  editor.value = formatted;
  editor.dispatchEvent(new Event('input', { bubbles:true }));
  flashAutosave('Código formatado');
}
function handleSmartEditorEnter(event) {
  if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const editor = event.currentTarget;
  const start = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
  const line = editor.value.slice(lineStart, start);
  const baseIndent = (line.match(/^\s*/) || [''])[0];
  const prev = editor.value[start - 1], next = editor.value[start];
  const isPair = ({'{':'}','[':']','(':')'})[prev] === next;
  const shouldIndent = activeLang === 'python' ? /:\s*(#.*)?$/.test(line) : /[\{\[\(]\s*$/.test(line);
  if (!baseIndent && !shouldIndent && !isPair) return false;
  event.preventDefault();
  if (isPair) {
    const inner = baseIndent + '  ';
    const insert = `\n${inner}\n${baseIndent}`;
    editor.value = editor.value.slice(0,start) + insert + editor.value.slice(editor.selectionEnd);
    editor.setSelectionRange(start + 1 + inner.length, start + 1 + inner.length);
  } else {
    const indent = baseIndent + (shouldIndent ? '  ' : '');
    editor.value = editor.value.slice(0,start) + '\n' + indent + editor.value.slice(editor.selectionEnd);
    editor.setSelectionRange(start + 1 + indent.length, start + 1 + indent.length);
  }
  editor.dispatchEvent(new Event('input', { bubbles:true }));
  return true;
}
function refreshSmartEditor({ autocomplete = false, diagnostics = true } = {}) {
  renderSmartEditorHighlight();
  updateSmartEditorCharWidth();
  updateSmartEditorCursorUI();
  if (diagnostics) scheduleSmartEditorDiagnostics();
  if (autocomplete) setTimeout(() => showSmartEditorAutocomplete(false), 0);
}


function initPlayground() {
  const presetSelect = $('#playgroundPreset');
  presetSelect.innerHTML = Object.entries(playgroundPresets).map(([id, preset]) => `<option value="${id}">${escapeHtml(preset.label)}</option>`).join('');
  if (state.playgroundPreset && playgroundPresets[state.playgroundPreset]) presetSelect.value = state.playgroundPreset;
  else presetSelect.value = 'default';
  renderPresetPicker();
  renderPlaygroundHistory();
  syncSavedProjectStatus();
  $('#savePlaygroundProject')?.addEventListener('click', () => openSaveCodeDialog(false));
  $('#openSavedCodes')?.addEventListener('click', openSavedCodesDialog);
  $('#savedProjectStatus')?.addEventListener('click', openSavedCodesDialog);
  $('#closeSaveCodeDialog')?.addEventListener('click', closeSaveCodeDialog);
  $('#cancelSaveCode')?.addEventListener('click', closeSaveCodeDialog);
  $('#saveCodeForm')?.addEventListener('submit', event => { event.preventDefault(); saveCodeFromDialog({ asNew:false }); });
  $('#saveCodeAsNew')?.addEventListener('click', () => saveCodeFromDialog({ asNew:true }));
  $('#closeSavedCodesDialog')?.addEventListener('click', () => $('#savedCodesDialog')?.close());
  $('#newSavedCodeFromLibrary')?.addEventListener('click', () => { $('#savedCodesDialog')?.close(); openSaveCodeDialog(false); });
  $('#savedCodesSearch')?.addEventListener('input', event => renderSavedCodeProjects(event.currentTarget.value));
  $('#savedCodesList')?.addEventListener('click', handleSavedCodeLibraryAction);
  $('#playgroundHistoryToggle')?.addEventListener('click', () => setPlaygroundHistoryOpen($('#playgroundHistoryToggle').getAttribute('aria-expanded') !== 'true'));
  $('#clearPlaygroundHistory')?.addEventListener('click', async () => {
    if (!(state.playgroundHistory || []).length) return;
    if (!await eeConfirm('As versões salvas automaticamente no Histórico do Playground serão apagadas.', { title:'Limpar histórico?', confirmLabel:'Limpar histórico', tone:'danger' })) return;
    state.playgroundHistory = []; saveState(); renderPlaygroundHistory();
  });
  $('#presetTrigger')?.addEventListener('click', event => {
    event.stopPropagation();
    setPresetMenu($('#presetTrigger').getAttribute('aria-expanded') !== 'true');
  });
  $('#presetMenu')?.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', event => {
    if (!$('#presetPicker')?.contains(event.target)) setPresetMenu(false);
    const historyPanel = $('#playgroundHistoryPanel');
    const historyToggle = $('#playgroundHistoryToggle');
    if (historyPanel && !historyPanel.hidden && !historyPanel.contains(event.target) && !historyToggle?.contains(event.target)) setPlaygroundHistoryOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#presetTrigger')?.getAttribute('aria-expanded') === 'true') {
      setPresetMenu(false);
      $('#presetTrigger')?.focus();
    }
    if (event.key === 'Escape' && $('#playgroundHistoryToggle')?.getAttribute('aria-expanded') === 'true') {
      setPlaygroundHistoryOpen(false);
      $('#playgroundHistoryToggle')?.focus();
    }
  });
  pg = { ...defaultPlayground, ...(state.playground || {}) };
  activeLang = ['html','css','js','python'].includes(state.playgroundLang) ? state.playgroundLang : 'html';
  syncEditorTabs();
  $('#workbench')?.style.setProperty('--split', `${state.playgroundSplit || 55}%`);
  if ($('#pythonStdin')) $('#pythonStdin').value = state.pythonStdin || '';
  syncEditorMode();
  updateEditor();
  applyConsoleState();
  if (activeLang === 'python') preparePythonPane(); else runWebPlayground();

  $$('#editorTabs button').forEach(button => button.addEventListener('click', () => selectEditorTab(button.dataset.lang)));
  $('#editorTabs')?.addEventListener('keydown', event => {
    const tabs = $('#editorTabs button');
    const focusedIndex = tabs.indexOf(event.target.closest('button'));
    const selectedIndex = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    const index = focusedIndex >= 0 ? focusedIndex : Math.max(0, selectedIndex);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      event.preventDefault();
      tabs[next].focus();
      selectEditorTab(tabs[next].dataset.lang);
    }
  });

  $('#codeEditor').addEventListener('input', () => {
    pg[activeLang] = $('#codeEditor').value;
    state.playground = { ...pg };
    state.playgroundLang = activeLang;
    saveState();
    updateEditorMetrics();
    updateEditorGutter();
    syncPythonStdinVisibility();
    refreshSmartEditor({ autocomplete:true, diagnostics:true });
    if (!$('#editorFindbar')?.hidden) updateSmartEditorFind();
    flashAutosave();
    savePlaygroundRecoveryDraft();
    clearTimeout(window.__eePlaygroundHistoryTimer);
    window.__eePlaygroundHistoryTimer = setTimeout(() => savePlaygroundSnapshot('Edição automática'), 12000);
  });
  $('#codeEditor').addEventListener('scroll', () => {
    syncEditorGutterScroll();
    updateSmartEditorCursorUI();
    hideSmartEditorAutocomplete();
    hideSmartEditorHoverDoc();
  });
  $('#codeEditor').addEventListener('click', () => { updateSmartEditorCursorUI(); hideSmartEditorAutocomplete(); });
  $('#codeEditor').addEventListener('keyup', event => {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Shift','Control','Meta','Alt'].includes(event.key)) return;
    updateSmartEditorCursorUI();
  });
  $('#codeEditor').addEventListener('select', updateSmartEditorCursorUI);
  $('#codeEditor').addEventListener('mousemove', scheduleSmartEditorHover);
  $('#codeEditor').addEventListener('mouseleave', hideSmartEditorHoverDoc);
  $('#codeEditor').addEventListener('keydown', event => {
    const textarea = event.currentTarget;
    hideSmartEditorHoverDoc();

    if (!$('#editorAutocomplete')?.hidden) {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSmartEditorAutocomplete(1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveSmartEditorAutocomplete(-1); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); acceptSmartEditorAutocomplete(); return; }
      if (event.key === 'Escape') { event.preventDefault(); hideSmartEditorAutocomplete(); return; }
    }
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      showSmartEditorAutocomplete(true);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      openSmartEditorFind();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      toggleSmartEditorComment();
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      formatSmartEditorCode();
      return;
    }
    if (handleSmartEditorPairKey(event)) return;
    if (handleSmartEditorHtmlClose(event)) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      indentSmartEditorSelection(event.shiftKey);
      return;
    }
    if (handleSmartEditorEnter(event)) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      runPlayground();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      quickSaveCurrentProject();
    }
  });

  $('#formatCode')?.addEventListener('click', formatSmartEditorCode);
  $('#editorFindInput')?.addEventListener('input', updateSmartEditorFind);
  $('#editorFindInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); navigateSmartEditorFind(event.shiftKey ? -1 : 1); }
    if (event.key === 'Escape') { event.preventDefault(); closeSmartEditorFind(); }
  });
  $('#editorFindPrev')?.addEventListener('click', () => navigateSmartEditorFind(-1));
  $('#editorFindNext')?.addEventListener('click', () => navigateSmartEditorFind(1));
  $('#editorFindClose')?.addEventListener('click', closeSmartEditorFind);
  $('#editorProblemsStatus')?.addEventListener('click', () => toggleSmartEditorProblems());
  $('#closeEditorProblems')?.addEventListener('click', () => toggleSmartEditorProblems(false));
  $('#editorProblemsList')?.addEventListener('click', event => {
    const go = event.target.closest('[data-problem-go]');
    const explain = event.target.closest('[data-problem-explain]');
    const fix = event.target.closest('[data-problem-fix]');
    if (go) goToSmartEditorDiagnostic(Number(go.dataset.problemGo));
    if (explain) {
      const index = Number(explain.dataset.problemExplain);
      const block = $(`[data-problem-explanation="${index}"]`);
      if (block) { block.hidden = !block.hidden; explain.textContent = block.hidden ? 'Explique este erro' : 'Ocultar explicação'; }
    }
    if (fix) applySmartEditorFix(Number(fix.dataset.problemFix));
  });
  $('#editorAutocomplete')?.addEventListener('mousedown', event => event.preventDefault());
  $('#editorAutocomplete')?.addEventListener('click', event => {
    const button = event.target.closest('[data-suggestion-index]');
    if (button) acceptSmartEditorAutocomplete(Number(button.dataset.suggestionIndex));
  });

  $('#runPlayground').addEventListener('click', runPlayground);
  $('#stopPython').addEventListener('click', stopPythonExecution);
  $('#clearPythonOutput')?.addEventListener('click', () => clearConsole('Saída limpa. Execute o Python para gerar uma nova saída.'));
  $('#resetPlayground').addEventListener('click', () => {
    savePlaygroundSnapshot('Antes de restaurar modelo');
    const selectedPreset = playgroundPresets[presetSelect.value] || playgroundPresets.default;
    pg = {
      ...defaultPlayground,
      html: selectedPreset.html ?? defaultPlayground.html,
      css: selectedPreset.css ?? defaultPlayground.css,
      js: selectedPreset.js ?? defaultPlayground.js,
      python: selectedPreset.python ?? defaultPlayground.python
    };
    state.playground = { ...pg };
    state.playgroundPreset = presetSelect.value;
    saveState();
    updateEditor();
    runPlayground();
  });
  $('#clearEditor').addEventListener('click', async () => {
    if (!$('#codeEditor').value || await eeConfirm(`O código da aba ${languageLabel(activeLang)} será apagado.`, { title:'Limpar editor?', confirmLabel:'Limpar', tone:'danger' })) {
      savePlaygroundSnapshot('Antes de limpar editor');
      $('#codeEditor').value = '';
      $('#codeEditor').dispatchEvent(new Event('input'));
      $('#codeEditor').focus();
    }
  });
  $('#clearAllEditors').addEventListener('click', async () => {
    syncPlaygroundBuffer();
    const languages = ['html', 'css', 'js', 'python'];
    const hasCode = languages.some(lang => String(pg[lang] || '').trim());
    if (hasCode && !await eeConfirm('HTML, CSS, JavaScript e Python serão apagados de uma vez. Uma versão será mantida no Histórico antes da limpeza.', { title:'Limpar todos os editores?', confirmLabel:'Limpar tudo', tone:'danger' })) return;
    if (hasCode) savePlaygroundSnapshot('Antes de limpar todos os editores');
    languages.forEach(lang => { pg[lang] = ''; });
    state.playground = { ...pg };
    state.playgroundLang = activeLang;
    saveState();
    updateEditor();
    runPlayground();
    $('#codeEditor').focus();
    showToast('Todos os editores foram limpos.');
  });
  $('#copyCode').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#codeEditor').value);
      setTransientButton($('#copyCode'), 'Copiado');
    } catch {
      setTransientButton($('#copyCode'), 'Falha ao copiar');
    }
  });
  $('#clearConsole').addEventListener('click', () => clearConsole());
  $('#toggleConsole')?.addEventListener('click', () => { if (activeLang !== 'python') setConsoleCollapsed(!state.consoleCollapsed); });
  $('#runResultFullscreen')?.addEventListener('click', runResultFullscreen);
  $('#pythonStdin')?.addEventListener('input', event => { state.pythonStdin = event.currentTarget.value; saveState(); flashAutosave('Entrada salva'); });
  $('#fullscreenPlayground').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await $('#workbench').requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      $('#workbench')?.classList.toggle('fullscreen-fallback');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      $('.result-only-target')?.classList.remove('result-only-target');
      $('#workbench')?.classList.remove('fullscreen-fallback');
      const hint = $('#resultFullscreenHint'); if (hint) hint.hidden = true;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.fullscreenElement) return;
    $$('.result-focus-fallback').forEach(element => element.classList.remove('result-focus-fallback','result-only-target'));
    $('#workbench')?.classList.remove('fullscreen-fallback');
  });
  presetSelect.addEventListener('change', async () => {
    const preset = playgroundPresets[presetSelect.value];
    if (!preset) return;
    const previousPreset = state.playgroundPreset || 'default';
    const shouldReplace = await eeConfirm(`O código atual do Playground será substituído pelo modelo “${presetDisplayTitle(preset)}”.`, { title:'Carregar modelo?', confirmLabel:'Carregar modelo' });
    if (!shouldReplace) {
      presetSelect.value = previousPreset;
      syncPresetPicker();
      return;
    }
    savePlaygroundSnapshot('Antes de trocar modelo');
    pg = {
      ...defaultPlayground,
      html: preset.html ?? defaultPlayground.html,
      css: preset.css ?? defaultPlayground.css,
      js: preset.js ?? defaultPlayground.js,
      python: preset.python ?? defaultPlayground.python
    };
    if (preset.category === 'Python') activeLang = 'python';
    else if (activeLang === 'python') activeLang = 'html';
    state.playground = { ...pg };
    state.playgroundPreset = presetSelect.value;
    state.playgroundLang = activeLang;
    saveState();
    syncPresetPicker();
    setPresetMenu(false);
    syncEditorMode();
    updateEditor();
    runPlayground();
  });

  $$('#viewportSwitch button').forEach(button => button.addEventListener('click', () => setPreviewViewport(button.dataset.viewport)));
  initWorkbenchResizer();
  window.addEventListener('message', handlePlaygroundMessage);
}

function languageLabel(lang) {
  return ({ html:'HTML', css:'CSS', js:'JavaScript', python:'Python 3' })[lang] || lang;
}

function syncEditorTabs() {
  $('#editorTabs button').forEach(tab => {
    const selected = tab.dataset.lang === activeLang;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

function selectEditorTab(lang) {
  pg[activeLang] = $('#codeEditor').value;
  activeLang = lang;
  state.playgroundLang = lang;
  state.playground = { ...pg };
  saveState();
  syncEditorTabs();
  syncEditorMode();
  updateEditor();
  if (lang === 'python') preparePythonPane(); else runWebPlayground();
}

function syncEditorMode() {
  const python = activeLang === 'python';
  const tkinter = python && tkinterLiteActive;
  $('#workbench')?.classList.toggle('python-mode', python);
  $('#workbench')?.classList.toggle('tkinter-mode', tkinter);
  if ($('#previewFrame')) $('#previewFrame').hidden = python;
  if ($('#pythonRuntime')) $('#pythonRuntime').hidden = true;
  if ($('#tkinterRuntime')) $('#tkinterRuntime').hidden = !tkinter;
  if ($('#viewportSwitch')) $('#viewportSwitch').hidden = python;
  if ($('#clearPythonOutput')) $('#clearPythonOutput').hidden = !python;
  syncPythonStdinVisibility();
  if ($('#previewTitle')) $('#previewTitle').textContent = tkinter ? 'Tkinter Web Lite' : (python ? 'Terminal Python' : 'Resultado');
  if ($('#runtimeBadge')) $('#runtimeBadge').textContent = tkinter ? 'Tkinter Web Lite · Pyodide' : (python ? 'Python 3 · Pyodide' : 'Web sandbox');
  if ($('#consoleTitle')) $('#consoleTitle').textContent = python ? 'Terminal Python' : 'Console';
  if ($('#consoleHint')) $('#consoleHint').textContent = tkinter ? 'prints / erros' : (python ? 'stdout / stderr' : 'JavaScript');
  if ($('#editorLanguageStatus')) $('#editorLanguageStatus').textContent = languageLabel(activeLang);
  const run = $('#runPlayground');
  if (run) {
    const label = tkinter ? 'Executar Tkinter' : (python ? 'Executar Python' : 'Executar código');
    run.setAttribute('aria-label', label);
    run.setAttribute('title', `${label} (Ctrl + Enter)`);
  }
  if ($('#stopPython')) $('#stopPython').hidden = !python || !pythonRunning;
  const runtimeNote = $('.playground-runtime-note strong');
  if (runtimeNote) runtimeNote.textContent = tkinter ? 'Tkinter Web Lite' : (python ? 'Python isolado' : 'Execução segura');
  applyConsoleState();
  $$('#editorTabs button').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.lang === activeLang)));
}

function updateEditor() {
  $('#codeEditor').value = pg[activeLang] || '';
  smartEditorDiagnostics = [];
  updateEditorGutter();
  updateEditorMetrics();
  syncEditorGutterScroll();
  syncPythonStdinVisibility();
  hideSmartEditorAutocomplete();
  hideSmartEditorHoverDoc();
  refreshSmartEditor({ autocomplete:false, diagnostics:true });
}

function updateEditorGutter() {
  const editor = $('#codeEditor');
  const gutter = $('#editorGutter');
  if (!editor || !gutter) return;
  const lines = Math.max(1, editor.value.split('\n').length);
  const active = smartEditorLineCol(editor.value, editor.selectionStart).line;
  const severityByLine = new Map();
  smartEditorDiagnostics.forEach(item => {
    const previous = severityByLine.get(item.line);
    if (!previous || item.severity === 'error') severityByLine.set(item.line, item.severity);
  });
  gutter.innerHTML = Array.from({ length: lines }, (_, index) => {
    const line = index + 1;
    const classes = [line === active ? 'active' : '', severityByLine.get(line) || ''].filter(Boolean).join(' ');
    return `<span${classes ? ` class="${classes}"` : ''}>${line}</span>`;
  }).join('');
}

function syncEditorGutterScroll() {
  const editor = $('#codeEditor');
  const gutter = $('#editorGutter');
  const highlight = $('#codeHighlight');
  if (editor && gutter) gutter.scrollTop = editor.scrollTop;
  if (editor && highlight) {
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  }
}

function updateEditorMetrics() {
  const value = $('#codeEditor')?.value || '';
  const lines = value.split('\n').length;
  if ($('#editorMetrics')) $('#editorMetrics').textContent = `${lines} ${lines === 1 ? 'linha' : 'linhas'} · ${value.length} caracteres`;
}

function flashAutosave(message = 'Salvo automaticamente') {
  const status = $('.autosave-status');
  if (!status) return;
  status.classList.add('saving');
  status.innerHTML = `<span class="autosave-dot"></span>${escapeHtml(message)}`;
  clearTimeout(window.__eeAutosaveTimer);
  window.__eeAutosaveTimer = setTimeout(() => {
    const current = $('.autosave-status');
    if (!current) return;
    current.classList.remove('saving');
    current.innerHTML = '<span class="autosave-dot"></span>Salvo automaticamente';
  }, 900);
}

function setTransientButton(button, label) {
  if (!button) return;
  const original = button.innerHTML;
  button.textContent = label;
  setTimeout(() => { if (button.isConnected) button.innerHTML = original; }, 1200);
}

let consoleUnreadCount = 0;
function applyConsoleState() {
  const panel = $('#consolePanel');
  if (!panel) return;
  const pythonMode = activeLang === 'python';
  const collapsed = pythonMode ? false : Boolean(state.consoleCollapsed);
  panel.classList.toggle('collapsed', collapsed);
  $('#toggleConsole')?.setAttribute('aria-expanded', String(!collapsed));
  if ($('#toggleConsoleText')) $('#toggleConsoleText').textContent = collapsed ? 'Mostrar' : 'Ocultar';
  const use = $('#toggleConsole use');
  if (use) use.setAttribute('href', '#icon-chevron-down');
}
function setConsoleCollapsed(collapsed, persist = true) {
  state.consoleCollapsed = Boolean(collapsed);
  if (!state.consoleCollapsed) {
    consoleUnreadCount = 0;
    if ($('#consoleUnread')) { $('#consoleUnread').hidden = true; $('#consoleUnread').textContent = '0'; }
  }
  if (persist) saveState();
  applyConsoleState();
}
function markConsoleUnread() {
  if (activeLang === 'python' || !state.consoleCollapsed) return;
  consoleUnreadCount += 1;
  const badge = $('#consoleUnread');
  if (badge) { badge.hidden = false; badge.textContent = consoleUnreadCount > 99 ? '99+' : String(consoleUnreadCount); }
}
function clearConsole(message = '') {
  if (!$('#playgroundConsole')) return;
  const fallback = activeLang === 'python'
    ? 'Execute o Python para ver a saída aqui.'
    : 'Console limpo. Execute o código para gerar novas mensagens.';
  $('#playgroundConsole').innerHTML = `<div class="console-empty">${escapeHtml(message || fallback)}</div>`;
  consoleUnreadCount = 0;
  if ($('#consoleUnread')) { $('#consoleUnread').hidden = true; $('#consoleUnread').textContent = '0'; }
}

function appendConsole(level, text) {
  const consoleEl = $('#playgroundConsole');
  if (!consoleEl) return;
  if ($('.console-empty', consoleEl)) consoleEl.innerHTML = '';
  const line = document.createElement('div');
  line.className = `console-line ${level}`;
  const prefix = document.createElement('span');
  prefix.className = 'console-prefix';
  prefix.textContent = level === 'error' ? 'ERR' : level === 'warn' ? 'WARN' : level === 'result' ? 'RET' : activeLang === 'python' ? 'OUT' : 'LOG';
  const content = document.createElement('span');
  content.textContent = text;
  line.append(prefix, content);
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
  markConsoleUnread();
}

function handlePlaygroundMessage(event) {
  const frame = $('#previewFrame');
  if (!frame || event.source !== frame.contentWindow || event.data?.source !== 'ee-playground') return;
  appendConsole(event.data.level || 'log', event.data.text || '');
}

async function runResultFullscreen() {
  const pythonTkinter = activeLang === 'python' && pythonUsesTkinter($('#codeEditor')?.value || pg.python || '');
  const target = activeLang === 'python' ? (pythonTkinter ? $('#previewStage') : $('#consolePanel')) : $('#previewStage');
  if (!target) return;
  if (activeLang === 'python' && !pythonTkinter) setConsoleCollapsed(false);
  target.classList.add('result-only-target');
  runPlayground();
  showResultFullscreenHint(target);
  try {
    if (target.requestFullscreen && !document.fullscreenElement) await target.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    target.classList.toggle('result-focus-fallback');
  }
}

function runPlayground() {
  savePlaygroundSnapshot('Executado');
  if (activeLang === 'python') runPythonPlayground();
  else runWebPlayground();
}

function runWebPlayground() {
  if (!$('#previewFrame')) return;
  tkinterLiteActive = false;
  tkinterLiteSnapshot = null;
  if ($('#tkinterRuntime')) $('#tkinterRuntime').hidden = true;
  pg[activeLang] = $('#codeEditor')?.value ?? pg[activeLang];
  clearConsole();
  const bootstrap = `<script>(function(){const format=v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{return String(v)}};['log','warn','error'].forEach(level=>{const original=console[level].bind(console);console[level]=(...args)=>{parent.postMessage({source:'ee-playground',level,text:args.map(format).join(' ')},'*');original(...args)}});window.onerror=(message,source,line,column)=>{parent.postMessage({source:'ee-playground',level:'error',text:String(message)+' · linha '+line+':'+column},'*')};window.onunhandledrejection=e=>parent.postMessage({source:'ee-playground',level:'error',text:'Promise rejeitada: '+format(e.reason)},'*');})();<\/script>`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${pg.css}</style></head><body>${bootstrap}${pg.html}<script>${pg.js}<\/script></body></html>`;
  $('#previewFrame').srcdoc = doc;
  setRunStatus('Executado agora', 'success');
  state.playground = { ...pg };
  state.playgroundLang = activeLang;
  saveState();
}

function preparePythonPane() {
  tkinterLiteActive = pythonUsesTkinter($('#codeEditor')?.value || pg.python || '');
  if ($('#tkinterRuntime')) $('#tkinterRuntime').hidden = !tkinterLiteActive || !tkinterLiteSnapshot;
  syncEditorMode();
  clearConsole(tkinterLiteActive ? 'Tkinter Web Lite pronto. Execute para gerar a interface visual; prints e erros aparecem no Console.' : 'Python pronto para executar. A primeira execução carrega o runtime pela internet.');
  if ($('#pythonRuntimeText')) {
    $('#pythonRuntimeText').textContent = pythonWorker
      ? 'Runtime iniciado. Execute novamente quando quiser.'
      : 'Na primeira execução, o Pyodide será carregado sob demanda. Isso pode levar alguns segundos.';
  }
  setRunStatus('Pronto para Python');
}

let tkinterLiteActive = false;
let tkinterLiteSnapshot = null;

const TKINTER_LITE_PY = String.raw`
import sys, types, json, itertools

_ee_tk_widgets = {}
_ee_tk_commands = {}
_ee_tk_counter = itertools.count(1)
_ee_tk_messages = []
_ee_tk_root = None

class Variable:
    def __init__(self, master=None, value=None, name=None):
        self._value = value
    def get(self): return self._value
    def set(self, value): self._value = value
    def __str__(self): return str(self._value if self._value is not None else '')

class StringVar(Variable):
    def __init__(self, master=None, value='', name=None): super().__init__(master, value, name)
class IntVar(Variable):
    def __init__(self, master=None, value=0, name=None): super().__init__(master, int(value or 0), name)
class DoubleVar(Variable):
    def __init__(self, master=None, value=0.0, name=None): super().__init__(master, float(value or 0), name)
class BooleanVar(Variable):
    def __init__(self, master=None, value=False, name=None): super().__init__(master, bool(value), name)

def _ee_safe(value):
    if isinstance(value, Variable): return value.get()
    if callable(value): return None
    if isinstance(value, (list, tuple)): return [_ee_safe(v) for v in value]
    if isinstance(value, dict): return {str(k): _ee_safe(v) for k, v in value.items()}
    if value is None or isinstance(value, (str, int, float, bool)): return value
    return str(value)

def _ee_register_command(widget_id, command):
    if callable(command): _ee_tk_commands[widget_id] = command
    elif widget_id in _ee_tk_commands: _ee_tk_commands.pop(widget_id, None)

class _Widget:
    _type = 'Widget'
    def __init__(self, master=None, cnf=None, **kwargs):
        global _ee_tk_root
        self.master = master
        self._id = f'w{next(_ee_tk_counter)}'
        self._children = []
        self._options = {}
        self._manager = ''
        self._layout = {}
        self._value = ''
        self._items = []
        self._canvas = []
        self._destroyed = False
        if master is not None and hasattr(master, '_children'):
            master._children.append(self)
        _ee_tk_widgets[self._id] = self
        if cnf and isinstance(cnf, dict): kwargs = {**cnf, **kwargs}
        self.configure(**kwargs)
    def pack(self, **kwargs): self._manager='pack'; self._layout=dict(kwargs); return self
    def grid(self, **kwargs): self._manager='grid'; self._layout=dict(kwargs); return self
    def place(self, **kwargs): self._manager='place'; self._layout=dict(kwargs); return self
    def pack_forget(self): self._manager=''; self._layout={}
    grid_forget = pack_forget
    place_forget = pack_forget
    def configure(self, cnf=None, **kwargs):
        if cnf and isinstance(cnf, dict): kwargs = {**cnf, **kwargs}
        for key, value in kwargs.items():
            key = str(key)
            if key == 'command': _ee_register_command(self._id, value)
            else: self._options[key] = value
        return None
    config = configure
    def cget(self, key): return self._options.get(key)
    def __getitem__(self, key): return self.cget(key)
    def __setitem__(self, key, value): self.configure(**{key:value})
    def destroy(self):
        self._destroyed = True
        _ee_tk_commands.pop(self._id, None)
        if self.master is not None and self in getattr(self.master, '_children', []): self.master._children.remove(self)
    def winfo_children(self): return [w for w in self._children if not w._destroyed]
    def winfo_exists(self): return int(not self._destroyed)
    def update(self): return None
    update_idletasks = update
    def bind(self, sequence=None, func=None, add=None):
        if callable(func): self._options['_bind'] = str(sequence or '')
        return self._id
    def focus_set(self): self._options['_focus'] = True
    focus = focus_set

class Tk(_Widget):
    _type='Tk'
    def __init__(self, *args, **kwargs):
        global _ee_tk_root
        super().__init__(None, **kwargs)
        _ee_tk_root = self
        self._title = 'Tkinter Web Lite'
        self._geometry = ''
        self._resizable = (True, True)
        self._minsize = None
        self._maxsize = None
    def title(self, text=None):
        if text is None: return self._title
        self._title = str(text)
    wm_title = title
    def geometry(self, spec=None):
        if spec is None: return self._geometry
        self._geometry = str(spec)
    wm_geometry = geometry
    def resizable(self, width=None, height=None):
        if width is None and height is None: return self._resizable
        self._resizable = (bool(width), bool(height))
    def minsize(self, width=None, height=None):
        if width is not None and height is not None: self._minsize=(int(width),int(height))
        return self._minsize
    def maxsize(self, width=None, height=None):
        if width is not None and height is not None: self._maxsize=(int(width),int(height))
        return self._maxsize
    def mainloop(self, n=0): return None
    def quit(self): return None
    def withdraw(self): self._options['_withdrawn']=True
    def deiconify(self): self._options['_withdrawn']=False
    def after(self, ms, func=None, *args):
        if callable(func) and float(ms or 0) <= 0: return func(*args)
        return f'after-{self._id}'
    def after_cancel(self, _id): return None

class Toplevel(Tk):
    _type='Toplevel'
    def __init__(self, master=None, **kwargs):
        _Widget.__init__(self, master, **kwargs)
        self._title='Janela'
        self._geometry=''
        self._resizable=(True,True)
        self._minsize=None; self._maxsize=None

class Frame(_Widget): _type='Frame'
class LabelFrame(Frame): _type='LabelFrame'
class Label(_Widget): _type='Label'
class Message(Label): _type='Message'

class Button(_Widget):
    _type='Button'
    def invoke(self):
        command = _ee_tk_commands.get(self._id)
        return command() if callable(command) else None

class Entry(_Widget):
    _type='Entry'
    def __init__(self, master=None, cnf=None, **kwargs):
        super().__init__(master, cnf, **kwargs)
        variable=self._options.get('textvariable')
        self._value = str(variable.get() if isinstance(variable, Variable) else self._options.get('text','') or '')
    def get(self):
        variable=self._options.get('textvariable')
        return str(variable.get()) if isinstance(variable, Variable) else self._value
    def delete(self, first, last=None):
        self._value=''
        variable=self._options.get('textvariable')
        if isinstance(variable, Variable): variable.set('')
    def insert(self, index, string):
        value=self.get(); text=str(string); idx=len(value) if str(index).lower() in ('end','insert') else int(index or 0)
        self._value=value[:idx]+text+value[idx:]
        variable=self._options.get('textvariable')
        if isinstance(variable, Variable): variable.set(self._value)

class Text(_Widget):
    _type='Text'
    def get(self, start='1.0', end='end'): return self._value
    def delete(self, start='1.0', end='end'): self._value=''
    def insert(self, index, chars, *tags): self._value += str(chars)

class Checkbutton(Button):
    _type='Checkbutton'
    def select(self):
        variable=self._options.get('variable'); value=self._options.get('onvalue',1)
        if isinstance(variable, Variable): variable.set(value)
    def deselect(self):
        variable=self._options.get('variable'); value=self._options.get('offvalue',0)
        if isinstance(variable, Variable): variable.set(value)
    def toggle(self):
        variable=self._options.get('variable')
        if isinstance(variable, Variable):
            current=variable.get(); variable.set(self._options.get('offvalue',0) if current==self._options.get('onvalue',1) else self._options.get('onvalue',1))

class Radiobutton(Button): _type='Radiobutton'

class Scale(_Widget):
    _type='Scale'
    def __init__(self, master=None, cnf=None, **kwargs): super().__init__(master, cnf, **kwargs); self._value=float(self._options.get('from_',0) or 0)
    def get(self): return self._value
    def set(self, value): self._value=float(value)

class Spinbox(Entry): _type='Spinbox'

class Listbox(_Widget):
    _type='Listbox'
    def insert(self, index, *elements): self._items.extend(str(x) for x in elements)
    def delete(self, first, last=None): self._items=[]
    def get(self, first, last=None):
        if last is None: return self._items[int(first)] if self._items else ''
        return tuple(self._items)
    def curselection(self): return tuple()

class Canvas(_Widget):
    _type='Canvas'
    def _draw(self, kind, coords, kwargs):
        item={'kind':kind,'coords':[float(x) for x in coords],'options':{str(k):_ee_safe(v) for k,v in kwargs.items()}}
        self._canvas.append(item); return len(self._canvas)
    def create_rectangle(self,*coords,**kwargs): return self._draw('rectangle',coords,kwargs)
    def create_oval(self,*coords,**kwargs): return self._draw('oval',coords,kwargs)
    def create_line(self,*coords,**kwargs): return self._draw('line',coords,kwargs)
    def create_text(self,*coords,**kwargs): return self._draw('text',coords,kwargs)
    def create_polygon(self,*coords,**kwargs): return self._draw('polygon',coords,kwargs)
    def delete(self, tag): self._canvas=[] if str(tag)=='all' else self._canvas

class Menu(_Widget):
    _type='Menu'
    def add_command(self, **kwargs): self._items.append({'type':'command', **kwargs})
    def add_separator(self): self._items.append({'type':'separator'})
    def add_cascade(self, **kwargs): self._items.append({'type':'cascade', **kwargs})

class OptionMenu(_Widget):
    _type='OptionMenu'
    def __init__(self, master, variable, default=None, *values, **kwargs):
        kwargs={'variable':variable,'values':[default,*values] if default is not None else list(values), **kwargs}
        super().__init__(master, **kwargs)
        if default is not None and isinstance(variable, Variable): variable.set(default)

class Scrollbar(_Widget): _type='Scrollbar'
class PanedWindow(Frame): _type='PanedWindow'

class Combobox(Entry): _type='Combobox'
class Progressbar(_Widget): _type='Progressbar'
class Separator(_Widget): _type='Separator'
class Treeview(_Widget): _type='Treeview'

class PhotoImage:
    def __init__(self, *args, **kwargs): self.kwargs=kwargs
class Font:
    def __init__(self, *args, **kwargs): self.kwargs=kwargs
    def configure(self, **kwargs): self.kwargs.update(kwargs)

class _MessageBoxModule(types.ModuleType):
    def _show(self, kind, title, message, **kwargs):
        _ee_tk_messages.append({'kind':kind,'title':str(title),'message':str(message)})
        return 'ok'
    def showinfo(self,title,message,**kwargs): return self._show('info',title,message,**kwargs)
    def showwarning(self,title,message,**kwargs): return self._show('warning',title,message,**kwargs)
    def showerror(self,title,message,**kwargs): return self._show('error',title,message,**kwargs)
    def askyesno(self,title,message,**kwargs): self._show('question',title,message,**kwargs); return True
    def askokcancel(self,title,message,**kwargs): self._show('question',title,message,**kwargs); return True

class _FileDialogModule(types.ModuleType):
    def askopenfilename(self, **kwargs): return ''
    def asksaveasfilename(self, **kwargs): return ''
    def askdirectory(self, **kwargs): return ''


def _ee_widget_snapshot(widget):
    options={}
    for key,value in widget._options.items():
        if key.startswith('_'): continue
        safe=_ee_safe(value)
        if safe is not None: options[key]=safe
    variable=widget._options.get('textvariable')
    if isinstance(variable, Variable): options['text']=str(variable.get())
    variable=widget._options.get('variable')
    if isinstance(variable, Variable): options['_variableValue']=_ee_safe(variable.get())
    if isinstance(widget, Entry): options['_value']=widget.get()
    if isinstance(widget, Text): options['_value']=widget._value
    if isinstance(widget, Scale): options['_value']=widget._value
    return {
        'id':widget._id,
        'type':widget._type,
        'parent':getattr(widget.master,'_id',None),
        'manager':widget._manager,
        'layout':_ee_safe(widget._layout),
        'options':options,
        'items':_ee_safe(widget._items),
        'canvas':_ee_safe(widget._canvas),
        'hasCommand':widget._id in _ee_tk_commands,
    }

def __ee_tk_snapshot():
    root=_ee_tk_root
    data={
        'title':getattr(root,'_title','Tkinter Web Lite') if root else 'Tkinter Web Lite',
        'geometry':getattr(root,'_geometry','') if root else '',
        'widgets':[_ee_widget_snapshot(w) for w in _ee_tk_widgets.values() if not w._destroyed],
        'messages':list(_ee_tk_messages),
    }
    return json.dumps(data, ensure_ascii=False)

def __ee_tk_apply_values(payload):
    values=json.loads(payload or '{}') if isinstance(payload,str) else (payload or {})
    for widget_id,value in values.items():
        widget=_ee_tk_widgets.get(widget_id)
        if not widget: continue
        if isinstance(widget, Entry):
            widget._value=str(value if value is not None else '')
            variable=widget._options.get('textvariable')
            if isinstance(variable, Variable): variable.set(widget._value)
        elif isinstance(widget, Text): widget._value=str(value if value is not None else '')
        elif isinstance(widget, Scale):
            try: widget._value=float(value)
            except: pass
        elif isinstance(widget, Checkbutton):
            variable=widget._options.get('variable')
            if isinstance(variable, Variable):
                onvalue=widget._options.get('onvalue',1); offvalue=widget._options.get('offvalue',0)
                variable.set(onvalue if str(value)==str(onvalue) or value is True else offvalue)
        elif isinstance(widget, Radiobutton):
            variable=widget._options.get('variable')
            if isinstance(variable, Variable): variable.set(value)

def __ee_tk_invoke(widget_id):
    widget=_ee_tk_widgets.get(widget_id)
    if isinstance(widget, Radiobutton):
        variable=widget._options.get('variable')
        if isinstance(variable, Variable): variable.set(widget._options.get('value',1))
    command=_ee_tk_commands.get(widget_id)
    if callable(command):
        if isinstance(widget, Scale): return command(str(widget._value))
        return command()
    return None

def __ee_tk_reset():
    global _ee_tk_widgets, _ee_tk_commands, _ee_tk_counter, _ee_tk_messages, _ee_tk_root
    _ee_tk_widgets={}; _ee_tk_commands={}; _ee_tk_counter=itertools.count(1); _ee_tk_messages=[]; _ee_tk_root=None

_tk=types.ModuleType('tkinter')
for _name,_value in list(globals().items()):
    if _name in {'Tk','Toplevel','Frame','LabelFrame','Label','Message','Button','Entry','Text','Checkbutton','Radiobutton','Scale','Spinbox','Listbox','Canvas','Menu','OptionMenu','Scrollbar','PanedWindow','StringVar','IntVar','DoubleVar','BooleanVar','PhotoImage'}:
        setattr(_tk,_name,_value)
for _name,_value in {
    'END':'end','INSERT':'insert','LEFT':'left','RIGHT':'right','TOP':'top','BOTTOM':'bottom','X':'x','Y':'y','BOTH':'both','HORIZONTAL':'horizontal','VERTICAL':'vertical','N':'n','S':'s','E':'e','W':'w','NW':'nw','NE':'ne','SW':'sw','SE':'se','CENTER':'center','NORMAL':'normal','DISABLED':'disabled','ACTIVE':'active','SUNKEN':'sunken','RAISED':'raised','FLAT':'flat','GROOVE':'groove','RIDGE':'ridge','WORD':'word','CHAR':'char','NONE':'none'
}.items(): setattr(_tk,_name,_value)

_ttk=types.ModuleType('tkinter.ttk')
for _name,_value in {'Frame':Frame,'LabelFrame':LabelFrame,'Label':Label,'Button':Button,'Entry':Entry,'Checkbutton':Checkbutton,'Radiobutton':Radiobutton,'Scale':Scale,'Spinbox':Spinbox,'Scrollbar':Scrollbar,'Panedwindow':PanedWindow,'Combobox':Combobox,'Progressbar':Progressbar,'Separator':Separator,'Treeview':Treeview}.items(): setattr(_ttk,_name,_value)
_messagebox=_MessageBoxModule('tkinter.messagebox')
_filedialog=_FileDialogModule('tkinter.filedialog')
_font=types.ModuleType('tkinter.font'); _font.Font=Font
_tk.ttk=_ttk; _tk.messagebox=_messagebox; _tk.filedialog=_filedialog; _tk.font=_font
sys.modules['tkinter']=_tk
sys.modules['tkinter.ttk']=_ttk
sys.modules['tkinter.messagebox']=_messagebox
sys.modules['tkinter.filedialog']=_filedialog
sys.modules['tkinter.font']=_font
`;

function pythonUsesTkinter(code = '') {
  return /(^|\n)\s*(?:import\s+tkinter(?:\s+as\s+\w+)?|from\s+tkinter(?:\.\w+)?\s+import\s+)/m.test(String(code));
}

function collectTkinterLiteValues() {
  const runtime = $('#tkinterRuntime');
  if (!runtime) return {};
  const values = {};
  runtime.querySelectorAll('[data-tk-widget-id]').forEach(node => {
    const id = node.dataset.tkWidgetId;
    if (!id) return;
    if (node.matches('input[type="checkbox"],input[type="radio"]')) values[id] = node.checked ? (node.dataset.tkOnvalue ?? true) : (node.dataset.tkOffvalue ?? false);
    else if ('value' in node) values[id] = node.value;
  });
  return values;
}

function sendTkinterLiteEvent(widgetId) {
  if (!pythonWorker || !widgetId) return;
  pythonWorker.postMessage({ type:'tk-event', runId:pythonRunId, widgetId, values:collectTkinterLiteValues() });
}

function tkinterLiteLength(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function applyTkinterLiteWidgetStyle(element, widget) {
  const options = widget.options || {};
  const layout = widget.layout || {};
  const bg = options.bg ?? options.background;
  const fg = options.fg ?? options.foreground;
  if (bg) element.style.background = String(bg);
  if (fg) element.style.color = String(fg);
  if (options.width && !['Entry','Text','Listbox'].includes(widget.type)) element.style.minWidth = `${Math.max(0, tkinterLiteLength(options.width))}ch`;
  if (options.height && !['Entry'].includes(widget.type)) element.style.minHeight = `${Math.max(0, tkinterLiteLength(options.height))}em`;
  if (options.padx !== undefined) element.style.paddingInline = `${Math.max(0, tkinterLiteLength(options.padx))}px`;
  if (options.pady !== undefined) element.style.paddingBlock = `${Math.max(0, tkinterLiteLength(options.pady))}px`;
  if (options.font) {
    const font = Array.isArray(options.font) ? options.font : String(options.font).split(/\s+/);
    if (font[0]) element.style.fontFamily = String(font[0]);
    if (font[1] && Number.isFinite(Number(font[1]))) element.style.fontSize = `${Math.abs(Number(font[1]))}px`;
    if (font.some(item => String(item).toLowerCase() === 'bold')) element.style.fontWeight = '700';
  }
  if (widget.manager === 'grid') {
    element.style.gridColumn = `${Number(layout.column || 0) + 1} / span ${Number(layout.columnspan || 1)}`;
    element.style.gridRow = `${Number(layout.row || 0) + 1} / span ${Number(layout.rowspan || 1)}`;
    const sticky = String(layout.sticky || '').toLowerCase();
    if (sticky.includes('e') && sticky.includes('w')) element.style.width = '100%';
    if (sticky.includes('n') && sticky.includes('s')) element.style.height = '100%';
    if (sticky.includes('e') && !sticky.includes('w')) element.style.justifySelf = 'end';
    if (sticky.includes('w') && !sticky.includes('e')) element.style.justifySelf = 'start';
  } else if (widget.manager === 'place') {
    element.style.position = 'absolute';
    if (layout.x !== undefined) element.style.left = `${tkinterLiteLength(layout.x)}px`;
    if (layout.y !== undefined) element.style.top = `${tkinterLiteLength(layout.y)}px`;
    if (layout.relx !== undefined) element.style.left = `${tkinterLiteLength(layout.relx) * 100}%`;
    if (layout.rely !== undefined) element.style.top = `${tkinterLiteLength(layout.rely) * 100}%`;
    if (layout.width !== undefined) element.style.width = `${tkinterLiteLength(layout.width)}px`;
    if (layout.height !== undefined) element.style.height = `${tkinterLiteLength(layout.height)}px`;
    if (layout.relwidth !== undefined) element.style.width = `${tkinterLiteLength(layout.relwidth) * 100}%`;
    if (layout.relheight !== undefined) element.style.height = `${tkinterLiteLength(layout.relheight) * 100}%`;
  } else {
    const fill = String(layout.fill || '').toLowerCase();
    if (fill === 'x' || fill === 'both') element.style.width = '100%';
    if (layout.expand) element.style.flex = '1 1 auto';
    const padx = Array.isArray(layout.padx) ? layout.padx[0] : layout.padx;
    const pady = Array.isArray(layout.pady) ? layout.pady[0] : layout.pady;
    if (padx !== undefined || pady !== undefined) element.style.margin = `${tkinterLiteLength(pady)}px ${tkinterLiteLength(padx)}px`;
  }
}

function createTkinterLiteCanvas(widget) {
  const options = widget.options || {};
  const width = Math.max(80, tkinterLiteLength(options.width, 300));
  const height = Math.max(60, tkinterLiteLength(options.height, 180));
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('tk-lite-canvas');
  (widget.canvas || []).forEach(item => {
    const coords = item.coords || [];
    const opts = item.options || {};
    let node = null;
    if (item.kind === 'rectangle' && coords.length >= 4) {
      node = document.createElementNS(svg.namespaceURI,'rect');
      node.setAttribute('x', Math.min(coords[0],coords[2])); node.setAttribute('y',Math.min(coords[1],coords[3]));
      node.setAttribute('width',Math.abs(coords[2]-coords[0])); node.setAttribute('height',Math.abs(coords[3]-coords[1]));
    } else if (item.kind === 'oval' && coords.length >= 4) {
      node = document.createElementNS(svg.namespaceURI,'ellipse');
      node.setAttribute('cx',(coords[0]+coords[2])/2); node.setAttribute('cy',(coords[1]+coords[3])/2);
      node.setAttribute('rx',Math.abs(coords[2]-coords[0])/2); node.setAttribute('ry',Math.abs(coords[3]-coords[1])/2);
    } else if (item.kind === 'line' && coords.length >= 4) {
      node = document.createElementNS(svg.namespaceURI,'polyline');
      node.setAttribute('points', Array.from({length:Math.floor(coords.length/2)},(_,i)=>`${coords[i*2]},${coords[i*2+1]}`).join(' '));
      node.setAttribute('fill','none');
    } else if (item.kind === 'polygon' && coords.length >= 6) {
      node = document.createElementNS(svg.namespaceURI,'polygon');
      node.setAttribute('points', Array.from({length:Math.floor(coords.length/2)},(_,i)=>`${coords[i*2]},${coords[i*2+1]}`).join(' '));
    } else if (item.kind === 'text' && coords.length >= 2) {
      node = document.createElementNS(svg.namespaceURI,'text'); node.setAttribute('x',coords[0]); node.setAttribute('y',coords[1]); node.textContent = String(opts.text || '');
    }
    if (!node) return;
    node.setAttribute('stroke', String(opts.outline || opts.fill || 'currentColor'));
    if (item.kind !== 'line' && item.kind !== 'text') node.setAttribute('fill', String(opts.fill || 'transparent'));
    if (item.kind === 'text') { node.setAttribute('fill', String(opts.fill || 'currentColor')); node.setAttribute('stroke','none'); }
    svg.appendChild(node);
  });
  return svg;
}

function createTkinterLiteWidget(widget, radioGroups) {
  const options = widget.options || {};
  const text = options.text ?? '';
  let element;
  if (widget.type === 'Label' || widget.type === 'Message') {
    element = document.createElement('div'); element.className='tk-lite-label'; element.textContent=String(text);
  } else if (widget.type === 'Button') {
    element = document.createElement('button'); element.type='button'; element.className='tk-lite-button'; element.textContent=String(text || 'Button');
    element.addEventListener('click',()=>sendTkinterLiteEvent(widget.id));
  } else if (widget.type === 'Entry' || widget.type === 'Spinbox' || widget.type === 'Combobox') {
    element = document.createElement('input'); element.className='tk-lite-entry'; element.value=String(options._value ?? '');
    if (options.show) element.type='password';
  } else if (widget.type === 'Text') {
    element=document.createElement('textarea'); element.className='tk-lite-text'; element.value=String(options._value ?? '');
  } else if (widget.type === 'Checkbutton') {
    const label=document.createElement('label'); label.className='tk-lite-choice';
    element=document.createElement('input'); element.type='checkbox';
    const onvalue=options.onvalue ?? 1, offvalue=options.offvalue ?? 0;
    element.checked=String(options._variableValue)===String(onvalue); element.dataset.tkOnvalue=String(onvalue); element.dataset.tkOffvalue=String(offvalue);
    label.append(element,document.createTextNode(String(text || ''))); element.addEventListener('change',()=>sendTkinterLiteEvent(widget.id));
    element.__tkWrapper=label;
  } else if (widget.type === 'Radiobutton') {
    const label=document.createElement('label'); label.className='tk-lite-choice';
    element=document.createElement('input'); element.type='radio';
    const group = String(options.variable ?? widget.parent ?? 'radio');
    if (!radioGroups.has(group)) radioGroups.set(group,`tk-${radioGroups.size+1}`);
    element.name=radioGroups.get(group); element.value=String(options.value ?? 1); element.checked=String(options._variableValue)===String(options.value ?? 1);
    label.append(element,document.createTextNode(String(text || ''))); element.addEventListener('change',()=>{if(element.checked) sendTkinterLiteEvent(widget.id);});
    element.__tkWrapper=label;
  } else if (widget.type === 'Scale') {
    element=document.createElement('input'); element.type='range'; element.className='tk-lite-scale';
    element.min=String(options.from_ ?? 0); element.max=String(options.to ?? 100); element.step=String(options.resolution ?? 1); element.value=String(options._value ?? options.from_ ?? 0);
    if (widget.hasCommand) element.addEventListener('change',()=>sendTkinterLiteEvent(widget.id));
  } else if (widget.type === 'Listbox') {
    element=document.createElement('select'); element.className='tk-lite-listbox'; element.multiple=String(options.selectmode || '').includes('multiple');
    (widget.items || []).forEach(item=>{const option=document.createElement('option'); option.textContent=String(item); element.appendChild(option);});
  } else if (widget.type === 'Canvas') {
    element=createTkinterLiteCanvas(widget);
  } else if (widget.type === 'Separator') {
    element=document.createElement('hr'); element.className='tk-lite-separator';
  } else if (widget.type === 'Progressbar') {
    element=document.createElement('progress'); element.className='tk-lite-progress'; element.max=Number(options.maximum || 100); element.value=Number(options.value || options._variableValue || 0);
  } else if (widget.type === 'LabelFrame') {
    element=document.createElement('fieldset'); element.className='tk-lite-frame tk-lite-labelframe'; const legend=document.createElement('legend'); legend.textContent=String(text || ''); element.appendChild(legend);
  } else {
    element=document.createElement('div'); element.className='tk-lite-frame';
  }
  element.dataset.tkWidgetId=widget.id;
  if (options.state === 'disabled') element.disabled=true;
  if (options.cursor) element.style.cursor=String(options.cursor);
  applyTkinterLiteWidgetStyle(element.__tkWrapper || element, widget);
  return element.__tkWrapper || element;
}

function renderTkinterLite(snapshot) {
  tkinterLiteSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot) : (snapshot || {});
  tkinterLiteActive = true;
  const runtime = $('#tkinterRuntime');
  if (!runtime) return;
  runtime.hidden = false;
  $('#previewFrame')?.setAttribute('hidden','');
  if ($('#pythonRuntime')) $('#pythonRuntime').hidden = true;
  if ($('#previewTitle')) $('#previewTitle').textContent = 'Tkinter Web Lite';
  if ($('#runtimeBadge')) $('#runtimeBadge').textContent = 'Tkinter Web Lite · Pyodide';
  const geometry = String(tkinterLiteSnapshot.geometry || '');
  const match = geometry.match(/^(\d+)x(\d+)/);
  const windowNode = document.createElement('section'); windowNode.className='tk-lite-window';
  if (match) { windowNode.style.width=`min(100%, ${Math.max(240,Number(match[1]))}px)`; windowNode.style.minHeight=`min(70vh, ${Math.max(160,Number(match[2]))}px)`; }
  const titlebar=document.createElement('div'); titlebar.className='tk-lite-titlebar'; titlebar.innerHTML='<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
  const title=document.createElement('strong'); title.textContent=String(tkinterLiteSnapshot.title || 'Tkinter Web Lite'); titlebar.appendChild(title);
  const body=document.createElement('div'); body.className='tk-lite-body';
  windowNode.append(titlebar,body); runtime.replaceChildren(windowNode);
  const widgets=(tkinterLiteSnapshot.widgets || []).filter(widget=>!['Tk','Toplevel'].includes(widget.type));
  const byParent=new Map(); widgets.forEach(widget=>{const key=widget.parent || '__root__'; if(!byParent.has(key)) byParent.set(key,[]); byParent.get(key).push(widget);});
  const radioGroups=new Map();
  const renderChildren=(parentId,parentNode)=>{
    const children=byParent.get(parentId) || [];
    if (!children.length) return;
    const usesGrid=children.some(child=>child.manager==='grid');
    const usesPlace=children.some(child=>child.manager==='place');
    if (usesGrid) {
      parentNode.classList.add('tk-lite-grid');
      const maxColumn=Math.max(0,...children.map(child=>Number(child.layout?.column || 0)+Number(child.layout?.columnspan || 1)-1));
      parentNode.style.gridTemplateColumns=`repeat(${maxColumn+1}, minmax(0,1fr))`;
    } else if (usesPlace) parentNode.classList.add('tk-lite-place');
    else {
      parentNode.classList.add('tk-lite-pack');
      if (children.some(child => ['left','right'].includes(String(child.layout?.side || '').toLowerCase()))) parentNode.classList.add('tk-lite-pack-row');
    }
    children.forEach(widget=>{
      const node=createTkinterLiteWidget(widget,radioGroups); parentNode.appendChild(node);
      const childHost=node.matches('fieldset') ? node : (['Frame','PanedWindow','LabelFrame'].includes(widget.type) ? node : null);
      if (childHost) renderChildren(widget.id,childHost);
    });
  };
  const rootWidget=(tkinterLiteSnapshot.widgets || []).find(widget=>widget.type==='Tk');
  if (rootWidget?.options) {
    const rootBg = rootWidget.options.bg ?? rootWidget.options.background;
    const rootFg = rootWidget.options.fg ?? rootWidget.options.foreground;
    if (rootBg) body.style.background = String(rootBg);
    if (rootFg) body.style.color = String(rootFg);
  }
  renderChildren(rootWidget?.id || '__root__', body);
  (tkinterLiteSnapshot.messages || []).slice(-3).forEach(message=>{
    const alert=document.createElement('div'); alert.className=`tk-lite-message ${message.kind || 'info'}`; alert.setAttribute('role','status');
    const strong=document.createElement('strong'); strong.textContent=String(message.title || 'Mensagem'); const p=document.createElement('p'); p.textContent=String(message.message || ''); alert.append(strong,p); body.appendChild(alert);
  });
}


function createPythonWorker() {
  if (pythonWorker) return pythonWorker;
  const workerSource = `
    let pyodide = null;
    let booting = null;
    let tkinterInstalled = false;
    const BASE = ${JSON.stringify(PYODIDE_BASE)};
    const TKINTER_BOOTSTRAP = ${JSON.stringify(TKINTER_LITE_PY)};
    async function ensurePyodide() {
      if (pyodide) return pyodide;
      if (!booting) booting = (async () => {
        self.postMessage({type:'status', status:'loading', text:'Carregando Python 3…'});
        importScripts(BASE + 'pyodide.js');
        pyodide = await loadPyodide({ indexURL: BASE });
        self.postMessage({type:'status', status:'ready', text:'Python pronto'});
        return pyodide;
      })();
      return booting;
    }
    async function ensureTkinterLite(runtime) {
      if (!tkinterInstalled) {
        await runtime.runPythonAsync(TKINTER_BOOTSTRAP);
        tkinterInstalled = true;
      } else {
        await runtime.runPythonAsync('__ee_tk_reset()');
      }
    }
    function snapshotTkinter(runtime, runId) {
      const snapshot = runtime.runPython('__ee_tk_snapshot()');
      self.postMessage({type:'tkinter', runId, snapshot:String(snapshot)});
    }
    self.onmessage = async event => {
      const type = event.data?.type;
      if (type === 'tk-event') {
        const runId = event.data.runId;
        try {
          const runtime = await ensurePyodide();
          runtime.globals.set('__ee_tk_values_json', JSON.stringify(event.data.values || {}));
          runtime.globals.set('__ee_tk_widget_id', String(event.data.widgetId || ''));
          await runtime.runPythonAsync('__ee_tk_apply_values(__ee_tk_values_json)\n__ee_tk_invoke(__ee_tk_widget_id)');
          snapshotTkinter(runtime, runId);
          self.postMessage({type:'status', runId, status:'ready', text:'Interface atualizada'});
        } catch (error) {
          self.postMessage({type:'error', runId, text:error?.message || String(error)});
        }
        return;
      }
      if (type !== 'run') return;
      const runId = event.data.runId;
      const code = event.data.code || '';
      const useTkinter = event.data.tkinter === true;
      try {
        const runtime = await ensurePyodide();
        if (useTkinter) await ensureTkinterLite(runtime);
        const packageScan = useTkinter
          ? code.replace(/^\s*(?:import\s+tkinter.*|from\s+tkinter(?:\.\w+)?\s+import.*)$/gm, '')
          : code;
        await runtime.loadPackagesFromImports(packageScan);
        runtime.setStdout({ batched: text => self.postMessage({type:'stdout', runId, text}) });
        runtime.setStderr({ batched: text => self.postMessage({type:'stderr', runId, text}) });
        const stdinLines = String(event.data.stdin || '').split(/\\r?\\n/);
        let stdinIndex = 0;
        runtime.setStdin({ stdin: () => stdinIndex < stdinLines.length ? stdinLines[stdinIndex++] : null });
        self.postMessage({type:'status', runId, status:'running', text:useTkinter ? 'Montando interface Tkinter…' : 'Executando…'});
        const result = await runtime.runPythonAsync(code);
        if (result !== undefined && result !== null && String(result) !== 'undefined') {
          self.postMessage({type:'result', runId, text:String(result)});
        }
        if (useTkinter) snapshotTkinter(runtime, runId);
        self.postMessage({type:'done', runId, tkinter:useTkinter});
      } catch (error) {
        self.postMessage({type:'error', runId, text:error?.message || String(error)});
        self.postMessage({type:'done', runId, failed:true, tkinter:useTkinter});
      }
    };
  `;
  const blob = new Blob([workerSource], { type:'text/javascript' });
  pythonWorkerUrl = URL.createObjectURL(blob);
  pythonWorker = new Worker(pythonWorkerUrl);
  pythonWorker.addEventListener('message', handlePythonWorkerMessage);
  pythonWorker.addEventListener('error', event => {
    appendConsole('error', `Não foi possível iniciar o Python: ${event.message || 'erro ao carregar o runtime'}. Verifique sua conexão com a internet.`);
    finishPythonRun(true);
  });
  return pythonWorker;
}

function runPythonPlayground() {
  pg.python = $('#codeEditor')?.value ?? pg.python;
  state.playground = { ...pg };
  state.playgroundLang = 'python';
  saveState();
  tkinterLiteActive = pythonUsesTkinter(pg.python);
  if (!tkinterLiteActive) {
    tkinterLiteSnapshot = null;
    if ($('#tkinterRuntime')) $('#tkinterRuntime').hidden = true;
  }
  clearConsole(tkinterLiteActive ? 'Tkinter Web Lite: mensagens, prints e erros continuam aparecendo aqui.' : 'Preparando execução Python…');
  pythonRunning = true;
  pythonRunStartedAt = performance.now();
  pythonRunId += 1;
  syncEditorMode();
  setRunStatus(pythonWorker ? (tkinterLiteActive ? 'Executando Tkinter…' : 'Executando Python…') : 'Carregando Python…', 'running');
  if ($('#pythonRuntimeText')) {
    $('#pythonRuntimeText').textContent = pythonWorker
      ? 'Executando no Worker isolado…'
      : 'Carregando o runtime Python. A primeira execução é a mais demorada.';
  }
  if (tkinterLiteActive && $('#tkinterRuntime')) {
    $('#tkinterRuntime').hidden = false;
    $('#tkinterRuntime').innerHTML = '<div class="tk-lite-loading"><span class="runtime-dot"></span><strong>Preparando Tkinter Web Lite…</strong><p>A interface aparecerá aqui quando o código terminar de montar a janela.</p></div>';
  }
  try {
    createPythonWorker().postMessage({ type:'run', runId:pythonRunId, code:pg.python, stdin:state.pythonStdin || '', tkinter:tkinterLiteActive });
  } catch (error) {
    appendConsole('error', error.message || String(error));
    finishPythonRun(true);
  }
}

function handlePythonWorkerMessage(event) {
  const message = event.data || {};
  if (message.runId && message.runId !== pythonRunId) return;
  if (message.type === 'status') {
    setRunStatus(message.text || 'Processando…', message.status === 'ready' ? 'success' : 'running');
    if ($('#pythonRuntimeText')) $('#pythonRuntimeText').textContent = message.text || 'Python em execução.';
    return;
  }
  if (message.type === 'stdout') appendConsole('log', message.text || '');
  if (message.type === 'stderr') appendConsole('warn', message.text || '');
  if (message.type === 'result') appendConsole('result', `↳ ${message.text}`);
  if (message.type === 'tkinter') {
    try { renderTkinterLite(message.snapshot); }
    catch (error) { appendConsole('error', `Tkinter Web Lite: ${error.message || String(error)}`); }
  }
  if (message.type === 'error') appendConsole('error', cleanPythonError(message.text || 'Erro desconhecido'));
  if (message.type === 'done') finishPythonRun(Boolean(message.failed));
}

function cleanPythonError(text) {
  const lines = String(text).split('\n').filter(Boolean);
  return lines.slice(-6).join('\n');
}

function finishPythonRun(failed = false) {
  const duration = Math.max(0, performance.now() - pythonRunStartedAt);
  pythonRunning = false;
  syncEditorMode();
  const time = duration < 1000 ? `${Math.round(duration)} ms` : `${(duration / 1000).toFixed(1)} s`;
  setRunStatus(failed ? 'Erro na execução' : `${tkinterLiteActive ? 'Interface pronta' : 'Concluído'} · ${time}`, failed ? 'error' : 'success');
  if ($('#pythonRuntimeText')) {
    $('#pythonRuntimeText').textContent = failed
      ? 'A execução terminou com erro. Leia o terminal para corrigir o código.'
      : (tkinterLiteActive ? 'Interface Tkinter renderizada na área de Resultado.' : 'Execução concluída. Edite o código e execute novamente quando quiser.');
  }
}

function stopPythonExecution() {
  if (!pythonWorker) return;
  pythonWorker.terminate();
  pythonWorker = null;
  if (pythonWorkerUrl) URL.revokeObjectURL(pythonWorkerUrl);
  pythonWorkerUrl = '';
  pythonRunning = false;
  syncEditorMode();
  appendConsole('warn', 'Execução interrompida pelo usuário.');
  setRunStatus('Interrompido', 'error');
  if ($('#pythonRuntimeText')) $('#pythonRuntimeText').textContent = 'Runtime interrompido. A próxima execução reiniciará o Python.';
}

function setRunStatus(text, kind = '') {
  const status = $('#runStatus');
  if (!status) return;
  status.textContent = text;
  status.dataset.kind = kind;
  if (kind === 'success') {
    setTimeout(() => {
      if ($('#runStatus')?.textContent !== text) return;
      $('#runStatus').textContent = activeLang === 'python' ? 'Python pronto' : 'Pronto';
      $('#runStatus').dataset.kind = '';
    }, 2600);
  }
}

function setPreviewViewport(viewport) {
  const device = $('#previewDevice');
  if (!device || activeLang === 'python') return;
  device.dataset.viewport = viewport;
  $$('#viewportSwitch button').forEach(button => button.classList.toggle('active', button.dataset.viewport === viewport));
}

function initWorkbenchResizer() {
  const resizer = $('#workbenchResizer');
  const workbench = $('#workbench');
  if (!resizer || !workbench) return;
  let dragging = false;
  const setSplit = clientX => {
    const rect = workbench.getBoundingClientRect();
    const percent = clamp(((clientX - rect.left) / rect.width) * 100, 36, 70);
    workbench.style.setProperty('--split', `${percent}%`);
  };
  resizer.addEventListener('pointerdown', event => {
    dragging = true;
    resizer.setPointerCapture(event.pointerId);
    workbench.classList.add('resizing');
  });
  resizer.addEventListener('pointermove', event => { if (dragging) setSplit(event.clientX); });
  resizer.addEventListener('pointerup', () => {
    dragging = false;
    workbench.classList.remove('resizing');
    state.playgroundSplit = parseFloat(getComputedStyle(workbench).getPropertyValue('--split')) || 55;
    saveState();
  });
  resizer.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const current = parseFloat(getComputedStyle(workbench).getPropertyValue('--split')) || 55;
    const next = clamp(current + (event.key === 'ArrowRight' ? 3 : -3), 36, 70);
    workbench.style.setProperty('--split', `${next}%`);
    state.playgroundSplit = next;
    saveState();
  });
}

function renderGlossary() {
  const categories = ['Todos', ...new Set(glossary.map(item => item.category).filter(Boolean).sort((a,b) => a.localeCompare(b,'pt-BR')))];
  if ($('#glossaryCategories')) {
    $('#glossaryCategories').innerHTML = categories.map(category => `<button class="glossary-category ${glossaryCategory === category ? 'active' : ''}" data-category="${escapeAttr(category)}" type="button" aria-pressed="${glossaryCategory === category}">${escapeHtml(category)}<span>${category === 'Todos' ? glossary.length : glossary.filter(item => item.category === category).length}</span></button>`).join('');
    $$('#glossaryCategories button').forEach(button => button.addEventListener('click', () => { glossaryCategory = button.dataset.category; letterFilter = 'Todos'; renderGlossary(); }));
  }

  const letters = ['Todos', ...new Set(glossary.filter(item => glossaryCategory === 'Todos' || item.category === glossaryCategory).map(item => item.term[0].toUpperCase()))];
  $('#alphabet').innerHTML = letters.map(letter => `<button class="${letterFilter === letter ? 'active' : ''}" data-letter="${escapeAttr(letter)}" aria-label="${letter === 'Todos' ? 'Todos os termos' : `Termos com ${letter}`}" aria-pressed="${letterFilter === letter}" type="button">${letter === 'Todos' ? 'Todos' : escapeHtml(letter)}</button>`).join('');
  $$('#alphabet button').forEach(button => button.addEventListener('click', () => { letterFilter = button.dataset.letter; renderGlossary(); }));
  requestAnimationFrame(syncGlossaryOverflowState);

  const query = normalizeText($('#glossarySearch').value || '');
  const filtered = glossary.filter(item =>
    (glossaryCategory === 'Todos' || item.category === glossaryCategory) &&
    (letterFilter === 'Todos' || item.term[0].toUpperCase() === letterFilter) &&
    (!query || normalizeText(`${item.term} ${item.category} ${item.definition} ${item.detail}`).includes(query))
  );
  if ($('#glossaryResultMeta')) $('#glossaryResultMeta').textContent = `${filtered.length} ${filtered.length === 1 ? 'termo' : 'termos'}`;
  if (!filtered.some(item => item.term === selectedTerm)) selectedTerm = filtered[0]?.term || '';

  $('#glossaryList').innerHTML = filtered.length ? filtered.map(item => {
    const relatedCount = (item.relatedLessonIds || []).filter(id => lessonById.has(id)).length;
    return `<button class="glossary-term-row ${item.term === selectedTerm ? 'active' : ''}" data-term="${escapeAttr(item.term)}" type="button"><span class="glossary-term-letter">${escapeHtml(item.term[0].toUpperCase())}</span><span class="glossary-term-copy"><strong>${escapeHtml(item.term)}</strong><small>${escapeHtml(item.category)}${relatedCount ? ` · ${relatedCount} ${relatedCount === 1 ? 'aula' : 'aulas'}` : ''}</small></span><span class="glossary-term-arrow">›</span></button>`;
  }).join('') : '<div class="glossary-empty"><strong>Nenhum conceito encontrado.</strong><p>Tente outra palavra, categoria ou letra.</p></div>';
  $$('#glossaryList button[data-term]').forEach(button => button.addEventListener('click', () => { selectedTerm = button.dataset.term; renderGlossary(); if (window.matchMedia('(max-width: 980px)').matches) $('.glossary-layout')?.classList.add('term-open'); }));

  const term = glossary.find(item => item.term === selectedTerm);
  if (!term) { $('#glossaryDetail').innerHTML = '<div class="glossary-empty large"><strong>Escolha um conceito.</strong><p>Selecione um termo à esquerda para abrir sua explicação.</p></div>'; return; }
  const relatedLessons = (term.relatedLessonIds || []).map(id => lessonById.get(id)).filter(Boolean).slice(0,8);
  const termWords = new Set(normalizeText(`${term.term} ${term.definition} ${term.detail}`).split(' ').filter(word => word.length > 5));
  const relatedTerms = glossary.map(item => {
    if (item.term === term.term) return { item, score:0 };
    const words = normalizeText(`${item.term} ${item.definition} ${item.detail}`).split(' ');
    const score = words.reduce((sum, word) => sum + (termWords.has(word) ? 1 : 0), 0) + (item.category === term.category ? 2 : 0);
    return { item, score };
  }).filter(entry => entry.score > 1).sort((a,b) => b.score - a.score).slice(0,6).map(entry => entry.item);

  $('#glossaryDetail').innerHTML = `<button class="glossary-mobile-back" id="glossaryMobileBack" type="button"><span aria-hidden="true">←</span> Todos os termos</button><div class="glossary-hero-card"><div class="term-monogram" aria-hidden="true">${escapeHtml(term.term[0].toUpperCase())}</div><div class="term-hero-copy"><div class="term-meta-row"><span class="term-type">${escapeHtml(term.category)}</span><span>${relatedLessons.length ? `${relatedLessons.length} ${relatedLessons.length === 1 ? 'aula relacionada' : 'aulas relacionadas'}` : 'conceito essencial'}</span></div><h2>${escapeHtml(term.term)}</h2><p class="definition">${escapeHtml(term.definition)}</p></div></div><div class="glossary-detail-grid"><section class="glossary-explain-card"><span class="detail-kicker">Em detalhes</span><h3>Entenda melhor</h3><p>${escapeHtml(term.detail)}</p></section><aside class="glossary-quick-card"><span class="detail-kicker">Leitura rápida</span><strong>${escapeHtml(term.definition)}</strong><button class="text-link" id="copyGlossaryDefinition" type="button">Copiar definição</button></aside></div>${relatedLessons.length ? `<section class="glossary-related-section"><div class="glossary-section-head"><div><span class="detail-kicker">Continue aprendendo</span><h3>Aulas relacionadas</h3></div><span>${relatedLessons.length} resultados</span></div><div class="glossary-lesson-grid">${relatedLessons.map(lesson => `<a class="glossary-lesson-card" href="#aula/${encodeURIComponent(lesson.id)}"><span class="glossary-lesson-icon"><svg class="ui-icon"><use href="#icon-${techIconId(lesson.courseId)}"></use></svg></span><span><small>${escapeHtml(techLabel(lesson.courseId))} · ${escapeHtml(lesson.moduleTitle || 'Curso')}</small><strong>${escapeHtml(lesson.title)}</strong></span><span class="glossary-term-arrow">›</span></a>`).join('')}</div></section>` : ''}${relatedTerms.length ? `<section class="glossary-related-section"><div class="glossary-section-head"><div><span class="detail-kicker">Explore conexões</span><h3>Termos relacionados</h3></div></div><div class="related-links">${relatedTerms.map(item => `<button class="related-link" type="button" data-related-term="${escapeAttr(item.term)}">${escapeHtml(item.term)}<small>${escapeHtml(item.category)}</small></button>`).join('')}</div></section>` : ''}`;
  $('#glossaryMobileBack')?.addEventListener('click', () => { resetGlossaryMobileView(); $('#glossarySearch')?.focus(); });
  $('#copyGlossaryDefinition')?.addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(`${term.term}: ${term.definition}`); setTransientButton(event.currentTarget, 'Copiado'); } catch { setTransientButton(event.currentTarget, 'Falha ao copiar'); }
  });
  $$('[data-related-term]').forEach(button => button.addEventListener('click', () => { selectedTerm = button.dataset.relatedTerm; letterFilter = 'Todos'; renderGlossary(); if (window.matchMedia('(max-width: 980px)').matches) $('.glossary-layout')?.classList.add('term-open'); window.scrollTo({ top:0, behavior:'smooth' }); }));
}

function initTermButtons() {
  $$('.term-inline').forEach(button => button.addEventListener('click', event => showTermPopover(button.dataset.term, event.currentTarget)));
}
function showTermPopover(termName, anchor) {
  const term = glossary.find(item => normalizeText(item.term) === normalizeText(termName));
  if (!term) return;
  const popover = $('#termPopover');
  $('#termPopoverCategory').textContent = term.category;
  $('#termPopoverTitle').textContent = term.term;
  $('#termPopoverDefinition').textContent = term.definition;
  $('#termPopoverOpen').onclick = () => { selectedTerm = term.term; popover.hidden = true; location.hash = `#glossario/${encodeURIComponent(term.term)}`; };
  popover.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 28);
  const left = clamp(rect.left, 14, window.innerWidth - width - 14);
  const top = clamp(rect.bottom + 10, 14, window.innerHeight - 220);
  popover.style.left = `${left}px`; popover.style.top = `${top}px`;
}

function courseCertificateEligibility(course) {
  const courseLessons = getCourseLessons(course.id);
  const lessonsDone = courseLessons.filter(lesson => state.completedLessons.includes(lesson.id)).length;
  const techNames = new Set([normalizeText(course.title), normalizeText(course.code), normalizeText(course.id)]);
  const courseExercises = exercises.filter(exercise => techNames.has(normalizeText(exercise.tech)) || (exercise.relatedLessonId && lessonById.get(exercise.relatedLessonId)?.courseId === course.id));
  const exercisesDone = courseExercises.filter(exercise => state.completedExercises.includes(exercise.id)).length;
  const exerciseRate = courseExercises.length ? Math.round((exercisesDone / courseExercises.length) * 100) : 100;
  const checkpoints = (course.modules || []).map(module => state.moduleCheckpoints[`${course.id}:${module.id}`]).filter(item => item?.score >= 70);
  const checkpointGoal = Math.min(3, Math.max(1, Math.ceil((course.modules?.length || 1) / 6)));
  const relatedProjects = projects.filter(project => (project.tech || []).some(tech => techNames.has(normalizeText(tech))));
  const projectDone = relatedProjects.some(project => state.completedProjects.includes(project.id));
  const requirements = [
    { label:'Aulas', pass:lessonsDone === courseLessons.length, value:`${lessonsDone}/${courseLessons.length}` },
    { label:'Exercícios', pass:exerciseRate >= 70, value:`${exerciseRate}%` },
    { label:'Checkpoints', pass:checkpoints.length >= checkpointGoal, value:`${checkpoints.length}/${checkpointGoal}` },
    { label:'Projeto', pass:projectDone, value:projectDone ? 'Concluído' : 'Pendente' }
  ];
  return { eligible:requirements.every(item => item.pass), requirements, exerciseRate, checkpointGoal };
}

function openCourseCertificate(courseId) {
  const course = courseById.get(courseId);
  if (!course) return;
  const eligibility = courseCertificateEligibility(course);
  if (!eligibility.eligible) { showToast('Conclua os critérios da trilha antes de gerar o certificado.'); return; }
  const dialog = $('#certificateDialog'); const input = $('#certificateName');
  if (!dialog || !input) return;
  input.value = state.certificateName || '';
  dialog.dataset.course = course.id;
  renderCourseCertificatePreview(course);
  if (!dialog.open) dialog.showModal();
  setTimeout(() => input.focus(), 50);
}

function renderCourseCertificatePreview(course) {
  const host = $('#certificatePreview'); if (!host || !course) return;
  const name = ($('#certificateName')?.value || state.certificateName || 'Estudante').trim() || 'Estudante';
  const date = new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date());
  host.innerHTML = `<div class="certificate-mark">EE <span>&lt;/&gt;</span></div><span class="certificate-kicker">CERTIFICADO DE CONCLUSÃO</span><h2>${escapeHtml(course.title)}</h2><p>Certificamos que</p><strong class="certificate-student">${escapeHtml(name)}</strong><p>concluiu a trilha de <b>${escapeHtml(course.title)}</b> no Epoch Education, incluindo aulas, prática, checkpoints e projeto aplicado.</p><div class="certificate-meta"><span>${getCourseLessons(course.id).length} aulas</span><span>${course.modules.length} módulos</span><span>${escapeHtml(date)}</span></div>`;
}

function initCertificateFeature() {
  $('#closeCertificate')?.addEventListener('click', () => $('#certificateDialog')?.close());
  $('#certificateDialog')?.addEventListener('click', event => { if (event.target === $('#certificateDialog')) $('#certificateDialog').close(); });
  $('#certificateName')?.addEventListener('input', event => { state.certificateName = event.currentTarget.value.slice(0,90); saveState(); const course = courseById.get($('#certificateDialog')?.dataset.course); if (course) renderCourseCertificatePreview(course); });
  $('#printCertificate')?.addEventListener('click', () => window.print());
  document.addEventListener('click', event => { const button = event.target.closest('[data-certificate-course]'); if (button) { event.preventDefault(); openCourseCertificate(button.dataset.certificateCourse); } });
}

function achievements() {
  const firstCourse = courses.find(course => courseProgress(course.id) >= 100);
  return [
    { title:'Primeiro passo', description:'Conclua sua primeira aula.', unlocked:state.completedLessons.length >= 1 },
    { title:'Praticando', description:'Conclua 10 exercícios.', unlocked:state.completedExercises.length >= 10 },
    { title:'Persistente', description:'Conclua 7 aulas.', unlocked:state.completedLessons.length >= 7 },
    { title:firstCourse ? `${firstCourse.title} concluído` : 'Trilha completa', description:'Conclua uma trilha inteira.', unlocked:Boolean(firstCourse) }
  ];
}
function renderProgress() {
  const total = overallProgress();
  const completedActivities = state.completedProjects.length + state.completedChallenges.length;
  const reviewItems = getReviewExercises(6);
  const recommended = getRecommendedLesson();
  const activity = state.activity.slice(0, 6);
  const startedCourseIds = new Set();
  courses.forEach(course => {
    if (getCourseLessons(course.id).some(lesson => state.completedLessons.includes(lesson.id))) startedCourseIds.add(course.id);
  });

  const summaryHost = $('#progressSummary');
  if (summaryHost) summaryHost.innerHTML = `<article class="progress-overview-card">
    <div class="progress-overview-main"><span class="detail-kicker">Progresso geral</span><div class="progress-overview-value"><strong>${total}%</strong><span>${total === 0 ? 'Pronto para começar' : total < 35 ? 'Construindo a base' : total < 75 ? 'Avançando com consistência' : total < 100 ? 'Reta final' : 'Jornada concluída'}</span></div><div class="progress progress-overview-bar"><span style="width:${total}%"></span></div></div>
    <div class="progress-overview-stats"><div><strong>${state.completedLessons.length}</strong><span>Aulas concluídas</span></div><div><strong>${state.completedExercises.length}</strong><span>Exercícios concluídos</span></div><div><strong>${completedActivities}</strong><span>Projetos + desafios</span></div><div><strong>${reviewItems.length}</strong><span>Para revisar agora</span></div></div>
  </article>`;

  const journeyHost = $('#progressJourney');
  if (journeyHost) {
    if (total === 0 && recommended) {
      journeyHost.innerHTML = `<article class="progress-journey-card is-start"><div class="progress-journey-icon"><svg class="ui-icon"><use href="#icon-book"></use></svg></div><div class="progress-journey-copy"><span class="detail-kicker">Primeiro passo recomendado</span><h3>${escapeHtml(recommended.title)}</h3><p>Comece por ${escapeHtml(techLabel(recommended.courseId))} · ${escapeHtml(recommended.moduleTitle)}. Depois da aula, faça uma prática curta para consolidar o conceito.</p><div class="progress-journey-meta"><span>${escapeHtml(techLabel(recommended.courseId))}</span><span>~${estimateLessonTime(recommended).total} min</span></div></div><div class="progress-journey-actions"><a class="button primary" href="#aula/${encodeURIComponent(recommended.id)}">Começar primeira aula</a><a class="button secondary" href="#trilhas">Explorar trilhas</a></div></article>`;
    } else if (recommended) {
      journeyHost.innerHTML = `<article class="progress-journey-card"><div class="progress-journey-icon"><svg class="ui-icon"><use href="#icon-book"></use></svg></div><div class="progress-journey-copy"><span class="detail-kicker">Continue daqui</span><h3>${escapeHtml(recommended.title)}</h3><p>${escapeHtml(techLabel(recommended.courseId))} · ${escapeHtml(recommended.moduleTitle)}. ${reviewItems.length ? `Você também tem ${reviewItems.length} ${reviewItems.length === 1 ? 'exercício priorizado' : 'exercícios priorizados'} para revisão.` : 'Sua fila de revisão está em dia.'}</p><div class="progress-journey-meta"><span>${courseProgress(recommended.courseId)}% da trilha</span><span>~${estimateLessonTime(recommended).total} min</span></div></div><div class="progress-journey-actions"><a class="button primary" href="#aula/${encodeURIComponent(recommended.id)}">Continuar estudando</a>${reviewItems.length ? '<button class="button secondary" type="button" data-start-review>Revisar agora</button>' : '<button class="button secondary" type="button" data-start-quick>Prática rápida</button>'}</div></article>`;
    } else {
      journeyHost.innerHTML = `<article class="progress-journey-card"><div class="progress-journey-icon"><svg class="ui-icon"><use href="#icon-trophy"></use></svg></div><div class="progress-journey-copy"><span class="detail-kicker">Todas as aulas concluídas</span><h3>Leve o conhecimento para projetos reais.</h3><p>Use projetos e desafios para consolidar o que aprendeu e continuar praticando.</p></div><div class="progress-journey-actions"><a class="button primary" href="#projetos">Explorar projetos</a><a class="button secondary" href="#desafios">Abrir desafios</a></div></article>`;
    }
  }

  const tracksHost = $('#progressTracks');
  if (tracksHost) tracksHost.innerHTML = courses.map(course => {
    const courseLessons = getCourseLessons(course.id);
    const completed = courseLessons.filter(lesson => state.completedLessons.includes(lesson.id)).length;
    const progress = courseProgress(course.id);
    const next = courseLessons.find(lesson => !state.completedLessons.includes(lesson.id));
    const started = startedCourseIds.has(course.id) || progress > 0;
    const currentModule = next?.moduleTitle || course.modules?.[course.modules.length - 1]?.title || 'Trilha';
    const certificate = courseCertificateEligibility(course);
    return `<article class="progress-track-card ${started ? 'is-started' : 'is-new'}"><div class="progress-track-head"><span class="progress-track-tech"><svg class="ui-icon"><use href="#icon-${techIconId(course.id)}"></use></svg>${escapeHtml(course.code)}</span><span class="progress-track-state">${progress >= 100 ? 'Concluída' : started ? `${progress}%` : 'Não iniciada'}</span></div><div class="progress-track-copy"><h3>${escapeHtml(started ? currentModule : course.modules?.[0]?.title || course.title)}</h3><p>${started ? `${completed} de ${courseLessons.length} aulas concluídas` : `${course.modules.length} módulos · ${courseLessons.length} aulas`}</p></div><div class="progress progress-track-bar"><span style="width:${progress}%"></span></div>${next ? `<a class="text-link" href="#aula/${encodeURIComponent(next.id)}">${started ? 'Continuar trilha' : 'Começar trilha'} →</a>` : certificate.eligible ? `<button class="text-link" type="button" data-certificate-course="${escapeAttr(course.id)}">Gerar certificado →</button>` : '<span class="progress-track-complete">Trilha concluída · complete prática, checkpoints e projeto para o certificado</span>'}</article>`;  }).join('');

  const reviewHost = $('#reviewCenter');
  if (reviewHost) reviewHost.innerHTML = `<article class="review-overview-card progress-review-card"><div><span class="detail-kicker">Fila adaptativa</span><h3>${reviewItems.length ? `${reviewItems.length} ${reviewItems.length === 1 ? 'ponto priorizado' : 'pontos priorizados'}` : 'Nenhuma pendência forte agora'}</h3><p>${reviewItems.length ? 'Erros recentes e conteúdos pouco praticados aparecem primeiro, para você revisar só o que realmente precisa.' : 'Continue estudando normalmente. A fila será preenchida conforme seus exercícios e checkpoints.'}</p></div><div class="review-overview-actions"><button class="button ${reviewItems.length ? 'primary' : 'secondary'}" type="button" data-start-review>${reviewItems.length ? 'Revisar agora' : 'Praticar agora'}</button><button class="text-button" type="button" data-start-quick>Prática rápida · 10</button></div></article>${reviewItems.length ? `<div class="review-queue">${reviewItems.slice(0,4).map(exercise => { const record = state.exerciseHistory[String(exercise.id)] || {}; const reason = getReviewReason(exercise); return `<div class="review-queue-item"><span><small>${escapeHtml(exercise.tech)} · ${escapeHtml(reason)}</small><strong>${escapeHtml(exercise.title)}</strong></span><a class="text-link" href="#exercicios/${encodeURIComponent(exercise.id)}">Abrir →</a></div>`; }).join('')}</div>` : ''}`;

  const masteryEntries = [];
  courses.forEach(course => (course.modules || []).forEach(module => {
    const mastery = getModuleMastery(course, module);
    const attempted = mastery.moduleExercises.some(exercise => (state.exerciseAttempts[exercise.id] || 0) > 0);
    const started = mastery.completedLessons > 0 || attempted || Boolean(mastery.checkpoint);
    if (started) masteryEntries.push({ course, module, mastery });
  }));
  masteryEntries.sort((a,b) => a.mastery.score - b.mastery.score || b.mastery.completedLessons - a.mastery.completedLessons);
  const masterySection = $('#progressMasterySection');
  const masteryHost = $('#masteryGrid');
  if (masterySection && masteryHost) {
    masterySection.hidden = masteryEntries.length === 0;
    masteryHost.innerHTML = masteryEntries.slice(0, 8).map(({course,module,mastery}) => {
      const canCheckpoint = mastery.completedLessons >= Math.max(1, Math.ceil(mastery.totalLessons * .65)) && mastery.moduleExercises.length >= 2;
      const nextLesson = module.lessonIds.find(id => !state.completedLessons.includes(id)) || module.lessonIds[0] || '';
      return `<article class="mastery-card progress-mastery-card"><div class="mastery-card-head"><span class="badge">${escapeHtml(course.code)}</span><strong>${mastery.score}%</strong></div><h3>${escapeHtml(module.title)}</h3><div class="mastery-status"><span>${escapeHtml(mastery.status)}</span><small>${mastery.completedLessons}/${mastery.totalLessons} aulas${mastery.checkpoint ? ` · checkpoint ${mastery.checkpoint.score}%` : ''}</small></div><div class="progress"><span style="width:${mastery.score}%"></span></div>${canCheckpoint ? `<button class="text-link" type="button" data-checkpoint-course="${escapeAttr(course.id)}" data-checkpoint-module="${escapeAttr(module.id)}">${mastery.checkpoint ? 'Refazer checkpoint' : 'Fazer checkpoint'} →</button>` : `<a class="text-link" href="#aula/${encodeURIComponent(nextLesson)}">Continuar módulo →</a>`}</article>`;
    }).join('');
  }

  const startedProjects = projects.map(project => {
    const steps = state.projectSteps[project.id] || [];
    const done = steps.filter(Boolean).length;
    return { project, done, total:project.steps?.length || 0, completed:state.completedProjects.includes(project.id) };
  }).filter(item => item.done > 0 && !item.completed);
  const projectsSection = $('#progressProjectsSection');
  const projectsHost = $('#progressProjects');
  if (projectsSection && projectsHost) {
    projectsSection.hidden = startedProjects.length === 0;
    projectsHost.innerHTML = startedProjects.slice(0, 4).map(({project,done,total}) => { const percent = total ? Math.round((done / total) * 100) : 0; return `<article class="progress-project-card"><div><span class="detail-kicker">${escapeHtml((project.tech || []).join(' · ') || 'Projeto')}</span><h3>${escapeHtml(project.title)}</h3><p>${done} de ${total} etapas concluídas</p></div><div class="progress-project-meter"><strong>${percent}%</strong><div class="progress"><span style="width:${percent}%"></span></div></div><a class="text-link" href="#projetos">Continuar projeto →</a></article>`; }).join('');
  }

  const activityHost = $('#progressActivity');
  if (activityHost) activityHost.innerHTML = activity.length ? `<div class="progress-activity-head"><strong>Atividade recente</strong><span>${activity.length} registros</span></div><div class="progress-activity-list">${activity.map(item => `<div class="progress-activity-item"><span class="progress-activity-dot" aria-hidden="true"></span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.meta || '')}${item.meta ? ' · ' : ''}${formatTime(item.time)}</small></span></div>`).join('')}</div>` : `<div class="progress-empty-inline"><strong>Seu histórico começa quando você estudar.</strong><span>Conclua uma aula ou exercício e as atividades aparecerão aqui.</span></div>`;

  renderStudyHistory();
  renderCloudSyncStatus();
  renderPwaStatus();

  const achievementItems = achievements();
  const unlocked = achievementItems.filter(item => item.unlocked);
  const nextLocked = achievementItems.find(item => !item.unlocked);
  const visibleAchievements = [...unlocked.slice(-3), ...(nextLocked ? [nextLocked] : [])].slice(0,4);
  $('#achievementGrid').innerHTML = visibleAchievements.map(item => `<article class="achievement-card ${item.unlocked ? '' : 'locked'}"><div class="achievement-icon"><svg class="ui-icon"><use href="#icon-trophy"></use></svg></div><div><span class="detail-kicker">${item.unlocked ? 'Concluída' : 'Próximo marco'}</span><h3>${escapeHtml(item.title)}</h3><p>${item.unlocked ? 'Conquista desbloqueada.' : escapeHtml(item.description)}</p></div></article>`).join('');
}

let searchActiveIndex = -1;
let currentSearchResults = [];
function buildSearchIndex() {
  const items = [];
  courses.forEach(course => {
    items.push({ type:'Trilha', title:course.title, desc:`${course.modules.length} módulos · ${getCourseLessons(course.id).length} aulas`, href:'#trilhas', keywords:course.description });
    (course.modules || []).forEach(module => {
      const first = lessonById.get(module.lessonIds?.[0]);
      if (first) items.push({ type:'Módulo', title:module.title, desc:`${course.title} · ${module.lessonIds.length} aulas`, href:`#aula/${encodeURIComponent(first.id)}`, keywords:course.title });
    });
  });
  lessons.forEach(lesson => items.push({ type:'Aula', title:lesson.title, desc:`${techLabel(lesson.courseId)} → ${lesson.moduleTitle}`, href:`#aula/${encodeURIComponent(lesson.id)}`, keywords:[lesson.intro,lesson.explanation,lesson.summary].filter(Boolean).join(' ') }));
  exercises.forEach(exercise => items.push({ type:'Exercício', title:exercise.title, desc:`${exercise.tech} · ${exercise.difficulty || exercise.type}`, href:`#exercicios/${encodeURIComponent(exercise.id)}`, keywords:exercise.prompt }));
  challenges.forEach(challenge => items.push({ type:'Desafio', title:challenge.title, desc:`${challenge.tech} · ${challenge.level}`, href:'#desafios', keywords:challenge.description }));
  projects.forEach(project => items.push({ type:'Projeto', title:project.title, desc:(project.tech || []).join(' · '), href:'#projetos', keywords:[project.description, project.objective, ...(project.concepts || [])].join(' ') }));
  glossary.forEach(term => items.push({ type:'Glossário', title:term.term, desc:term.definition, href:`#glossario/${encodeURIComponent(term.term)}`, keywords:term.detail }));
  return items;
}
const searchIndex = buildSearchIndex().map(item => ({ ...item, _title:normalizeText(item.title), _desc:normalizeText(item.desc), _keywords:normalizeText(item.keywords) }));
function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const source = String(text);
  const index = normalizeText(source).indexOf(normalizeText(query));
  if (index < 0) return escapeHtml(source);
  const rawQuery = String(query).trim();
  const regex = new RegExp(`(${rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return escapeHtml(source).replace(regex, '<mark>$1</mark>');
}

function searchEditDistance(a = '', b = '') {
  a = normalizeText(a); b = normalizeText(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({length:b.length + 1}, (_,i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) curr[j] = Math.min(curr[j-1] + 1, prev[j] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
function fuzzyTitleScore(title = '', query = '') {
  const q = normalizeText(query); const t = normalizeText(title);
  if (!q || q.length < 3) return 0;
  const words = t.split(/\s+/).filter(Boolean);
  let best = Infinity;
  for (const word of words) {
    if (Math.abs(word.length - q.length) > 3) continue;
    best = Math.min(best, searchEditDistance(word, q));
  }
  const allowed = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
  return best <= allowed ? Math.max(20, 52 - best * 11) : 0;
}

function openSearch() {
  const dialog = $('#searchDialog');
  if (!dialog.open) dialog.showModal();
  setTimeout(() => $('#globalSearch').focus(), 10);
  renderSearch($('#globalSearch').value || '');
}
function rememberSearchQuery(query = '') {
  const value = String(query).trim();
  if (value.length < 2) return;
  state.searchHistory = [value, ...(state.searchHistory || []).filter(item => normalizeText(item) !== normalizeText(value))].slice(0,8);
  saveState();
}

function renderSearch(query) {
  const input = $('#globalSearch');
  const normalized = normalizeText(query);
  const resultHost = $('#searchResults');
  if (!resultHost) return;

  if (!normalized) {
    currentSearchResults = [];
    searchActiveIndex = -1;
    const recent = (state.searchHistory || []).slice(0,6);
    const recommended = [
      getRecommendedLesson() ? { label:'Continuar aula', href:`#aula/${encodeURIComponent(getRecommendedLesson().id)}`, meta:getRecommendedLesson().title } : null,
      { label:'Prática rápida', href:'#exercicios', meta:'Exercícios recomendados' },
      { label:'Abrir Playground', href:'#playground', meta:'Testar código' }
    ].filter(Boolean);
    resultHost.innerHTML = `${recent.length ? `<section class="search-start-section"><div class="search-group-title"><span>Pesquisas recentes</span><span class="search-group-actions"><small>${recent.length}</small><button class="search-clear-history" id="clearSearchHistory" type="button">Limpar</button></span></div><div class="search-history-chips">${recent.map(item => `<button class="search-history-chip" type="button" data-search-history="${escapeAttr(item)}"><svg class="ui-icon" aria-hidden="true"><use href="#icon-clock"></use></svg>${escapeHtml(item)}</button>`).join('')}</div></section>` : ''}<section class="search-start-section"><div class="search-group-title"><span>Atalhos</span><small>3</small></div><div class="search-shortcuts">${recommended.map(item => `<a href="${item.href}" class="search-shortcut"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.meta)}</small></span><span aria-hidden="true">→</span></a>`).join('')}</div></section>`;
    $('[data-search-history]', resultHost).forEach(button => button.addEventListener('click', () => { input.value = button.dataset.searchHistory; searchExpandedGroups.clear(); renderSearch(input.value); input.focus(); }));
    $('#clearSearchHistory', resultHost)?.addEventListener('click', () => {
      state.searchHistory = [];
      saveState();
      input.value = '';
      renderSearch('');
      input.focus();
      showToast('Pesquisas recentes limpas.');
    });
    $('.search-shortcut', resultHost).forEach(link => link.addEventListener('click', () => $('#searchDialog')?.close()));
    return;
  }

  const ranked = searchIndex.map(item => {
    const title = item._title; const desc = item._desc; const keywords = item._keywords;
    let score = 0;
    if (title === normalized) score = 100;
    else if (title.startsWith(normalized)) score = 84;
    else if (title.includes(normalized)) score = 64;
    else if (desc.includes(normalized)) score = 38;
    else if (keywords.includes(normalized)) score = 18;
    else score = fuzzyTitleScore(item.title, normalized);
    return { item, score };
  }).filter(entry => entry.score > 0).sort((a,b) => b.score - a.score || a.item.title.localeCompare(b.item.title,'pt-BR'));

  const limits = { 'Aula': 5, 'Módulo': 3, 'Exercício': 3, 'Projeto': 2, 'Desafio': 2, 'Glossário': 3, 'Trilha': 2 };
  const allGrouped = new Map();
  ranked.forEach(({ item }) => { const list = allGrouped.get(item.type) || []; list.push(item); allGrouped.set(item.type,list); });
  const preferredOrder = ['Trilha','Módulo','Aula','Exercício','Projeto','Desafio','Glossário'];
  const groups = preferredOrder.map(type => {
    const all = allGrouped.get(type) || [];
    const limit = searchExpandedGroups.has(type) ? Math.min(all.length, 30) : (limits[type] || 3);
    return [type, all.slice(0,limit), all.length];
  }).filter(([,items]) => items.length);
  currentSearchResults = groups.flatMap(([,items]) => items);
  searchActiveIndex = currentSearchResults.length ? 0 : -1;

  let runningIndex = 0;
  if (currentSearchResults.length) {
    resultHost.innerHTML = groups.map(([type,items,total]) => {
      const links = items.map(item => {
        const index = runningIndex++;
        return `<a class="search-result ${index === searchActiveIndex ? 'active' : ''}" href="${item.href}" data-search-index="${index}"><span class="search-result-copy"><small>${escapeHtml(item.desc)}</small><strong>${highlightMatch(item.title, query)}</strong></span><span class="search-result-type">${escapeHtml(type)}</span></a>`;
      }).join('');
      const more = total > items.length ? `<button class="search-show-more" type="button" data-search-expand="${escapeAttr(type)}">Ver mais ${Math.min(total-items.length,30-items.length)} ${escapeHtml(type.toLocaleLowerCase('pt-BR'))}${total-items.length > 1 ? 's' : ''}</button>` : '';
      return `<section class="search-result-group"><div class="search-group-title"><span>${escapeHtml(type)}</span><small>${total}</small></div>${links}${more}</section>`;
    }).join('');
  } else {
    const words = [...new Set(searchIndex.flatMap(item => item._title.split(/\s+/)).filter(word => word.length >= 3))];
    const suggestion = words.map(word => ({ word, distance:searchEditDistance(word, normalized) })).filter(item => item.distance <= (normalized.length <= 5 ? 2 : 3)).sort((a,b)=>a.distance-b.distance || a.word.length-b.word.length)[0];
    resultHost.innerHTML = `<div class="empty-state"><strong>Não encontramos “${escapeHtml(query)}”.</strong><br>${suggestion ? `Talvez você quisesse buscar <button class="search-spelling-suggestion" type="button" data-search-history="${escapeAttr(suggestion.word)}">“${escapeHtml(suggestion.word)}”</button>.` : 'Tente um termo mais geral ou verifique a digitação.'}</div>`;
  }

  $$('[data-search-index]', resultHost).forEach(link => link.addEventListener('click', () => { rememberSearchQuery(query); $('#searchDialog')?.close(); }));
  $$('[data-search-expand]', resultHost).forEach(button => button.addEventListener('click', () => { searchExpandedGroups.add(button.dataset.searchExpand); renderSearch(query); }));
  $$('[data-search-history]', resultHost).forEach(button => button.addEventListener('click', () => { input.value = button.dataset.searchHistory; searchExpandedGroups.clear(); renderSearch(input.value); input.focus(); }));
}

function setSearchActive(index) {
  if (!currentSearchResults.length) return;
  searchActiveIndex = (index + currentSearchResults.length) % currentSearchResults.length;
  $$('.search-result').forEach((item, i) => item.classList.toggle('active', i === searchActiveIndex));
  $$('.search-result')[searchActiveIndex]?.scrollIntoView({ block:'nearest' });
}
function initSearch() {
  const dialog = $('#searchDialog'); const input = $('#globalSearch');
  $('#openSearch').addEventListener('click', openSearch);
  let searchTimer = 0;
  input.addEventListener('input', () => { searchExpandedGroups.clear(); clearTimeout(searchTimer); searchTimer = setTimeout(() => renderSearch(input.value), 110); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSearchActive(searchActiveIndex + 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSearchActive(searchActiveIndex - 1); }
    if (event.key === 'Enter' && searchActiveIndex >= 0) { event.preventDefault(); const target = $$('.search-result')[searchActiveIndex]; target?.click(); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
    if (event.key === '/' && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey && !dialog.open) {
      event.preventDefault();
      openSearch();
    }
  });
}

function resolveTheme() {
  if (state.theme === 'dark' || state.theme === 'light') return state.theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
let themeTransitionTimer = 0;
let brandSwapTimer = 0;

function syncBrandThemeAssets(theme, animate = false) {
  const isLight = theme === 'light';
  const brandImages = $$('.brand-symbol');
  const setBrandSources = () => {
    brandImages.forEach(img => {
      const darkSrc = img.dataset.darkSrc || img.getAttribute('src');
      const lightSrc = img.dataset.lightSrc || darkSrc;
      img.setAttribute('src', isLight ? lightSrc : darkSrc);
    });
  };

  clearTimeout(brandSwapTimer);
  if (animate && brandImages.length) {
    brandImages.forEach(img => img.classList.add('is-theme-swapping'));
    brandSwapTimer = window.setTimeout(() => {
      setBrandSources();
      requestAnimationFrame(() => brandImages.forEach(img => img.classList.remove('is-theme-swapping')));
    }, 120);
  } else {
    setBrandSources();
    brandImages.forEach(img => img.classList.remove('is-theme-swapping'));
  }

  const icon32 = $('#favicon32');
  const icon16 = $('#favicon16');
  const apple = $('#appleTouchIcon');
  if (icon32) icon32.href = isLight ? icon32.dataset.lightHref : icon32.dataset.darkHref;
  if (icon16) icon16.href = isLight ? icon16.dataset.lightHref : icon16.dataset.darkHref;
  if (apple) apple.href = isLight ? apple.dataset.lightHref : apple.dataset.darkHref;
}

function applyTheme(theme, { animate = false } = {}) {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const shouldAnimate = animate && !reducedMotion;
  const themeToggle = $('#themeToggle');

  clearTimeout(themeTransitionTimer);
  if (shouldAnimate) {
    root.classList.remove('theme-transitioning');
    themeToggle?.classList.remove('theme-toggle-animating');
    void root.offsetWidth;
    root.classList.add('theme-transitioning');
    themeToggle?.classList.add('theme-toggle-animating');
  }

  root.dataset.theme = theme;
  themeToggle?.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#08090a' : '#f5efe6';
  syncBrandThemeAssets(theme, shouldAnimate);

  if (shouldAnimate) {
    themeTransitionTimer = window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
      themeToggle?.classList.remove('theme-toggle-animating');
    }, 520);
  } else {
    root.classList.remove('theme-transitioning');
    themeToggle?.classList.remove('theme-toggle-animating');
  }
}

function initTheme() {
  applyTheme(resolveTheme(), { animate: false });
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    state.theme = next;
    applyTheme(next, { animate: true });
    saveState();
  });
}
function initMobileMenu() {
  const button = $('#mobileMenuButton');
  const nav = $('#mobileNav');
  if (!button || !nav) return;

  const setOpen = open => {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.hidden = !open;
    button.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-${open ? 'close' : 'menu'}"></use></svg>`;
  };

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  $$('#mobileNav a').forEach(link => link.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', event => {
    if (button.getAttribute('aria-expanded') !== 'true') return;
    if (nav.contains(event.target) || button.contains(event.target)) return;
    setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1260 && button.getAttribute('aria-expanded') === 'true') setOpen(false);
  }, { passive:true });
}
function initLessonMobile() {
  const button = $('#lessonMobileToggle'); const sidebar = $('.lesson-sidebar');
  if (!button || !sidebar) return;
  const setOpen = open => {
    button.setAttribute('aria-expanded', String(open));
    sidebar.classList.toggle('mobile-open', open);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  $('#lessonNavSearch')?.addEventListener('input', event => filterLessonNavigation(event.currentTarget.value));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') { event.preventDefault(); setOpen(false); button.focus(); }
  });
  document.addEventListener('click', event => {
    if (button.getAttribute('aria-expanded') !== 'true' || window.innerWidth > 980) return;
    if (sidebar.contains(event.target) || button.contains(event.target)) return;
    setOpen(false);
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 980) setOpen(false); scheduleLessonScrollState(); }, { passive:true });
  window.addEventListener('scroll', scheduleLessonScrollState, { passive:true });
}

function enableHorizontalWheelScroll(element) {
  if (!element || element.dataset.wheelScrollReady === 'true') return;
  element.dataset.wheelScrollReady = 'true';

  element.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const maxScroll = element.scrollWidth - element.clientWidth;
    if (maxScroll <= 1) return;

    const previous = element.scrollLeft;
    const next = Math.max(0, Math.min(maxScroll, previous + event.deltaY));

    // At either end, allow the page to keep scrolling vertically.
    if (Math.abs(next - previous) < 0.5) return;

    event.preventDefault();
    element.scrollLeft = next;
  }, { passive: false });
}

function syncHorizontalOverflowState(element) {
  if (!element) return;
  const group = element.closest('.glossary-filter-group');
  const max = Math.max(0, element.scrollWidth - element.clientWidth);
  const overflow = max > 2;
  group?.classList.toggle('has-horizontal-overflow', overflow);
  group?.classList.toggle('at-start', !overflow || element.scrollLeft <= 2);
  group?.classList.toggle('at-end', !overflow || element.scrollLeft >= max - 2);
}

function bindHorizontalOverflowState(element) {
  if (!element || element.dataset.overflowStateReady === 'true') return;
  element.dataset.overflowStateReady = 'true';
  const sync = () => syncHorizontalOverflowState(element);
  element.addEventListener('scroll', sync, { passive:true });
  if ('ResizeObserver' in window) new ResizeObserver(sync).observe(element);
  window.addEventListener('resize', sync, { passive:true });
  requestAnimationFrame(sync);
}

function syncGlossaryOverflowState() {
  syncHorizontalOverflowState($('#glossaryCategories'));
  syncHorizontalOverflowState($('#alphabet'));
}

function initGlossaryHorizontalNavigation() {
  const categories = $('#glossaryCategories');
  const alphabet = $('#alphabet');
  [categories, alphabet].forEach(element => {
    enableHorizontalWheelScroll(element);
    bindHorizontalOverflowState(element);
  });
}

function initGlossary() {
  let timer = 0;
  $('#glossarySearch').addEventListener('input', () => {
    resetGlossaryMobileView();
    clearTimeout(timer);
    timer = setTimeout(renderGlossary, 100);
  });
  initGlossaryHorizontalNavigation();
}
function initTermPopover() {
  $('#closeTermPopover').addEventListener('click', () => { $('#termPopover').hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#termPopover').hidden) { $('#termPopover').hidden = true; } });
  document.addEventListener('click', event => {
    const popover = $('#termPopover');
    if (!popover.hidden && !popover.contains(event.target) && !event.target.closest('.term-inline')) popover.hidden = true;
  });
}
function initResetProgress() {
  $('#resetProgress').addEventListener('click', async () => {
    if (!await eeConfirm('Aulas, exercícios, projetos e desafios concluídos neste navegador serão redefinidos.', { title:'Redefinir progresso?', confirmLabel:'Redefinir', tone:'danger' })) return;
    state.completedLessons = []; state.completedExercises = []; state.completedChallenges = []; state.completedProjects = []; state.projectSteps = {}; state.exerciseAttempts = {}; state.exerciseMistakes = []; state.exerciseHistory = {}; state.moduleCheckpoints = {}; state.activity = []; state.studyLog = {}; activeExerciseSession = null;
    saveState(); renderProgress(); renderHome(); renderTracks(); renderExercises(); renderProjects(); renderChallenges();
  });
}


function initEditorMoreMenu() {
  const menu = document.querySelector('.editor-more-menu');
  if (!menu || menu.dataset.ready === 'true') return;
  menu.dataset.ready = 'true';
  document.addEventListener('click', event => {
    if (!menu.open) return;
    if (event.target.closest('.editor-more-action')) {
      menu.removeAttribute('open');
      return;
    }
    if (!menu.contains(event.target)) menu.removeAttribute('open');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) menu.removeAttribute('open');
  });
}

function initConnectivityStatus() {
  let lastOnline = navigator.onLine;
  const sync = (initial = false) => {
    const online = navigator.onLine;
    document.documentElement.dataset.network = online ? 'online' : 'offline';
    if (initial) {
      if (!online) showToast('Você está offline. Conteúdos já armazenados continuam disponíveis.');
      lastOnline = online;
      return;
    }
    if (online === lastOnline) return;
    lastOnline = online;
    showToast(online ? 'Conexão restabelecida.' : 'Você está offline. Recursos online podem ficar indisponíveis.');
  };
  window.addEventListener('online', () => sync(false));
  window.addEventListener('offline', () => sync(false));
  sync(true);
}

function init() {
  initTheme();
  initConnectivityStatus();
  initMobileMenu();
  initLessonMobile();
  initSearch();
  initGlossary();
  initTermPopover();
  initPlayground();
  initDataPortability();
  initCertificateFeature();
  initEditorMoreMenu();
  enableHorizontalWheelScroll($('.tabs'));
  initResetProgress();
  bindLearningMechanicActions();
  renderHome(); renderTracks(); renderExercises(); renderChallenges(); renderProjects(); renderGlossary(); renderProgress();
  route();
}

