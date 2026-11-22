const alarmSound = new Audio("carol_of_the_bells-alarm.mp3");
alarmSound.preload = "auto";

function parseDuration(value) {
  const input = value.trim().replace(",", ".");
  const match = input.match(/^(\d+)(?:([:.])(\d{1,2}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  let seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (match[2] === "." && match[3]?.length === 1) seconds *= 10;
  if (seconds > 59) return null;

  const totalSeconds = minutes * 60 + seconds;
  return Number.isSafeInteger(totalSeconds) && totalSeconds > 0 ? totalSeconds : null;
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

class LoopingTimer {
  constructor(card) {
    this.card = card;
    this.durationInput = card.querySelector("[data-duration]");
    this.pauseBetween = card.querySelector("[data-pause-between]");
    this.display = card.querySelector("[data-display]");
    this.cyclesDisplay = card.querySelector("[data-cycles]");
    this.cycleCount = card.querySelector(".cycle-count");
    this.toggleButton = card.querySelector("[data-toggle]");
    this.hint = card.querySelector(".field-hint");
    this.durationSeconds = 0;
    this.remainingSeconds = 0;
    this.cycles = 0;
    this.deadline = 0;
    this.interval = null;
    this.state = "idle";

    this.toggleButton.addEventListener("click", () => this.toggle());
    card.querySelector("[data-reset]").addEventListener("click", () => this.reset());
    this.durationInput.addEventListener("input", () => {
      this.durationInput.classList.remove("is-invalid");
      this.hint.textContent = "";
    });
    this.durationInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.toggle();
    });
  }

  toggle() {
    if (this.state === "running") {
      this.pause();
      return;
    }

    if (this.state === "paused") {
      this.start(this.remainingSeconds);
      return;
    }

    const duration = parseDuration(this.durationInput.value);
    if (duration === null) {
      this.durationInput.classList.add("is-invalid");
      this.hint.textContent = "Enter a valid duration, e.g. 1:40.";
      this.durationInput.focus();
      return;
    }

    if (this.state === "idle") this.cycles = 0;
    this.durationSeconds = duration;
    this.cyclesDisplay.textContent = String(this.cycles);
    this.start(duration);
  }

  start(seconds) {
    this.remainingSeconds = seconds;
    this.deadline = Date.now() + seconds * 1000;
    this.state = "running";
    this.durationInput.disabled = true;
    this.render();
    clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), 200);
  }

  pause() {
    this.remainingSeconds = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    clearInterval(this.interval);
    this.interval = null;
    this.state = "paused";
    this.durationInput.disabled = false;
    this.render();
  }

  tick() {
    this.remainingSeconds = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    if (this.remainingSeconds === 0) {
      this.completeCycle();
      return;
    }
    this.render();
  }

  completeCycle() {
    clearInterval(this.interval);
    this.interval = null;
    this.cycles += 1;
    this.cyclesDisplay.textContent = String(this.cycles);
    alarmSound.currentTime = 0;
    alarmSound.play().catch(() => {});

    if (this.pauseBetween.checked) {
      this.remainingSeconds = 0;
      this.state = "complete";
      this.durationInput.disabled = false;
      this.render();
      return;
    }

    this.start(this.durationSeconds);
  }

  reset() {
    clearInterval(this.interval);
    this.interval = null;
    this.state = "idle";
    this.cycles = 0;
    this.remainingSeconds = 0;
    this.durationInput.disabled = false;
    this.cyclesDisplay.textContent = "0";
    this.render();
  }

  render() {
    const formattedTime = formatTime(this.remainingSeconds);
    this.display.textContent = formattedTime;
    this.display.classList.toggle("is-long", formattedTime.length > 5);
    this.cycleCount.setAttribute("aria-label", `Number of completed cycles: ${this.cycles}`);
    const buttonLabels = {
      idle: "Start timer",
      running: "Pause timer",
      paused: "Resume timer",
      complete: "Start next cycle",
    };
    const buttonLabel = buttonLabels[this.state];
    this.toggleButton.setAttribute("aria-label", buttonLabel);
    this.toggleButton.title = buttonLabel;
    this.toggleButton.classList.toggle("is-pausing", this.state === "running");
  }
}

const timers = [...document.querySelectorAll("[data-timer]")].map((card) => new LoopingTimer(card));

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.matches("input, button, textarea, select") || target.isContentEditable)) return;

  const shortcuts = { " ": [0, "toggle"], r: [0, "reset"], s: [1, "toggle"], t: [1, "reset"] };
  const action = shortcuts[event.key.toLowerCase()];
  if (!action) return;
  event.preventDefault();
  const [index, method] = action;
  if (method === "reset") timers[index].reset();
  else timers[index].toggle();
});