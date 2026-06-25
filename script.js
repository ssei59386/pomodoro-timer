const CIRCUMFERENCE = 2 * Math.PI * 90;

const timeDisplay = document.getElementById("timeDisplay");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const progressCircle = document.querySelector(".progress");
const sessionCountEl = document.getElementById("sessionCount");
const modeButtons = document.querySelectorAll(".mode-btn");
const alarmSound = document.getElementById("alarmSound");

progressCircle.style.strokeDasharray = CIRCUMFERENCE;

let totalSeconds = 25 * 60;
let remainingSeconds = totalSeconds;
let timerId = null;
let isRunning = false;
let sessionCount = Number(localStorage.getItem("pomodoroSessions") || 0);
sessionCountEl.textContent = sessionCount;

function updateDisplay() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  timeDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const ratio = remainingSeconds / totalSeconds;
  progressCircle.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);
}

function tick() {
  if (remainingSeconds <= 0) {
    clearInterval(timerId);
    isRunning = false;
    startBtn.textContent = "開始";
    alarmSound.play().catch(() => {});

    const activeMode = document.querySelector(".mode-btn.active").dataset.mode;
    if (activeMode === "work") {
      sessionCount++;
      localStorage.setItem("pomodoroSessions", sessionCount);
      sessionCountEl.textContent = sessionCount;
    }
    return;
  }
  remainingSeconds--;
  updateDisplay();
}

startBtn.addEventListener("click", () => {
  if (isRunning) {
    clearInterval(timerId);
    isRunning = false;
    startBtn.textContent = "開始";
  } else {
    isRunning = true;
    startBtn.textContent = "一時停止";
    timerId = setInterval(tick, 1000);
  }
});

resetBtn.addEventListener("click", () => {
  clearInterval(timerId);
  isRunning = false;
  startBtn.textContent = "開始";
  remainingSeconds = totalSeconds;
  updateDisplay();
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    clearInterval(timerId);
    isRunning = false;
    startBtn.textContent = "開始";
    totalSeconds = Number(btn.dataset.minutes) * 60;
    remainingSeconds = totalSeconds;
    updateDisplay();
  });
});

updateDisplay();

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

function loadTasks() {
  return JSON.parse(localStorage.getItem("pomodoroTasks") || "[]");
}

function saveTasks(tasks) {
  localStorage.setItem("pomodoroTasks", JSON.stringify(tasks));
}

function renderTasks() {
  const tasks = loadTasks();
  taskList.innerHTML = "";
  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    if (task.done) li.classList.add("done");

    const span = document.createElement("span");
    span.textContent = task.text;
    span.addEventListener("click", () => {
      tasks[index].done = !tasks[index].done;
      saveTasks(tasks);
      renderTasks();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      tasks.splice(index, 1);
      saveTasks(tasks);
      renderTasks();
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  const tasks = loadTasks();
  tasks.push({ text, done: false });
  saveTasks(tasks);
  taskInput.value = "";
  renderTasks();
});

renderTasks();
