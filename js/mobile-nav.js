// js/mobile-nav.js

function initMobileNav() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return; // Agar is page par sidebar hi nahi hai, to kuch mat karo

    // 1. Check karo ke mobile-topbar pehle se hai ya nahi
    let topbar = document.querySelector(".mobile-topbar");
    if (!topbar) {
        topbar = document.createElement("div");
        topbar.className = "mobile-topbar";
        topbar.innerHTML = `
            <button type="button" class="mobile-menu-btn" id="mobileMenuToggleBtn" aria-label="Open menu">
                <i class="fa-solid fa-bars">&#9776;</i>
            </button>
            <span class="mobile-topbar-title">Islamia POS</span>
        `;
        document.body.insertBefore(topbar, document.body.firstChild);
    }

    // 2. Overlay banao (background dim karne ke liye)
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        overlay.id = "sidebarOverlay";
        document.body.appendChild(overlay);
    }

    // 3. Sidebar ke andar close (X) button inject karo
    let closeBtn = document.querySelector(".sidebar-close-btn");
    if (!closeBtn) {
        closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "sidebar-close-btn";
        closeBtn.id = "sidebarCloseBtn";
        closeBtn.setAttribute("aria-label", "Close menu");
        closeBtn.innerHTML = "&#10005;"; // Cross/X symbol
        sidebar.style.position = sidebar.style.position || "fixed";
        sidebar.insertBefore(closeBtn, sidebar.firstChild);
    }

    // 4. Open/Close logic
    const menuToggleBtn = document.getElementById("mobileMenuToggleBtn") || document.querySelector(".mobile-menu-btn");

    function openSidebar() {
        sidebar.classList.add("mobile-open");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar.classList.remove("mobile-open");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    if (menuToggleBtn) menuToggleBtn.addEventListener("click", openSidebar);
    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    // 5. Kisi bhi sidebar link par click karne se menu apne aap band ho jaye
    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    // 6. Escape key se bhi band ho sake
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSidebar();
    });

    // 7. Agar window resize ho ke desktop size par aa jaye, sidebar state reset kar do
    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
}

// YEH NAYA HAI: Ensures script runs properly no matter when it loads
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileNav);
} else {
    initMobileNav();
}