import { db, auth } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    } else {
        loadMedicines();
        loadSuggestions(); // Naya function jo auto-suggestions laayega
    }
});

const addMedicineForm = document.getElementById("addMedicineForm");
const medicinesList = document.getElementById("medicinesList");
const startScannerBtn = document.getElementById("startScannerBtn");
const readerDiv = document.getElementById("reader");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const submitBtn = document.getElementById("submitBtn");
const formTitle = document.getElementById("formTitle");
const medicineSearchInput = document.getElementById("medicineSearchInput"); // NAYA

let html5QrcodeScanner = null;
let allMedicinesData = []; // NAYA: local cache, search filter ke liye

if (startScannerBtn) {
    startScannerBtn.addEventListener("click", () => {
        if (!html5QrcodeScanner) {
            readerDiv.style.display = "block";
            startScannerBtn.innerText = "Starting Camera...";
            
            // Camera initialize kar rahe hain
            html5QrcodeScanner = new Html5Qrcode("reader");
            html5QrcodeScanner.start(
                { facingMode: "environment" }, // Back camera
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (decodedText) => {
                    // Jab barcode scan ho jaye
                    document.getElementById("medBarcode").value = decodedText;
                    
                    // Scanner band karo
                    html5QrcodeScanner.stop().then(() => {
                        readerDiv.style.display = "none";
                        html5QrcodeScanner = null;
                        startScannerBtn.innerText = "📷 Scan";
                    });
                },
                (errorMessage) => { 
                    // Background errors ko ignore karein
                }
            ).catch(err => {
                // Ignore error visual to user to comply with rules, update button instead
                startScannerBtn.innerText = "Camera Failed";
                setTimeout(() => { startScannerBtn.innerText = "📷 Scan"; }, 2000);
            });
        }
    });
}

async function loadSuggestions() {
    const medSuggestions = document.getElementById("medicineSuggestions");
    const supSuggestions = document.getElementById("supplierSuggestions");
    
    try {
        // 1. Load Medicine Names
        const medSnapshot = await getDocs(collection(db, "medicines"));
        const uniqueMeds = new Set();
        medSnapshot.forEach(doc => {
            if (doc.data().name) uniqueMeds.add(doc.data().name);
        });
        
        medSuggestions.innerHTML = "";
        uniqueMeds.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            medSuggestions.appendChild(option);
        });

        // 2. Load Supplier/Company Names
        const supSnapshot = await getDocs(collection(db, "suppliers"));
        const uniqueSups = new Set();
        supSnapshot.forEach(doc => {
            if (doc.data().name) uniqueSups.add(doc.data().name);
        });
        
        supSuggestions.innerHTML = "";
        uniqueSups.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            supSuggestions.appendChild(option);
        });
    } catch (error) {
        console.error("Suggestions load nahi huin:", error);
    }
}

async function loadMedicines() {
    if(!medicinesList) return;
    medicinesList.innerHTML = "<tr><td colspan='8'>Loading...</td></tr>";

    try {
        const querySnapshot = await getDocs(collection(db, "medicines"));
        allMedicinesData = []; // NAYA: cache reset

        querySnapshot.forEach((docSnapshot) => {
            allMedicinesData.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });

        renderMedicinesTable(allMedicinesData); // NAYA: render alag function se

    } catch (error) {
        console.error("Error loading medicines: ", error);
        medicinesList.innerHTML = "<tr><td colspan='8' style='color:red;'>Error loading data!</td></tr>";
    }
}

// =====================================================
// NAYA: Table render karne ka function (filtered ya full list ke liye)
// =====================================================
function renderMedicinesTable(medsArray) {
    medicinesList.innerHTML = "";

    if (medsArray.length === 0) {
        medicinesList.innerHTML = "<tr><td colspan='8' style='text-align:center;'>Koi medicine nahi mili.</td></tr>";
        return;
    }

    medsArray.forEach((med) => {
        const id = med.id;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${med.name}</strong> <br> <small>${med.barcode || 'N/A'}</small></td>
            <td>${med.company}</td>
            <td>${med.category}</td>
            <td style="color: ${med.stock < 10 ? 'red' : 'green'}; font-weight:bold;">${med.stock}</td>
            <td>Rs. ${med.purchasePrice}</td>
            <td>Rs. ${med.salePrice}</td>
            <td>${med.expiry}</td>
            <td class="action-cell">
                <button class="btn-edit" data-id="${id}">Edit</button>
                <button class="btn-delete" data-id="${id}">Delete</button>
            </td>
        `;
        medicinesList.appendChild(row);
    });

    attachActionButtons();
}

// =====================================================
// NAYA: Search/Filter logic (naam ya barcode se)
// =====================================================
if (medicineSearchInput) {
    medicineSearchInput.addEventListener("input", () => {
        const val = medicineSearchInput.value.toLowerCase().trim();

        if (!val) {
            renderMedicinesTable(allMedicinesData);
            return;
        }

        const filtered = allMedicinesData.filter(med => {
            const matchName = (med.name || "").toLowerCase().includes(val);
            const matchBarcode = (med.barcode || "").toLowerCase().includes(val);
            return matchName || matchBarcode;
        });

        renderMedicinesTable(filtered);
    });
}

function attachActionButtons() {
    // Delete Logic (Double click to confirm safely)
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            
            if (e.target.innerText === "Delete") {
                e.target.innerText = "Sure?";
                e.target.style.backgroundColor = "darkred";
                // Reset text after 3 seconds if not clicked again
                setTimeout(() => {
                    if (e.target) {
                        e.target.innerText = "Delete";
                        e.target.style.backgroundColor = "#e74c3c";
                    }
                }, 3000);
            } else if (e.target.innerText === "Sure?") {
                e.target.innerText = "Deleting...";
                try {
                    await deleteDoc(doc(db, "medicines", id));
                    loadMedicines();
                    loadSuggestions();
                } catch (error) {
                    console.error("Delete failed", error);
                    e.target.innerText = "Error";
                }
            }
        });
    });

    // Edit Logic (Populate form)
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            
            try {
                const medData = allMedicinesData.find(m => m.id === id); // NAYA: cache se lo, dobara fetch na karo

                if (medData) {
                    document.getElementById("editMedId").value = id;
                    document.getElementById("medBarcode").value = medData.barcode || "";
                    document.getElementById("medName").value = medData.name || "";
                    document.getElementById("medCompany").value = medData.company || "";
                    document.getElementById("medCategory").value = medData.category || "";
                    document.getElementById("medBatch").value = medData.batch || "";
                    document.getElementById("medExpiry").value = medData.expiry || "";
                    document.getElementById("medPurPrice").value = medData.purchasePrice || "";
                    document.getElementById("medSalePrice").value = medData.salePrice || "";
                    document.getElementById("medStock").value = medData.stock || "";

                    formTitle.innerText = "Edit Medicine";
                    submitBtn.innerText = "Update Medicine";
                    cancelEditBtn.style.display = "inline-block";
                    
                    window.scrollTo(0, 0); // Scroll to top smoothly
                }
            } catch (error) {
                console.error("Error fetching for edit: ", error);
            }
        });
    });
}

// Cancel Edit Button
cancelEditBtn.addEventListener("click", () => {
    addMedicineForm.reset();
    document.getElementById("editMedId").value = "";
    formTitle.innerText = "Add New Medicine";
    submitBtn.innerText = "Save Medicine";
    cancelEditBtn.style.display = "none";
});

// Save / Update Logic
addMedicineForm.addEventListener("submit", async (e) => {
    e.preventDefault(); 
    submitBtn.innerText = "Processing...";
    submitBtn.disabled = true;

    const medData = {
        barcode: document.getElementById("medBarcode").value,
        name: document.getElementById("medName").value,
        company: document.getElementById("medCompany").value,
        category: document.getElementById("medCategory").value,
        batch: document.getElementById("medBatch").value,
        expiry: document.getElementById("medExpiry").value,
        purchasePrice: Number(document.getElementById("medPurPrice").value),
        salePrice: Number(document.getElementById("medSalePrice").value),
        stock: Number(document.getElementById("medStock").value)
    };

    const editId = document.getElementById("editMedId").value;

    try {
        if (editId) {
            // Update mode
            await updateDoc(doc(db, "medicines", editId), medData);
            submitBtn.innerText = "Updated!";
        } else {
            // Add mode
            medData.createdAt = serverTimestamp();
            await addDoc(collection(db, "medicines"), medData);
            submitBtn.innerText = "Saved!";
        }

        // Reset form and UI
        setTimeout(() => {
            addMedicineForm.reset(); 
            document.getElementById("editMedId").value = "";
            formTitle.innerText = "Add New Medicine";
            submitBtn.innerText = "Save Medicine";
            submitBtn.disabled = false;
            cancelEditBtn.style.display = "none";
            
            loadMedicines(); 
            loadSuggestions(); 
        }, 1500);
        
    } catch (error) {
        console.error("Error adding/updating medicine: ", error);
        submitBtn.innerText = "Error!";
        setTimeout(() => { 
            submitBtn.innerText = editId ? "Update Medicine" : "Save Medicine";
            submitBtn.disabled = false;
        }, 2000);
    } 
});