import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Auth Guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    } else {
        loadOverallSummary();
        loadExpenseReport(); // NAYA
        initDailyCashSummary(); // NAYA
    }
});

// -- HTML Elements --
const repPurchases = document.getElementById("rep-purchases");
const repMedSales = document.getElementById("rep-med-sales");
const repDocFee = document.getElementById("rep-doc-fee");
const repNetSales = document.getElementById("rep-net-sales");
const repDiscount = document.getElementById("rep-discount");

const monthPicker = document.getElementById("monthPicker");
const loadMonthBtn = document.getElementById("loadMonthBtn");
const deleteMonthBtn = document.getElementById("deleteMonthBtn");
const monthStatusMsg = document.getElementById("monthStatusMsg");
const monthSummaryCards = document.getElementById("monthSummaryCards");
const monthBillsBody = document.getElementById("monthBillsBody");

const monthBillCount = document.getElementById("month-bill-count");
const monthMedTotal = document.getElementById("month-med-total");
const monthDocFee = document.getElementById("month-doc-fee");
const monthDiscount = document.getElementById("month-discount");
const monthGrandTotal = document.getElementById("month-grand-total");

// Default month picker ko current month par set kar do
(function setDefaultMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    monthPicker.value = `${y}-${m}`;
})();

// Cart items se readable medicines string banana
function formatItemsList(items) {
    if (!items || items.length === 0) return "-";
    return items.map(it => `${it.name} x${it.qty}`).join(", ");
}

// =====================================================
// 1. OVERALL (ALL-TIME) SUMMARY CARDS
// =====================================================
async function loadOverallSummary() {
    try {
        // ---- Purchases Total ----
        const purchasesSnap = await getDocs(collection(db, "purchases"));
        let totalPurchases = 0;
        purchasesSnap.forEach(docSnap => {
            const p = docSnap.data();
            totalPurchases += Number(p.totalAmount) || 0;
        });
        repPurchases.innerText = `Rs. ${totalPurchases.toLocaleString()}`;

        // ---- Sales Totals ----
        const salesSnap = await getDocs(collection(db, "sales"));
        let totalMedSales = 0;
        let totalDocFee = 0;
        let totalDiscount = 0;
        let totalGrand = 0;

        salesSnap.forEach(docSnap => {
            const s = docSnap.data();
            totalMedSales += Number(s.medicineTotal) || 0;
            totalDocFee += Number(s.doctorFee) || 0;
            totalDiscount += Number(s.discount) || 0;
            totalGrand += Number(s.grandTotal) || 0;
        });

        repMedSales.innerText = `Rs. ${totalMedSales.toLocaleString()}`;
        repDocFee.innerText = `Rs. ${totalDocFee.toLocaleString()}`;
        repNetSales.innerText = `Rs. ${totalGrand.toLocaleString()}`;
        repDiscount.innerText = `Discount Given: Rs. ${totalDiscount.toLocaleString()}`;

    } catch (error) {
        console.error("Error loading overall summary:", error);
        repPurchases.innerText = "Error";
        repMedSales.innerText = "Error";
        repDocFee.innerText = "Error";
        repNetSales.innerText = "Error";
    }
}

// =====================================================
// 2. MONTHLY HISTORY - LOAD
// =====================================================
let currentMonthSales = []; // { id, ...data } - selected month ke loaded docs (delete ke liye use honge)

loadMonthBtn.addEventListener("click", async () => {
    const selectedMonth = monthPicker.value; // format: "YYYY-MM"

    if (!selectedMonth) {
        monthStatusMsg.innerText = "⚠️ Pehle koi month select karein.";
        monthStatusMsg.style.color = "#e74c3c";
        return;
    }

    loadMonthBtn.disabled = true;
    loadMonthBtn.innerText = "Loading...";
    monthStatusMsg.innerText = "Data load ho raha hai...";
    monthStatusMsg.style.color = "#555";
    monthBillsBody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>Loading...</td></tr>";
    monthSummaryCards.style.display = "none";

    try {
        const querySnapshot = await getDocs(collection(db, "sales"));
        currentMonthSales = [];

        querySnapshot.forEach(docSnap => {
            const sale = docSnap.data();
            // sale.date format "YYYY-MM-DD" hai, isliye prefix match karo
            if (sale.date && sale.date.startsWith(selectedMonth)) {
                currentMonthSales.push({ id: docSnap.id, ...sale });
            }
        });

        // Date ke hisaab se sort karo (purana -> naya)
        currentMonthSales.sort((a, b) => (a.date > b.date ? 1 : -1));

        renderMonthData(selectedMonth);

    } catch (error) {
        console.error("Error loading month data:", error);
        monthStatusMsg.innerText = "❌ Data load karne mein error aaya.";
        monthStatusMsg.style.color = "#e74c3c";
        monthBillsBody.innerHTML = "<tr><td colspan='8' style='text-align:center; color:red;'>Error loading data.</td></tr>";
    } finally {
        loadMonthBtn.disabled = false;
        loadMonthBtn.innerText = "🔍 Load Month Data";
    }
});

function renderMonthData(selectedMonth) {
    monthBillsBody.innerHTML = "";

    if (currentMonthSales.length === 0) {
        monthStatusMsg.innerText = `📭 "${selectedMonth}" mahine ke liye koi sales record nahi mila.`;
        monthStatusMsg.style.color = "#7f8c8d";
        monthBillsBody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>No records found for this month.</td></tr>";
        monthSummaryCards.style.display = "none";
        return;
    }

    let sumMed = 0, sumDocFee = 0, sumDiscount = 0, sumGrand = 0;

    currentMonthSales.forEach(sale => {
        sumMed += Number(sale.medicineTotal) || 0;
        sumDocFee += Number(sale.doctorFee) || 0;
        sumDiscount += Number(sale.discount) || 0;
        sumGrand += Number(sale.grandTotal) || 0;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${sale.date || '-'}</td>
            <td><strong>${sale.patientName || 'Walk-in'}</strong></td>
            <td>${sale.doctorName || '-'}</td>
            <td>${formatItemsList(sale.items)}</td>
            <td>Rs. ${sale.medicineTotal || 0}</td>
            <td>Rs. ${sale.doctorFee || 0}</td>
            <td style="color:red;">Rs. ${sale.discount || 0}</td>
            <td style="color:green; font-weight:bold;">Rs. ${sale.grandTotal || 0}</td>
        `;
        monthBillsBody.appendChild(row);
    });

    // Summary cards update karo
    monthBillCount.innerText = currentMonthSales.length;
    monthMedTotal.innerText = `Rs. ${sumMed.toLocaleString()}`;
    monthDocFee.innerText = `Rs. ${sumDocFee.toLocaleString()}`;
    monthDiscount.innerText = `Rs. ${sumDiscount.toLocaleString()}`;
    monthGrandTotal.innerText = `Rs. ${sumGrand.toLocaleString()}`;
    monthSummaryCards.style.display = "grid";

    monthStatusMsg.innerText = `✅ "${selectedMonth}" ke ${currentMonthSales.length} bills mil gaye.`;
    monthStatusMsg.style.color = "#27ae60";
}

// =====================================================
// 3. MONTHLY HISTORY - DELETE
// =====================================================
deleteMonthBtn.addEventListener("click", async () => {
    const selectedMonth = monthPicker.value;

    if (!selectedMonth) {
        alert("Pehle koi month select karein.");
        return;
    }

    if (currentMonthSales.length === 0) {
        alert(`Pehle "Load Month Data" button dabayein taake pata chale is mahine mein kitna data hai.`);
        return;
    }

    const confirmDelete = confirm(
        `⚠️ Warning!\n\n"${selectedMonth}" mahine ke ${currentMonthSales.length} sales records PERMANENTLY delete ho jayenge.\n\nYeh action wapas (undo) nahi ho sakta. Kya aap pakka delete karna chahte hain?`
    );

    if (!confirmDelete) return;

    // Double confirmation - critical destructive action
    const doubleCheck = confirm(`Last confirmation: "${selectedMonth}" ka pura data delete kar dein?`);
    if (!doubleCheck) return;

    deleteMonthBtn.disabled = true;
    deleteMonthBtn.innerText = "Deleting...";
    monthStatusMsg.innerText = "Delete ho raha hai, intezaar karein...";
    monthStatusMsg.style.color = "#555";

    try {
        for (const sale of currentMonthSales) {
            await deleteDoc(doc(db, "sales", sale.id));
        }

        monthStatusMsg.innerText = `🗑️ "${selectedMonth}" ka data successfully delete ho gaya.`;
        monthStatusMsg.style.color = "#e74c3c";

        currentMonthSales = [];
        monthBillsBody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>No records found for this month.</td></tr>";
        monthSummaryCards.style.display = "none";

        // Overall summary cards bhi refresh karo kyunke total change ho gaya
        loadOverallSummary();

    } catch (error) {
        console.error("Error deleting month data:", error);
        monthStatusMsg.innerText = "❌ Delete karte waqt error aaya. Dobara koshish karein.";
        monthStatusMsg.style.color = "#e74c3c";
    } finally {
        deleteMonthBtn.disabled = false;
        deleteMonthBtn.innerText = "🗑️ Delete This Month's Data";
    }
});

// =====================================================
// 4. EXPENSE REPORT (All-Time Summary + Category Breakdown)
// =====================================================
const expTotalEl = document.getElementById("exp-total");
const expCountEl = document.getElementById("exp-count");
const expTopCategoryEl = document.getElementById("exp-top-category");
const categoryChartContainer = document.getElementById("categoryChartContainer");

// Category bars ke liye colors rotate honge taake har bar alag dikhe
const CATEGORY_COLORS = [
    "linear-gradient(90deg, #e74c3c, #f39c12)",
    "linear-gradient(90deg, #8e44ad, #c0392b)",
    "linear-gradient(90deg, #2980b9, #3498db)",
    "linear-gradient(90deg, #16a085, #27ae60)",
    "linear-gradient(90deg, #d35400, #e67e22)",
    "linear-gradient(90deg, #2c3e50, #34495e)"
];

async function loadExpenseReport() {
    try {
        const expensesSnap = await getDocs(collection(db, "expenses"));

        let totalExpenses = 0;
        let totalCount = 0;
        const categoryTotals = {}; // { categoryName: totalAmount }

        expensesSnap.forEach(docSnap => {
            const exp = docSnap.data();
            const amount = Number(exp.amount) || 0;
            const category = exp.category || "Other";

            totalExpenses += amount;
            totalCount++;

            categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        });

        // -- Summary cards update --
        expTotalEl.innerText = `Rs. ${totalExpenses.toLocaleString()}`;
        expCountEl.innerText = totalCount;

        // -- Highest category find karo --
        const categoryEntries = Object.entries(categoryTotals); // [[name, total], ...]
        if (categoryEntries.length === 0) {
            expTopCategoryEl.innerText = "-";
            categoryChartContainer.innerHTML = `<p style="text-align:center; color:#7f8c8d;">Abhi tak koi expense record nahi hai.</p>`;
            return;
        }

        categoryEntries.sort((a, b) => b[1] - a[1]); // Sabse zyada total pehle

        expTopCategoryEl.innerText = categoryEntries[0][0];

        // -- Category-wise bar chart render karo --
        renderCategoryChart(categoryEntries, totalExpenses);

    } catch (error) {
        console.error("Error loading expense report:", error);
        expTotalEl.innerText = "Error";
        expCountEl.innerText = "Error";
        expTopCategoryEl.innerText = "Error";
        categoryChartContainer.innerHTML = `<p style="text-align:center; color:red;">Expense report load karne mein error aaya.</p>`;
    }
}

function renderCategoryChart(categoryEntries, totalExpenses) {
    categoryChartContainer.innerHTML = "";

    const maxAmount = categoryEntries[0][1]; // Sabse bada total (bar width scale karne ke liye)

    categoryEntries.forEach(([category, amount], index) => {
        const percentWidth = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
        const percentOfTotal = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0;
        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

        const row = document.createElement("div");
        row.className = "category-bar-row";
        row.innerHTML = `
            <div class="category-bar-label">${category}</div>
            <div class="category-bar-track">
                <div class="category-bar-fill" style="width:${percentWidth}%; background:${color};">
                    <span>${percentOfTotal}%</span>
                </div>
            </div>
            <div class="category-bar-amount">Rs. ${amount.toLocaleString()}</div>
        `;
        categoryChartContainer.appendChild(row);
    });
}

// =====================================================
// 5. DAILY CASH SUMMARY
// =====================================================
const cashDatePicker = document.getElementById("cashDatePicker");
const loadCashBtn = document.getElementById("loadCashBtn");
const saveCashBtn = document.getElementById("saveCashBtn");
const cashStatusMsg = document.getElementById("cashStatusMsg");
const cashSummaryGrid = document.getElementById("cashSummaryGrid");
const cashOpeningInput = document.getElementById("cashOpening");
const cashSalesInput = document.getElementById("cashSales");
const cashExpensesInput = document.getElementById("cashExpenses");
const cashClosingInput = document.getElementById("cashClosing");
const cashRecordStatusBadge = document.getElementById("cashRecordStatusBadge");

let currentCashDate = null;     // Abhi jo date load hui hai (string "YYYY-MM-DD")
let currentCashRecordExists = false; // Kya is date ka record Firestore mein already saved hai

function getTodayDateStr() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Date ko 1 din peeche karna (previous day ka string nikalne ke liye)
function getPreviousDateStr(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Default: date picker aaj ki date par set karo, aur aaj ka din load karo
(function initDefaultCashDate() {
    if (cashDatePicker) cashDatePicker.value = getTodayDateStr();
})();

function initDailyCashSummary() {
    // Page load hote hi aaj ka din automatically load kar do
    loadCashForDate(getTodayDateStr());
}

loadCashBtn.addEventListener("click", () => {
    const selectedDate = cashDatePicker.value;
    if (!selectedDate) {
        cashStatusMsg.innerText = "⚠️ Pehle koi date select karein.";
        cashStatusMsg.style.color = "#e74c3c";
        return;
    }
    loadCashForDate(selectedDate);
});

// =====================================================
// Date ke liye Sales aur Expenses ka total calculate karo
// =====================================================
async function calculateSalesAndExpensesForDate(dateStr) {
    let totalSales = 0;
    let totalExpenses = 0;

    const salesSnap = await getDocs(collection(db, "sales"));
    salesSnap.forEach(docSnap => {
        const sale = docSnap.data();
        if (sale.date === dateStr) {
            totalSales += Number(sale.grandTotal) || 0;
        }
    });

    const expensesSnap = await getDocs(collection(db, "expenses"));
    expensesSnap.forEach(docSnap => {
        const exp = docSnap.data();
        if (exp.date === dateStr) {
            totalExpenses += Number(exp.amount) || 0;
        }
    });

    return { totalSales, totalExpenses };
}

// =====================================================
// Pichle din ka Closing Cash dhoondo (carry-forward ke liye)
// Agar pichle din ka record nahi mila, to peeche jaate raho (max 60 din tak)
// taake gaps (jaise band rehne wale din) handle ho sakein
// =====================================================
async function findPreviousClosingCash(dateStr) {
    let searchDate = dateStr;
    for (let i = 0; i < 60; i++) {
        searchDate = getPreviousDateStr(searchDate);
        const prevDocRef = doc(db, "dailyCash", searchDate);
        const prevDocSnap = await getDoc(prevDocRef);
        if (prevDocSnap.exists()) {
            return Number(prevDocSnap.data().closingCash) || 0;
        }
    }
    return null; // Koi pichla record nahi mila (pehla din hai)
}

async function loadCashForDate(dateStr) {
    currentCashDate = dateStr;
    cashSummaryGrid.style.display = "none";
    cashStatusMsg.innerText = "Loading...";
    cashStatusMsg.style.color = "#555";
    loadCashBtn.disabled = true;

    try {
        const docRef = doc(db, "dailyCash", dateStr);
        const docSnap = await getDoc(docRef);

        // Sales & Expenses hamesha live (fresh) calculate karo us din ke liye
        const { totalSales, totalExpenses } = await calculateSalesAndExpensesForDate(dateStr);
        cashSalesInput.value = totalSales;
        cashExpensesInput.value = totalExpenses;

        if (docSnap.exists()) {
            // -- Record already saved hai is date ke liye --
            currentCashRecordExists = true;
            const data = docSnap.data();
            cashOpeningInput.value = data.openingCash || 0;
            cashClosingInput.value = data.closingCash || 0;

            cashRecordStatusBadge.innerHTML = `<span class="cash-record-status saved">✅ Is din ka record save ho chuka hai. Aap chahein to neeche se update kar sakte hain.</span>`;
            cashStatusMsg.innerText = `"${dateStr}" ka data load ho gaya.`;
            cashStatusMsg.style.color = "#27ae60";

        } else {
            // -- Record nahi mila, naya banayein --
            currentCashRecordExists = false;

            const prevClosing = await findPreviousClosingCash(dateStr);

            if (prevClosing !== null) {
                cashOpeningInput.value = prevClosing;
            } else {
                // Bilkul pehla din hai - manual entry chahiye
                cashOpeningInput.value = 0;
            }

            // Closing Cash auto-calculate karo
            recalculateClosingCash();

            cashRecordStatusBadge.innerHTML = `<span class="cash-record-status unsaved">⚠️ Is din ka record abhi save nahi hua. "Save / Update Cash Record" dabayein taake mehfooz ho jaye.</span>`;
            cashStatusMsg.innerText = prevClosing !== null
                ? `"${dateStr}" ke liye naya record - Opening Cash pichle din se carry hua hai.`
                : `"${dateStr}" sabse pehla din lag raha hai - Opening Cash khud darj karein.`;
            cashStatusMsg.style.color = "#555";
        }

        cashSummaryGrid.style.display = "grid";

    } catch (error) {
        console.error("Error loading daily cash:", error);
        cashStatusMsg.innerText = "❌ Data load karne mein error aaya.";
        cashStatusMsg.style.color = "#e74c3c";
    } finally {
        loadCashBtn.disabled = false;
    }
}

// Closing Cash = Opening + Sales - Expenses (auto-calculate, lekin manually override bhi ho sakta hai)
function recalculateClosingCash() {
    const opening = Number(cashOpeningInput.value) || 0;
    const sales = Number(cashSalesInput.value) || 0;
    const expenses = Number(cashExpensesInput.value) || 0;
    cashClosingInput.value = opening + sales - expenses;
}

// Jab Opening Cash manually change karein, Closing Cash khud update ho jaye
cashOpeningInput.addEventListener("input", recalculateClosingCash);

// =====================================================
// SAVE / UPDATE Cash Record
// =====================================================
saveCashBtn.addEventListener("click", async () => {
    if (!currentCashDate) {
        alert("Pehle koi date load karein.");
        return;
    }

    const openingCash = Number(cashOpeningInput.value) || 0;
    const totalSales = Number(cashSalesInput.value) || 0;
    const totalExpenses = Number(cashExpensesInput.value) || 0;
    const closingCash = Number(cashClosingInput.value) || 0;

    saveCashBtn.disabled = true;
    saveCashBtn.innerText = "Saving...";

    try {
        await setDoc(doc(db, "dailyCash", currentCashDate), {
            date: currentCashDate,
            openingCash,
            totalSales,
            totalExpenses,
            closingCash,
            createdAt: serverTimestamp()
        });

        currentCashRecordExists = true;
        cashRecordStatusBadge.innerHTML = `<span class="cash-record-status saved">✅ "${currentCashDate}" ka record successfully save ho gaya.</span>`;
        cashStatusMsg.innerText = "Record save ho gaya. Agla din yahi Closing Cash, Opening Cash ban jayega.";
        cashStatusMsg.style.color = "#27ae60";

    } catch (error) {
        console.error("Error saving daily cash:", error);
        alert("❌ Record save karne mein error aaya.");
    } finally {
        saveCashBtn.disabled = false;
        saveCashBtn.innerText = "💾 Save / Update Cash Record";
    }
});