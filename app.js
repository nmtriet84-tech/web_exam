const TOTAL_QUESTIONS = 20;
const DATA_BASE_PATH = "data/EN08_GRAMMAR";
const EXAM_DURATION_SECONDS = 20 * 60;

let ALL_QUESTIONS = [];
let ALL_READINGS = [];
let ALL_GRAMMAR = {};
let ALL_VOCAB_INFO = {};
let ALL_VOCAB_QUIZ = [];
let currentMode = 'grammar';

let currentExam = [];
let userAnswers = {};
let currentIdx = 0;
let remainingSeconds = EXAM_DURATION_SECONDS;
let timerId = null;

const setupScreen = document.getElementById("setup-screen");
const examScreen = document.getElementById("exam-screen");
const resultScreen = document.getElementById("result-screen");
const unifiedSelector = document.getElementById("unified-selector");
const startBtn = document.getElementById("start-btn");
const selectAllBtn = document.getElementById("select-all-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const selectionCount = document.getElementById("selection-count");
const questionPoolCount = document.getElementById("question-pool-count");
const progressFill = document.getElementById("progress-fill");
const qCounter = document.getElementById("q-counter");
const examTitle = document.getElementById("exam-title");
const answeredBadge = document.getElementById("answered-badge");
const questionNav = document.getElementById("question-nav");
const readingArea = document.getElementById("reading-area");
const questionMeta = document.getElementById("question-meta");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");
const finalScore = document.getElementById("final-score");
const scoreTen = document.getElementById("score-ten");
const resultMsg = document.getElementById("result-msg");
const reviewList = document.getElementById("review-list");
const newExamBtn = document.getElementById("new-exam-btn");
const timerBadge = document.getElementById("timer-badge");

const modeGrammarBtn = document.getElementById("mode-grammar-btn");
const modeVocabBtn = document.getElementById("mode-vocab-btn");

if (modeGrammarBtn && modeVocabBtn) {
    modeGrammarBtn.addEventListener("click", () => setMode("grammar"));
    modeVocabBtn.addEventListener("click", () => setMode("vocab"));
}

function setMode(mode) {
    currentMode = mode;
    
    const subtitle = document.getElementById('brand-subtitle');
    const readingStat = document.getElementById('reading-stat');
    const setupTitle = document.getElementById('setup-title');
    
    if (mode === "grammar") {
        modeGrammarBtn.classList.replace("secondary-btn", "primary-btn");
        modeVocabBtn.classList.replace("primary-btn", "secondary-btn");
        
        if(subtitle) subtitle.textContent = 'Tạo đề luyện tập 20 câu từ ngân hàng ngữ pháp và bài đọc.';
        if(readingStat) readingStat.style.display = 'block';
        if(setupTitle) setupTitle.textContent = 'Grammar Points';
    } else {
        modeVocabBtn.classList.replace("secondary-btn", "primary-btn");
        modeGrammarBtn.classList.replace("primary-btn", "secondary-btn");
        
        if(subtitle) subtitle.textContent = 'Tạo đề luyện tập 20 câu trắc nghiệm từ vựng chuyên sâu.';
        if(readingStat) readingStat.style.display = 'none';
        if(setupTitle) setupTitle.textContent = 'Vocabulary Units';
    }
    renderSelector();
    updateSelectionSummary();
}

async function init() {
    setLoadingState(true);
    try {
        await loadData();
        renderSelector();
        updateSelectionSummary();
    } catch (error) {
        console.error(error);
        selectionCount.textContent = "Không tải được dữ liệu JSON.";
        questionPoolCount.textContent = "Kiểm tra thư mục data/EN08_GRAMMAR trên GitHub.";
    } finally {
        setLoadingState(false);
    }
}

function getQuestionUnit(question) {
    const match = question.id.match(/U\d{2}/);
    return match ? match[0] : "U00";
}

async function loadData() {
    const [questions, readings, grammar, vInfo, vQuiz] = await Promise.all([
        fetchJson(`${DATA_BASE_PATH}/questions.json`),
        fetchJson(`${DATA_BASE_PATH}/reading.json`),
        fetchJson(`${DATA_BASE_PATH}/unit.json`),
        fetchJson(`data/EN08_VOCAB/English8Vocabulary_info.json`).catch(e=>null),
        fetchJson(`data/EN08_VOCAB/English8Vocabulary_quiz.json`).catch(e=>null)
    ]);
    if (vInfo) ALL_VOCAB_INFO = vInfo;
    if (vQuiz) ALL_VOCAB_QUIZ = vQuiz;

    if (!Array.isArray(questions)) throw new Error("questions.json must be an array.");
    if (!Array.isArray(readings)) throw new Error("reading.json must be an array.");
    if (!grammar || typeof grammar !== "object" || Array.isArray(grammar)) {
        throw new Error("unit.json must be an object.");
    }

    ALL_QUESTIONS = questions;
    ALL_READINGS = readings;
    ALL_GRAMMAR = grammar;
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Cannot load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

function setLoadingState(isLoading) {
    startBtn.disabled = isLoading;
    selectAllBtn.disabled = isLoading;
    clearAllBtn.disabled = isLoading;
}

function getQuestionGrammar(question) {
    const match = question.id.match(/GR-\d{2}/);
    return match ? match[0] : "GR-00";
}

function getGrammarKey(question) {
    return `${getQuestionUnit(question)}-${getQuestionGrammar(question)}`;
}

function renderSelector() {
    if (currentMode === 'vocab') {
        unifiedSelector.replaceChildren();
        const units = ALL_VOCAB_INFO.units || [];
        units.forEach(unit => {
            const unitGroup = document.createElement("section");
            unitGroup.className = "unit-group";
            const unitHeader = document.createElement("div");
            unitHeader.className = "unit-header";
            
            const unitCheckbox = document.createElement("input");
            unitCheckbox.type = "checkbox";
            unitCheckbox.id = `unit-${unit.id}`;
            unitCheckbox.className = "unit-cb";
            unitCheckbox.value = unit.id;
            unitCheckbox.checked = true;
            unitCheckbox.addEventListener("change", () => updateSelectionSummary());
            
            const unitLabel = document.createElement("label");
            unitLabel.className = "unit-title";
            unitLabel.htmlFor = unitCheckbox.id;
            unitLabel.textContent = unit.title;
            
            unitHeader.append(unitCheckbox, unitLabel);
            unitGroup.append(unitHeader);
            unifiedSelector.appendChild(unitGroup);
        });
        return;
    }
    const unitMap = new Map();

    ALL_QUESTIONS.forEach((question) => {
        const unit = getQuestionUnit(question);
        const grammar = getQuestionGrammar(question);
        if (!unitMap.has(unit)) unitMap.set(unit, new Set());
        unitMap.get(unit).add(grammar);
    });

    unifiedSelector.replaceChildren();

    [...unitMap.keys()].sort().forEach((unit) => {
        const unitData = typeof ALL_GRAMMAR !== "undefined" ? ALL_GRAMMAR[unit] : null;
        const unitGroup = document.createElement("section");
        unitGroup.className = "unit-group";

        const unitHeader = document.createElement("div");
        unitHeader.className = "unit-header";

        const unitCheckbox = document.createElement("input");
        unitCheckbox.type = "checkbox";
        unitCheckbox.id = `unit-${unit}`;
        unitCheckbox.className = "unit-cb";
        unitCheckbox.value = unit;
        unitCheckbox.checked = true;
        unitCheckbox.addEventListener("change", () => toggleUnitGroup(unit));

        const unitLabel = document.createElement("label");
        unitLabel.className = "unit-title";
        unitLabel.htmlFor = unitCheckbox.id;
        unitLabel.textContent = `Unit ${unit.replace("U", "")}: ${unitData ? unitData.title : unit}`;

        const unitCount = document.createElement("span");
        unitCount.className = "unit-count";
        unitCount.textContent = `${unitMap.get(unit).size} points`;

        unitHeader.append(unitCheckbox, unitLabel, unitCount);

        const grammarList = document.createElement("div");
        grammarList.className = "gr-list";
        grammarList.id = `list-${unit}`;

        [...unitMap.get(unit)].sort().forEach((grammar) => {
            const grammarName = unitData?.grammar?.[grammar] || grammar;
            const item = document.createElement("label");
            item.className = "checkbox-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = `gr-cb gr-cb-${unit}`;
            checkbox.value = `${unit}-${grammar}`;
            checkbox.checked = true;
            checkbox.addEventListener("change", () => toggleGrammarItem(unit));

            const textWrap = document.createElement("span");
            const code = document.createElement("span");
            code.className = "gr-code";
            code.textContent = grammar;
            const name = document.createElement("span");
            name.className = "gr-name";
            name.textContent = grammarName;
            textWrap.append(code, name);

            item.append(checkbox, textWrap);
            grammarList.appendChild(item);
        });

        unitGroup.append(unitHeader, grammarList);
        unifiedSelector.appendChild(unitGroup);
    });
}

function toggleUnitGroup(unit) {
    const unitCheckbox = document.getElementById(`unit-${unit}`);
    document.querySelectorAll(`.gr-cb-${unit}`).forEach((checkbox) => {
        checkbox.checked = unitCheckbox.checked;
    });
    updateSelectionSummary();
}

function toggleGrammarItem(unit) {
    const unitCheckbox = document.getElementById(`unit-${unit}`);
    const grammarCheckboxes = [...document.querySelectorAll(`.gr-cb-${unit}`)];
    unitCheckbox.checked = grammarCheckboxes.some((checkbox) => checkbox.checked);
    unitCheckbox.indeterminate = unitCheckbox.checked && grammarCheckboxes.some((checkbox) => !checkbox.checked);
    updateSelectionSummary();
}

function setAllSelections(checked) {
    document.querySelectorAll(".unit-cb, .gr-cb").forEach((checkbox) => {
        checkbox.checked = checked;
        checkbox.indeterminate = false;
    });
    updateSelectionSummary();
}

function getSelectedGrammarKeys() {
    return [...document.querySelectorAll(".gr-cb:checked")].map((checkbox) => checkbox.value);
}

function getSelectedPool() {
    if (currentMode === 'vocab') {
        const selectedUnitNumbers = new Set([...document.querySelectorAll(".unit-cb:checked")].map(cb => {
            const match = cb.value.match(/u(\d+)/i);
            return match ? match[1] : cb.value;
        }));
        let pool = [];
        ALL_VOCAB_QUIZ.forEach(wordObj => {
            const unitMatch = wordObj.id.match(/u(\d+)_/i);
            const uNum = unitMatch ? unitMatch[1] : null;
            if (uNum && selectedUnitNumbers.has(uNum)) {
                wordObj.questions.forEach(q => {
                    pool.push({
                        ...q,
                        q: q.question,
                        o: q.options,
                        vocabHint: wordObj.hint,
                        e: q.explanation
                    });
                });
            }
        });
        return pool;
    }
    const selectedKeys = new Set(getSelectedGrammarKeys());
    return ALL_QUESTIONS.filter((question) => selectedKeys.has(getGrammarKey(question)));
}

function updateSelectionSummary() {
    if (currentMode === 'vocab') {
        const pool = getSelectedPool();
        selectionCount.textContent = `Chế độ Luyện Từ Vựng`;
        questionPoolCount.textContent = `${pool.length} câu hỏi MC`;
        return;
    }
    const selectedGrammar = getSelectedGrammarKeys();
    const pool = getSelectedPool();
    const readingCount = new Set(pool.filter((question) => question.r).map((question) => question.r)).size;
    const mcCount = pool.filter((question) => !question.r).length;

    selectionCount.textContent = `${selectedGrammar.length} grammar points đã chọn`;
    questionPoolCount.textContent = `${readingCount} bài đọc, ${mcCount} câu MC`;
}

function generateExam() {
    const pool = getSelectedPool();
    
    if (currentMode === 'vocab') {
        if (pool.length < TOTAL_QUESTIONS) {
            alert(`Không đủ câu hỏi để tạo đề ${TOTAL_QUESTIONS} câu. Hiện có ${pool.length} câu.`);
            return;
        }
        currentExam = shuffle(pool).slice(0, TOTAL_QUESTIONS).map(question => ({
            ...question,
            shuffledOptions: shuffle(question.o.map((text, originalIdx) => ({ text, originalIdx })))
        }));
        startTest();
        return;
    }
    
    const mcPool = pool.filter((question) => !question.r);
    const readingQuestions = pool.filter((question) => question.r);
    const readingRefs = [...new Set(readingQuestions.map((question) => question.r))];

    if (readingRefs.length < 2) {
        alert("Cần ít nhất 2 bài đọc trong phần đã chọn.");
        return;
    }

    const selectedReadings = shuffle(readingRefs).slice(0, 2);
    const finalReadings = selectedReadings.flatMap((readingId) =>
        readingQuestions.filter((question) => question.r === readingId)
    );
    const remainingSlots = TOTAL_QUESTIONS - finalReadings.length;

    if (remainingSlots < 0 || mcPool.length < remainingSlots) {
        alert(`Không đủ câu hỏi để tạo đề ${TOTAL_QUESTIONS} câu. Hiện có ${finalReadings.length} câu đọc và ${mcPool.length} câu trắc nghiệm.`);
        return;
    }

    currentExam = [...finalReadings, ...shuffle(mcPool).slice(0, remainingSlots)].map((question) => ({
        ...question,
        shuffledOptions: shuffle(question.o.map((text, originalIdx) => ({ text, originalIdx })))
    }));

    startTest();
}

function startTest() {
    setupScreen.hidden = true;
    resultScreen.hidden = true;
    examScreen.hidden = false;
    document.body.classList.add("exam-active");
    document.body.classList.remove("result-active");
    currentIdx = 0;
    userAnswers = {};
    startTimer();
    window.scrollTo({ top: 0, behavior: "auto" });
    renderQuestion();
}

function startTimer() {
    stopTimer();
    remainingSeconds = EXAM_DURATION_SECONDS;
    updateTimerDisplay();
    timerId = window.setInterval(() => {
        remainingSeconds -= 1;
        updateTimerDisplay();

        if (remainingSeconds <= 0) {
            stopTimer();
            showResult({ timedOut: true });
        }
    }, 1000);
}

function stopTimer() {
    if (timerId) {
        window.clearInterval(timerId);
        timerId = null;
    }
}

function updateTimerDisplay() {
    const safeSeconds = Math.max(remainingSeconds, 0);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
    const seconds = (safeSeconds % 60).toString().padStart(2, "0");
    timerBadge.textContent = `${minutes}:${seconds}`;
    timerBadge.classList.toggle("timer-warning", safeSeconds <= 60);
}

function renderQuestion() {
    const question = currentExam[currentIdx];
    const total = currentExam.length;
    const answeredCount = Object.keys(userAnswers).length;

    progressFill.style.width = `${((currentIdx + 1) / total) * 100}%`;
    qCounter.textContent = `${currentIdx + 1} / ${total}`;
    examTitle.textContent = `Question ${currentIdx + 1}`;
    answeredBadge.textContent = `${answeredCount}/${total} đã trả lời`;
    if (currentMode === 'vocab') {
        const unitMatch = question.id.match(/u(\d+)_/i);
        const uDisplay = unitMatch ? 'Unit ' + unitMatch[1] : 'VOCAB';
        questionMeta.textContent = uDisplay;
    } else {
        questionMeta.textContent = `${getQuestionUnit(question)} - ${getQuestionGrammar(question)}`;
    }

    renderQuestionNav();
    renderReading(question);
    questionText.textContent = question.q;
    renderOptions(question);

    prevBtn.style.visibility = currentIdx === 0 ? "hidden" : "visible";
    nextBtn.hidden = currentIdx === total - 1;
    submitBtn.hidden = currentIdx !== total - 1;
}

function renderQuestionNav() {
    questionNav.replaceChildren();
    let activeButton = null;

    currentExam.forEach((question, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "question-nav-btn";
        if (index === currentIdx) {
            button.classList.add("active");
            activeButton = button;
        }
        if (userAnswers[question.id] !== undefined) button.classList.add("answered");
        button.textContent = index + 1;
        button.setAttribute("aria-label", `Question ${index + 1}`);
        button.addEventListener("click", () => {
            currentIdx = index;
            renderQuestion();
        });
        questionNav.appendChild(button);
    });

    activeButton?.scrollIntoView({ block: "nearest", inline: "center" });
}

function renderReading(question) {
    if (!question.r) {
        readingArea.hidden = true;
        readingArea.replaceChildren();
        return;
    }

    const passage = ALL_READINGS.find((reading) => reading.id === question.r);
    readingArea.hidden = false;
    readingArea.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = passage?.title ? `${passage.title} (${question.r})` : `Reading Passage (${question.r})`;
    const content = document.createElement("p");
    content.textContent = passage?.content || "Context not found.";
    readingArea.append(title, content);
}

function renderOptions(question) {
    optionsList.replaceChildren();

    question.shuffledOptions.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-btn";
        if (userAnswers[question.id] === index) button.classList.add("selected");
        button.addEventListener("click", () => selectOption(index));

        const label = document.createElement("span");
        label.className = "option-label";
        label.textContent = String.fromCharCode(65 + index);

        const text = document.createElement("span");
        text.className = "option-text";
        text.textContent = option.text;

        button.append(label, text);
        optionsList.appendChild(button);
    });
}

function selectOption(index) {
    const question = currentExam[currentIdx];
    userAnswers[question.id] = index;
    renderQuestion();
}

function showResult(options = {}) {
    stopTimer();
    examScreen.hidden = true;
    resultScreen.hidden = false;
    document.body.classList.remove("exam-active");
    document.body.classList.add("result-active");
    window.scrollTo({ top: 0, behavior: "auto" });

    const score = currentExam.reduce((total, question) => {
        const selectedIdx = userAnswers[question.id];
        if (selectedIdx === undefined) return total;
        return total + (question.shuffledOptions[selectedIdx].originalIdx === 0 ? 1 : 0);
    }, 0);

    finalScore.textContent = score;
    scoreTen.textContent = `Điểm thang 10: ${(score / TOTAL_QUESTIONS * 10).toFixed(1)}`;
    resultMsg.textContent = options.timedOut ? `Hết giờ. ${getResultMessage(score)}` : getResultMessage(score);
    renderReview();
}

function getResultMessage(score) {
    if (score >= 18) return "Excellent! Bạn đã sẵn sàng cho bài kiểm tra thật.";
    if (score >= 15) return "Good job! Chỉ cần ôn lại vài điểm nhỏ nữa.";
    if (score >= 10) return "Khá ổn, nhưng nên xem lại phần giải thích bên dưới.";
    return "Nên ôn tập thêm các grammar points rồi thử lại một đề mới.";
}

function renderReview() {
    reviewList.replaceChildren();

    currentExam.forEach((question, index) => {
        const selectedIdx = userAnswers[question.id];
        const selectedOption = selectedIdx === undefined ? null : question.shuffledOptions[selectedIdx];
        const correctOption = question.shuffledOptions.find((option) => option.originalIdx === 0);
        const isCorrect = selectedOption?.originalIdx === 0;

        const item = document.createElement("article");
        item.className = `review-item ${isCorrect ? "correct" : "incorrect"}`;

        const status = document.createElement("span");
        status.className = "review-status";
        status.textContent = isCorrect ? "Đúng" : "Xem lại";

        const title = document.createElement("h3");
        title.textContent = `Question ${index + 1}: ${question.q}`;

        const readingReview = createReadingReview(question);

        const chosen = document.createElement("p");
        chosen.innerHTML = `<strong>Câu trả lời của bạn:</strong> ${selectedOption ? escapeHtml(selectedOption.text) : "Chưa trả lời"}`;

        const correct = document.createElement("p");
        correct.innerHTML = `<strong>Đáp án đúng:</strong> ${escapeHtml(correctOption.text)}`;

        const explain = document.createElement("p");
        explain.className = "review-explain";
        explain.textContent = question.e || "Chưa có giải thích cho câu này.";

        item.append(status, title);
        if (readingReview) item.appendChild(readingReview);
        item.append(chosen, correct, explain);
        reviewList.appendChild(item);
    });
}

function createReadingReview(question) {
    if (!question.r) return null;

    const passage = ALL_READINGS.find((reading) => reading.id === question.r);
    const wrapper = document.createElement("section");
    wrapper.className = "review-reading";

    const title = document.createElement("h4");
    title.textContent = passage?.title ? `${passage.title} (${question.r})` : `Reading Passage (${question.r})`;

    const content = document.createElement("p");
    content.textContent = passage?.content || "Không tìm thấy bài đọc.";

    wrapper.append(title, content);
    return wrapper;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

selectAllBtn.addEventListener("click", () => setAllSelections(true));
clearAllBtn.addEventListener("click", () => setAllSelections(false));
startBtn.addEventListener("click", generateExam);
prevBtn.addEventListener("click", () => {
    if (currentIdx > 0) {
        currentIdx--;
        renderQuestion();
    }
});
nextBtn.addEventListener("click", () => {
    if (currentIdx < currentExam.length - 1) {
        currentIdx++;
        renderQuestion();
    }
});
submitBtn.addEventListener("click", () => {
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < currentExam.length && !confirm(`Bạn mới trả lời ${answeredCount}/${currentExam.length} câu. Vẫn nộp bài?`)) return;
    showResult();
});
newExamBtn.addEventListener("click", () => {
    stopTimer();
    resultScreen.hidden = true;
    setupScreen.hidden = false;
    document.body.classList.remove("exam-active", "result-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

init();

