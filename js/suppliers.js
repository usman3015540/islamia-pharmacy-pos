// js/suppliers.js
import { db, auth } from "./firebase-config.js";
import { collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Auth Guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    } else {
        loadSuppliers(); // Login hai to list load karo
    }
});

// HTML elements
const addSupplierForm = document.getElementById("addSupplierForm");
const suppliersList = document.getElementById("suppliersList");

// 2. Add Supplier Logic
addSupplierForm.addEventListener("submit", async (e) => {
    e.preventDefault(); 
    const submitBtn = addSupplierForm.querySelector("button");
    submitBtn.innerText = "Saving...";
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "suppliers"), {
            name: document.getElementById("supName").value,
            contactPerson: document.getElementById("supPerson").value,
            phone: document.getElementById("supPhone").value,
            email: document.getElementById("supEmail").value,
            address: document.getElementById("supAddress").value,
            createdAt: serverTimestamp()
        });

        alert("Supplier added successfully!");
        addSupplierForm.reset(); 
        loadSuppliers(); 

    } catch (error) {
        console.error("Error adding supplier: ", error);
        alert("Error saving supplier!");
    } finally {
        submitBtn.innerText = "Save Supplier";
        submitBtn.disabled = false;
    }
});

// 3. Load Suppliers Logic
async function loadSuppliers() {
    if(!suppliersList) return;
    suppliersList.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

    try {
        const querySnapshot = await getDocs(collection(db, "suppliers"));
        suppliersList.innerHTML = ""; 

        querySnapshot.forEach((doc) => {
            const sup = doc.data();
            
            const row = `
                <tr>
                    <td><strong>${sup.name}</strong></td>
                    <td>${sup.contactPerson || '-'}</td>
                    <td>${sup.phone}</td>
                    <td>${sup.email || '-'}</td>
                    <td>${sup.address}</td>
                </tr>
            `;
            suppliersList.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading suppliers: ", error);
        suppliersList.innerHTML = "<tr><td colspan='5' style='color:red;'>Error loading data!</td></tr>";
    }
}