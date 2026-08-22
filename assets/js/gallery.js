/* =========================================
   JA-ELA SERENITY VILLA
   PHOTO GALLERY LIGHTBOX
   ========================================= */

const galleryImages = document.querySelectorAll(
    ".gallery-item img"
);

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCaption = document.getElementById("lightbox-caption");

const closeButton = document.querySelector(".lightbox-close");
const previousButton = document.querySelector(".lightbox-prev");
const nextButton = document.querySelector(".lightbox-next");

let currentImageIndex = 0;


/* =========================================
   OPEN PHOTO
   ========================================= */

function openLightbox(index) {

    currentImageIndex = index;

    const image = galleryImages[currentImageIndex];

    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;

    lightboxCaption.textContent = image.alt;

    lightbox.classList.add("active");

    document.body.style.overflow = "hidden";
}


/* =========================================
   CLOSE PHOTO
   ========================================= */

function closeLightbox() {

    lightbox.classList.remove("active");

    document.body.style.overflow = "";
}


/* =========================================
   SHOW NEXT PHOTO
   ========================================= */

function showNextPhoto() {

    currentImageIndex++;

    if (currentImageIndex >= galleryImages.length) {
        currentImageIndex = 0;
    }

    updateLightboxImage();
}


/* =========================================
   SHOW PREVIOUS PHOTO
   ========================================= */

function showPreviousPhoto() {

    currentImageIndex--;

    if (currentImageIndex < 0) {
        currentImageIndex = galleryImages.length - 1;
    }

    updateLightboxImage();
}


/* =========================================
   UPDATE PHOTO
   ========================================= */

function updateLightboxImage() {

    const image = galleryImages[currentImageIndex];

    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;

    lightboxCaption.textContent = image.alt;
}


/* =========================================
   CLICK GALLERY PHOTOS
   ========================================= */

galleryImages.forEach((image, index) => {

    image.addEventListener("click", function () {

        openLightbox(index);

    });

});


/* =========================================
   BUTTON EVENTS
   ========================================= */

closeButton.addEventListener(
    "click",
    closeLightbox
);


nextButton.addEventListener(
    "click",
    showNextPhoto
);


previousButton.addEventListener(
    "click",
    showPreviousPhoto
);


/* =========================================
   CLOSE WHEN CLICKING BACKGROUND
   ========================================= */

lightbox.addEventListener(
    "click",
    function (event) {

        if (event.target === lightbox) {

            closeLightbox();

        }

    }
);


/* =========================================
   KEYBOARD CONTROLS
   ========================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (!lightbox.classList.contains("active")) {
            return;
        }

        if (event.key === "Escape") {
            closeLightbox();
        }

        if (event.key === "ArrowRight") {
            showNextPhoto();
        }

        if (event.key === "ArrowLeft") {
            showPreviousPhoto();
        }

    }
);