const audioPlayer = document.querySelector("#audioPlayer");
const videoPlayer = document.querySelector("#videoPlayer");
const modeButtons = document.querySelectorAll(".media-mode-tabs button");
const nowTitle = document.querySelector(".now-playing h1");
const nowSubtitle = document.querySelector(".now-playing .subtitle");
const mediaCards = document.querySelectorAll(".media-card");

function setMode(mode) {
  const isAudio = mode === "audio";

  audioPlayer.classList.toggle("hidden", !isAudio);
  videoPlayer.classList.toggle("hidden", isAudio);

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
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

mediaCards.forEach((card) => {
  card.addEventListener("click", () => {
    const title = card.dataset.title || "Sunstruck Synapse";
    const subtitle = card.dataset.subtitle || "Selected work";
    const type = card.dataset.type || "audio";

    nowTitle.textContent = `Sunstruck Synapse - ${title}`;
    nowSubtitle.textContent = subtitle;
    setMode(type);

    document.querySelector(".player-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll(".protected-media").forEach((media) => {
  media.addEventListener("contextmenu", (event) => event.preventDefault());
  media.addEventListener("dragstart", (event) => event.preventDefault());
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
  }
});
