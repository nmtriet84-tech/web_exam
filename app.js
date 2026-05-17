

let DATASETS = [];
let currentDataset = null;

let ALL_QUESTIONS = [];
let ALL_READINGS = [];
let ALL_GRAMMAR = {};
let ALL_INSTRUCTIONS = {};

let currentExam = [];
let userAnswers = {};
let currentIdx = 0;
let remainingSeconds = 0;
let timerId = null;
let examStartTime = null;   // Thời điểm bắt đầu làm bài
let examStartTimestamp = 0; // Unix timestamp để tính thời gian đã làm

// Biến lưu thông tin học sinh
let studentName = '';
let studentClass = '';

const setupScreen = document.getElementById("setup-screen");
const examScreen = document.getElementById("exam-screen");
const resultScreen = document.getElementById("result-screen");
const unifiedSelector = document.getElementById("unified-selector");
const start15Btn = document.getElementById("start-15-btn");
const start30Btn = document.getElementById("start-30-btn");
let currentExamTargetCount = 20;
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
const questionInstruction = document.getElementById("question-instruction");
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

// Các phần tử form thông tin học sinh
const studentNameInput = document.getElementById("student-name");
const studentClassInput = document.getElementById("student-class");

// Tải thông tin học sinh đã lưu từ localStorage
function loadStudentInfo() {
    const savedName = localStorage.getItem('examStudentName') || '';
    const savedClass = localStorage.getItem('examStudentClass') || '';
    if (studentNameInput) studentNameInput.value = savedName;
    if (studentClassInput) studentClassInput.value = savedClass;
}

// Lưu thông tin học sinh vào localStorage
function saveStudentInfo() {
    const name = studentNameInput ? studentNameInput.value.trim() : '';
    const cls = studentClassInput ? studentClassInput.value.trim() : '';
    if (name) localStorage.setItem('examStudentName', name);
    if (cls) localStorage.setItem('examStudentClass', cls);
    studentName = name;
    studentClass = cls;
}

async function init() {
    loadStudentInfo();
    setLoadingState(true);
    try {
        DATASETS = await fetchJson('data/datasets.json');
        renderDatasetSelector();
        if (DATASETS.length > 0) {
            await setMode(DATASETS[0].id);
        }
    } catch (error) {
        console.error(error);
        selectionCount.textContent = "Không tải được cấu hình hệ thống.";
    } finally {
        setLoadingState(false);
    }
}

function renderDatasetSelector() {
    const container = document.getElementById('dataset-selector');
    if (!container) return;
    container.replaceChildren();
    
    DATASETS.forEach(ds => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dataset-btn';
        btn.id = `ds-btn-${ds.id}`;
        btn.textContent = ds.title;
        btn.addEventListener('click', () => setMode(ds.id));
        container.appendChild(btn);
    });
}

async function setMode(datasetId) {
    setLoadingState(true);
    currentDataset = DATASETS.find(ds => ds.id === datasetId);
    
    document.querySelectorAll('.dataset-btn').forEach(btn => {
        if (btn.id === `ds-btn-${datasetId}`) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const eyebrow = document.getElementById('brand-eyebrow');
    const subtitle = document.getElementById('brand-subtitle');
    const readingStat = document.getElementById('reading-stat');
    const setupTitle = document.getElementById('setup-title');
    
    if (eyebrow) eyebrow.textContent = currentDataset.eyebrow || 'Grade 8 English';
    if (subtitle) subtitle.textContent = currentDataset.subtitle || '';
    if (readingStat) readingStat.style.display = currentDataset.has_reading ? 'block' : 'none';
    if (setupTitle) setupTitle.textContent = currentDataset.setup_title || 'Select Units';
    
    try {
        await loadData();
        renderSelector();
        updateSelectionSummary();
    } catch(e) {
        console.error(e);
        selectionCount.textContent = `Lỗi tải bộ đề ${datasetId}`;
    } finally {
        setLoadingState(false);
    }
}

async function loadData() {
    ALL_QUESTIONS = [];
    ALL_READINGS = [];
    ALL_GRAMMAR = {};
    ALL_INSTRUCTIONS = {};
    
    const [questions, grammar, readings, instructions] = await Promise.all([
        fetchJson(`${currentDataset.path}/questions.json`),
        fetchJson(`${currentDataset.path}/unit.json`),
        currentDataset.has_reading ? fetchJson(`${currentDataset.path}/reading.json`).catch(()=>[]) : Promise.resolve([]),
        fetchJson(`${currentDataset.path}/instruction.json`).catch(()=>({}))
    ]);

    ALL_QUESTIONS = questions || [];
    ALL_GRAMMAR = grammar || {};
    ALL_READINGS = readings || [];
    ALL_INSTRUCTIONS = instructions || {};
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${url}`);
    return response.json();
}

function setLoadingState(isLoading) {
    if (start15Btn) start15Btn.disabled = isLoading;
    if (start30Btn) start30Btn.disabled = isLoading;
    selectAllBtn.disabled = isLoading;
    clearAllBtn.disabled = isLoading;
}

function getQuestionUnit(question) {
    const match = question.id.match(/U\d{2}/i);
    return match ? match[0].toUpperCase() : "U00";
}

function getQuestionGrammar(question) {
    const match = question.id.match(/GR-\d{2}/i);
    return match ? match[0].toUpperCase() : "GR-00";
}

function getGrammarKey(question) {
    return `${getQuestionUnit(question)}-${getQuestionGrammar(question)}`;
}

function renderSelector() {
    const unitMap = new Map();
    const unitQuestionCount = new Map(); // Đếm tổng số câu hỏi thực tế của mỗi Unit

    ALL_QUESTIONS.forEach((question) => {
        const unit = getQuestionUnit(question);
        const grammar = getQuestionGrammar(question);
        
        if (!unitMap.has(unit)) unitMap.set(unit, new Set());
        unitMap.get(unit).add(grammar);
        
        if (!unitQuestionCount.has(unit)) unitQuestionCount.set(unit, 0);
        unitQuestionCount.set(unit, unitQuestionCount.get(unit) + 1);
    });

    unifiedSelector.replaceChildren();

    [...unitMap.keys()].sort((a,b)=>a.localeCompare(b, undefined, {numeric: true})).forEach((unit) => {
        let unitKey = unit;
        let unitData = ALL_GRAMMAR[unitKey] || ALL_GRAMMAR[unitKey.replace(/^0+/, '')] || ALL_GRAMMAR[unitKey.replace(/^U0*/i, 'U')];
        
        const unitGroup = document.createElement("section");
        unitGroup.className = "unit-group";

        const unitHeader = document.createElement("div");
        unitHeader.className = "unit-header";

        const isRequired = unitData?.config?.required === true;
        
        const unitCheckbox = document.createElement("input");
        unitCheckbox.type = "checkbox";
        unitCheckbox.id = `unit-${unit}`;
        unitCheckbox.className = "unit-cb";
        unitCheckbox.value = unit;
        unitCheckbox.checked = true;
        if (isRequired) {
            unitCheckbox.disabled = true;
            unitCheckbox.title = "Phần này là bắt buộc";
        }
        unitCheckbox.addEventListener("change", () => toggleUnitGroup(unit));

        const unitLabel = document.createElement("label");
        unitLabel.className = "unit-title";
        unitLabel.htmlFor = unitCheckbox.id;
        unitLabel.textContent = unitData ? unitData.title : `Unit ${unit.replace(/^U0*/i, "")}`;

        const unitCount = document.createElement("span");
        unitCount.className = "unit-count";
        const totalPoints = unitMap.get(unit).size;
        const totalQuestions = unitQuestionCount.get(unit) || 0;
        unitCount.textContent = currentDataset.type === 'vocab' 
            ? `${totalQuestions} câu` 
            : `${totalPoints} points, ${totalQuestions} câu`;

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
            if (isRequired) {
                checkbox.disabled = true;
            }
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
        if (!checkbox.disabled) {
            checkbox.checked = unitCheckbox.checked;
        }
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
        if (!checkbox.disabled) {
            checkbox.checked = checked;
            checkbox.indeterminate = false;
        }
    });
    updateSelectionSummary();
}

function getSelectedGrammarKeys() {
    return [...document.querySelectorAll(".gr-cb:checked")].map((checkbox) => checkbox.value);
}

function getSelectedPool() {
    const selectedKeys = new Set(getSelectedGrammarKeys());
    return ALL_QUESTIONS.filter((question) => selectedKeys.has(getGrammarKey(question)));
}

function updateSelectionSummary() {
    const pool = getSelectedPool();
    const readingCount = new Set(pool.filter((q) => q.r).map((q) => q.r)).size;
    const mcCount = pool.filter((q) => !q.r).length;

    if (currentDataset.has_reading) {
        const selectedGrammar = getSelectedGrammarKeys();
        selectionCount.textContent = `${selectedGrammar.length} điểm kiến thức đã chọn`;
        questionPoolCount.textContent = `${readingCount} bài đọc, ${mcCount} câu MC`;
    } else {
        selectionCount.textContent = `Chế độ ${currentDataset.title}`;
        questionPoolCount.textContent = `${pool.length} câu hỏi MC`;
    }
}

function generateExam(targetCount) {
    // Yêu cầu điền tên trước khi làm bài
    const nameVal = studentNameInput ? studentNameInput.value.trim() : '';
    if (!nameVal) {
        alert("⚠️ Vui lòng điền Họ và tên học sinh trước khi bắt đầu làm bài!");
        if (studentNameInput) {
            studentNameInput.focus();
            studentNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const pool = getSelectedPool();
    if (pool.length === 0) {
        alert("Vui lòng chọn ít nhất 1 phần để tạo đề.");
        return;
    }
    
    currentExamTargetCount = targetCount;
    if (pool.length < targetCount) {
        alert(`Ngân hàng đề không đủ ${targetCount} câu (hiện chỉ có ${pool.length} câu trong các phần đã chọn). Vui lòng chọn thêm Unit/Chuyên đề.`);
        return;
    }

    let finalExam = [];
    const selectedGrammars = getSelectedGrammarKeys();
    let allocation = {};
    // 1. Pick reading passages globally
    const readingQs = pool.filter(q => q.r);
    const mcQs = pool.filter(q => !q.r);
    const uniqueRefs = [...new Set(readingQs.map(q => q.r))];
    
    const maxReadings = Math.max(1, Math.floor(targetCount / 10)); // 20->2, 40->4 readings max
    const selectedRefs = shuffle(uniqueRefs).slice(0, maxReadings);
    
    for (const ref of selectedRefs) {
        const qsForRef = readingQs.filter(q => q.r === ref);
        if (finalExam.length + qsForRef.length <= targetCount + 2) { // Allow slight exceed
            finalExam.push(...qsForRef);
        }
    }
    
    let remaining = targetCount - finalExam.length;
    
    // 2. Distribute remaining across grammar points using MC questions
    let activeGrammars = [...selectedGrammars];
    activeGrammars.forEach(g => allocation[g] = 0);
    
    while (remaining > 0 && activeGrammars.length > 0) {
        const perGrammar = Math.max(1, Math.floor(remaining / activeGrammars.length));
        let stillActive = [];
        
        for (const g of activeGrammars) {
            if (remaining <= 0) break;
            
            const availableMC = mcQs.filter(q => getGrammarKey(q) === g);
            const currentAlloc = allocation[g];
            const take = Math.min(perGrammar, availableMC.length - currentAlloc);
            
            if (take > 0) {
                allocation[g] += take;
                remaining -= take;
                if (allocation[g] < availableMC.length) {
                    stillActive.push(g);
                }
            }
        }
        
        if (activeGrammars.length === stillActive.length && remaining > 0 && remaining < activeGrammars.length) {
            const shuffled = shuffle(stillActive);
            for (let i = 0; i < remaining; i++) {
                allocation[shuffled[i]] += 1;
            }
            remaining = 0;
            break;
        }
        activeGrammars = stillActive;
    }

    // 3. Fulfill the MC allocation
    for (const g of selectedGrammars) {
        let needed = allocation[g];
        if (needed <= 0) continue;
        const availableMC = mcQs.filter(q => getGrammarKey(q) === g);
        finalExam.push(...shuffle(availableMC).slice(0, needed));
    }
    
    // 4. Cắt gọt MC dư thừa nếu pick reading bị lố
    let exceed = finalExam.length - targetCount;
    if (exceed > 0) {
        let mcIndices = [];
        finalExam.forEach((q, idx) => { if (!q.r) mcIndices.push(idx); });
        mcIndices = shuffle(mcIndices).slice(0, exceed).sort((a,b) => b-a);
        for (let idx of mcIndices) {
            finalExam.splice(idx, 1);
        }
    }
    
    // 5. Nếu thiếu MC, lấy đại các MC chưa được chọn để bù vào
    let deficit = targetCount - finalExam.length;
    if (deficit > 0) {
        const selectedIds = new Set(finalExam.map(q => q.id));
        const unusedMC = mcQs.filter(q => !selectedIds.has(q.id));
        finalExam.push(...shuffle(unusedMC).slice(0, deficit));
    }

    if (finalExam.length === 0) {
        alert("Không có câu hỏi nào được tạo. Vui lòng kiểm tra lại cấu hình.");
        return;
    }

    currentExam = finalExam.map(question => ({
        ...question,
        shuffledOptions: shuffle(question.o.map((text, originalIdx) => ({ text, originalIdx })))
    }));
    
    startTest();
}

function startTest() {
    // Lưu thông tin học sinh trước khi vào bài thi
    saveStudentInfo();
    
    examStartTime = new Date();
    examStartTimestamp = Date.now();
    
    setupScreen.hidden = true;
    resultScreen.hidden = true;
    examScreen.hidden = false;
    document.body.classList.add("exam-active");
    document.body.classList.remove("result-active");
    currentIdx = 0;
    userAnswers = {};
    
    // Cập nhật thông số dynamic ở panel bên trái
    const qCountEl = document.getElementById("stat-questions");
    const rCountEl = document.getElementById("stat-readings");
    const dCountEl = document.getElementById("stat-duration");
    
    if (qCountEl) qCountEl.textContent = currentExam.length;
    if (rCountEl) rCountEl.textContent = new Set(currentExam.filter(q => q.r).map(q => q.r)).size;
    if (dCountEl) dCountEl.textContent = currentExam.length === 40 ? 30 : 15;
    
    startTimer();
    window.scrollTo({ top: 0, behavior: "auto" });
    renderQuestion();
}

function startTimer() {
    stopTimer();
    
    const durationMins = currentExamTargetCount === 40 ? 30 : 15;
    remainingSeconds = durationMins * 60;
    
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
    
    questionMeta.textContent = getGrammarKey(question);
    
    // Xử lý Instruction
    const grammarKey = getQuestionGrammar(question);
    if (ALL_INSTRUCTIONS[grammarKey]) {
        questionInstruction.textContent = ALL_INSTRUCTIONS[grammarKey];
        questionInstruction.style.display = 'block';
    } else {
        questionInstruction.style.display = 'none';
    }

    renderQuestionNav();
    renderReading(question);
    questionText.innerHTML = question.q;
    
    const qImg = document.getElementById("question-img");
    if(qImg) {
        const hasImage = currentDataset.id === 'TS10_ENGLISH' && question.id.includes('GR-03');
        if (hasImage) {
            qImg.src = `${currentDataset.path}/img/${question.id}.png`;
            qImg.style.display = 'block';
            qImg.onerror = function() {
                if (this.src.endsWith('.png')) {
                    this.src = `${currentDataset.path}/img/${question.id}.jpg`;
                } else if (this.src.endsWith('.jpg')) {
                    this.src = `${currentDataset.path}/img/${question.id}.jpeg`;
                } else {
                    this.style.display = 'none';
                }
            };
        } else {
            qImg.style.display = 'none';
            qImg.src = '';
        }
    }
    
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
    if (!question.r || !currentDataset.has_reading) {
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

    // --- Thông tin học sinh và thời gian ---
    const nameEl = document.getElementById('result-student-name');
    const classEl = document.getElementById('result-student-class');
    const datetimeEl = document.getElementById('result-datetime');
    const durationEl = document.getElementById('result-duration');

    if (nameEl) nameEl.textContent = studentName || '(Chưa nhập tên)';
    if (classEl) classEl.textContent = studentClass || '(Chưa nhập lớp)';

    // Thời điểm bắt đầu làm bài (VD: 17/05/2026 lúc 18:45)
    if (datetimeEl && examStartTime) {
        const dateStr = examStartTime.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const timeStr = examStartTime.toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit'
        });
        datetimeEl.textContent = `${dateStr} lúc ${timeStr}`;
    }

    // Thời gian đã làm (phút:giây)
    if (durationEl && examStartTimestamp) {
        const elapsedMs = Date.now() - examStartTimestamp;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        durationEl.textContent = `${mins} phút ${secs} giây`;
    }

    const score = currentExam.reduce((total, question) => {
        const selectedIdx = userAnswers[question.id];
        if (selectedIdx === undefined) return total;
        return total + (question.shuffledOptions[selectedIdx].originalIdx === 0 ? 1 : 0);
    }, 0);

    // Tính điểm hệ 10 và định dạng dạng "8,5 điểm" hay "8,54 điểm"
    const scoreTenVal = (score / currentExam.length * 10);
    const formattedScore = Number(scoreTenVal.toFixed(2)).toString().replace('.', ',');
    finalScore.textContent = `${formattedScore} điểm`;

    // Cập nhật nhãn số câu trả lời đúng
    const labelEl = document.getElementById('score-label-text');
    if (labelEl) {
        labelEl.textContent = `Đúng ${score}/${currentExam.length} câu`;
    }

    resultMsg.textContent = options.timedOut ? `Hết giờ. ${getResultMessage(score)}` : getResultMessage(score);
    renderReview();
}

function getResultMessage(score) {
    if (score >= 18) return "Excellent! Bạn đã sẵn sàng cho bài kiểm tra thật.";
    if (score >= 15) return "Good job! Chỉ cần ôn lại vài điểm nhỏ nữa.";
    if (score >= 10) return "Khá ổn, nhưng nên xem lại phần giải thích bên dưới.";
    return "Nên ôn tập thêm các kiến thức rồi thử lại một đề mới.";
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
        title.innerHTML = `Question ${index + 1}: ${question.q}`;

        const readingReview = createReadingReview(question);

        const chosen = document.createElement("p");
        chosen.innerHTML = `<strong>Câu trả lời của bạn:</strong> ${selectedOption ? escapeHtml(selectedOption.text) : "Chưa trả lời"}`;

        const correct = document.createElement("p");
        correct.innerHTML = `<strong>Đáp án đúng:</strong> ${escapeHtml(correctOption.text)}`;

        const explainWrap = document.createElement("div");
        
        const explain = document.createElement("p");
        explain.className = "review-explain";
        explain.innerHTML = `<strong>Giải thích:</strong> ${question.e || "Chưa có giải thích cho câu này."}`;
        
        explainWrap.appendChild(explain);


        item.append(status, title);
        if (readingReview) item.appendChild(readingReview);
        item.append(chosen, correct, explainWrap);
        reviewList.appendChild(item);
    });
}

function createReadingReview(question) {
    if (!question.r || !currentDataset.has_reading) return null;

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
if (start15Btn) start15Btn.addEventListener("click", () => generateExam(20));
if (start30Btn) start30Btn.addEventListener("click", () => generateExam(40));
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
    
    // Reset left column stats back to default on returning to setup
    const qCountEl = document.getElementById("stat-questions");
    const rCountEl = document.getElementById("stat-readings");
    const dCountEl = document.getElementById("stat-duration");
    
    if (qCountEl) qCountEl.textContent = 20;
    if (rCountEl) rCountEl.textContent = 2;
    if (dCountEl) dCountEl.textContent = 15;
    
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ==========================================
// 🛡️ CHỨC NĂNG BẢO MẬT: CẤM CHUỘT PHẢI & COPY
// ==========================================

// 1. Cấm chuột phải (Right-click) trên toàn bộ website
document.addEventListener('contextmenu', event => {
    event.preventDefault();
});

// 2. Cấm phím tắt sao chép, xem nguồn và F12 Inspect (Ctrl+C, Ctrl+X, Ctrl+U, F12, Ctrl+Shift+I)
document.addEventListener('keydown', event => {
    // Ngăn chặn Ctrl+C (Copy) và Ctrl+X (Cut)
    if (event.ctrlKey && (event.key === 'c' || event.key === 'x' || event.key === 'C' || event.key === 'X')) {
        event.preventDefault();
    }
    
    // Ngăn chặn Ctrl+U (Xem nguồn trang - View Source)
    if (event.ctrlKey && (event.key === 'u' || event.key === 'U')) {
        event.preventDefault();
    }
    
    // Ngăn chặn F12 hoặc Ctrl+Shift+I (Mở Chrome DevTools)
    if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && (event.key === 'i' || event.key === 'I'))) {
        event.preventDefault();
    }
});

// 3. Phát hiện chuyển tab hoặc rời màn hình (Tab Switching & Window Blur Detection)
const cheatModal = document.getElementById("cheat-modal");
const cheatResetBtn = document.getElementById("cheat-reset-btn");
let isCheatTriggered = false;

function handleExamCheating() {
    // Chỉ kích hoạt hình phạt khi đang ở trong phòng thi tích cực và chưa bị cảnh báo trước đó
    if (!document.body.classList.contains("exam-active") || isCheatTriggered) {
        return;
    }
    
    isCheatTriggered = true;
    stopTimer(); // Dừng thời gian đếm ngược ngay lập tức
    
    // Hiển thị modal cảnh báo gian lận
    if (cheatModal) {
        cheatModal.style.display = "flex";
    }
}

// Khi nhấn "Bốc đề mới & Làm lại" trên modal cảnh báo
if (cheatResetBtn) {
    cheatResetBtn.addEventListener("click", () => {
        if (cheatModal) {
            cheatModal.style.display = "none";
        }
        isCheatTriggered = false;
        
        // Hủy kết quả làm bài hiện tại và tự động bốc bộ đề mới với cấu hình tương đương
        const targetCount = currentExamTargetCount || 20;
        generateExam(targetCount);
    });
}

// Lắng nghe sự kiện ẩn/hiện tab (Page Visibility API)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        handleExamCheating();
    }
});

// Lắng nghe sự kiện mất tiêu điểm của trình duyệt (chuyển cửa sổ khác, chia màn hình)
window.addEventListener("blur", () => {
    handleExamCheating();
});

init();
