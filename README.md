# VÉRITÉ — Premium Fashion E-Commerce Website

VÉRITÉ is a modern, premium fashion e-commerce website designed with a clean and elegant user interface. The project provides a complete shopping experience, from browsing products to checkout and order management.

## ✨ Features

* 🛍️ Premium fashion storefront
* 👕 Multiple product categories
* 🖼️ Realistic fashion product images
* 🔍 Product search
* ❤️ Wishlist functionality
* 🛒 Shopping cart with quantity management
* 📦 Product details with sizes and colors
* 💳 Demo payment gateway
* ✅ Order confirmation
* 🧾 Automatic Order ID and Payment ID generation
* 🖥️ Host/Admin order dashboard
* 📊 Order details and payment information
* 📱 Fully responsive design
* ✨ Smooth animations and modern UI
* 💾 Local browser storage for cart, wishlist, and demo orders

## 🛠️ Technologies Used

* HTML5
* CSS3
* JavaScript
* Responsive Web Design
* LocalStorage
* Unsplash Images

## 📂 Project Structure

```text
verite-fashion-ecommerce/
│
├── index.html
└── README.md
```

The project is implemented as a standalone HTML application and does not require React, Babel, Tailwind CSS, or any build tools.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/verite-fashion-ecommerce.git
```

### 2. Open the project

Navigate to the project folder:

```bash
cd verite-fashion-ecommerce
```

Then open `index.html` directly in your browser.

No installation or build process is required.

## 🛒 Customer Flow

```text
Home
  ↓
Browse Products
  ↓
Select Product
  ↓
Add to Cart
  ↓
Checkout
  ↓
Payment Gateway
  ↓
Payment Confirmation
  ↓
Order Confirmation
```

## 🖥️ Host Order Management

After a demo payment is completed, the order is saved locally in the browser.

The host can access:

```text
Host → Orders
```

The dashboard displays:

* Order ID
* Customer name
* Email
* Phone number
* Delivery address
* Products ordered
* Quantity
* Size
* Color
* Total amount
* Payment method
* Payment ID
* Payment status
* Order date

## 💳 Payment Gateway

The current project includes a **demo payment gateway** designed for client presentations and demonstrations.

It supports simulated:

* UPI
* Credit/Debit Card
* Net Banking

> ⚠️ The current payment gateway does not process real money.

For production deployment, the demo gateway should be replaced with a secure payment integration such as Razorpay, along with a backend server, database, payment verification, and webhooks.

## 💾 Data Storage

The demo version uses the browser's `localStorage` to store:

* Cart items
* Wishlist items
* Customer orders
* Payment information

Because localStorage is browser-specific, orders are currently visible only on the same browser/device.

## 🔮 Future Improvements

* Real Razorpay payment integration
* Secure backend API
* MySQL / PostgreSQL / MongoDB database
* Real-time host/admin dashboard
* User authentication
* Customer accounts
* Order tracking
* Inventory management
* Product management
* Coupon and discount system
* Email/SMS order notifications
* Cloud image storage
* Production deployment

## 📸 Screenshots

Add your project screenshots here:

```text
screenshots/
├── home.png
├── products.png
├── product-details.png
├── cart.png
├── checkout.png
├── payment.png
└── admin-orders.png
```

Example:

```markdown
![Home Page](screenshots/home.png)
```

## 🌐 Live Demo

Add your deployed website URL here:

```text
https://your-verite-demo-url.com
```

## 👨‍💻 Author

**Sudheer Kumar**

B.Tech — Computer Science & Engineering (AI & ML)

---

⭐ If you like this project, consider giving it a star on GitHub!
