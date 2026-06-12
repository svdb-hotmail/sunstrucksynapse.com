const audioPlayer = document.querySelector("#audioPlayer");
const videoPlayer = document.querySelector("#videoPlayer");
const modeButtons = document.querySelectorAll(".media-mode-tabs button");
const nowTitle = document.querySelector(".now-playing h1");
const nowSubtitle = document.querySelector(".now-playing .subtitle");
const mediaCards = document.querySelectorAll(".media-card");
const playerPanel = document.querySelector(".player-panel");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setMode(mode) {
  const isAudio = mode === "audio";

  audioPlayer.classList.toggle("hidden", !isAudio);
  videoPlayer.classList.toggle("hidden", isAudio);

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });

  if (isAudio) {
    videoPlayer.pause();
  } else {
    audioPlayer.pause();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

function selectMediaCard(card) {
  const title = card.dataset.title || "Sunstruck Synapse";
  const subtitle = card.dataset.subtitle || "Selected work";
  const type = card.dataset.type || "audio";

  nowTitle.textContent = `Sunstruck Synapse - ${title}`;
  nowSubtitle.textContent = subtitle;
  setMode(type);

  playerPanel.scrollIntoView({
    behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    block: "start",
  });
}

mediaCards.forEach((card) => {
  card.addEventListener("click", () => {
    selectMediaCard(card);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectMediaCard(card);
    }
  });
});

document.querySelectorAll(".protected-media").forEach((media) => {
  media.addEventListener("contextmenu", (event) => event.preventDefault());
  media.addEventListener("dragstart", (event) => event.preventDefault());
});
