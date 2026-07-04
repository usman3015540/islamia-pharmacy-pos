import { db, auth } from "./firebase-config.js";
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, increment, serverTimestamp, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let purchaseCart = [];
let grandTotal = 0;
let editPurchaseId = null; // Edit mode track karne ke liye
let allMedicinesCache = []; // NAYA: live "already exists" check ke liye local cache

// Auth Guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    } else {
        generateSystemInvoice();
        loadSuppliersDatalist();
        loadMedicinesCache(); // NAYA
        loadPurchaseHistory();
    }
});

// Custom Notification Function
function showMessage(msg, isError = false) {
    const div = document.createElement("div");
    div.innerText = msg;
    div.style.position = "fixed";
    div.style.bottom = "20px";
    div.style.right = "20px";
    div.style.padding = "15px 25px";
    div.style.backgroundColor = isError ? "#e74c3c" : "#27ae60";
    div.style.color = "white";
    div.style.borderRadius = "5px";
    div.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
    div.style.zIndex = "9999";
    div.style.fontWeight = "bold";
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function generateSystemInvoice() {
    const invInput = document.getElementById("purSysInvoice");
    if(invInput) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        invInput.value = "PUR-" + randomNum;
    }
    const dateInput = document.getElementById("purDate");
    if(dateInput) dateInput.valueAsDate = new Date();
}

async function loadSuppliersDatalist() {
    const supplierList = document.getElementById("supplierList");
    if(!supplierList) return;
    try {
        const querySnapshot = await getDocs(collection(db, "suppliers"));
        supplierList.innerHTML = "";
        querySnapshot.forEach(doc => {
            const option = document.createElement("option");
            option.value = doc.data().name;
            supplierList.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading suppliers", error);
    }
}

// =====================================================
// NAYA: Medicines cache load karo (local "exists?" check ke liye)
// =====================================================
async function loadMedicinesCache() {
    try {
        const querySnapshot = await getDocs(collection(db, "medicines"));
        allMedicinesCache = [];
        querySnapshot.forEach(docSnap => {
            allMedicinesCache.push({ id: docSnap.id, ...docSnap.data() });
        });
    } catch (error) {
        console.error("Error loading medicines cache:", error);
    }
}

// =====================================================
// NAYA: Jaise hi medicine name ya barcode type karein, check karo exists karti hai ya nahi
// =====================================================
const medNameInput = document.getElementById("medName");
const medBarcodeInput = document.getElementById("medBarcode");
const medExistsIndicator = document.getElementById("medExistsIndicator");

function checkIfMedicineExists() {
    const name = medNameInput.value.trim().toLowerCase();
    const barcode = medBarcodeInput.value.trim();

    if (!name && !barcode) {
        medExistsIndicator.style.display = "none";
        return;
    }

    let found = null;
    if (barcode) {
        found = allMedicinesCache.find(m => (m.barcode || "") == barcode);
    }
    if (!found && name) {
        found = allMedicinesCache.find(m => (m.name || "").toLowerCase() === name);
    }

    if (found) {
        medExistsIndicator.style.display = "block";
        medExistsIndicator.style.color = "#e67e22";
        medExistsIndicator.innerHTML = `⚠️ Yeh medicine pehle se maujood hai (Current Stock: <strong>${found.stock}</strong>, Sale Price: Rs. ${found.salePrice}). Save karne par sirf <strong>stock update</strong> hoga.`;

        // Existing medicine ki company/category auto-fill kar do agar khali hain
        const medCompanyInput = document.getElementById("purCompany");
        if (medCompanyInput && !medCompanyInput.value && found.company) {
            medCompanyInput.value = found.company;
        }
    } else {
        medExistsIndicator.style.display = "block";
        medExistsIndicator.style.color = "#27ae60";
        medExistsIndicator.innerHTML = `✅ Yeh nayi medicine hai. Save karne par <strong>nayi entry</strong> banegi.`;
    }
}

if (medNameInput) medNameInput.addEventListener("input", checkIfMedicineExists);
if (medBarcodeInput) medBarcodeInput.addEventListener("input", checkIfMedicineExists);

document.getElementById("addMedToCartBtn").addEventListener("click", () => {
    const name = document.getElementById("medName").value.trim();
    const batch = document.getElementById("medBatch").value.trim();
    const expiry = document.getElementById("medExpiry").value;
    const purPrice = Number(document.getElementById("medPurPrice").value);
    const salePrice = Number(document.getElementById("medSalePrice").value);
    const qty = Number(document.getElementById("medQty").value);
    const barcode = document.getElementById("medBarcode").value.trim();
    const mfgDate = document.getElementById("medMfgDate").value;

    if (!name || !batch || !expiry || purPrice <= 0 || salePrice <= 0 || qty <= 0) {
        showMessage("Please fill all required medicine fields properly!", true);
        return;
    }

    const subtotal = purPrice * qty;

    purchaseCart.push({
        barcode, name, batch, mfgDate, expiry, purPrice, salePrice, qty, subtotal
    });

    updateCartUI();
    clearMedInputs();
});

function clearMedInputs() {
    document.getElementById("medBarcode").value = "";
    document.getElementById("medName").value = "";
    document.getElementById("medBatch").value = "";
    document.getElementById("medMfgDate").value = "";
    document.getElementById("medExpiry").value = "";
    document.getElementById("medPurPrice").value = "";
    document.getElementById("medSalePrice").value = "";
    document.getElementById("medQty").value = "1";
    if (medExistsIndicator) medExistsIndicator.style.display = "none"; // NAYA
}

function updateCartUI() {
    const tbody = document.getElementById("purchaseCartBody");
    tbody.innerHTML = "";
    grandTotal = 0;

    purchaseCart.forEach((item, index) => {
        grandTotal += item.subtotal;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.name} <br><small>${item.barcode || 'No Code'}</small></td>
            <td>B: ${item.batch} <br>E: ${item.expiry}</td>
            <td>Rs. ${item.purPrice}</td>
            <td>Rs. ${item.salePrice}</td>
            <td>${item.qty}</td>
            <td style="font-weight:bold;">Rs. ${item.subtotal}</td>
            <td><button class="btn-sm btn-danger" onclick="removeFromCart(${index})">X</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("grandTotalSpan").innerText = grandTotal;
}

window.removeFromCart = (index) => {
    purchaseCart.splice(index, 1);
    updateCartUI();
};

async function findMedicineRef(item) {
    if (item.barcode) {
        const qCode = query(collection(db, "medicines"), where("barcode", "==", item.barcode));
        const snapCode = await getDocs(qCode);
        if (!snapCode.empty) return doc(db, "medicines", snapCode.docs[0].id);
    }
    const qName = query(collection(db, "medicines"), where("name", "==", item.name));
    const snapName = await getDocs(qName);
    if (!snapName.empty) return doc(db, "medicines", snapName.docs[0].id);
    return null;
}

document.getElementById("saveCompletePurchaseBtn").addEventListener("click", async () => {
    const sysInvoice = document.getElementById("purSysInvoice").value;
    const purDate = document.getElementById("purDate").value;
    const supplier = document.getElementById("purSupplier").value;
    const company = document.getElementById("purCompany").value;
    const supInvoice = document.getElementById("purSupInvoice").value;
    const notes = document.getElementById("purNotes").value;
    
    const btn = document.getElementById("saveCompletePurchaseBtn");

    if (!supplier || purchaseCart.length === 0) {
        showMessage("Please enter Supplier and add at least 1 medicine!", true);
        return;
    }

    btn.disabled = true;
    btn.innerText = "Saving... Please wait";

    try {
        if (editPurchaseId) {
            // ==== EDIT MODE ====
            const oldPurDoc = await getDoc(doc(db, "purchases", editPurchaseId));
            if (oldPurDoc.exists()) {
                const oldItems = oldPurDoc.data().items || [];
                for(let item of oldItems) {
                    let medRef = await findMedicineRef(item);
                    if(medRef) await updateDoc(medRef, { stock: increment(-item.qty) }); 
                }
            }

            for (let item of purchaseCart) {
                let medRef = await findMedicineRef(item);
                if (medRef) {
                    await updateDoc(medRef, {
                        stock: increment(item.qty), purchasePrice: item.purPrice, salePrice: item.salePrice,
                        batch: item.batch, expiry: item.expiry, mfgDate: item.mfgDate, company: company
                    });
                } else {
                    await addDoc(collection(db, "medicines"), {
                        barcode: item.barcode, name: item.name, company: company, category: "General",
                        batch: item.batch, mfgDate: item.mfgDate, expiry: item.expiry,
                        purchasePrice: item.purPrice, salePrice: item.salePrice, stock: item.qty, createdAt: serverTimestamp()
                    });
                }
            }

            const updateData = {
                systemInvoice: sysInvoice, date: purDate, supplier: supplier, company: company,
                supplierInvoice: supInvoice, notes: notes,
                totalAmount: grandTotal, items: purchaseCart
            };

            await updateDoc(doc(db, "purchases", editPurchaseId), updateData);
            showMessage("Purchase Updated & Stock Adjusted!");
            editPurchaseId = null; 

        } else {
            // ==== ADD MODE ====
            await addDoc(collection(db, "purchases"), {
                systemInvoice: sysInvoice, date: purDate, supplier: supplier, company: company,
                supplierInvoice: supInvoice, notes: notes, totalAmount: grandTotal,
                items: purchaseCart, createdAt: serverTimestamp()
            });

            for (let item of purchaseCart) {
                let medRef = await findMedicineRef(item);
                if (medRef) {
                    await updateDoc(medRef, {
                        stock: increment(item.qty), purchasePrice: item.purPrice, salePrice: item.salePrice,
                        batch: item.batch, expiry: item.expiry, mfgDate: item.mfgDate, company: company
                    });
                } else {
                    await addDoc(collection(db, "medicines"), {
                        barcode: item.barcode, name: item.name, company: company, category: "General",
                        batch: item.batch, mfgDate: item.mfgDate, expiry: item.expiry,
                        purchasePrice: item.purPrice, salePrice: item.salePrice, stock: item.qty, createdAt: serverTimestamp()
                    });
                }
            }
            showMessage("Purchase Saved & Stock Updated!");
        }
        
        // Reset everything
        purchaseCart = [];
        updateCartUI();
        generateSystemInvoice();
        document.getElementById("purSupplier").value = "";
        document.getElementById("purCompany").value = "";
        document.getElementById("purSupInvoice").value = "";
        document.getElementById("purNotes").value = "";
        
        loadPurchaseHistory();
        loadMedicinesCache(); // NAYA: cache refresh karo taake naye stock levels reflect ho

    } catch (error) {
        console.error("Purchase Error:", error);
        showMessage("Error saving purchase! Check console.", true);
    } finally {
        btn.disabled = false;
        btn.innerText = "💾 Save Purchase & Update Stock";
    }
});

// NAYA: Cart items se readable medicines string banana (Purchase History column ke liye)
function formatPurchaseItemsList(items) {
    if (!items || items.length === 0) return "-";
    return items.map(it => `${it.name} x${it.qty}`).join(", ");
}

async function loadPurchaseHistory() {
    const tbody = document.getElementById("purchaseHistoryBody");
    if(!tbody) return;
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Loading History...</td></tr>";

    try {
        const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const pur = docSnap.data();

            const tr = document.createElement("tr");
            
            const dateStr = pur.date || "-";
            const sysInvStr = pur.systemInvoice || "-";
            const supplierStr = pur.supplier || "-";
            const compStr = pur.company || "-";
            const amtStr = pur.totalAmount || 0;
            const medsStr = formatPurchaseItemsList(pur.items); // NAYA

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${sysInvStr}</strong></td>
                <td>${supplierStr} <br><small>${compStr}</small></td>
                <td>${medsStr}</td>
                <td style="color:#27ae60; font-weight:bold;">Rs. ${amtStr}</td>
                <td>
                    <button class="btn-sm btn-edit" style="margin-bottom:5px;" onclick="editPurchase('${docSnap.id}')">Edit</button>
                    <button class="btn-sm btn-danger" onclick="deletePurchase(this, '${docSnap.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading history:", error);
        tbody.innerHTML = "<tr><td colspan='6' style='color:red;'>Error loading data!</td></tr>";
    }
}

window.editPurchase = async (id) => {
    try {
        const purDoc = await getDoc(doc(db, "purchases", id));
        if(purDoc.exists()) {
            const purData = purDoc.data();
            editPurchaseId = id; 

            document.getElementById("purSysInvoice").value = purData.systemInvoice || "";
            document.getElementById("purDate").value = purData.date || "";
            document.getElementById("purSupplier").value = purData.supplier || "";
            document.getElementById("purCompany").value = purData.company || "";
            document.getElementById("purSupInvoice").value = purData.supplierInvoice || "";
            document.getElementById("purNotes").value = purData.notes || "";

            purchaseCart = purData.items || [];
            updateCartUI();

            document.getElementById("saveCompletePurchaseBtn").innerText = "🔄 Update Purchase & Stock";
            window.scrollTo(0, 0);
            showMessage("Bill loaded for Editing!");
        }
    } catch(error) {
        console.error("Error loading for edit", error);
    }
};

window.deletePurchase = async (btn, id) => {
    if (btn.innerText === "Delete") {
        btn.innerText = "Sure?";
        btn.style.backgroundColor = "darkred";
        setTimeout(() => { 
            if (btn) { btn.innerText = "Delete"; btn.style.backgroundColor = "#e74c3c"; } 
        }, 3000);
        return;
    }

    btn.innerText = "Deleting...";
    try {
        const purDoc = await getDoc(doc(db, "purchases", id));
        if(purDoc.exists()) {
            const purData = purDoc.data();
            
            if(purData.items && purData.items.length > 0) {
                for(let item of purData.items) {
                    let medRef = await findMedicineRef(item);
                    if(medRef) {
                        await updateDoc(medRef, { stock: increment(-item.qty) });
                    }
                }
            }
            await deleteDoc(doc(db, "purchases", id));
            showMessage("Purchase Deleted & Stock Reverted Successfully!");
            loadPurchaseHistory();
            loadMedicinesCache(); // NAYA
        }
    } catch(error) {
        console.error("Delete Error:", error);
        showMessage("Error deleting purchase!", true);
    }
};