import { db, auth } from "./firebase-config.js";
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Auth Guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    } else {
        loadExpenses();
    }
});

// -- Variables --
let allExpenses = [];      // Saare expenses cache mein (filter ke liye)
let editingExpenseId = null; // Agar edit mode mein hain to Firestore doc id yahan hogi

// -- HTML Elements --
const expenseIdDisplay = document.getElementById("expenseIdDisplay");
const editExpenseIdInput = document.getElementById("editExpenseId");
const expDate = document.getElementById("expDate");
const expCategory = document.getElementById("expCategory");
const expAmount = document.getElementById("expAmount");
const expPaymentMethod = document.getElementById("expPaymentMethod");
const expPaidTo = document.getElementById("expPaidTo");
const expDescription = document.getElementById("expDescription");
const expNotes = document.getElementById("expNotes");

const formTitle = document.getElementById("formTitle");
const saveExpenseBtn = document.getElementById("saveExpenseBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const expenseTableBody = document.getElementById("expenseTableBody");
const expenseTotalBar = document.getElementById("expenseTotalBar");

const filterDate = document.getElementById("filterDate");
const filterCategory = document.getElementById("filterCategory");
const filterPaymentMethod = document.getElementById("filterPaymentMethod");
const filterMinAmount = document.getElementById("filterMinAmount");
const filterMaxAmount = document.getElementById("filterMaxAmount");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

// Default date = today
(function setDefaultDate() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    expDate.value = `${y}-${m}-${d}`;
})();

// =====================================================
// CUSTOM EXPENSE ID GENERATOR (EXP-0001, EXP-0002...)
// =====================================================
function generateNextExpenseId(existingExpenses) {
    let maxNum = 0;
    existingExpenses.forEach(exp => {
        if (exp.expenseId) {
            const match = exp.expenseId.match(/EXP-(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        }
    });
    const nextNum = maxNum + 1;
    return `EXP-${String(nextNum).padStart(4, '0')}`;
}

// =====================================================
// LOAD ALL EXPENSES FROM FIRESTORE
// =====================================================
async function loadExpenses() {
    expenseTableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>Loading expenses...</td></tr>";
    try {
        const querySnapshot = await getDocs(collection(db, "expenses"));
        allExpenses = [];
        querySnapshot.forEach(docSnap => {
            allExpenses.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Naye expenses upar (date + createdAt ke hisaab se sort, naya pehle)
        allExpenses.sort((a, b) => {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            return 0;
        });

        // Naya expense ID preview (agar add mode mein hain)
        if (!editingExpenseId) {
            expenseIdDisplay.value = generateNextExpenseId(allExpenses);
        }

        renderExpenseTable();
    } catch (error) {
        console.error("Error loading expenses:", error);
        expenseTableBody.innerHTML = "<tr><td colspan='9' style='text-align:center; color:red;'>Error loading expenses.</td></tr>";
    }
}

// =====================================================
// RENDER TABLE (with filters applied)
// =====================================================
function renderExpenseTable() {
    const dateVal = filterDate.value;
    const catVal = filterCategory.value;
    const methodVal = filterPaymentMethod.value;
    const minVal = filterMinAmount.value !== "" ? Number(filterMinAmount.value) : null;
    const maxVal = filterMaxAmount.value !== "" ? Number(filterMaxAmount.value) : null;

    const filtered = allExpenses.filter(exp => {
        if (dateVal && exp.date !== dateVal) return false;
        if (catVal && exp.category !== catVal) return false;
        if (methodVal && exp.paymentMethod !== methodVal) return false;
        const amt = Number(exp.amount) || 0;
        if (minVal !== null && amt < minVal) return false;
        if (maxVal !== null && amt > maxVal) return false;
        return true;
    });

    expenseTableBody.innerHTML = "";

    if (filtered.length === 0) {
        expenseTableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>No expenses found.</td></tr>";
        expenseTotalBar.innerText = "Total (filtered): Rs. 0";
        return;
    }

    let total = 0;

    filtered.forEach(exp => {
        total += Number(exp.amount) || 0;

        let badgeClass = "badge-cash";
        if (exp.paymentMethod === "Bank") badgeClass = "badge-bank";
        if (exp.paymentMethod === "Online") badgeClass = "badge-online";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${exp.expenseId || '-'}</strong></td>
            <td>${exp.date || '-'}</td>
            <td>${exp.category || '-'}</td>
            <td>${exp.description || '-'}</td>
            <td>${exp.paidTo || '-'}</td>
            <td style="color:#e74c3c; font-weight:bold;">Rs. ${(Number(exp.amount) || 0).toLocaleString()}</td>
            <td><span class="badge ${badgeClass}">${exp.paymentMethod || '-'}</span></td>
            <td>${exp.receiptNote ? exp.receiptNote : '<span style="color:#bbb;">No receipt</span>'}</td>
            <td>
                <button class="btn-edit" data-id="${exp.id}">✏️ Edit</button>
                <button class="btn-delete" data-id="${exp.id}">🗑️ Delete</button>
            </td>
        `;
        expenseTableBody.appendChild(row);
    });

    expenseTotalBar.innerText = `Total (filtered): Rs. ${total.toLocaleString()}`;

    // Edit/Delete button listeners (dynamically attached)
    expenseTableBody.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => startEditExpense(btn.dataset.id));
    });
    expenseTableBody.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteExpense(btn.dataset.id));
    });
}

// Filters change hone par table re-render
[filterDate, filterCategory, filterPaymentMethod, filterMinAmount, filterMaxAmount].forEach(el => {
    el.addEventListener("input", renderExpenseTable);
    el.addEventListener("change", renderExpenseTable);
});

clearFiltersBtn.addEventListener("click", () => {
    filterDate.value = "";
    filterCategory.value = "";
    filterPaymentMethod.value = "";
    filterMinAmount.value = "";
    filterMaxAmount.value = "";
    renderExpenseTable();
});

// =====================================================
// SAVE EXPENSE (Add or Update)
// =====================================================
saveExpenseBtn.addEventListener("click", async () => {
    const category = expCategory.value;
    const amount = Number(expAmount.value);
    const date = expDate.value;
    const paymentMethod = expPaymentMethod.value;
    const paidTo = expPaidTo.value.trim();
    const description = expDescription.value.trim();
    const notes = expNotes.value.trim();

    if (!date) {
        alert("Date select karna zaroori hai.");
        return;
    }
    if (!amount || amount <= 0) {
        alert("Amount sahi se darj karein.");
        return;
    }

    saveExpenseBtn.disabled = true;
    saveExpenseBtn.innerText = "Saving...";

    try {
        if (editingExpenseId) {
            // -- UPDATE EXISTING EXPENSE --
            const expRef = doc(db, "expenses", editingExpenseId);
            await updateDoc(expRef, {
                date, category, amount, paymentMethod, paidTo, description, notes
            });
            alert("✅ Expense update ho gaya.");
        } else {
            // -- ADD NEW EXPENSE --
            const newExpenseId = generateNextExpenseId(allExpenses);
            await addDoc(collection(db, "expenses"), {
                expenseId: newExpenseId,
                date, category, amount, paymentMethod, paidTo, description, notes,
                receiptNote: "", // Receipt upload abhi disabled hai
                createdAt: serverTimestamp()
            });
            alert(`✅ Expense saved as ${newExpenseId}`);
        }

        resetForm();
        await loadExpenses();

    } catch (error) {
        console.error("Error saving expense:", error);
        alert("❌ Expense save karne mein error aaya.");
    } finally {
        saveExpenseBtn.disabled = false;
        saveExpenseBtn.innerText = "💾 Save Expense";
    }
});

// =====================================================
// EDIT EXPENSE
// =====================================================
function startEditExpense(id) {
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;

    editingExpenseId = id;
    editExpenseIdInput.value = id;

    expenseIdDisplay.value = exp.expenseId || "";
    expDate.value = exp.date || "";
    expCategory.value = exp.category || "Other";
    expAmount.value = exp.amount || 0;
    expPaymentMethod.value = exp.paymentMethod || "Cash";
    expPaidTo.value = exp.paidTo || "";
    expDescription.value = exp.description || "";
    expNotes.value = exp.notes || "";

    formTitle.innerText = `✏️ Editing Expense: ${exp.expenseId}`;
    saveExpenseBtn.innerText = "💾 Update Expense";
    cancelEditBtn.style.display = "inline-block";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

cancelEditBtn.addEventListener("click", resetForm);

function resetForm() {
    editingExpenseId = null;
    editExpenseIdInput.value = "";

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    expDate.value = `${y}-${m}-${d}`;

    expCategory.value = "Doctor Salary";
    expAmount.value = "";
    expPaymentMethod.value = "Cash";
    expPaidTo.value = "";
    expDescription.value = "";
    expNotes.value = "";

    expenseIdDisplay.value = generateNextExpenseId(allExpenses);

    formTitle.innerText = "➕ Add New Expense";
    saveExpenseBtn.innerText = "💾 Save Expense";
    cancelEditBtn.style.display = "none";
}

// =====================================================
// DELETE EXPENSE
// =====================================================
async function deleteExpense(id) {
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;

    const confirmDelete = confirm(`"${exp.expenseId}" (Rs. ${exp.amount}) ko delete karna hai? Yeh action wapas nahi ho sakta.`);
    if (!confirmDelete) return;

    try {
        await deleteDoc(doc(db, "expenses", id));
        alert("🗑️ Expense delete ho gaya.");

        if (editingExpenseId === id) resetForm();
        await loadExpenses();
    } catch (error) {
        console.error("Error deleting expense:", error);
        alert("❌ Delete karte waqt error aaya.");
    }
}