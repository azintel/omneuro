// ////apps/homepage/public/store/app.js
const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));

// State
const state = {
  products: [],
  cart: [], // [{id, qty}]
};

function currency(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function findProduct(id) {
  return state.products.find(p => p.id === id);
}

function cartCount() {
  return state.cart.reduce((n, it) => n + it.qty, 0);
}

function cartTotalCents() {
  return state.cart.reduce((sum, it) => {
    const p = findProduct(it.id);
    return sum + (p ? p.price * it.qty : 0);
  }, 0);
}

function saveCart() {
  localStorage.setItem("JJ_CART", JSON.stringify(state.cart));
}
function loadCart() {
  try {
    const raw = localStorage.getItem("JJ_CART");
    state.cart = raw ? JSON.parse(raw) : [];
  } catch { state.cart = []; }
}

function renderProducts() {
  const wrap = el("#products");
  wrap.innerHTML = "";
  state.products.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="desc">${p.description}</p>
        <div class="row">
          <span class="price">${currency(p.price)}</span>
          <div class="qty">
            <button class="minus">−</button>
            <input type="number" min="1" value="1" />
            <button class="plus">+</button>
          </div>
        </div>
        <button class="add">Add to Cart</button>
      </div>
    `;
    const input = card.querySelector("input");
    card.querySelector(".minus").addEventListener("click", () => {
      input.value = Math.max(1, (parseInt(input.value||"1",10) - 1)).toString();
    });
    card.querySelector(".plus").addEventListener("click", () => {
      input.value = Math.max(1, (parseInt(input.value||"1",10) + 1)).toString();
    });
    card.querySelector(".add").addEventListener("click", () => {
      addToCart(p.id, parseInt(input.value||"1",10));
    });
    wrap.appendChild(card);
  });
}

function addToCart(id, qty) {
  const existing = state.cart.find(it => it.id === id);
  if (existing) existing.qty += qty; else state.cart.push({ id, qty });
  saveCart();
  updateCartBadge();
}

function updateCartBadge() {
  el("#cartCount").textContent = String(cartCount());
}

function openCart() {
  renderCart();
  el("#cart").classList.remove("hidden");
}
function closeCart() {
  el("#cart").classList.add("hidden");
}

function renderCart() {
  const itemsWrap = el("#cartItems");
  itemsWrap.innerHTML = "";
  state.cart.forEach((it, idx) => {
    const p = findProduct(it.id);
    if (!p) return;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <div class="cart-info">
        <div class="title">${p.name}</div>
        <div class="sub">${currency(p.price)} • ${p.currency.toUpperCase()}</div>
        <div class="qtyline">
          <button class="minus">−</button>
          <input type="number" min="1" value="${it.qty}" />
          <button class="plus">+</button>
          <button class="remove">Remove</button>
        </div>
      </div>
      <div class="line-total">${currency(p.price * it.qty)}</div>
    `;
    const input = row.querySelector("input");
    row.querySelector(".minus").addEventListener("click", () => {
      input.value = Math.max(1, parseInt(input.value||"1",10) - 1).toString();
      state.cart[idx].qty = parseInt(input.value,10);
      saveCart(); renderCart();
    });
    row.querySelector(".plus").addEventListener("click", () => {
      input.value = Math.max(1, parseInt(input.value||"1",10) + 1).toString();
      state.cart[idx].qty = parseInt(input.value,10);
      saveCart(); renderCart();
    });
    row.querySelector(".remove").addEventListener("click", () => {
      state.cart.splice(idx, 1);
      saveCart(); renderCart(); updateCartBadge();
    });
    itemsWrap.appendChild(row);
  });
  el("#cartTotal").textContent = currency(cartTotalCents());
}

async function loadProducts() {
  const r = await fetch("/api/store/products");
  const j = await r.json().catch(() => ({ ok:false }));
  if (!j.ok) throw new Error("products_failed");
  state.products = j.products || [];
  renderProducts();
}

async function checkout() {
  try {
    el("#cartMsg").textContent = "";
    if (!state.cart.length) return;
    const body = { items: state.cart.map(it => ({ id: it.id, quantity: it.qty })) };
    const r = await fetch("/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      throw new Error(j?.error || "checkout_failed");
    }
    // If Stripe returned a URL, redirect the browser
    if (j.url) {
      window.location.href = j.url;
      return;
    }
    el("#cartMsg").textContent = "Unexpected response.";
  } catch (err) {
    el("#cartMsg").textContent = "Checkout failed. Please try again.";
    console.error(err);
  }
}

// Wireup
document.addEventListener("DOMContentLoaded", async () => {
  loadCart();
  updateCartBadge();

  el("#cartBtn").addEventListener("click", openCart);
  el("#closeCart").addEventListener("click", closeCart);
  el("#checkout").addEventListener("click", checkout);

  try {
    await loadProducts();
  } catch {
    el("#products").innerHTML = `<div class="error">Could not load products. Try again later.</div>`;
  }
});