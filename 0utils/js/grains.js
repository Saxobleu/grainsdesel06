/* ==========================================================================
   LOGIQUE APPLICATIVE - FLUX SURVOL INTERACTIF ET VERROUILLAGE MODALE
   Fichier : ante.js
   ========================================================================== */

function parseCsvData(csvText) {
    const events = {};
    const lines = csvText.trim().split(/\r?\n/);

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) return;

        const separator = trimmedLine.includes(";") ? ";" : ",";
        const [rawDate, img, page, color] = trimmedLine.split(separator).map(value => value.trim());
        if (!rawDate || rawDate.toLowerCase() === "date" || !img) return;

        let dateKey = rawDate;
        const frenchDate = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (frenchDate) {
            dateKey = `${frenchDate[3]}-${frenchDate[2]}-${frenchDate[1]}`;
        }

        events[dateKey] = {
            img,
            page: page || "#",
            color: color || "#00AEEF"
        };
    });

    return events;
}

let activitiesDatabase = {};

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let isModalOpen = false; // Indique si une modale bloquante est affichée

let isFinancePreviewLocked = false;
const sitePrefix = document.body.dataset.sitePrefix || "";
const csvUrl = `${sitePrefix}0utils/divers/grains.csv`;
const defaultSrc = "0utils/img/Mettez_du_SEL_dans_votre_vie_(1).jpg";
const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

document.addEventListener("DOMContentLoaded", async () => {
    initializeSeoAbout();
    await loadCalendarData();
    renderCalendar(currentMonth, currentYear);
    initializePrinting();

    // Changement de mois
    document.getElementById("prev-month").addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        closePreviewModal();
        renderCalendar(currentMonth, currentYear);
    });

    document.getElementById("next-month").addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        closePreviewModal();
        renderCalendar(currentMonth, currentYear);
    });

    // Bouton Croix pour fermer la modale bloquante
    document.getElementById("close-preview")?.addEventListener("click", (e) => {
        e.stopPropagation();
        closePreviewModal();
    });

    // Clic sur le fond transparent de la modale pour fermer
    document.getElementById("activity-preview-container")?.addEventListener("click", (e) => {
        if (e.target.id === "activity-preview-container") {
            closePreviewModal();
        }
    });
});

function initializePrinting() {
    const printButton = document.getElementById("print-calendar-button");
    const printAboutPage = document.getElementById("print-about-page");
    const aboutContent = document.querySelector(".seo-about-content");

    if (printAboutPage && aboutContent) {
        printAboutPage.innerHTML = `
            <div class="print-page-brand">
                <img src="${sitePrefix}0utils/img/Logo_avec_texte_V2_0.png" alt="Grains de SEL">
            </div>
            <article class="print-about-content">${aboutContent.innerHTML}</article>
        `;
    }

    printButton?.addEventListener("click", () => {
        buildCompletePrintCalendar();
        document.body.classList.add("print-calendar-mode");
        window.print();
    });

    window.addEventListener("afterprint", () => {
        document.body.classList.remove("print-calendar-mode");
    });
}

function buildCompletePrintCalendar() {
    const container = document.getElementById("print-calendar-pages");
    if (!container) return;

    const eventDates = Object.keys(activitiesDatabase).sort();
    if (!eventDates.length) {
        container.innerHTML = "<p>Aucune activité enregistrée dans le calendrier.</p>";
        return;
    }

    const [firstYear, firstMonth] = eventDates[0].split("-").map(Number);
    const [lastYear, lastMonth] = eventDates[eventDates.length - 1].split("-").map(Number);
    const monthCards = [];
    let year = firstYear;
    let month = firstMonth - 1;

    while (year < lastYear || (year === lastYear && month <= lastMonth - 1)) {
        monthCards.push(createPrintMonth(month, year));
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
    }

    container.innerHTML = `
        <header class="print-calendar-title">
            <img src="${sitePrefix}0utils/img/Logo_avec_texte_V2_0.png" alt="Grains de SEL">
            <div>
                <h1>Calendrier complet</h1>
                <p>Activités de Grains de SEL 06</p>
            </div>
        </header>
        <div class="print-months-grid">${monthCards.join("")}</div>
    `;
}

function createPrintMonth(month, year) {
    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let cell = 0; cell < 42; cell++) {
        if (cell < startOffset || cell >= startOffset + daysInMonth) {
            cells.push('<div class="print-calendar-day empty"></div>');
            continue;
        }

        const day = cell - startOffset + 1;
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const eventData = activitiesDatabase[dateKey];
        const eventMarker = eventData
            ? `<span class="print-event-dot" style="--event-color:${eventData.color}"></span>`
            : "";
        cells.push(`<div class="print-calendar-day"><span>${day}</span>${eventMarker}</div>`);
    }

    return `
        <article class="print-month-card">
            <h2>${monthNames[month]} ${year}</h2>
            <div class="print-weekdays">
                <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span>
                <span>Ven</span><span>Sam</span><span>Dim</span>
            </div>
            <div class="print-month-grid">${cells.join("")}</div>
        </article>
    `;
}

function initializeSeoAbout() {
    const about = document.getElementById("seo-about");
    const toggle = document.getElementById("seo-about-toggle");
    if (!about || !toggle) return;

    toggle.addEventListener("click", () => {
        const isExpanded = about.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(isExpanded));
        toggle.setAttribute("aria-label", isExpanded
            ? "Fermer la présentation"
            : "Afficher la présentation complète");
        toggle.textContent = isExpanded ? "×" : "⌄";
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && about.classList.contains("is-expanded")) {
            toggle.click();
            toggle.focus();
        }
    });
}

async function loadCalendarData() {
    try {
        const response = await fetch(csvUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        activitiesDatabase = parseCsvData(await response.text());
    } catch (error) {
        console.error(`Impossible de charger le calendrier depuis ${csvUrl}`, error);
        activitiesDatabase = {};
    }
}

/* --------------------------------------------------------------------------
   [SOUS-TITRE] : GÉNÉRATION DU CALENDRIER
   -------------------------------------------------------------------------- */
function renderCalendar(month, year) {
    const title = document.getElementById("calendar-title");
    const grid = document.getElementById("calendar-grid");
    grid.innerHTML = ""; 
    
    title.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6; 

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let cell = 0; cell < 42; cell++) {
        const dayCell = document.createElement("div");
        dayCell.classList.add("calendar-day");

        if (cell >= startOffset && cell < startOffset + daysInMonth) {
            const dayNumber = cell - startOffset + 1;
            dayCell.innerText = dayNumber;

            const mapMonth = String(month + 1).padStart(2, '0');
            const mapDay = String(dayNumber).padStart(2, '0');
            const dateKey = `${year}-${mapMonth}-${mapDay}`;

            if (activitiesDatabase[dateKey]) {
                const eventData = activitiesDatabase[dateKey];
                const dot = document.createElement("div");
                dot.classList.add("event-dot");
                dot.style.backgroundColor = eventData.color;
                
                // 1. COMPORTEMENT AU SURVOL (Ordinateur - Non Bloquant)
                dayCell.addEventListener("mouseenter", () => {
                    if (!isModalOpen && window.innerWidth > 1024) {
                        handleHoverPreview(eventData.img, eventData.page);
                    }
                });
                
                dayCell.addEventListener("mouseleave", () => {
                    if (!isModalOpen && window.innerWidth > 1024) {
                        resetHoverPreview();
                    }
                });
                
                // 2. COMPORTEMENT AU CLIC (PC & Mobile - Bloquant / Pop-up)
                dot.addEventListener("click", (e) => {
                    e.stopPropagation();
                    resetHoverPreview(); // Nettoie le survol en tâche de fond
                    openPreviewModal(eventData, dot);
                });

                dayCell.appendChild(dot);
            }
        } else {
            dayCell.classList.add("empty");
        }

        grid.appendChild(dayCell);
    }
}

/* --------------------------------------------------------------------------
   [SOUS-TITRE] : FONCTIONS SURVOL TEMPORAIRE (CENTRE)
   -------------------------------------------------------------------------- */
function handleHoverPreview(imgUrl, pageUrl) {
    if (document.body.classList.contains("finance-page")) {
        showFinanceCalendarPreview(imgUrl, pageUrl, false);
        return;
    }
    const calendarPreview = document.getElementById("calendar-hover-preview");
    const calendarImg = document.getElementById("calendar-hover-img");
    if (calendarPreview && calendarImg) {
        calendarImg.src = sitePrefix + imgUrl;
        calendarPreview.classList.add("visible");
        return;
    }
    const welcomeImg = document.getElementById("welcome-img");
    const welcomeLink = document.getElementById("welcome-link");
    
    if (!welcomeImg || !welcomeLink) return;
    welcomeImg.src = imgUrl;
    welcomeImg.classList.add("preview-mode");
    welcomeLink.href = pageUrl;
}

function resetHoverPreview() {
    if (document.body.classList.contains("finance-page")) {
        if (!isFinancePreviewLocked) hideFinanceCalendarPreview();
        return;
    }
    const calendarPreview = document.getElementById("calendar-hover-preview");
    const calendarImg = document.getElementById("calendar-hover-img");
    if (calendarPreview && calendarImg) {
        calendarPreview.classList.remove("visible");
        calendarImg.removeAttribute("src");
        return;
    }
    const welcomeImg = document.getElementById("welcome-img");
    const welcomeLink = document.getElementById("welcome-link");
    
    if (!welcomeImg || !welcomeLink) return;
    welcomeImg.src = defaultSrc;
    welcomeImg.classList.remove("preview-mode");
    welcomeLink.href = "#";
}

/* --------------------------------------------------------------------------
   [SOUS-TITRE] : FONCTIONS MODALE DURABLE (POPUP CLIC)
   -------------------------------------------------------------------------- */
function openPreviewModal(eventData, dotElement) {
    if (document.body.classList.contains("finance-page")) {
        showFinanceCalendarPreview(eventData.img, eventData.page, true);
        document.querySelectorAll('.event-dot').forEach(d => d.classList.remove('active-dot'));
        if (dotElement) dotElement.classList.add('active-dot');
        return;
    }
    const container = document.getElementById("activity-preview-container");
    const img = document.getElementById("activity-img");
    const link = document.getElementById("activity-link");

    if (!container || !img || !link) {
        if (eventData.page && eventData.page !== '#') window.location.href = eventData.page;
        return;
    }
    img.src = eventData.img;
    link.href = eventData.page;
    
    // Ajout visuel du point actif
    document.querySelectorAll('.event-dot').forEach(d => d.classList.remove('active-dot'));
    if (dotElement) dotElement.classList.add('active-dot');

    // Déploiement de la modale
    container.className = "activity-preview-visible";
    isModalOpen = true;
}

function closePreviewModal() {
    if (document.body.classList.contains("finance-page")) {
        isFinancePreviewLocked = false;
        hideFinanceCalendarPreview();
        document.querySelectorAll('.event-dot').forEach(d => d.classList.remove('active-dot'));
        return;
    }
    const container = document.getElementById("activity-preview-container");
    if (!container) return;
    
    container.className = "activity-preview-hidden";
    
    // Nettoyage des sélections actives
    document.querySelectorAll('.event-dot').forEach(d => d.classList.remove('active-dot'));
    isModalOpen = false;
    resetHoverPreview();
}

function showFinanceCalendarPreview(imgUrl, pageUrl, locked) {
    const preview = document.getElementById("finance-calendar-preview");
    const img = document.getElementById("finance-preview-img");
    const link = document.getElementById("finance-preview-link");
    if (!preview || !img || !link) return;
    img.src = sitePrefix + imgUrl;
    link.href = pageUrl;
    isFinancePreviewLocked = locked;
    preview.classList.add("visible");
    preview.classList.toggle("locked", locked);
}

function hideFinanceCalendarPreview() {
    const preview = document.getElementById("finance-calendar-preview");
    if (preview) preview.classList.remove("visible", "locked");
}
