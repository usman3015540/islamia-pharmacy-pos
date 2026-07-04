import { db, auth } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Auth Guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    } else {
        loadMedicinesList(); // Dawaiyan load karo search ke liye
        loadSalesLedger(); // Aaj ka ledger load karo
    }
});

// -- Variables --
let cart = [];
let cartTotal = 0;
let grandTotal = 0;
let selectedMedId = null;
let allMedicines = []; 
let html5QrcodeScanner = null;

// -- HTML Elements (Id mapping) --
const readerDiv = document.getElementById("reader");
const startScannerBtn = document.getElementById("startScannerBtn");
const searchInput = document.getElementById("searchInput");
const searchSuggestions = document.getElementById("searchSuggestions");
const barcodeInput = document.getElementById("barcodeInput");
const selectedMedName = document.getElementById("selectedMedName");
const priceInput = document.getElementById("priceInput");
const stockInput = document.getElementById("stockInput");
const qtyInput = document.getElementById("qtyInput");
const addMedicineBtn = document.getElementById("addMedicineBtn");
const billTableBody = document.getElementById("billTableBody");
const medicineTotalSpan = document.getElementById("medicineTotal");
const grandTotalSpan = document.getElementById("grandTotalSpan");
const docFeeInput = document.getElementById("docFee");
const discountInput = document.getElementById("discount");
const patientNameInput = document.getElementById("patientName");
const doctorSelect = document.getElementById("doctorSelect");
const completeBillBtn = document.getElementById("completeBillBtn");
const salesLedgerBody = document.getElementById("salesLedgerBody");

// Aaj ki date string banane ka function (Ledger ke liye)
const getTodayDateString = () => {
    // Local time zone ke mutabiq aaj ki date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
};

// 2. Camera Scanner Logic
if (startScannerBtn) {
    startScannerBtn.addEventListener("click", () => {
        if (!html5QrcodeScanner) {
            readerDiv.style.display = "block";
            startScannerBtn.innerText = "Starting Camera...";
            
            html5QrcodeScanner = new Html5Qrcode("reader");
            html5QrcodeScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (decodedText) => {
                    barcodeInput.value = decodedText;
                    html5QrcodeScanner.stop().then(() => {
                        readerDiv.style.display = "none";
                        html5QrcodeScanner = null;
                        startScannerBtn.innerText = "📷 Start Camera Scan";
                        fetchMedicineByBarcode(decodedText); // Scan hote hi fetch karo
                    });
                },
                (errorMessage) => { /* ignore frame errors */ }
            ).catch(err => {
                startScannerBtn.innerText = "Camera Failed";
                setTimeout(() => { startScannerBtn.innerText = "📷 Start Camera Scan"; }, 2000);
            });
        }
    });
}

// 3. Load Medicines for Auto-suggestions
async function loadMedicinesList() {
    try {
        const querySnapshot = await getDocs(collection(db, "medicines"));
        allMedicines = [];
        querySnapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id;
            allMedicines.push(data);
        });
    } catch (error) {
        console.error("Error loading medicines list:", error);
    }
}

// 4. Live Search & Dropdown Logic
searchInput.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    searchSuggestions.innerHTML = "";
    
    // Agar input khali hai to list chhupa do
    if (val.length < 1) {
        searchSuggestions.style.display = "none";
        return;
    }

    // Dawai ka naam YA Barcode dono mein se koi bhi match ho jaye
    const filtered = allMedicines.filter(med => {
        const matchName = med.name.toLowerCase().includes(val);
        const matchBarcode = (med.barcode || "").toLowerCase().includes(val);
        return matchName || matchBarcode;
    });
    
    if (filtered.length > 0) {
        searchSuggestions.style.display = "block";
        filtered.forEach(med => {
            const div = document.createElement("div");
            // List mein Dawai ka naam aur Code dono show honge
            div.innerText = `${med.name} (Code: ${med.barcode || 'N/A'}) - Rs.${med.salePrice} (Stock: ${med.stock})`;
            div.addEventListener("click", () => {
                autoFillMedicine(med);
                searchSuggestions.style.display = "none";
            });
            searchSuggestions.appendChild(div);
        });
    } else {
        searchSuggestions.style.display = "none";
    }
});

// Jab click outside ho toh suggestions chup jayein
document.addEventListener('click', (e) => {
    if(e.target !== searchInput) {
        searchSuggestions.style.display = "none";
    }
});

function autoFillMedicine(med) {
    selectedMedId = med.id;
    selectedMedName.value = med.name;
    
    // Yahan search box mein dawai ka naam nazar aayega
    searchInput.value = med.name; 
    
    stockInput.value = med.stock;
    priceInput.value = med.salePrice;
    qtyInput.value = 1;
    barcodeInput.value = med.barcode || ""; 
}

// NAYA FEATURE: Barcode manually likhne par dawa khud dhoondna
barcodeInput.addEventListener("input", (e) => {
    let code = e.target.value.trim();
    if(code.length > 0){
        // Dawai dhoondho jiska barcode match ho (== use kiya hai taake number/string ka farq na pare)
        let med = allMedicines.find(m => m.barcode == code);
        if(med){
            autoFillMedicine(med);
        } else {
            // Agar barcode galat hai to baqi cheezein khali kar do
            clearMedicineInputsOnly();
        }
    } else {
        clearMedicineInputsOnly();
    }
});

function fetchMedicineByBarcode(code) {
    const med = allMedicines.find(m => m.barcode == code);
    if (med) {
        autoFillMedicine(med);
    } else {
        alert("Medicine not found with this barcode!");
        clearMedicineInputs();
    }
}

function clearMedicineInputsOnly() {
    selectedMedId = null;
    selectedMedName.value = "";
    searchInput.value = ""; 
    priceInput.value = "";
    stockInput.value = "";
    qtyInput.value = "1";
}

function clearMedicineInputs() {
    barcodeInput.value = "";
    clearMedicineInputsOnly();
}

// 5. Add to Cart Logic
addMedicineBtn.addEventListener("click", () => {
    const qty = Number(qtyInput.value);
    const stock = Number(stockInput.value);
    
    if (!selectedMedId) {
        alert("Please search and select a medicine first!");
        return;
    }
    if (qty <= 0) {
        alert("Quantity must be at least 1.");
        return;
    }
    if (qty > stock) {
        alert(`Not enough stock! Only ${stock} left.`);
        return;
    }

    const price = Number(priceInput.value);
    const subtotal = price * qty;

    cart.push({
        id: selectedMedId,
        name: selectedMedName.value,
        price: price,
        qty: qty,
        subtotal: subtotal
    });

    updateCartUI();
    clearMedicineInputs();
});

function updateCartUI() {
    billTableBody.innerHTML = "";
    cartTotal = 0;

    cart.forEach((item, index) => {
        cartTotal += item.subtotal;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>Rs. ${item.price}</td>
            <td>${item.qty}</td>
            <td>Rs. ${item.subtotal}</td>
            <td><button onclick="removeItem(${index})" style="background:#e74c3c;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:3px;">X</button></td>
        `;
        billTableBody.appendChild(tr);
    });

    medicineTotalSpan.innerText = cartTotal;
    calculateGrandTotal();
}

window.removeItem = (index) => {
    cart.splice(index, 1);
    updateCartUI();
};

// 6. Calculate Grand Total
function calculateGrandTotal() {
    const docFee = Number(docFeeInput.value) || 0;
    const discount = Number(discountInput.value) || 0;
    
    grandTotal = (cartTotal + docFee) - discount;
    if (grandTotal < 0) grandTotal = 0;
    
    grandTotalSpan.innerText = grandTotal;
}

docFeeInput.addEventListener("input", calculateGrandTotal);
discountInput.addEventListener("input", calculateGrandTotal);

// 7. Complete Sale & Save Logic
completeBillBtn.addEventListener("click", async () => {
    const patientName = patientNameInput.value || "Walk-in";
    const doctorName = doctorSelect.value;
    const docFee = Number(docFeeInput.value) || 0;
    const discount = Number(discountInput.value) || 0;

    if (cart.length === 0 && docFee === 0) {
        alert("Bill is empty! Add medicine or doctor fee.");
        return;
    }

    completeBillBtn.disabled = true;
    completeBillBtn.innerText = "Saving & Printing...";

    try {
        const todayStr = getTodayDateString();

        // 1. Save to Database
        await addDoc(collection(db, "sales"), {
            date: todayStr, 
            patientName: patientName,
            doctorName: doctorName,
            doctorFee: docFee,
            medicineTotal: cartTotal,
            discount: discount,
            grandTotal: grandTotal,
            items: cart,
            createdAt: serverTimestamp() // Database mein server ka time hi jayega protection ke liye
        });

        // 2. Reduce Stock in Database
        for (let item of cart) {
            const medRef = doc(db, "medicines", item.id);
            await updateDoc(medRef, {
                stock: increment(-item.qty)
            });
        }

        // 3. Print Thermal Invoice
        printInvoice(patientName, doctorName, docFee, discount);

        // 4. Reset Form
        cart = [];
        patientNameInput.value = "";
        docFeeInput.value = "0";
        discountInput.value = "0";
        doctorSelect.value = "Only Medicine";
        updateCartUI();
        
        loadSalesLedger(); // Naya bill ledger mein lao
        loadMedicinesList(); // Stock update ho gaya, fetch again

    } catch (error) {
        console.error("Sale Error: ", error);
        alert("Error saving sale.");
    } finally {
        completeBillBtn.disabled = false;
        completeBillBtn.innerText = "💾 Complete, Print & Save";
    }
});

// 8. Thermal Print Logic
function printInvoice(patientName, doctorName, docFee, discount) {
    // Print Area mein values dalo aur Local Time set karo
    let localTime = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    let localDate = getTodayDateString();
    
    document.getElementById("printDate").innerText = `${localDate} | ${localTime}`;
    document.getElementById("printPatient").innerText = patientName;
    document.getElementById("printDoctor").innerText = doctorName;
    
    const printItems = document.getElementById("printItems");
    printItems.innerHTML = "";
    
    cart.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="text-align:left;">${item.name}</td>
            <td style="text-align:center;">${item.qty}</td>
            <td style="text-align:right;">${item.subtotal}</td>
        `;
        printItems.appendChild(tr);
    });

    document.getElementById("printDocFee").innerText = docFee;
    document.getElementById("printMedTotal").innerText = cartTotal;
    document.getElementById("printDiscount").innerText = discount;
    document.getElementById("printGrandTotal").innerText = grandTotal;

    // Print command bhejo 
    window.print(); 
}

// NAYA HELPER: Cart items se medicines ka readable string banana
// e.g. "Panadol x2, Brufen x1"
function formatItemsList(items) {
    if (!items || items.length === 0) return "-";
    return items.map(it => `${it.name} x${it.qty}`).join(", ");
}

// 9. Load ONLY Today's Sales Ledger
async function loadSalesLedger() {
    salesLedgerBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Loading today's ledger...</td></tr>";

    try {
        const todayStr = getTodayDateString();
        const querySnapshot = await getDocs(collection(db, "sales"));
        salesLedgerBody.innerHTML = ""; 

        let todaySalesCount = 0;

        querySnapshot.forEach((doc) => {
            const sale = doc.data();
            
            // Sirf aaj ki date match karo
            if (sale.date === todayStr) {
                todaySalesCount++;
                
                // NAYA FEATURE: Local Computer ka time strict 12-hour AM/PM format mein
                let timeStr = "";
                if(sale.createdAt){
                    timeStr = sale.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                }

                // NAYA FEATURE: Medicines ki list bhi dikhao
                const medsStr = formatItemsList(sale.items);

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${timeStr || sale.date}</td>
                    <td><strong>${sale.patientName || 'Walk-in'}</strong></td>
                    <td>${sale.doctorName || '-'}</td>
                    <td>${medsStr}</td>
                    <td>Rs. ${sale.medicineTotal || 0}</td>
                    <td style="color:red;">Rs. ${sale.discount || 0}</td>
                    <td style="color:green; font-weight:bold;">Rs. ${sale.grandTotal || 0}</td>
                `;
                salesLedgerBody.appendChild(row);
            }
        });

        if (todaySalesCount === 0) {
            salesLedgerBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No sales today yet.</td></tr>";
        }

    } catch (error) {
        console.error("Error loading ledger: ", error);
        salesLedgerBody.innerHTML = "<tr><td colspan='7' style='color:red;'>Error loading data!</td></tr>";
    }
}