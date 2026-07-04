import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("error-msg");

loginBtn.addEventListener("click", async () => {
    // Debugging ke liye check karna
    console.log("Attempting login with:", emailInput.value);
    
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        alert("Login Successful!");
        // Kyunki login.html root mein hai aur dashboard.html bhi root mein, 
        // toh seedha dashboard.html use karein.
        window.location.href = "dashboard.html"; 
    } catch (error) {
        console.error("Firebase Login Error:", error);
        // Error handling: invalid-credential ka matlab password ya email ghalat hai
        if (error.code === 'auth/invalid-credential') {
            errorMsg.innerText = "Invalid Email or Password!";
        } else {
            errorMsg.innerText = "Login Failed: " + error.message;
        }
    }
});