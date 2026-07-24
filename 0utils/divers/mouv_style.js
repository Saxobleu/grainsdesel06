const slides = document.querySelectorAll(".slide");
let index = 0;

if (slides.length) {
  slides[0].classList.add("active");
}

function showNextSlide() {
  slides[index].classList.remove("active");
  index = (index + 1) % slides.length;
  slides[index].classList.add("active");
}

setInterval(showNextSlide, 5000);