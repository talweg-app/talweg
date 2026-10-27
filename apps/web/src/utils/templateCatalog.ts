import type { ArrowNode, CanvasDocument, CanvasNode, PageId } from "@talweg/core";
import type { Language } from "../i18nContext.js";
import { createCanvasNode } from "./createCanvasNode.js";
import { createId } from "./template.js";
import { createBlankCanvas, createMicroservicesTemplate, createSprintMindmapTemplate } from "./starterTemplates.js";

interface Copy { en: string; ru: string }
export type TemplateCategory = "planning" | "thinking" | "workshops" | "learning" | "engineering";
export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["planning", "thinking", "workshops", "learning", "engineering"];
export const TEMPLATE_CATALOG = [
  { id: "kickoff", category: "planning", title: { en: "Project kickoff", ru: "Старт проекта" }, description: { en: "Agree on the outcome, scope and first milestones.", ru: "Определите результат, границы проекта и первые этапы." } },
  { id: "research", category: "thinking", title: { en: "Research map", ru: "Карта исследования" }, description: { en: "Separate evidence, assumptions and unanswered questions.", ru: "Разделите факты, предположения и открытые вопросы." } },
  { id: "lesson", category: "learning", title: { en: "Math lesson", ru: "Урок математики" }, description: { en: "A worked example, LaTeX notes and a linked practice page.", ru: "Пример, заметки с LaTeX и отдельная страница практики." } },
  { id: "retro", category: "workshops", title: { en: "Team retrospective", ru: "Ретроспектива команды" }, description: { en: "Keep what works and choose one experiment.", ru: "Сохраните полезное и выберите один эксперимент." } },
  { id: "decision", category: "thinking", title: { en: "Decision tree", ru: "Дерево решений" }, description: { en: "Make your criteria, alternatives and reasoning visible.", ru: "Покажите критерии, варианты и причины выбора." } },
  { id: "weekly", category: "planning", title: { en: "Weekly focus", ru: "Фокус на неделю" }, description: { en: "One priority, five days and room for the unexpected.", ru: "Главная цель, пять дней и место для неожиданностей." } },
  { id: "roadmap", category: "planning", title: { en: "Now, next, later", ru: "Сейчас, дальше, потом" }, description: { en: "Plan outcomes without inventing deadlines.", ru: "Планируйте результаты без выдуманных сроков." } },
  { id: "swot", category: "workshops", title: { en: "SWOT workshop", ru: "SWOT-анализ" }, description: { en: "Connect strengths and risks to concrete actions.", ru: "Свяжите сильные стороны и риски с конкретными действиями." } },
  { id: "incident", category: "engineering", title: { en: "Incident review", ru: "Разбор инцидента" }, description: { en: "Build a timeline and follow up without assigning blame.", ru: "Восстановите хронологию и назначьте действия без поиска виноватых." } },
  { id: "blank", category: "thinking", title: { en: "Blank Canvas", ru: "Пустой холст" }, description: { en: "Start with an open canvas.", ru: "Свободное место для новой идеи." } },
  { id: "micro", category: "engineering", title: { en: "Microservices Architecture", ru: "Архитектура микросервисов" }, description: { en: "Services, events and data flows.", ru: "Сервисы, события и потоки данных." } },
  { id: "sprint", category: "planning", title: { en: "Sprint plan", ru: "План спринта" }, description: { en: "Turn a sprint goal into connected tasks.", ru: "Разложите цель спринта на связанные задачи." } },
] as const satisfies readonly { id: string; category: TemplateCategory; title: Copy; description: Copy }[];
export type StarterTemplateId = typeof TEMPLATE_CATALOG[number]["id"];

export function createStarterTemplate(templateId: StarterTemplateId, language: Language = "en", documentId?: string): CanvasDocument {
  if (templateId === "blank") return createBlankCanvas(documentId);
  if (templateId === "micro") return createMicroservicesTemplate(documentId);
  if (templateId === "sprint") return createSprintMindmapTemplate(documentId);
  const doc = createBlankCanvas(documentId);
  const definition = TEMPLATE_CATALOG.find(template => template.id === templateId);
  if (!definition) throw new Error("Unknown template");
  doc.name = definition.title[language];
  const text = (en: string, ru: string) => language === "ru" ? ru : en;
  const blue = "#38bdf8", green = "#34d399", violet = "#818cf8", plum = "#c084fc";
  const add = (node: CanvasNode) => {
    doc.nodes[node.id] = node;
    doc.rootNodeIds = [...doc.rootNodeIds, node.id];
    return node;
  };
  const box = (label: string, x: number, y: number, color = blue, width = 280, height = 84) => {
    const node = createCanvasNode("rectangle", { x: 0, y: 0 }, "whiteboard");
    if (node?.type !== "rectangle") throw new Error("Missing shape");
    return add({ ...node, x, y, width, height, data: { label }, style: { ...node.style, fillColor: "#0f141c", strokeColor: color, textColor: "#f4f4f5", fontSize: 16, textAlign: "center", verticalAlign: "middle" } });
  };
  const checklist = (title: string, items: string[], x: number, y: number, color = green, width = 300) => {
    const node = createCanvasNode("checklist", { x: 0, y: 0 }, "whiteboard");
    if (node?.type !== "checklist") throw new Error("Missing checklist");
    return add({ ...node, x, y, width, height: 300, style: { ...node.style, fillColor: "#0f141c", strokeColor: color, textColor: "#f4f4f5", fontSize: 16 }, data: { title, items: items.map(value => ({ id: crypto.randomUUID(), text: value, checked: false })) } });
  };
  const note = (title: string, content: string, x: number, y: number, color = violet) => {
    const node = createCanvasNode("markdown", { x: 0, y: 0 }, "whiteboard");
    if (node?.type !== "markdown") throw new Error("Missing note");
    return add({ ...node, x, y, width: 300, height: 240, data: { title }, note: content, style: { ...node.style, fillColor: "#0f141c", strokeColor: color, textColor: "#f4f4f5", fontSize: 16 } });
  };
  const table = (cells: string[][], x: number, y: number, width = 920) => {
    const node = createCanvasNode("table", { x: 0, y: 0 }, "whiteboard");
    if (node?.type !== "table") throw new Error("Missing table");
    return add({ ...node, x, y, width, height: 240, data: { cells }, style: { ...node.style, fillColor: "#0f141c", strokeColor: green, textColor: "#f4f4f5" } });
  };
  const connect = (from: CanvasNode, to: CanvasNode, label = "", color = blue) => {
    const node: ArrowNode = { ...from, id: createId("arrow"), type: "arrow", x: 0, y: 0, width: 0, height: 0, zIndex: 1, style: { strokeColor: color, strokeWidth: 1.5 }, data: { sourceId: from.id, targetId: to.id, sourceAnchor: from.y + from.height <= to.y ? "s" : "e", targetAnchor: from.y + from.height <= to.y ? "n" : "w", curveStyle: "orthogonal", endArrow: "arrow", ...(label ? { label } : {}) } };
    doc.nodes[node.id] = node;
  };
  const heading = createCanvasNode("text", { x: 0, y: 0 }, "whiteboard");
  if (heading?.type === "text") add({ ...heading, x: 40, y: 0, width: 960, height: 70, style: { ...heading.style, textColor: "#f4f4f5", fontSize: 34, fontWeight: 600 }, data: { text: doc.name, autoSize: false } });

  switch (templateId) {
    case "kickoff": {
      const outcome = box(text("What changes when we succeed?", "Что изменится после успеха?"), 40, 110, blue, 920);
      note(text("Project brief", "Описание проекта"), text("## Outcome\nWho benefits, and what becomes easier?\n\n## Scope\n- We will deliver…\n- We will not tackle yet…\n\n## Evidence\nHow will we know this worked?", "## Результат\nКому станет проще и в чём?\n\n## Границы\n- Что сделаем…\n- Что пока отложим…\n\n## Проверка\nКак поймём, что получилось?"), 40, 245);
      checklist(text("Before we begin", "Перед стартом"), [text("Agree on the outcome", "Согласовать результат"), text("Choose a project owner", "Назначить ответственного"), text("List the constraints", "Записать ограничения"), text("Schedule a first review", "Назначить первую проверку")], 370, 245);
      const risks = note(text("Risks and assumptions", "Риски и предположения"), text("## Assumptions\nWhat are we treating as true?\n\n## Risks\nWhat could stop us? Write a small test for each risk.", "## Предположения\nЧто мы пока считаем правдой?\n\n## Риски\nЧто может помешать? Для каждого риска придумайте небольшую проверку."), 700, 245, plum);
      connect(outcome, risks, text("Check early", "Проверить заранее"), plum);
      table([[text("Milestone", "Этап"), text("Owner", "Ответственный"), text("Done when", "Критерий готовности")], [text("First useful result", "Первый полезный результат"), "", ""], [text("Test with a user", "Проверка с пользователем"), "", ""], [text("Review and decide", "Разбор и решение"), "", ""]], 40, 560);
      break;
    }
    case "weekly": {
      box(text("This week matters because…", "Зачем нужна эта неделя…"), 40, 110, blue, 1280);
      const days = language === "ru" ? ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"] : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      days.forEach((day, index) => checklist(day, [text("One important task", "Одна важная задача"), text("A small follow-up", "Небольшое продолжение"), text("Leave some room", "Оставить немного времени")], 40 + index * 260, 245, index === 4 ? green : violet, 240));
      note(text("Parking lot", "Отложенные идеи"), text("Capture new requests here before adding them to a full day.\n\n- Can this wait?\n- What would it replace?", "Записывайте новые задачи здесь, прежде чем заполнять день.\n\n- Может ли это подождать?\n- Что придётся отложить взамен?"), 40, 650);
      note(text("Friday review", "Итоги пятницы"), text("What moved forward?\n\nWhat took longer than expected?\n\nWhat should next week inherit?", "Что продвинулось?\n\nЧто заняло больше времени?\n\nЧто стоит перенести на следующую неделю?"), 400, 650, green);
      break;
    }
    case "roadmap": {
      const columns = [
        { title: text("Now", "Сейчас"), items: [text("Make the core workflow reliable", "Довести основной сценарий"), text("Fix the biggest friction", "Убрать главную помеху"), text("Review with real users", "Проверить с пользователями")], color: green },
        { title: text("Next", "Дальше"), items: [text("Test the next useful outcome", "Проверить следующий результат"), text("Reduce repeated work", "Сократить повторяющуюся работу"), text("Check dependencies", "Проверить зависимости")], color: blue },
        { title: text("Later", "Потом"), items: [text("Keep promising ideas", "Сохранить перспективные идеи"), text("Record what is still unknown", "Записать неизвестное"), text("Revisit after the next review", "Вернуться после проверки")], color: violet },
      ];
      columns.forEach((column, index) => checklist(column.title, column.items, 40 + index * 340, 120, column.color));
      note(text("Why this order?", "Почему такой порядок?"), text("For each outcome, note the user problem, expected value and evidence. Move work forward after a review, not just because a date arrived.", "Для каждого результата запишите проблему пользователя, ожидаемую пользу и подтверждение. Переносите работу дальше после проверки, а не просто по календарю."), 40, 440);
      table([[text("Outcome", "Результат"), text("Signal of success", "Признак успеха"), text("Next review", "Следующая проверка")], ["", "", ""], ["", "", ""]], 380, 440, 640);
      break;
    }
    case "retro":
    case "swot": {
      const retro = templateId === "retro";
      const sections = retro ? [
        [text("Keep", "Сохранить"), text("What helped us?", "Что нам помогло?")], [text("Stop", "Прекратить"), text("What slowed us down?", "Что нас тормозило?")], [text("Start", "Попробовать"), text("What is worth trying?", "Что стоит попробовать?")], [text("Learn", "Понять"), text("What surprised us?", "Что нас удивило?")],
      ] : [
        [text("Strengths", "Сильные стороны"), text("What do we do well?", "Что получается хорошо?")], [text("Weaknesses", "Слабые стороны"), text("Where are we struggling?", "Где нам сложно?")], [text("Opportunities", "Возможности"), text("What could we build on?", "Чем можно воспользоваться?")], [text("Threats", "Угрозы"), text("What could change our plans?", "Что может изменить планы?")],
      ];
      sections.forEach((section, index) => {
        const node = box(`${section[0] ?? ""}\n\n${section[1] ?? ""}`, 40 + (index % 2) * 500, 120 + Math.floor(index / 2) * 200, [green, plum, blue, violet][index], 460, 155);
        node.note = text("Add specific examples. Separate observations from interpretations. What evidence supports this point?", "Добавьте конкретные примеры. Отделяйте наблюдения от объяснений. Чем подтверждается этот вывод?");
      });
      table([[text("One action", "Одно действие"), text("Owner", "Ответственный"), text("Review", "Проверка")], [text(retro ? "Try one small experiment" : "Address the most important risk", retro ? "Проверить один эксперимент" : "Разобраться с главным риском"), "", ""], ["", "", ""]], 40, 560, 960);
      break;
    }
    case "decision": {
      const question = box(text("What are we deciding?", "Что мы решаем?"), 380, 110, blue, 280);
      const shape = createCanvasNode("diamond", { x: 0, y: 0 }, "diagrams");
      if (shape?.type !== "diamond") throw new Error("Missing decision");
      const criterion = add({ ...shape, x: 410, y: 260, width: 220, height: 145, data: { label: text("Do we have enough\nevidence?", "Достаточно ли\nданных?") }, style: { ...shape.style, fillColor: "#17122a", strokeColor: violet, textColor: "#f3e8ff", textAlign: "center" } });
      const experiment = box(text("Run a small test", "Провести небольшой тест"), 40, 470, plum);
      const action = box(text("Choose and set a review", "Выбрать и назначить проверку"), 690, 470, green);
      connect(question, criterion);
      connect(criterion, experiment, text("Not yet", "Пока нет"), plum);
      connect(criterion, action, text("Yes", "Да"), green);
      note(text("Decision record", "Запись решения"), text("## Context\nWhat problem are we solving?\n\n## Alternatives\nWhat else did we consider?\n\n## Decision\nWhy this option?\n\n## Revisit when\nWhat new information would change our minds?", "## Контекст\nКакую проблему решаем?\n\n## Варианты\nЧто ещё рассматривали?\n\n## Решение\nПочему выбрали этот вариант?\n\n## Пересмотр\nКакие новые данные могут изменить решение?"), 370, 650);
      break;
    }
    case "research": {
      const question = box(text("Our research question", "Вопрос исследования"), 380, 120, blue);
      const facts = box(text("Evidence\nWhat did we observe?", "Факты\nЧто мы наблюдали?"), 40, 320, green, 280, 120);
      const assumptions = box(text("Assumptions\nWhat are we guessing?", "Предположения\nЧто мы предполагаем?"), 380, 320, violet, 280, 120);
      const unknown = box(text("Open questions\nWhat is missing?", "Открытые вопросы\nЧего не хватает?"), 720, 320, plum, 280, 120);
      connect(question, facts, "", green); connect(question, assumptions, "", violet); connect(question, unknown, "", plum);
      note(text("Sources and quotes", "Источники и цитаты"), text("## Source\nAdd a link and date.\n\n## Observation\nKeep the original quote or finding.\n\n## Interpretation\nWhat do you think it means?\n\n## Confidence\nWhat would confirm or contradict this?", "## Источник\nДобавьте ссылку и дату.\n\n## Наблюдение\nСохраните цитату или результат.\n\n## Объяснение\nЧто это может значить?\n\n## Уверенность\nЧто подтвердит или опровергнет вывод?"), 40, 530, green);
      checklist(text("Next investigation", "Следующая проверка"), [text("Choose one unanswered question", "Выбрать один открытый вопрос"), text("Find an independent source", "Найти независимый источник"), text("Record conflicting evidence", "Записать противоречащие данные"), text("Update the conclusion", "Уточнить вывод")], 380, 530);
      break;
    }
    case "lesson": {
      const lesson = "page-lesson" as PageId, practice = "page-practice" as PageId;
      const concept = box(text("Pythagorean theorem", "Теорема Пифагора"), 40, 130, blue, 360, 120);
      const worked = box(text("Right triangle\na = 3, b = 4 → c = 5", "Прямоугольный треугольник\na = 3, b = 4 → c = 5"), 500, 130, green, 480, 150);
      concept.style.fontSize = 18; worked.style.fontSize = 18;
      connect(concept, worked, text("Worked example", "Пример"));
      const formula = note(text("Formula and explanation", "Формула и объяснение"), text("## Right triangles\n\n$$a^2 + b^2 = c^2$$\n\nFor $a=3$ and $b=4$:\n\n$$c = \\sqrt{3^2+4^2} = 5$$\n\nWhich side is the hypotenuse?", "## Прямоугольные треугольники\n\n$$a^2 + b^2 = c^2$$\n\nПри $a=3$ и $b=4$:\n\n$$c = \\sqrt{3^2+4^2} = 5$$\n\nКакая сторона является гипотенузой?"), 40, 340);
      formula.width = 420; formula.height = 320; formula.style.fontSize = 18;
      const understanding = checklist(text("Check understanding", "Проверить понимание"), [text("Find the right angle", "Найти прямой угол"), text("Identify the hypotenuse", "Определить гипотенузу"), text("Explain each term", "Объяснить каждое слагаемое"), text("Check the units", "Проверить единицы")], 520, 340, green, 460);
      understanding.height = 320; understanding.style.fontSize = 18;
      for (const node of Object.values(doc.nodes)) node.pageId = lesson;
      const exercise = box(text("Try it: a = 5, b = 12\nFind c and explain your steps.", "Попробуйте: a = 5, b = 12\nНайдите c и объясните шаги."), 40, 120, blue, 480, 150);
      exercise.pageId = practice;
      exercise.note = text("## Solution\n\n$$c = \\sqrt{5^2+12^2}=13$$\n\nCheck: $25+144=169$.\n\nTry another example with your own numbers.", "## Решение\n\n$$c = \\sqrt{5^2+12^2}=13$$\n\nПроверка: $25+144=169$.\n\nПридумайте свой пример с другими числами.");
      const reflection = note(text("Explain your reasoning", "Объясните решение"), text("Which side is unknown?\n\nWhy does this theorem apply?\n\nHow can you check the result?", "Какая сторона неизвестна?\n\nПочему здесь применима теорема?\n\nКак проверить результат?"), 580, 120);
      reflection.pageId = practice;
      formula.note = (formula.note ?? "") + `\n\n[${text("Go to practice", "Перейти к практике")}](/board/${doc.id}/page/${practice}?node=${exercise.id})`;
      doc.pages = { [lesson]: { id: lesson, name: text("Lesson", "Урок"), order: 0, createdAt: doc.meta.createdAt, updatedAt: doc.meta.updatedAt }, [practice]: { id: practice, name: text("Practice", "Практика"), order: 1, createdAt: doc.meta.createdAt, updatedAt: doc.meta.updatedAt } };
      doc.activePageId = lesson;
      break;
    }
    case "incident": {
      const detected = box(text("Detected\nWhat alerted us?", "Обнаружение\nКак узнали о проблеме?"), 40, 120, plum);
      const response = box(text("Response\nWhat did we try?", "Реакция\nЧто попробовали?"), 380, 120, blue);
      const recovered = box(text("Recovery\nHow did we verify it?", "Восстановление\nКак проверили результат?"), 720, 120, green);
      connect(detected, response, text("Timeline", "Хронология")); connect(response, recovered, "", green);
      note(text("Impact and contributing factors", "Влияние и причины"), text("## Impact\nWho was affected, and for how long?\n\n## Conditions\nWhat made the incident possible?\n\n## Evidence\nLink logs, metrics and observations. Describe the system, not who to blame.", "## Влияние\nКого затронуло и на какое время?\n\n## Условия\nЧто сделало инцидент возможным?\n\n## Подтверждение\nДобавьте логи, метрики и наблюдения. Разбирайте систему, а не ищите виноватых."), 40, 340, plum);
      checklist(text("Recovery checks", "Проверка восстановления"), [text("Confirm the user workflow", "Проверить сценарий пользователя"), text("Watch the relevant signals", "Проверить нужные показатели"), text("Record what is still unknown", "Записать неизвестное"), text("Schedule a follow-up", "Назначить повторную проверку")], 380, 340);
      table([[text("Follow-up", "Действие"), text("Owner", "Ответственный"), text("Evidence it helped", "Как проверить пользу")], [text("Improve detection", "Улучшить обнаружение"), "", ""], [text("Reduce the impact", "Снизить влияние"), "", ""], [text("Test the recovery path", "Проверить восстановление"), "", ""]], 40, 650, 960);
      break;
    }
  }
  const ofType = <T extends CanvasNode["type"]>(type: T) => Object.values(doc.nodes).filter((node): node is Extract<CanvasNode, { type: T }> => node.type === type);
  const mainPage = doc.activePageId ?? "page-overview";
  const addPage = (id: string, name: string) => {
    if (!doc.pages) {
      doc.pages = { [mainPage]: { id: mainPage, name: text("Overview", "Обзор"), order: 0, createdAt: doc.meta.createdAt, updatedAt: doc.meta.updatedAt } };
      doc.activePageId = mainPage;
      for (const node of Object.values(doc.nodes)) node.pageId = mainPage;
    }
    const pageId = id;
    doc.pages[pageId] = { id: pageId, name, order: Object.keys(doc.pages).length, createdAt: doc.meta.createdAt, updatedAt: doc.meta.updatedAt };
    return pageId;
  };
  const moveTo = (node: CanvasNode | undefined, page: PageId, x: number, y: number) => { if (node) { node.pageId = page; node.x = x; node.y = y; } };
  const onPage = (node: CanvasNode, page: PageId) => { node.pageId = page; return node; };
  const sampleList = (node: Extract<CanvasNode, { type: "checklist" }> | undefined, values: string[]) => {
    if (node) node.data.items = values.map(value => ({ id: crypto.randomUUID(), text: value, checked: false }));
  };
  const sticky = (content: string, x: number, y: number, page: PageId) => {
    const node = createCanvasNode("sticker", { x: 0, y: 0 }, "whiteboard");
    if (node?.type !== "sticker") throw new Error("Missing sticky note");
    return onPage(add({ ...node, x, y, width: 220, height: 130, data: { content, stickerShape: "square" }, style: { ...node.style, fontSize: 16 } }), page);
  };
  const exampleCard = (title: string, description: string, x: number, y: number, page: PageId) => {
    const node = createCanvasNode("card", { x: 0, y: 0 }, "whiteboard");
    if (node?.type !== "card") throw new Error("Missing card");
    return onPage(add({ ...node, x, y, width: 300, height: 150, data: { title, description, status: "todo", tags: [] }, style: { ...node.style, fillColor: "#0f141c", strokeColor: blue, textColor: "#f4f4f5", fontSize: 16 } }), page);
  };

  if (templateId === "lesson") {
    const solutions = addPage("page-solutions", text("Solutions", "Решения"));
    const practice = "page-practice" as PageId;
    const task = ofType("rectangle").find(node => node.pageId === practice);
    if (task) { task.width = 460; task.height = 150; task.style.fontSize = 18; task.note = text("Write your calculation before opening the solutions page.", "Сначала запишите вычисления, затем откройте страницу решений."); }
    const reflection = ofType("markdown").find(node => node.pageId === practice);
    moveTo(reflection, practice, 540, 500);
    onPage(box(text("Task 2: c = 10, a = 6\nFind the other leg.", "Задача 2: c = 10, a = 6\nНайдите второй катет."), 540, 120, violet, 460, 150), practice);
    onPage(box(text("Task 3: a = 7, b = 9\nGive an exact answer.", "Задача 3: a = 7, b = 9\nДайте точный ответ."), 40, 310, green, 460, 150), practice);
    onPage(box(text("Task 4: sides 6, 8, 11\nIs the triangle right-angled?", "Задача 4: стороны 6, 8, 11\nПрямоугольный ли треугольник?"), 540, 310, plum, 460, 150), practice);
    onPage(checklist(text("Before checking the answers", "Перед проверкой"), [text("Draw and label the triangle", "Нарисовать и подписать треугольник"), text("Choose the hypotenuse", "Выбрать гипотенузу"), text("Write the equation", "Записать уравнение"), text("Check the answer is plausible", "Проверить правдоподобие ответа")], 40, 500, green, 460), practice);
    const formula = ofType("markdown").find(node => node.pageId === "page-lesson");
    if (formula) formula.note = (formula.note ?? "") + ` · [${text("Solutions", "Решения")}](/board/${doc.id}/page/${solutions})`;
    const answers = [
      [text("1. Find the hypotenuse", "1. Найти гипотенузу"), "$$c=\\sqrt{5^2+12^2}=\\sqrt{169}=13$$"],
      [text("2. Find the missing leg", "2. Найти катет"), "$$b=\\sqrt{10^2-6^2}=\\sqrt{64}=8$$"],
      [text("3. Keep the exact value", "3. Сохранить точное значение"), "$$c=\\sqrt{7^2+9^2}=\\sqrt{130}\\approx11.40$$"],
      [text("4. Check the converse", "4. Проверить обратную теорему"), text("$$6^2+8^2=100\\ne121=11^2$$\n\nThe triangle is not right-angled.", "$$6^2+8^2=100\\ne121=11^2$$\n\nТреугольник не является прямоугольным.")],
    ];
    answers.forEach((answer, index) => {
      const solution = onPage(note(answer[0] ?? "", `${answer[1] ?? ""}\n\n[${text("Back to practice", "Вернуться к задачам")}](/board/${doc.id}/page/${practice})`, 40 + index % 2 * 500, 100 + Math.floor(index / 2) * 290, index % 2 ? violet : green), solutions);
      solution.width = 460; solution.height = 250; solution.style.fontSize = 18;
    });
    onPage(box(text("When it applies\nOnly to right-angled triangles", "Когда применять\nТолько к прямоугольным треугольникам"), 40, 710, plum, 440, 110), mainPage);
    onPage(box(text("A common mistake\nThe hypotenuse is opposite the right angle", "Частая ошибка\nГипотенуза лежит напротив прямого угла"), 540, 710, violet, 440, 110), mainPage);
  } else {
    const workspace = addPage("page-workspace", text("Working example", "Рабочий пример"));
    switch (templateId) {
      case "kickoff": {
        const outcome = ofType("rectangle")[0]; if (outcome) outcome.data = { label: text("Example: open a neighbourhood book swap", "Пример: открыть районный обмен книгами") };
        const brief = ofType("markdown")[0]; if (brief) brief.note = text("## Outcome\nNeighbours can find and exchange a book in one visit.\n\n## First version\nOne shelf, clear labels and a simple exchange rule.\n\n## Not yet\nAn online catalogue or delivery service.\n\n## Success\n20 labelled books, one exchange event and five pieces of feedback.", "## Результат\nСоседи могут найти и обменять книгу за один визит.\n\n## Первая версия\nОдна полка, понятные подписи и простое правило обмена.\n\n## Пока откладываем\nОнлайн-каталог и доставку.\n\n## Успех\n20 подписанных книг, одно мероприятие и пять отзывов.");
        const milestones = ofType("table")[0]; moveTo(milestones, workspace, 40, 120);
        if (milestones) milestones.data.cells = [[text("Milestone", "Этап"), text("Owner", "Ответственный"), text("Done when", "Готово, когда")], [text("Collect books", "Собрать книги"), text("Coordinator", "Координатор"), text("20 books labelled", "20 книг подписаны")], [text("Run first exchange", "Первый обмен"), text("Event host", "Ведущий"), text("Visitors understand the rule", "Посетителям понятно правило")], [text("Collect feedback", "Собрать отзывы"), text("Volunteer", "Волонтёр"), text("5 responses and one improvement", "5 отзывов и одно улучшение")]];
        for (const [index, label] of [text("Participants\nFind their next book", "Участники\nНаходят следующую книгу"), text("Venue\nProvides one shelf", "Площадка\nПредоставляет полку"), text("Coordinator\nKeeps the exchange running", "Координатор\nПоддерживает обмен")].entries()) onPage(box(label, 40 + index * 330, 570, index === 1 ? violet : green, 300, 110), mainPage);
        onPage(checklist(text("First event", "Первое мероприятие"), [text("Confirm the venue", "Подтвердить площадку"), text("Print exchange instructions", "Напечатать правила"), text("Invite neighbours", "Пригласить соседей"), text("Check the shelf afterwards", "Проверить полку после встречи")], 40, 440), workspace);
        onPage(note(text("Invitation draft", "Черновик приглашения"), text("Bring a book you would recommend. Take another one home.\n\nPlease leave a short note about why you liked your book.\n\nAsk the coordinator if you are unsure where a book belongs.", "Принесите книгу, которую хотите порекомендовать, и заберите другую.\n\nОставьте короткую записку: чем вам понравилась ваша книга?\n\nЕсли непонятно, куда её поставить, спросите координатора."), 390, 440), workspace);
        break;
      }
      case "weekly": {
        const goal = ofType("rectangle")[0]; if (goal) goal.data = { label: text("This week: publish one portfolio case study", "На этой неделе: опубликовать один кейс для портфолио") };
        const tasks = language === "ru" ? [["Выбрать один проект", "Собрать материалы", "Записать исходную задачу", "Зарезервировать время"], ["Выбрать три иллюстрации", "Написать первый черновик", "Проверить подписи", "Сохранить исходники"], ["Сократить лишний текст", "Показать черновик коллеге", "Записать непонятные места", "Внести одну правку"], ["Собрать страницу кейса", "Проверить ссылки", "Проверить узкий экран", "Подготовить публикацию"], ["Опубликовать кейс", "Попросить обратную связь", "Записать результат недели", "Выбрать следующий шаг"]] : [["Choose one project", "Gather the materials", "Write the original problem", "Reserve focused time"], ["Choose three images", "Write the first draft", "Check the captions", "Keep the source files"], ["Cut unnecessary text", "Show a colleague the draft", "Record confusing parts", "Make one improvement"], ["Build the case-study page", "Check every link", "Try a narrow screen", "Prepare publication"], ["Publish the case study", "Ask for feedback", "Record the week's result", "Choose a next step"]];
        ofType("checklist").forEach((list, index) => { sampleList(list, tasks[index] ?? []); list.height = 360; });
        onPage(table([[text("Commitment", "Обязательство"), text("Planned", "План"), text("Actual", "Факт")], [text("Focused sessions", "Рабочие сессии"), "5", ""], [text("Published case studies", "Опубликованные кейсы"), "1", ""], [text("Feedback conversations", "Обсуждения результата"), "2", ""]], 40, 120), workspace);
        onPage(note(text("Example Friday review", "Пример итогов пятницы"), text("## Finished\nThe case study is published and all links work.\n\n## Learned\nChoosing images took longer than drafting.\n\n## Next time\nPrepare the illustrations before writing the page.", "## Готово\nКейс опубликован, ссылки работают.\n\n## Вывод\nПодбор иллюстраций занял больше времени, чем черновик.\n\n## В следующий раз\nПодготовить иллюстрации до работы над текстом."), 40, 450), workspace);
        onPage(checklist(text("Unexpected requests", "Неожиданные задачи"), [text("A task may wait until next week", "Задача может подождать до следующей недели"), text("An urgent task replaces an existing one", "Срочная задача заменяет запланированную"), text("Keep one session unplanned", "Оставить одну свободную сессию")], 400, 450), workspace);
        break;
      }
      case "roadmap": {
        doc.nodes = Object.fromEntries(Object.entries(doc.nodes).filter(([, node]) => node.type !== "checklist"));
        moveTo(ofType("markdown")[0], workspace, 40, 120); moveTo(ofType("table")[0], workspace, 390, 120);
        const columns = [text("Now · prove the basics", "Сейчас · проверить основу"), text("Next · reduce effort", "Дальше · упростить работу"), text("Later · explore", "Потом · исследовать")];
        const examples = language === "ru" ? [["Записать учебную цель", "Пользователь понимает, что изучает."], ["Добавить материалы", "Конспекты и иллюстрации находятся рядом."], ["Сохранить без интернета", "План открывается после перезапуска."], ["Повторять готовую структуру", "Новый курс начинается с шаблона."], ["Находить действие с клавиатуры", "Для частых действий не нужно искать кнопку."], ["Сравнить план и результат", "После недели видно, что получилось."], ["Совместная подготовка", "Два человека собирают один конспект."], ["Показать материал группе", "Страницы становятся последовательным рассказом."], ["Разобраться с обратной связью", "Идеи развития подтверждены разговорами."]] : [["Capture a study goal", "The learner knows what they are studying."], ["Keep materials together", "Notes and illustrations stay beside the plan."], ["Save without the internet", "The plan opens after an application restart."], ["Reuse a familiar structure", "A new course starts from a personal template."], ["Find actions from the keyboard", "Frequent actions do not need a button hunt."], ["Review the week's outcome", "The learner can compare plans and results."], ["Prepare material together", "Two people assemble one lesson."], ["Present the material", "Pages form a clear story for a group."], ["Learn from feedback", "Conversations guide the next useful change."]];
        columns.forEach((column, index) => onPage(box(column, 40 + index * 340, 110, [green, blue, violet][index], 300, 56), mainPage));
        examples.forEach((example, index) => exampleCard(example[0] ?? "", example[1] ?? "", 40 + Math.floor(index / 3) * 340, 200 + index % 3 * 180, mainPage));
        onPage(checklist(text("Review before moving work forward", "Перед переносом задачи дальше"), [text("A real user has tried it", "Пользователь попробовал результат"), text("The original problem is clearer", "Исходная проблема стала понятнее"), text("A next action is small enough", "Следующий шаг достаточно мал")], 40, 430), workspace);
        break;
      }
      case "retro":
      case "swot": {
        const retro = templateId === "retro";
        const sections = ofType("rectangle");
        sections.slice(0, 4).forEach((node, index) => { node.y = 120 + Math.floor(index / 2) * 240; node.height = 54; node.data = { label: node.data?.label?.split("\n")[0] ?? "" }; });
        const values = retro ? (language === "ru" ? ["Короткие утренние встречи помогали", "У каждой задачи был один ответственный", "Проверка откладывалась до последнего дня", "Обсуждения терялись в разных чатах", "Показывать черновик раньше", "Проверять одну гипотезу за раз", "Маленький пример снимал долгие споры", "Время на подготовку часто забывали"] : ["Short morning check-ins helped", "Each task had one owner", "Testing waited until the last day", "Decisions got lost in separate chats", "Show a draft earlier", "Test one assumption at a time", "A small example settled long debates", "Preparation time was easy to forget"]) : (language === "ru" ? ["Читатели доверяют рекомендациям", "Есть связи с местными издателями", "Остатки учитываются вручную", "Не хватает места на складе", "Запустить ежемесячный книжный клуб", "Развивать самовывоз заказов", "Онлайн-магазины снижают цены", "Поставки иногда задерживаются"] : ["Readers trust personal recommendations", "Strong ties to local publishers", "Stock is tracked manually", "Storage space is limited", "Start a monthly reading club", "Offer click-and-collect", "Online shops discount heavily", "Deliveries sometimes arrive late"]);
        values.forEach((value, index) => sticky(value, 40 + Math.floor(index / 2) % 2 * 500 + index % 2 * 240, 190 + Math.floor(index / 4) * 240, mainPage));
        const actions = ofType("table")[0]; moveTo(actions, workspace, 40, 120);
        if (actions) actions.data.cells = [[text("Action", "Действие"), text("Owner", "Ответственный"), text("Check", "Проверка")], [text(retro ? "Show a draft midway" : "Pilot a reading club", retro ? "Показать черновик в середине работы" : "Провести пробный книжный клуб"), text("Coordinator", "Координатор"), text("Ask three participants", "Спросить трёх участников")], [text(retro ? "Keep one decision log" : "Count stock weekly", retro ? "Вести один журнал решений" : "Сверять остатки раз в неделю"), text("Team", "Команда"), text("Review after two weeks", "Проверить через две недели")]];
        onPage(note(text("Context for this example", "Контекст примера"), retro ? text("Example retrospective after a two-week demonstration project. Replace these notes with observations from your own work. Choose one improvement that you can test before the next review.", "Пример ретроспективы после двухнедельного учебного проекта. Замените заметки наблюдениями из своей работы. Выберите одно улучшение для проверки до следующей встречи.") : text("Example: an independent bookshop planning its next quarter. Pair one strength with one opportunity, then choose an action that the team can actually try.", "Пример: независимый книжный магазин планирует следующий квартал. Свяжите одну сильную сторону с одной возможностью и выберите посильное действие."), 40, 430), workspace);
        onPage(checklist(text("Close the discussion", "Завершить обсуждение"), [text("Check everyone was heard", "Убедиться, что все высказались"), text("Choose one concrete action", "Выбрать одно конкретное действие"), text("Name an owner and a review", "Назначить ответственного и проверку")], 400, 430), workspace);
        break;
      }
      case "decision": {
        const rectangles = ofType("rectangle");
        if (rectangles[0]) rectangles[0].data = { label: text("Should we build this feature?", "Стоит ли делать эту функцию?") };
        const criterion = ofType("diamond")[0]; if (criterion) criterion.data = { label: text("Is the user problem\nconfirmed?", "Проблема пользователя\nподтверждена?") };
        if (rectangles[1]) rectangles[1].data = { label: text("Talk to five users", "Поговорить с пятью пользователями") };
        if (rectangles[2]) rectangles[2].data = { label: text("Test a small prototype", "Проверить небольшой прототип") };
        moveTo(ofType("markdown")[0], workspace, 40, 120);
        const rethink = onPage(box(text("Still unclear?\nReframe the question.", "Всё ещё непонятно?\nУточните вопрос."), 40, 650, plum), mainPage);
        const build = onPage(box(text("People complete the task?\nPlan the first version.", "Пользователи справляются?\nПланируйте первую версию."), 690, 650, green), mainPage);
        if (rectangles[1]) connect(rectangles[1], rethink, text("Review", "Проверить"), plum);
        if (rectangles[2]) connect(rectangles[2], build, text("Observe", "Наблюдать"), green);
        onPage(table([[text("Option", "Вариант"), text("What it tells us", "Что узнаем"), text("Effort", "Усилие")], [text("Five short interviews", "Пять коротких интервью"), text("Whether the problem exists", "Есть ли проблема"), text("One afternoon", "Один вечер")], [text("Clickable prototype", "Кликабельный прототип"), text("Whether the workflow is clear", "Понятен ли сценарий"), text("One or two days", "Один-два дня")], [text("Small working version", "Небольшая рабочая версия"), text("Whether people return", "Возвращаются ли люди"), text("After the first evidence", "После первых подтверждений")]], 390, 120, 640), workspace);
        onPage(checklist(text("Decision checklist", "Перед решением"), [text("Write the reason", "Записать причину"), text("Keep rejected alternatives", "Сохранить отвергнутые варианты"), text("Choose a review trigger", "Назначить условие пересмотра")], 40, 430), workspace);
        break;
      }
      case "research": {
        const rectangles = ofType("rectangle");
        if (rectangles[0]) rectangles[0].data = { label: text("Why do readers abandon signup?", "Почему читатели бросают регистрацию?") };
        const labels = [text("Evidence\n3 of 5 test participants paused at the form", "Факты\n3 из 5 участников остановились на форме"), text("Assumption\nThe form asks for too much too early", "Предположение\nФорма слишком рано требует много данных"), text("Open question\nIs a phone number really needed?", "Открытый вопрос\nНужен ли номер телефона?")];
        rectangles.slice(1).forEach((node, index) => { node.data = { label: labels[index] ?? "" }; });
        moveTo(ofType("checklist")[0], workspace, 40, 430);
        const firstSource = ofType("markdown")[0]; if (firstSource) { firstSource.data.title = text("Example observation log", "Пример журнала наблюдений"); firstSource.note = text("## Example data\nThree of five participants stopped at the phone field in a small usability exercise.\n\n## Limitation\nThis is a tiny fictional sample for the template, not evidence about your product.\n\n## Next check\nCompare a shorter form with the same people.", "## Учебный пример\nТрое из пяти участников остановились на поле телефона в небольшом тесте удобства.\n\n## Ограничение\nЭто маленькая вымышленная выборка для шаблона, а не данные о вашем продукте.\n\n## Следующая проверка\nСравнить с короткой формой на той же группе."); }
        onPage(note(text("An alternative explanation", "Другое объяснение"), text("The wording may be confusing even if the number of fields is acceptable. Test one change at a time before deciding the cause.", "Возможно, непонятны формулировки, а не количество полей. Проверяйте по одному изменению, прежде чем определять причину."), 380, 530), mainPage);
        onPage(note(text("Source to collect", "Источник для проверки"), text("Add the original source, a date, the observation and its limits here. Keep links to real evidence when adapting this example.", "Добавьте исходный источник, дату, наблюдение и ограничения. При работе с реальным проектом сохраняйте ссылки на подтверждения."), 720, 530, plum), mainPage);
        onPage(table([[text("Hypothesis", "Гипотеза"), text("Test", "Проверка"), text("Decision signal", "Признак для решения")], [text("Too many fields", "Слишком много полей"), text("Try the shorter form", "Попробовать короткую форму"), text("People finish without help", "Люди справляются без подсказок")], [text("Unclear wording", "Непонятный текст"), text("Rewrite one label", "Переписать одну подпись"), text("Fewer clarification questions", "Меньше уточняющих вопросов")]], 40, 120), workspace);
        break;
      }
      case "incident": {
        const rectangles = ofType("rectangle");
        [text("09:10 · detected\nNew signups fail", "09:10 · обнаружение\nНе работает регистрация"), text("09:14 · response\nRoll back the release", "09:14 · реакция\nОткатить релиз"), text("09:26 · recovered\nVerify fresh accounts", "09:26 · восстановление\nПроверить новые аккаунты")].forEach((label, index) => { if (rectangles[index]) rectangles[index].data = { label }; });
        const report = ofType("markdown")[0]; if (report) { report.y = 420; report.note = text("## Example incident\nA release changed a validation rule and prevented new signups.\n\n## Impact\nThe signup workflow was affected for sixteen minutes in this fictional example. Existing sessions continued working.\n\n## Contributing conditions\nNo smoke check created a fresh account after deployment.\n\n## Recovery\nThe team rolled back, created a new account and watched the error signal.", "## Учебный инцидент\nРелиз изменил правило проверки и сломал регистрацию.\n\n## Влияние\nВ этом вымышленном примере регистрация не работала шестнадцать минут. Действующие сессии продолжали работать.\n\n## Условия\nПосле выкладки не проверяли создание нового аккаунта.\n\n## Восстановление\nКоманда откатила релиз, создала аккаунт и проверила ошибки."); }
        const checks = ofType("checklist")[0]; if (checks) checks.y = 420;
        [text("Scope\nNew signups", "Затронуто\nНовые регистрации"), text("Duration\n16 minutes in this example", "Длительность\n16 минут в этом примере"), text("Recovery\nRollback and verification", "Восстановление\nОткат и проверка")].forEach((label, index) => onPage(box(label, 40 + index * 340, 260, [plum, blue, green][index], 300, 100), mainPage));
        const actions = ofType("table")[0]; moveTo(actions, workspace, 40, 120);
        if (actions) actions.data.cells = [[text("Follow-up", "Действие"), text("Owner", "Ответственный"), text("Evidence", "Подтверждение")], [text("Create a fresh account after releases", "Создавать аккаунт после релизов"), text("Release owner", "Ответственный за релиз"), text("A failing smoke check blocks release", "Падающая проверка останавливает релиз")], [text("Alert on signup errors", "Следить за ошибками регистрации"), text("On-call", "Дежурный"), text("A controlled failure triggers the alert", "Пробный сбой вызывает уведомление")], [text("Practice the rollback", "Отработать откат"), text("Team", "Команда"), text("Record steps and recovery time", "Записать шаги и время восстановления")]];
        onPage(note(text("What made recovery easier?", "Что помогло восстановлению?"), text("A known previous version, a clear owner and a quick way to test a new account. Keep these conditions in the next release plan.", "Известная предыдущая версия, понятный ответственный и быстрый способ проверить новый аккаунт. Сохраните эти условия для следующих релизов."), 40, 450, green), workspace);
        break;
      }
    }
    const bridge = ofType("markdown").find(node => node.pageId === mainPage);
    if (bridge) bridge.note = (bridge.note ?? "") + `\n\n[${text("Open the working example", "Открыть рабочий пример")}](/board/${doc.id}/page/${workspace})`;
  }
  doc.rootNodeIds = doc.rootNodeIds.filter(id => !!doc.nodes[id]);
  return doc;
}
