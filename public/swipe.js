let users = [];
let index = 0;

fetch("/users", {
  credentials: "same-origin"
})

function showUser() {
  // ✅ RESET CARD POSITION & VISIBILITY
  card.style.transform = "translateX(0)";
  card.style.opacity = 1;

  if (index >= users.length) {
    card.innerHTML = "No more users";
    return;
  }

  const user = users[index];

  card.innerHTML = `
    <h2>${user.username}</h2>
    ${user.photo ? `<img src="${user.photo}" width="200">` : ""}
  `;
}
function likeUser() {
  fetch("/like", {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ likedId: users[index].id })
});

let startX = 0;
const card = document.getElementById("card");

card.addEventListener("mousedown", e => {
  startX = e.clientX;
});

card.addEventListener("mouseup", e => {
  const diff = e.clientX - startX;

  if (diff > 100) {
    card.style.transform = "translateX(300px)";
    card.style.opacity = 0;
    setTimeout(likeUser, 300);
  } else if (diff < -100) {
    card.style.transform = "translateX(-300px)";
    card.style.opacity = 0;
    setTimeout(nextUser, 300);
