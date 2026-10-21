// ===== Shared UI helpers =====
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  }
  const tabs = document.querySelectorAll('.booking-tab');
  const panels = document.querySelectorAll('.booking-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');
    });
  });
  if (window.location.hash) {
    const hash = window.location.hash.slice(1);
    const tab = document.querySelector(`.booking-tab[data-target="${hash}"]`);
    if (tab) tab.click();
  }
});

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusBadge(status) {
  const map = {
    pending_payment: 'badge-pending',
    paid: 'badge-paid',
    approved: 'badge-approved',
    rejected: 'badge-rejected'
  };
  const labels = {
    pending_payment: 'Pending Payment',
    paid: 'Paid – Awaiting Approval',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return `<span class="badge ${map[status] || ''}">${labels[status] || status}</span>`;
}

function showPaymentModal(bookingId, amount, onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Complete Payment</h3>
      <p>Amount due: <strong>${formatCurrency(amount)}</strong></p>
      <p style="font-size:0.9rem;color:#6b7280;margin:1rem 0;">This is a demo payment. In production this would integrate with Paystack / Stripe / Flutterwave.</p>
      <div class="form-group">
        <label>Card Number</label>
        <input type="text" value="4242 4242 4242 4242" readonly />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Expiry</label>
          <input type="text" value="12/28" readonly />
        </div>
        <div class="form-group">
          <label>CVV</label>
          <input type="text" value="123" readonly />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="cancelPay">Cancel</button>
        <button class="btn btn-primary" id="confirmPay">Pay Now</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelPay').onclick = () => overlay.remove();
  overlay.querySelector('#confirmPay').onclick = async () => {
    if (window.Api && localStorage.getItem('sl_token')) {
      try {
        await window.Api.payBooking(bookingId);
      } catch (e) {
        updateBookingStatus(bookingId, 'paid', { paidAt: new Date().toISOString() });
      }
    } else {
      updateBookingStatus(bookingId, 'paid', { paidAt: new Date().toISOString() });
    }
    overlay.remove();
    if (onSuccess) onSuccess();
  };
}
