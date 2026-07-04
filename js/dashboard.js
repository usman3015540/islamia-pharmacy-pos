import { db, auth } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("Dashboard JS Loaded Successfully!");

// NAYA: Low stock threshold aur expiry warning window (yahan se control karein)
const LOW_STOCK_THRESHOLD = 10;
const EXPIRY_WARNING_DAYS = 30;

// 1. Auth Guard (Check karega ke user login hai ya nahi)
onAuthStateChanged(auth, (user) => {
    if (!user) {
        console.log("No user logged in, redirecting to login.html...");
        window.location.replace("login.html");
    } else {
        console.log("User is logged in as:", user.email);
        // Agar login hai, toh dashboard ka data load karo
        loadDashboardStats();
        loadTodaysSales(); // NAYA
    }
});

// 2. Logout Logic
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.replace("login.html");
        } catch (error) {
            alert("Error logging out!");
            console.error(error);
        }
    });
}

// Aaj ki date string (Sales ledger jaisa hi format: YYYY-MM-DD)
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 3. Load Dashboard Stats (Total Medicines, Low Stock count + names, Expiring Soon)
async function loadDashboardStats() {
    console.log("Fetching stats from Firestore...");
    try {
        const querySnapshot = await getDocs(collection(db, "medicines"));
        console.log("Firestore Response Received. Total documents found:", querySnapshot.size);
        
        let totalMeds = 0;
        let lowStockMeds = [];
        let expiringMeds = [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const warningDate = new Date(today);
        warningDate.setDate(warningDate.getDate() + EXPIRY_WARNING_DAYS);

        querySnapshot.forEach((doc) => {
            totalMeds++; 
            const medData = doc.data();
            const stockNum = Number(medData.stock);

            // -- Low Stock check --
            if (stockNum < LOW_STOCK_THRESHOLD) {
                lowStockMeds.push({ name: medData.name, stock: stockNum });
            }

            // -- Expiring Soon check --
            if (medData.expiry) {
                const expiryDate = new Date(medData.expiry);
                if (!isNaN(expiryDate) && expiryDate <= warningDate) {
                    const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                    expiringMeds.push({ name: medData.name, expiry: medData.expiry, daysLeft });
                }
            }
        });

        console.log(`Final Counts - Total: ${totalMeds}, Low Stock: ${lowStockMeds.length}, Expiring: ${expiringMeds.length}`);

        // HTML elements ko update karna
        const totalMedsEl = document.getElementById("total-medicines");
        const lowStockEl = document.getElementById("low-stock");

        if (totalMedsEl) totalMedsEl.innerText = totalMeds;
        if (lowStockEl) lowStockEl.innerText = lowStockMeds.length;

        // NAYA: Low Stock names list render karo
        renderLowStockList(lowStockMeds);

        // NAYA: Expiring Soon names list render karo
        renderExpiringSoonList(expiringMeds);
        
    } catch (error) {
        console.error("Error loading dashboard stats from Firebase:", error);
        alert("Stats load karne mein masla aaya: " + error.message);
    }
}

// =====================================================
// NAYA: Low Stock list render karna
// =====================================================
function renderLowStockList(lowStockMeds) {
    const listEl = document.getElementById("lowStockList");
    if (!listEl) return;

    if (lowStockMeds.length === 0) {
        listEl.innerHTML = `<li class="alert-empty">✅ Saari medicines ka stock theek hai.</li>`;
        return;
    }

    // Kam stock pehle (sabse critical sab se upar)
    lowStockMeds.sort((a, b) => a.stock - b.stock);

    listEl.innerHTML = "";
    lowStockMeds.forEach(med => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="item-name">${med.name}</span>
            <span class="badge-stock">${med.stock} left</span>
        `;
        listEl.appendChild(li);
    });
}

// =====================================================
// NAYA: Expiring Soon list render karna
// =====================================================
function renderExpiringSoonList(expiringMeds) {
    const listEl = document.getElementById("expiringSoonList");
    if (!listEl) return;

    if (expiringMeds.length === 0) {
        listEl.innerHTML = `<li class="alert-empty">✅ Koi medicine agle ${EXPIRY_WARNING_DAYS} dino mein expire nahi ho rahi.</li>`;
        return;
    }

    // Jo sabse pehle expire ho rahi hai, woh sab se upar
    expiringMeds.sort((a, b) => a.daysLeft - b.daysLeft);

    listEl.innerHTML = "";
    expiringMeds.forEach(med => {
        const li = document.createElement("li");
        const daysLabel = med.daysLeft < 0 ? "Expired" : `${med.daysLeft}d left`;
        li.innerHTML = `
            <span>
                <span class="item-name">${med.name}</span><br>
                <span class="item-meta">Expiry: ${med.expiry}</span>
            </span>
            <span class="badge-expiry">${daysLabel}</span>
        `;
        listEl.appendChild(li);
    });
}

// =====================================================
// NAYA: Today's Sales calculation (pehle missing tha)
// =====================================================
async function loadTodaysSales() {
    const todaySalesEl = document.getElementById("today-sales");
    if (!todaySalesEl) return;

    try {
        const todayStr = getTodayDateString();
        const querySnapshot = await getDocs(collection(db, "sales"));

        let todayTotal = 0;
        querySnapshot.forEach((doc) => {
            const sale = doc.data();
            if (sale.date === todayStr) {
                todayTotal += Number(sale.grandTotal) || 0;
            }
        });

        todaySalesEl.innerText = `Rs. ${todayTotal.toLocaleString()}`;

    } catch (error) {
        console.error("Error loading today's sales:", error);
        todaySalesEl.innerText = "Error";
    }
}