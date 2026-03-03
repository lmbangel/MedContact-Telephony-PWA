Got it — this is an **important architectural constraint**, and you’re right to bake it into the prompt now so the coding agent doesn’t accidentally entangle the phone UI and dashboard UI.

Below is an **updated, clean, concise version of the prompt**, with:

* Container architecture clearly explained
* Explicit separation of **Phone vs Dashboard** inside the same app
* Clear instruction that dashboard changes must not affect phone

This is **agent-ready**.

---

## **Agent Dashboard – Authentication UI Implementation**

### **Context & Architecture**

I have an existing system with the following setup:

* **API**

  * Runs in its **own container**
  * Fully functional and already used by the phone application
  * Should remain **unchanged**

* **Frontend App (`app/`)**

  * Runs in **one container**
  * Currently hosts the **phone application**, which is working correctly
  * I want the **Agent Dashboard** to run in this **same container**
  * The dashboard and phone should be **features of the same app**, not separate apps

👉 **Key requirement:**
Changes made to the **dashboard** must **not affect the phone application**.
The phone app should continue working exactly as it does now.

---

## **Project Structure Reference**

Relevant structure (simplified):

```
app/
├── src/
├── index.html
├── login.html
├── register.html
├── nginx.conf
├── Dockerfile
├── vite.config.js
```

The dashboard should live **inside `app/`** and be logically separated from the phone feature so future development does not cause regressions.

---

## **Scope (ONLY these 3 pages for now)**

1. **Login / Sign In**
2. **Register / Sign Up**
3. **Home / Dashboard Landing Page**

These pages are for the **Agent Dashboard only**, not the phone UI.

---

## **Login Page – Functional Requirements**

### **Authentication Methods**

* **Email + Password Login**

  * Already implemented in the API
  * Must be used by the dashboard

* **OTP Login**

  * OTP is sent via phone/email using the existing API

### **Future Providers (UI only)**

* Google Sign-In button
* Microsoft Sign-In button
* **No backend or auth logic required yet**

---

## **Login Form UI Requirements**

### **Default State**

**Inputs**

* Email
* Password

**Buttons**

* Sign In
* Use OTP
* Google (placeholder / disabled)
* Microsoft (placeholder / disabled)

---

### **OTP Mode**

* Triggered when **“Use OTP”** is clicked
* Input fields switch to:

  * Email
  * OTP
* Password field is hidden
* User enters OTP received via phone/email

---

## **Validation Requirements**

* Email and password are required for standard login
* Email is required for OTP login
* Display errors when:

  * Required fields are missing
  * User does not exist
  * Credentials or OTP are invalid

---

## **Design Reference**

Designs for **login and sign-up pages** can be found at:

```
.prompt/login/design
```

---

## **Important Constraints**

* Do **not** modify or break the phone application
* Dashboard must be **isolated logically** within the same app container
* API remains a **separate container**
* Focus on clean separation so future dashboard changes do not impact phone functionality

---

### ✅ Outcome Expected

A dashboard authentication flow that:

* Uses the existing API
* Lives in the same app container as the phone app
* Is safely isolated so the phone feature remains stable
