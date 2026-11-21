// Listens for the "watchedchange" event from vision.js and updates the page
window.addEventListener("watchedchange", (e) => {
  const watched = e.detail.watched;
  document.body.classList.toggle("alive", !watched);
});